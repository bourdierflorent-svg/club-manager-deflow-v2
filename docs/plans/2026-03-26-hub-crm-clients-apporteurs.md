# Hub CRM - Clients & Apporteurs pour Deflower

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Intégrer le Hub CRM Stargazing (customers + apporteurs) dans Deflower avec autocomplete dans les réservations et onglet Clients visible hors soirée.

**Architecture:** Ajout d'une 2ème instance Firebase (`firebaseHub.ts`) pointant sur le Hub Stargazing. Hooks de recherche (`useHubCustomerSearch`, `useHubApporteurSearch`) avec cache en mémoire. Auto-création des nouveaux clients/apporteurs dans le Hub. Onglet Clients (`HubClientsPage`) accessible aux CDR, hôtesses et admin même sans soirée active. Tout est **additif** — aucun code existant n'est modifié sauf pour ajouter les nouveaux champs optionnels et l'intégration autocomplete.

**Tech Stack:** React/TypeScript, Zustand, Firebase Firestore v12.9, Hub Firebase séparé

**RÈGLE CRITIQUE : ZÉRO CASSE** — Chaque tâche est purement additive. Les types existants ne sont qu'enrichis (champs optionnels). Les composants existants ne perdent aucune fonctionnalité. Si le Hub est inaccessible, tout continue de fonctionner.

---

### Ordre d'exécution

1. Task 1 — Types Hub + firebaseHub.ts (fondations, aucun impact UI)
2. Task 2 — Hooks de recherche + utils de création (aucun impact UI)
3. Task 3 — Autocomplete apporteurs dans ReservationsManager (évolution UI douce)
4. Task 4 — Autocomplete clients dans ReservationsManager (évolution UI douce)
5. Task 5 — HubClientsPage + visibilité hors soirée (nouveau composant)
6. Task 6 — Build + vérification finale

---

### Task 1 : Fondations — Types Hub + Firebase Hub instance

**Files:**
- Create: `repo/firebaseHub.ts`
- Modify: `repo/src/types/index.ts` (ajouter types Hub en fin de fichier)
- Modify: `repo/.env` (ajouter variables Hub)

**Step 1: Créer `repo/.env`** (ou ajouter aux variables existantes)

Ajouter les variables Hub :
```
VITE_HUB_API_KEY=AIzaSyCjyU4ZGxZNv3VJO2HpIu-FgVxzLj7vTZ0
VITE_HUB_AUTH_DOMAIN=stargazing-hub-41582894-c909e.firebaseapp.com
VITE_HUB_PROJECT_ID=stargazing-hub-41582894-c909e
VITE_HUB_STORAGE_BUCKET=stargazing-hub-41582894-c909e.firebasestorage.app
VITE_HUB_MESSAGING_SENDER_ID=460928598720
VITE_HUB_APP_ID=1:460928598720:web:c4697e1d82b2409e49a325
```

**Step 2: Créer `repo/firebaseHub.ts`**

Copie exacte de Little Room, sans auth (pas besoin) :

```typescript
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

const hubApiKey = import.meta.env.VITE_HUB_API_KEY;

let dbHub: Firestore = null!;

if (hubApiKey) {
  const hubConfig = {
    apiKey: hubApiKey,
    authDomain: import.meta.env.VITE_HUB_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_HUB_PROJECT_ID,
    storageBucket: import.meta.env.VITE_HUB_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_HUB_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_HUB_APP_ID,
  };

  const hubApp = getApps().find(a => a.name === 'hub') ?? initializeApp(hubConfig, 'hub');
  dbHub = getFirestore(hubApp);
} else {
  console.warn('[FirebaseHub] VITE_HUB_API_KEY manquante — Hub désactivé');
}

export { dbHub };
```

**Step 3: Ajouter les types Hub dans `repo/src/types/index.ts`**

En fin de fichier, APRÈS les types existants, ajouter :

