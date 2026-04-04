# Blindage complet du flux soirée

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Garantir qu'aucune donnée n'est perdue pendant ou à la clôture d'une soirée, même en cas de problèmes réseau sur les appareils des CDR.

**Architecture:** 3 axes : (1) `closeEvening` refactorisé pour utiliser Firestore comme unique source de vérité, (2) indicateur de sync enrichi avec compteur de pending writes et erreurs, (3) blindage de `createOrder` pour empêcher les rejets silencieux Firestore.

**Tech Stack:** React/TypeScript, Zustand, Firebase Firestore v12.9 (persistentLocalCache + multiTab)

---

### Task 1: Refactorer `closeEvening` — 100% Firestore

**Files:**
- Modify: `repo/store.ts:554-627` (fonction closeEvening)

**Step 1: Remplacer le corps de `closeEvening`**

Remplacer TOUT le contenu du try block de `closeEvening` (lignes 558-627) par une version qui query Firestore directement. Factoriser la logique commune avec `recoverEvent`.

Le nouveau flow :

```typescript
closeEvening: async () => {
    const { currentEvent, orders: localOrders, users } = get();
    if (!currentEvent) return;
    try {
        logSync("🔒 Fermeture de la soirée");

        // ========================================
        // SOURCE DE VÉRITÉ : FIRESTORE DIRECT
        // ========================================
        const ordersSnap = await getDocs(collection(db, `events/${currentEvent.id}/orders`));
        const fsOrders = ordersSnap.docs.map(d => ({ ...d.data(), id: d.id } as Order));

        const clientsSnap = await getDocs(collection(db, `events/${currentEvent.id}/clients`));
        const fsClients = clientsSnap.docs.map(d => ({ ...d.data(), id: d.id } as Client));

        const tablesSnap = await getDocs(collection(db, `events/${currentEvent.id}/tables`));
        const fsTables = tablesSnap.docs.map(d => ({ ...d.data(), id: d.id } as Table));

        // Commandes valides pour l'historique (SERVED + SETTLED + PENDING)
        const validOrders = fsOrders.filter(o =>
            o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED || o.status === OrderStatus.PENDING
        );

        // Construire detailedHistory depuis Firestore
        const detailedHistory = validOrders.map(o => {
            const client = fsClients.find(c => c.id === o.clientId);
            const table = fsTables.find(t => t.id === o.tableId);
            const clientTable = !table && client?.tableId ? fsTables.find(t => t.id === client.tableId) : null;
            const resolvedTable = table || clientTable;
            const waiter = users.find(u => u.id === o.waiterId);
            return {
                clientName: client?.name || 'Inconnu',
                tableNumber: resolvedTable?.number || '?',
                zone: resolvedTable?.zone || 'club',
                apporteur: client?.businessProvider || '-',
                waiterName: waiter?.firstName || 'Inconnu',
                totalAmount: Number(o.totalAmount || 0),
                items: o.items.map(i => `${i.quantity}x ${i.productName} (${i.size})`),
                structuredItems: o.items.map(i => ({
                    productName: i.productName,
                    size: i.size,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                    subtotal: i.subtotal
                }))
            };
        });

        // Revenue depuis Firestore (SERVED + SETTLED)
        const firestoreRevenue = fsOrders
            .filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED)
            .reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0);

        // Revenue depuis state local (backup)
        const localRevenue = localOrders
            .filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED)
            .reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0);

        const finalRevenue = Math.max(firestoreRevenue, localRevenue);

        // ALERTE si divergence > 5% entre local et Firestore
        if (firestoreRevenue > 0 && localRevenue > 0) {
            const diff = Math.abs(firestoreRevenue - localRevenue);
            const maxVal = Math.max(firestoreRevenue, localRevenue);
            if (diff / maxVal > 0.05) {
                secureError(`[WARN] [closeEvening] Divergence CA: Firestore=${firestoreRevenue}€ vs Local=${localRevenue}€`);
                get().addNotification({
                    type: 'error',
                    title: 'ALERTE SYNC',
                    message: `Divergence CA détectée : Firestore ${firestoreRevenue}€ vs Local ${localRevenue}€. Le montant le plus élevé (${finalRevenue}€) a été retenu.`
                });
            }
        }

        // GARDE : 0€ avec des commandes valides → alerte mais on continue avec ce qu'on a
        if (finalRevenue === 0 && fsOrders.length > 0) {
            const hasValid = fsOrders.some(o =>
                o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED
            );
            if (hasValid) {
                secureError("[CRITICAL] [closeEvening] Revenue=0 avec commandes valides!");
                get().addNotification({
                    type: 'error',
                    title: 'ERREUR CLÔTURE',
                    message: `CA à 0€ malgré ${fsOrders.length} commande(s). Contactez l'administrateur.`
                });
                return;
            }
        }

        // WaiterStats depuis Firestore
        const revenueOrders = fsOrders.filter(o =>
            o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED
        );
        const waiterStatsMap = new Map<string, { revenue: number; tablesCount: number }>();
        revenueOrders.forEach(o => {
            const waiter = users.find(u => u.id === o.waiterId);
            const wName = waiter?.firstName || 'Inconnu';
            const current = waiterStatsMap.get(wName) || { revenue: 0, tablesCount: 0 };
            waiterStatsMap.set(wName, {
                revenue: current.revenue + (Number(o.totalAmount) || 0),
                tablesCount: current.tablesCount
            });
        });
        fsClients.forEach(c => {
            if (c.waiterId) {
                const waiter = users.find(u => u.id === c.waiterId);
                const wName = waiter?.firstName || 'Inconnu';
                const current = waiterStatsMap.get(wName) || { revenue: 0, tablesCount: 0 };
                waiterStatsMap.set(wName, { ...current, tablesCount: current.tablesCount + 1 });
            }
        });
        const waiterStats = Array.from(waiterStatsMap.entries())
            .map(([name, data]) => ({ name, revenue: data.revenue, tablesCount: data.tablesCount }))
            .filter(s => s.revenue > 0);

        // Écriture finale
        await updateDoc(doc(db, "events", currentEvent.id), {
            name: currentEvent.name || 'SOIRÉE DEFLOWER',
            status: "closed",
            endTime: new Date().toISOString(),
            totalRevenue: finalRevenue,
            clientCount: fsClients.length,
            orderCount: fsOrders.length,
            detailedHistory: detailedHistory,
            waiterStats: waiterStats
        });

        // ... (garder le bloc auto no-show + set({ currentEvent: null }) existant)
