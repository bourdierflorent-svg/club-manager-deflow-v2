# Import Deflower Jan-Fév 2026

## Contexte
L'application Deflower est utilisée depuis le 4 mars 2026. Les soirées de janvier et février doivent être rattrapées à partir d'un fichier Excel (`deflow_recap_janfev (1).xlsx`).

## Approche
Script Node.js `deflow-import/import-deflow-janfev.cjs` calqué sur `lr-import/import-history.cjs`.

### Input
- Fichier Excel, sheet "Récap Complet"
- Colonnes : Date, Table, Client, Consommation, Apporteur, Total

### Output (par soirée)
Un document `/events/{eventId}` avec :
- `date` (YYYY-MM-DD), `name: "SOIRÉE DEFLOWER"`, `status: "closed"`
- `totalRevenue` : somme des totaux
- `detailedHistory[]` : un entry par ligne Excel valide
- `waiterStats: []`
- `importedFrom: "excel_deflow_janfev"`
- Pas de sous-collections (ni clients, ni orders)

### Entry detailedHistory
```js
{
  clientName: "NADAV",
  tableNumber: "22",           // null si table inconnue
  zone: "club",
  apporteur: "STEVE",
  apporteurId: "SGP-APP-xxx",  // si match HUB
  customerId: "SGP-CLI-xxx",   // match ou création HUB
  customerSnapshot: { ... },
  waiterName: "",
  totalAmount: 1280,
  items: ["1x Altius Magnum", "3x Redbull (x4)"]
}
```

## Logique de traitement

1. **Grouper** les lignes par date → une soirée par date unique
2. **Filtrer** : ignorer les lignes sans consommation OU sans total
3. **Matcher apporteurs** avec HUB `/apporteurs/` par nom (insensible casse). Pas de match → nom texte seul
4. **Matcher clients** avec HUB `/customers/` par nom (insensible casse). Pas de match → **créer** un nouveau customer HUB avec prochain ID `SGP-CLI-XXXX`
5. **Mapper consommations** : parser le texte en items. Matcher avec catalogue produits si possible, sinon texte brut
6. **Vérifier tables** : si numéro existe dans INITIAL_TABLES → garder. Sinon → `null`
7. **Déduplication** : skip si event closed existe déjà pour cette date

## Sécurité
- `--dry-run` par défaut : rapport complet sans écriture
- Flag `importedFrom` sur chaque event
- Aucune exclusion de noms clients (PASSAGE, PHONE, etc. traités si conso + total présents)

## Décisions
- Pas de sous-collections clients/orders
- Pas de création de produits manquants (CODIGO, Jack Fire, etc.) → texte brut dans items
- BACARDI / BACARDI 8 ans → Bacardi Reserva 8
- Toutes les tables sont zone "club"
- Le user fait la fusion/lien des customers HUB manuellement après import