```typescript
// ==========================================
// HUB CRM — Customers
// ==========================================

export type HubCustomerTag = 'vip' | 'regular' | 'blacklist' | 'watchlist';

export interface HubCustomer {
  id: string;              // "SGP-CLI-0001"
  firstName: string;
  lastName: string;
  nickname: string | null;
  displayName: string;
  displayNameSearch: string;
  phone: string | null;
  email: string | null;
  birthDate?: string | null;
  notes?: string | null;
  createdByName?: string | null;
  tags: HubCustomerTag[];
  totalVisits: number;
  totalRevenue: number;
  vipScore: number;
}

export interface HubCustomerSnapshot {
  customerId: string;
  displayName: string;
  nickname: string | null;
  tags: HubCustomerTag[];
  vipScore: number;
}

// ==========================================
// HUB CRM — Apporteurs
// ==========================================

export interface HubApporteur {
  id: string;              // "SGP-APP-0001"
  name: string;
  displayNameSearch: string;
  phone: string | null;
  email: string | null;
}

export interface HubApporteurSnapshot {
  apporteurId: string;
  name: string;
}
```

**Step 4: Enrichir les interfaces Client et Reservation (champs OPTIONNELS uniquement)**

Dans `Client` (ligne ~178, avant la `}`), ajouter :
```typescript
  customerId?: string | null;
  customerSnapshot?: HubCustomerSnapshot | null;
  apporteurId?: string | null;
  apporteurSnapshot?: HubApporteurSnapshot | null;
```

Dans `Reservation` (ligne ~288, avant la `}`), ajouter :
```typescript
  customerId?: string | null;
  customerSnapshot?: HubCustomerSnapshot | null;
  apporteurId?: string | null;
  apporteurSnapshot?: HubApporteurSnapshot | null;
```

Dans `CreateReservationData` (ligne ~299, avant la `}`), ajouter :
```typescript
  customerId?: string | null;
  customerSnapshot?: HubCustomerSnapshot | null;
  apporteurId?: string | null;
  apporteurSnapshot?: HubApporteurSnapshot | null;
```

**Step 5: Build + Commit**

```bash
npx vite build
git add repo/firebaseHub.ts repo/src/types/index.ts repo/.env
git commit -m "feat: add Hub CRM types and Firebase instance for Stargazing Hub"
```

---

### Task 2 : Hooks de recherche + utils de création

**Files:**
- Create: `repo/src/hooks/useHubCustomerSearch.ts`
- Create: `repo/src/hooks/useHubApporteurSearch.ts`
- Create: `repo/src/utils/hubCustomerCreator.ts`
- Create: `repo/src/utils/hubApporteurCreator.ts`

**Step 1: Créer `repo/src/hooks/useHubCustomerSearch.ts`**

Copie de Little Room, import adapté :

```typescript
import { useState, useCallback, useEffect, useRef } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { dbHub } from '../../firebaseHub';
import { HubCustomer } from '../types';

interface SearchState {
  results: HubCustomer[];
  isLoading: boolean;
}

export function useHubCustomerSearch() {
  const [state, setState] = useState<SearchState>({ results: [], isLoading: false });
  const allRef = useRef<HubCustomer[]>([]);
  const loadPromiseRef = useRef<Promise<void> | null>(null);

  const ensureLoaded = useCallback(async () => {
    if (!dbHub || allRef.current.length > 0) return;
    if (loadPromiseRef.current) {
      await loadPromiseRef.current;
      return;
    }
    loadPromiseRef.current = (async () => {
      try {
        const snap = await getDocs(query(collection(dbHub, 'customers'), orderBy('displayName', 'asc')));
        allRef.current = snap.docs.map(d => ({ ...d.data(), id: d.id } as HubCustomer));
      } catch (err: any) {
        console.warn('[HubCustomerSearch] Load error:', err.message);
      } finally {
        loadPromiseRef.current = null;
      }
    })();
    await loadPromiseRef.current;
  }, []);

  useEffect(() => { ensureLoaded(); }, [ensureLoaded]);

  const search = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setState({ results: [], isLoading: false });
      return;
    }
    setState(prev => ({ ...prev, isLoading: true }));
    await ensureLoaded();
    const normalized = term.trim().toLowerCase();
    const results = allRef.current.filter(c =>
      c.displayName?.toLowerCase().includes(normalized) ||
      c.nickname?.toLowerCase().includes(normalized) ||
      c.firstName?.toLowerCase().includes(normalized) ||
      c.lastName?.toLowerCase().includes(normalized) ||
      c.phone?.toLowerCase().includes(normalized) ||
      c.email?.toLowerCase().includes(normalized) ||
      c.id?.toLowerCase().includes(normalized)
    ).slice(0, 8);
    setState({ results, isLoading: false });
  }, [ensureLoaded]);

  const clear = useCallback(() => setState({ results: [], isLoading: false }), []);
  const reload = useCallback(() => { allRef.current = []; ensureLoaded(); }, [ensureLoaded]);

  return { ...state, search, clear, reload };
}
```