```

**Step 2: Vérifier le build**

Run: `npx vite build`
Expected: build success

**Step 3: Commit**

```bash
git add repo/store.ts
git commit -m "refactor: closeEvening uses Firestore as source of truth instead of local state"
```

---

### Task 2: Enrichir l'indicateur de sync avec pending writes et erreurs

**Files:**
- Modify: `repo/store.ts:44-60` (interface — ajouter `pendingWritesCount` et `syncErrorCount`)
- Modify: `repo/store.ts:218-232` (initial state)
- Modify: `repo/store.ts:380-396` (orders listener — détecter pending writes via metadata)
- Modify: `repo/components/ConnectionIndicator.tsx` (afficher pending/erreurs)

**Step 1: Ajouter les champs au store**

Dans l'interface `DeflowerState` (après `lastSyncTime`), ajouter :

```typescript
pendingWritesCount: number;
syncErrorCount: number;
```

Dans l'initial state (après `lastSyncTime: null`), ajouter :

```typescript
pendingWritesCount: 0,
syncErrorCount: 0,
```

**Step 2: Détecter les pending writes dans le listener orders**

Modifier le listener orders (ligne ~380) pour utiliser les metadata du snapshot :

```typescript
// --- Listener Orders de l'event ---
eventSubUnsubs.push(onSnapshot(
  collection(db, `events/${eventData.id}/orders`),
  { includeMetadataChanges: true },
  (s) => {
    const orders = s.docs.map(d => ({...d.data(), id: d.id} as Order));
    const pendingCount = s.docs.filter(d => d.metadata.hasPendingWrites).length;
    set({
      orders,
      lastSyncTime: new Date().toISOString(),
      pendingWritesCount: pendingCount
    });
    if (pendingCount > 0) {
      logSync(`⏳ ${pendingCount} commande(s) en attente de sync`);
    } else {
      logSync(`✅ Orders synced: ${orders.length} commandes`);
    }
  },
  (error) => {
    secureError("[ERROR] [Orders Listener] Erreur:", error);
    set(state => ({
      isOnline: false,
      syncErrorCount: state.syncErrorCount + 1
    }));
    get().addNotification({
      type: 'error',
      title: 'SYNC COMMANDES',
      message: 'Erreur synchronisation commandes'
    });
  }
));
```

**Step 3: Enrichir ConnectionIndicator**

Ajouter `pendingWritesCount` et `syncErrorCount` dans le composant. Modifier la logique de statut :

```typescript
// Dans le composant :
const { isOnline, lastSyncTime, forceResync, pendingWritesCount, syncErrorCount } = useStore();

