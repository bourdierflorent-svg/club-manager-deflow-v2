# Fix clôture soirée à 0€ + récupération données

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corriger le bug de clôture de soirée avec données perdues (totalRevenue=0, detailedHistory=[]) et récupérer la soirée du 25 mars 2026.

**Architecture:** 3 corrections indépendantes : (1) fonction de récupération d'event depuis les sous-collections Firestore, (2) sécurisation de `closeEvening` avec calcul local + garde de sécurité, (3) ajout des règles Firestore manquantes pour `/caisses`.

**Tech Stack:** React/TypeScript, Zustand, Firebase Firestore v12.9

---

### Task 1: Ajouter la fonction `recoverEvent` dans le store

**Files:**
- Modify: `repo/store.ts:44-120` (interface DeflowerState — ajouter la signature)
- Modify: `repo/store.ts:1687` (zone des fonctions archive — ajouter l'implémentation)

**Step 1: Ajouter la signature dans l'interface**

Dans `DeflowerState` (après `deleteArchivedRecapEntry`), ajouter :

```typescript
recoverEvent: (eventId: string) => Promise<void>;
```

**Step 2: Implémenter `recoverEvent`**

Après `deleteArchivedRecapEntry` (vers ligne 1864), ajouter :

```typescript
recoverEvent: async (eventId: string) => {
  try {
    // 1. Lire les commandes depuis la sous-collection Firestore
    const ordersSnap = await getDocs(collection(db, `events/${eventId}/orders`));
    const orders = ordersSnap.docs.map(d => ({ ...d.data(), id: d.id } as Order));

    // 2. Lire les clients depuis la sous-collection Firestore
    const clientsSnap = await getDocs(collection(db, `events/${eventId}/clients`));
    const clients = clientsSnap.docs.map(d => ({ ...d.data(), id: d.id } as Client));

    // 3. Lire les tables depuis la sous-collection Firestore
    const tablesSnap = await getDocs(collection(db, `events/${eventId}/tables`));
    const tables = tablesSnap.docs.map(d => ({ ...d.data(), id: d.id } as Table));

    // 4. Filtrer les commandes valides (SERVED + SETTLED + PENDING)
    const validOrders = orders.filter(o =>
      o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED || o.status === OrderStatus.PENDING
    );

    // 5. Reconstruire detailedHistory
    const detailedHistory = validOrders.map(o => {
      const client = clients.find(c => c.id === o.clientId);
      const table = tables.find(t => t.id === o.tableId);
      const clientTable = !table && client?.tableId ? tables.find(t => t.id === client.tableId) : null;
      const resolvedTable = table || clientTable;
      const users = get().users;
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

    // 6. Recalculer totalRevenue (SERVED + SETTLED uniquement)
    const totalRevenue = orders
      .filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED)
      .reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0);

    // 7. Recalculer waiterStats
    const users = get().users;
    const waiterStatsMap = new Map<string, { revenue: number; tablesCount: number }>();
    validOrders.forEach(o => {
      const waiter = users.find(u => u.id === o.waiterId);
      const wName = waiter?.firstName || 'Inconnu';
      const current = waiterStatsMap.get(wName) || { revenue: 0, tablesCount: 0 };
      waiterStatsMap.set(wName, {
        revenue: current.revenue + (Number(o.totalAmount) || 0),
        tablesCount: current.tablesCount
      });
    });
    // Compter les tables par serveur
    clients.forEach(c => {
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

    // 8. Mettre à jour le document event
    await updateDoc(doc(db, "events", eventId), {
      totalRevenue,
      detailedHistory,
      waiterStats,
      orderCount: orders.length,
      clientCount: clients.length
    });

    get().addNotification({
      type: 'success',
      title: 'SOIRÉE RÉCUPÉRÉE',
      message: `${validOrders.length} commandes récupérées — CA: ${totalRevenue}€`
    });
    secureLog(`[recoverEvent] Event ${eventId} recovered: ${totalRevenue}€, ${validOrders.length} orders, ${clients.length} clients`);

  } catch (e) {
    secureError("[ERROR] [recoverEvent] Error:", e);
    get().addNotification({ type: 'error', title: 'ERREUR RÉCUPÉRATION', message: 'Impossible de récupérer la soirée' });
  }
},
```

**Step 3: Ajouter le bouton de récupération dans AdminDashboard**

Dans `repo/components/AdminDashboard.tsx`, dans le modal de détail d'archive (`selectedArchive`), ajouter un bouton "Recalculer" quand `totalRevenue === 0` et `orderCount > 0`.

Ajouter `recoverEvent` dans le destructuring du store (ligne 33), puis un bouton conditionnel dans la zone des boutons d'export (vers ligne 870) :

```tsx
{selectedArchive.totalRevenue === 0 && (selectedArchive.orderCount || 0) > 0 && (
  <button
    onClick={async () => {
      await recoverEvent(selectedArchive.id);
      const updated = useStore.getState().pastEvents.find(e => e.id === selectedArchive.id);
      if (updated) setSelectedArchive(updated);
    }}
    className="flex items-center gap-2 bg-amber-600/20 text-amber-400 px-6 py-3 rounded-xl font-medium uppercase text-xs hover:bg-amber-600/30 transition-all"
  >
    <RefreshCw className="w-4 h-4" /> Recalculer
  </button>
)}
```

**Step 4: Vérifier**

Ouvrir l'app, aller sur le récap de la soirée du 25 mars, cliquer "Recalculer". Vérifier que les commandes et le CA apparaissent.

**Step 5: Commit**

```bash
git add repo/store.ts repo/components/AdminDashboard.tsx
git commit -m "feat: add recoverEvent function to rebuild archived events from Firestore sub-collections"
```

---

### Task 2: Sécuriser `closeEvening` avec calcul local + garde de sécurité

**Files:**
- Modify: `repo/store.ts:545-614` (fonction closeEvening)
- Modify: `repo/store.ts:140-202` (fonction recalculateEventRevenue)

**Step 1: Ajouter un calcul local de revenue dans `closeEvening`**

Remplacer les lignes 580-582 de `closeEvening` :

```typescript
// AVANT (fragile - dépend uniquement de Firestore)
await recalculateEventRevenue(currentEvent.id);
const finalEventDoc = await getDoc(doc(db, "events", currentEvent.id));
const finalRevenue = Number(finalEventDoc.data()?.totalRevenue || 0);
```

Par :

```typescript
// Calcul LOCAL du revenue (source de vérité : state local)
const localRevenue = orders
    .filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED)
    .reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0);

// Calcul FIRESTORE (tentative de sync)
let firestoreRevenue = 0;
try {
    await recalculateEventRevenue(currentEvent.id);
    const finalEventDoc = await getDoc(doc(db, "events", currentEvent.id));
    firestoreRevenue = Number(finalEventDoc.data()?.totalRevenue || 0);
} catch (e) {
    secureError("[WARN] [closeEvening] Firestore recalculate failed, using local:", e);
}

// Utiliser le max des deux (si l'un échoue, l'autre prend le relais)
const finalRevenue = Math.max(localRevenue, firestoreRevenue);

// 🛡️ GARDE DE SÉCURITÉ : bloquer si 0€ avec des commandes
if (finalRevenue === 0 && orders.length > 0) {
    const hasValidOrders = orders.some(o =>
        o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED
    );
    if (hasValidOrders) {
        secureError("[CRITICAL] [closeEvening] Revenue=0 mais commandes valides détectées!");
        get().addNotification({
            type: 'error',
            title: 'ERREUR CLÔTURE',
            message: `Impossible de clôturer : le CA calculé est 0€ alors qu'il y a ${orders.length} commande(s). Contactez l'administrateur.`
        });
        return;
    }
}
```

**Step 2: Ajouter une notification d'erreur visible dans `recalculateEventRevenue`**

Dans la fonction `recalculateEventRevenue` (ligne 199-201), remplacer le catch silencieux :

```typescript
// AVANT (silencieux)
} catch (error) {
    secureError('[recalculateEventRevenue] Erreur recalcul CA:', error);
}
```

Par :

```typescript
} catch (error) {
    secureError('[recalculateEventRevenue] Erreur recalcul CA:', error);
    // Notification visible pour le debugging
    try {
        const store = useStore.getState();
        store.addNotification({
            type: 'error',
            title: 'SYNC CA',
            message: 'Erreur de synchronisation du chiffre d\'affaires'
        });
    } catch (_) { /* ignore si store pas dispo */ }
}
```

**Step 3: Vérifier**

Relire le code pour s'assurer que le flow est correct : calcul local → calcul Firestore → max des deux → garde de sécurité → écriture.

**Step 4: Commit**

```bash
git add repo/store.ts
git commit -m "fix: secure closeEvening with local revenue fallback and safety guard against 0€ closure"
```

---

### Task 3: Ajouter les règles Firestore pour `/caisses`

**Files:**
- Modify: `repo/firestore.rules:186` (avant le catch-all)

**Step 1: Ajouter les règles**

Avant la règle catch-all `match /{document=**}` (ligne 191), ajouter :

```
    // ──────────────────────────────────────────────────
    // CAISSES – données de caisse par soirée
    // ──────────────────────────────────────────────────
    match /caisses/{eventId} {
      allow read: if true;

      allow create: if request.resource.data.eventId is string
                    && request.resource.data.vestiaire is number
                    && request.resource.data.caSalle is number
                    && request.resource.data.bar is number;

      allow update: if request.resource.data.vestiaire is number
                    && request.resource.data.caSalle is number
                    && request.resource.data.bar is number;

      allow delete: if true;
    }
```

**Step 2: Commit**

```bash
git add repo/firestore.rules
git commit -m "fix: add missing Firestore rules for /caisses collection"
```

---

### Ordre d'exécution

1. **Task 1** (récupération) — priorité absolue, récupérer la soirée perdue
2. **Task 2** (sécurisation closeEvening) — empêcher que ça se reproduise
3. **Task 3** (règles caisses) — bug indépendant, fix rapide