**Step 2: Créer `repo/src/hooks/useHubApporteurSearch.ts`**

```typescript
import { useState, useCallback, useEffect, useRef } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { dbHub } from '../../firebaseHub';
import { HubApporteur } from '../types';

interface SearchState {
  results: HubApporteur[];
  isLoading: boolean;
}

export function useHubApporteurSearch() {
  const [state, setState] = useState<SearchState>({ results: [], isLoading: false });
  const allRef = useRef<HubApporteur[]>([]);
  const loadPromiseRef = useRef<Promise<void> | null>(null);

  const ensureLoaded = useCallback(async () => {
    if (!dbHub || allRef.current.length > 0) return;
    if (loadPromiseRef.current) {
      await loadPromiseRef.current;
      return;
    }
    loadPromiseRef.current = (async () => {
      try {
        const snap = await getDocs(query(collection(dbHub, 'apporteurs'), orderBy('name', 'asc')));
        allRef.current = snap.docs.map(d => ({ ...d.data(), id: d.id } as HubApporteur));
      } catch (err: any) {
        console.warn('[HubApporteurSearch] Load error:', err.message);
      } finally {
        loadPromiseRef.current = null;
      }
    })();
    await loadPromiseRef.current;
  }, []);

  useEffect(() => { ensureLoaded(); }, [ensureLoaded]);

  const search = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setState({ results: [], isLoading: false });
      return;
    }
    setState(prev => ({ ...prev, isLoading: true }));
    await ensureLoaded();
    const normalized = term.trim().toLowerCase();
    const results = allRef.current.filter(a =>
      a.name?.toLowerCase().includes(normalized) ||
      a.displayNameSearch?.includes(normalized) ||
      a.id?.toLowerCase().includes(normalized)
    ).slice(0, 8);
    setState({ results, isLoading: false });
  }, [ensureLoaded]);

  const clear = useCallback(() => setState({ results: [], isLoading: false }), []);
  const reload = useCallback(() => { allRef.current = []; ensureLoaded(); }, [ensureLoaded]);

  return { ...state, search, clear, reload };
}
```

**Step 3: Créer `repo/src/utils/hubCustomerCreator.ts`**

Adapté de Little Room — `createdFromClub: 'ClubB'` pour Deflower, vérification ID libre :