// Modifier useMemo status :
const status = useMemo(() => {
    if (!isOnline) return STATUS_CONFIG.offline;
    if (syncErrorCount > 0) return STATUS_CONFIG.error;  // NOUVEAU
    if (pendingWritesCount > 0) return STATUS_CONFIG.pending;  // NOUVEAU
    if (lastSyncTime) {
      const diffMs = Date.now() - new Date(lastSyncTime).getTime();
      if (diffMs > SYNC_TIMEOUT_MS) return STATUS_CONFIG.slow;
    }
    return STATUS_CONFIG.online;
}, [isOnline, lastSyncTime, pendingWritesCount, syncErrorCount]);
```

Ajouter dans `STATUS_CONFIG` :

```typescript
pending: {
    color: 'orange',
    bgColor: 'bg-orange-500',
    borderColor: 'border-orange-500/30',
    textColor: 'text-orange-400',
    bgHover: 'hover:bg-orange-500/20',
    icon: AlertTriangle,
    label: 'SYNC EN COURS',
    description: 'Commandes en attente de synchronisation'
},
error: {
    color: 'red',
    bgColor: 'bg-red-500',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
    bgHover: 'hover:bg-red-500/20',
    icon: WifiOff,
    label: 'ERREUR SYNC',
    description: 'Des commandes n\'ont pas pu être synchronisées'
},
```

Dans le panel de détails, après la section Firestore, ajouter :

```tsx
{pendingWritesCount > 0 && (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2 text-orange-500">
      <AlertTriangle className="w-4 h-4" />
      <span className="text-xs font-medium">En attente</span>
    </div>
    <span className="text-xs font-semibold text-orange-400">
      {pendingWritesCount} commande(s)
    </span>
  </div>
)}
```

**Step 4: Vérifier le build**

Run: `npx vite build`
Expected: build success

**Step 5: Commit**

```bash
git add repo/store.ts repo/components/ConnectionIndicator.tsx
git commit -m "feat: sync indicator shows pending writes count and sync errors"
```

---

### Task 3: Blinder `createOrder` contre les rejets silencieux Firestore

**Files:**
- Modify: `repo/store.ts:1224-1260` (createOrder — section après les vérifications)

**Step 1: Ajouter validation pre-Firestore et détection de rejet**

Après les vérifications existantes (ligne 1224 "TOUTES VÉRIFICATIONS OK"), remplacer le bloc try/catch :

```typescript
// ==========================================
// ✅ TOUTES VÉRIFICATIONS OK - Créer commande
// ==========================================
try {
    logSync(`📝 Nouvelle commande pour client ${client.name} (table ${client.tableId})`);

    const isCdrOnOtherClient = currentUser?.role === UserRole.WAITER && !isAssignedWaiter;
    const orderNote = isCommis
        ? `[COMMIS: ${currentUser?.firstName || 'Commis'}] ${note || ''}`.trim()
        : isCdrOnOtherClient
            ? `[CDR: ${currentUser?.firstName || 'CDR'}] ${note || ''}`.trim()
            : (note || '');

    // 🛡️ BLINDAGE : Construire l'objet avec des valeurs garanties non-undefined
    // Firestore strip les champs undefined → les règles hasAll() échouent → rejet silencieux
    const safeTableId = client.tableId || '';
    const safeWaiterId = client.waiterId || '';

    if (!safeTableId || !safeWaiterId) {
        secureError(`[CRITICAL] [createOrder] Champs manquants: tableId=${safeTableId}, waiterId=${safeWaiterId}`);
        get().addNotification({
            type: 'error',
            title: 'ERREUR COMMANDE',
            message: 'Données client incomplètes (table ou serveur manquant). Réassignez le client.'
        });
        return;
    }

    const order = {
        eventId: currentEvent.id,
        clientId: cId,
        tableId: safeTableId,
        waiterId: safeWaiterId,
        items,
        note: orderNote,
        totalAmount: items.reduce((acc, i) => acc + i.subtotal, 0),
        status: OrderStatus.SERVED,
        createdAt: new Date().toISOString(),
        validatedAt: new Date().toISOString()
    };

    // 🛡️ BLINDAGE : Vérification que tous les champs requis par Firestore rules sont présents
    const requiredFields = ['eventId', 'clientId', 'tableId', 'waiterId', 'status', 'items', 'totalAmount', 'createdAt'];
    const missingFields = requiredFields.filter(f => order[f as keyof typeof order] === undefined || order[f as keyof typeof order] === null);
    if (missingFields.length > 0) {
        secureError(`[CRITICAL] [createOrder] Champs Firestore manquants: ${missingFields.join(', ')}`);
        get().addNotification({
            type: 'error',
            title: 'ERREUR COMMANDE',
            message: `Champs manquants: ${missingFields.join(', ')}. Veuillez réessayer.`
        });
        return;
    }

    await addDoc(collection(db, `events/${currentEvent.id}/orders`), order);

    // ... (garder le reste : update table status, recalculateEventRevenue, auto-confirmation réservation)
```

**Step 2: Vérifier le build**

Run: `npx vite build`
Expected: build success

**Step 3: Commit**

```bash
git add repo/store.ts
git commit -m "fix: harden createOrder with pre-Firestore field validation to prevent silent rejections"
```

---

### Ordre d'exécution

1. **Task 1** — closeEvening Firestore-first (correction racine)
2. **Task 3** — blindage createOrder (prévention)
3. **Task 2** — indicateur de sync (visibilité)
