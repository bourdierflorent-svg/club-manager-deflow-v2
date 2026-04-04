# UI Refonte "Linear x Stripe" Dark Mode

## Contexte
Passer d'un style "glassmorphism AI template" a un style SaaS pro (Linear/Vercel + Stripe Dashboard). Dark mode noir et blanc conserve. Sidebar non modifiee.

## Principes
- Borders nettes, pas de blur/glow/shimmer
- Typographie sobre (font-semibold, pas font-black uppercase)
- Hierarchy par la couleur, pas par les ombres
- Border-radius reduits (xl=12px pour cards, lg=8px pour boutons)
- Palette zinc (zinc-950, zinc-900, zinc-800) au lieu de #0a0a0a/#111/#1a1a1a arbitraires

## Scope
1. CSS global (index.css) - supprimer glass/glow/shimmer, nouveaux tokens
2. Composants partages (StatCard, TableCard, ClientCard, OrderCard)
3. Layout.tsx (header)
4. WaiterDashboard (priorite 1)
5. AdminDashboard (priorite 2)
6. HostessDashboard (priorite 3)
7. Reste (ManagerDashboard, BarmaidDashboard, ViewerDashboard, ReservationsManager, modals)

## Contraintes
- Sidebar inchangee
- TableMap inchange
- Logique metier inchangee
- Couleurs semantiques conservees (emerald, amber, red, blue, violet)
- DA noir et blanc conservee