```typescript
import {
  doc, setDoc, getDoc, collection, getDocs, query, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import { dbHub } from '../../firebaseHub';
import { HubCustomerSnapshot } from '../types';

async function getNextFreeHubId(): Promise<string> {
  const snap = await getDocs(
    query(collection(dbHub, 'customers'), orderBy('id', 'desc'), limit(100))
  );
  const nums = snap.docs
    .map(d => parseInt((d.data().id as string ?? '').replace('SGP-CLI-', ''), 10))
    .filter(n => !isNaN(n));
  let next = (nums.length > 0 ? Math.max(...nums) : 0) + 1;

  // Vérifier que l'ID est libre (protection contre les doublons entre clubs)
  let candidate = `SGP-CLI-${String(next).padStart(4, '0')}`;
  const existingDoc = await getDoc(doc(dbHub, 'customers', candidate));
  while (existingDoc.exists()) {
    next++;
    candidate = `SGP-CLI-${String(next).padStart(4, '0')}`;
    const check = await getDoc(doc(dbHub, 'customers', candidate));
    if (!check.exists()) break;
  }
  return candidate;
}

interface CreateHubCustomerParams {
  firstName: string;
  lastName: string;
  nickname?: string | null;
  phone?: string | null;
  createdByName?: string | null;
}

interface CreateHubCustomerResult {
  customerId: string;
  snapshot: HubCustomerSnapshot;
}

export async function createHubCustomerAuto(
  params: CreateHubCustomerParams
): Promise<CreateHubCustomerResult> {
  const firstName = params.firstName.trim();
  const lastName = params.lastName.trim();
  const displayName = `${firstName} ${lastName}`;
  const nickname = params.nickname?.trim() || null;
  const newId = await getNextFreeHubId();

  await setDoc(doc(dbHub, 'customers', newId), {
    id: newId,
    firstName,
    lastName,
    nickname,
    displayName,
    displayNameSearch: displayName.toLowerCase(),
    phone: params.phone?.trim() || null,
    email: null,
    birthDate: null,
    notes: null,
    createdByName: params.createdByName?.trim() || null,
    tags: [],
    totalVisits: 0,
    totalRevenue: 0,
    vipScore: 0,
    createdFromHub: false,
    createdFromClub: 'ClubB',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    customerId: newId,
    snapshot: {
      customerId: newId,
      displayName,
      nickname,
      tags: [],
      vipScore: 0,
    },
  };
}
```

**Step 4: Créer `repo/src/utils/hubApporteurCreator.ts`**

```typescript
import {
  doc, setDoc, getDoc, collection, getDocs, query, orderBy, limit,
} from 'firebase/firestore';
import { dbHub } from '../../firebaseHub';
import { HubApporteurSnapshot } from '../types';

async function getNextFreeApporteurId(): Promise<string> {
  const snap = await getDocs(
    query(collection(dbHub, 'apporteurs'), orderBy('id', 'desc'), limit(100))
  );
  const nums = snap.docs
    .map(d => parseInt((d.data().id as string ?? '').replace('SGP-APP-', ''), 10))
    .filter(n => !isNaN(n));
  let next = (nums.length > 0 ? Math.max(...nums) : 0) + 1;

  let candidate = `SGP-APP-${String(next).padStart(4, '0')}`;
  const existingDoc = await getDoc(doc(dbHub, 'apporteurs', candidate));
  while (existingDoc.exists()) {
    next++;
    candidate = `SGP-APP-${String(next).padStart(4, '0')}`;
    const check = await getDoc(doc(dbHub, 'apporteurs', candidate));
    if (!check.exists()) break;
  }
  return candidate;
}

interface CreateHubApporteurResult {
  apporteurId: string;
  snapshot: HubApporteurSnapshot;
}

export async function createHubApporteurAuto(
  params: { name: string }
): Promise<CreateHubApporteurResult> {
  const name = params.name.trim().toUpperCase();
  const newId = await getNextFreeApporteurId();

  await setDoc(doc(dbHub, 'apporteurs', newId), {
    id: newId,
    name,
    displayNameSearch: name.toLowerCase(),
    phone: null,
    email: null,
    clubs: [],
    totalRevenue: 0,
    revenueByClub: {},
    totalReservations: 0,
    reservationsByClub: {},
    clientCount: 0,
  });

  return {
    apporteurId: newId,
    snapshot: { apporteurId: newId, name },
  };
}
```

**Step 5: Build + Commit**

```bash
npx vite build
git add repo/src/hooks/useHubCustomerSearch.ts repo/src/hooks/useHubApporteurSearch.ts repo/src/utils/hubCustomerCreator.ts repo/src/utils/hubApporteurCreator.ts
git commit -m "feat: add Hub search hooks and auto-create utils for customers and apporteurs"
```

---

### Task 3 : Autocomplete apporteurs dans ReservationsManager

**Files:**
- Modify: `repo/components/ReservationsManager.tsx` (le formulaire de création de réservation)

**Principe : Remplacement minimal** — le champ texte libre `businessProvider` devient un champ avec autocomplete dropdown. Le reste du formulaire ne change pas.

**Step 1: Importer le hook et le creator**

En haut du fichier, ajouter :
```typescript
import { useHubApporteurSearch } from '../src/hooks/useHubApporteurSearch';
import { createHubApporteurAuto } from '../src/utils/hubApporteurCreator';
```

**Step 2: Dans le composant, ajouter le hook et le state lié**

Après les states existants du formulaire :
```typescript
const apporteurSearch = useHubApporteurSearch();
const [showApporteurSuggestions, setShowApporteurSuggestions] = useState(false);
const [selectedApporteurId, setSelectedApporteurId] = useState<string | null>(null);
```

**Step 3: Remplacer l'input businessProvider** par un champ autocomplete

Remplacer le `<input>` du businessProvider (le champ "Apporteur d'affaires") par :
```tsx
<div className="relative">
  <input
    type="text"
    value={formData.businessProvider}
    onChange={e => {
      const val = e.target.value.toUpperCase();
      setFormData({ ...formData, businessProvider: val });
      setSelectedApporteurId(null);
      apporteurSearch.search(val);
      setShowApporteurSuggestions(true);
    }}
    onFocus={() => {
      if (formData.businessProvider.length >= 2) {
        apporteurSearch.search(formData.businessProvider);
        setShowApporteurSuggestions(true);
      }
    }}
    onBlur={() => setTimeout(() => setShowApporteurSuggestions(false), 200)}
    placeholder="Nom de l'apporteur"
    className={/* garder les classes existantes */}
  />
  {showApporteurSuggestions && apporteurSearch.results.length > 0 && (
    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
      {apporteurSearch.results.map(a => (
        <button
          key={a.id}
          type="button"
          onMouseDown={e => {
            e.preventDefault();
            setFormData({ ...formData, businessProvider: a.name });
            setSelectedApporteurId(a.id);
            setShowApporteurSuggestions(false);
            apporteurSearch.clear();
          }}
          className="w-full text-left px-4 py-2.5 hover:bg-zinc-800 transition-colors flex items-center justify-between"
        >
          <span className="text-white font-semibold text-sm uppercase">{a.name}</span>
          <span className="text-zinc-500 text-[10px]">{a.id}</span>
        </button>
      ))}
    </div>
  )}
  {/* Option créer nouveau si pas de match et texte >= 2 chars */}
  {showApporteurSuggestions && apporteurSearch.results.length === 0 && formData.businessProvider.length >= 2 && !apporteurSearch.isLoading && (
    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-lg">
      <button
        type="button"
        onMouseDown={async e => {
          e.preventDefault();
          try {
            const result = await createHubApporteurAuto({ name: formData.businessProvider });
            setSelectedApporteurId(result.apporteurId);
            setShowApporteurSuggestions(false);
            apporteurSearch.reload();
          } catch (err) {
            console.warn('[Apporteur] Auto-create failed:', err);
          }
        }}
        className="w-full text-left px-4 py-2.5 hover:bg-zinc-800 transition-colors text-emerald-400 text-sm font-semibold"
      >
        + Créer "{formData.businessProvider}"
      </button>
    </div>
  )}
</div>
```

**Step 4: Passer l'apporteurId dans le submit**

Dans la fonction de submit du formulaire, si `selectedApporteurId` existe, l'inclure dans les données de réservation. Modifier l'appel `createReservation` pour passer `apporteurId` et `apporteurSnapshot`.

**Step 5: Build + Commit**

```bash
npx vite build
git commit -m "feat: autocomplete apporteurs in reservation form with Hub search"
```

---

### Task 4 : Autocomplete clients dans ReservationsManager

**Files:**
- Modify: `repo/components/ReservationsManager.tsx`

**Même pattern que Task 3** mais pour le champ `clientName` :

**Step 1: Importer**
```typescript
import { useHubCustomerSearch } from '../src/hooks/useHubCustomerSearch';
import { createHubCustomerAuto } from '../src/utils/hubCustomerCreator';
```

**Step 2: Hook et state**
```typescript
const customerSearch = useHubCustomerSearch();
const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
```

**Step 3: Remplacer l'input clientName**

Même pattern autocomplete. Quand un customer Hub est sélectionné :
- Pré-remplir `phoneNumber` si disponible
- Stocker `customerId` pour le passer à la réservation

Quand aucun match et submit : auto-créer le customer dans le Hub (non-bloquant).

**Step 4: Passer customerId dans le submit**

**Step 5: Build + Commit**

```bash
git commit -m "feat: autocomplete clients in reservation form with Hub customer search"
```

---

### Task 5 : HubClientsPage + visibilité hors soirée

**Files:**
- Create: `repo/components/HubClientsPage.tsx`
- Modify: `repo/App.tsx` (ajouter onglet Clients dans les vues hors-soirée)

**Step 1: Créer `repo/components/HubClientsPage.tsx`**

Adapter le composant de Little Room au contexte Deflower :
- Même structure : liste + détail
- Recherche locale en mémoire
- Détail client avec visites et notes
- CLUB_LABELS adapté : `{ ClubA: 'Little Room', ClubB: 'Deflower', ClubC: 'Giulia' }`
- Style cohérent avec Deflower (bg-[#0a0a0a], zinc, etc.)
- Import depuis `../../firebaseHub` (pas `../../store`)

**Step 2: Modifier `repo/App.tsx` — Ajouter l'onglet Clients**

Dans `WaiterNoEventView` (ligne 99), ajouter un 3ème tab `'clients'` :
```typescript
const [activeTab, setActiveTab] = useState<'resa' | 'recap' | 'clients'>('resa');
```

Ajouter un bouton tab "Clients" et le contenu :
```tsx
{activeTab === 'clients' && (
  <Suspense fallback={<LoadingScreen />}>
    <HubClientsPage />
  </Suspense>
)}
```

Dans la vue hors-soirée des autres rôles (manager, barmaid — ligne 370), ajouter le même onglet Clients.

Pour l'admin : il a déjà toutes les vues via AdminDashboard. Ajouter un onglet Clients dans son dashboard.

Pour l'hôtesse : elle a déjà accès à son dashboard complet. Ajouter l'onglet Clients dans HostessDashboard.

**Step 3: Lazy load**

En haut de App.tsx :
```typescript
const HubClientsPage = lazy(() => import('./components/HubClientsPage'));
```

**Step 4: Build + Commit**

```bash
npx vite build
git commit -m "feat: add HubClientsPage visible to CDR, hostess and admin without active evening"
```

---

### Task 6 : Vérification finale

**Step 1: Build production**
```bash
npx vite build
```
Expected: success, pas d'erreur TypeScript

**Step 2: Checklist manuelle**
- [ ] L'app démarre sans soirée active
- [ ] CDR voit l'onglet Clients + Réservations
- [ ] Hôtesse voit l'onglet Clients
- [ ] Admin voit tout
- [ ] Formulaire réservation : autocomplete apporteur fonctionne
- [ ] Formulaire réservation : autocomplete client fonctionne
- [ ] Créer un nouvel apporteur non existant → créé dans le Hub
- [ ] Créer un nouveau client non existant → créé dans le Hub
- [ ] Si Hub inaccessible : les formulaires fonctionnent toujours en mode texte libre
- [ ] Ouvrir une soirée : tout fonctionne normalement
- [ ] Clôturer une soirée : tout fonctionne normalement

**Step 3: Commit final + push**
```bash
git add -A
git commit -m "feat: complete Hub CRM integration - clients, apporteurs, autocomplete"
git push
```
