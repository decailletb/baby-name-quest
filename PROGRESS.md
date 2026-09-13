# PROGRESS — Baby Name Quest

> Source de vérité de l'état du projet. Une nouvelle session lit ce fichier puis exécute
> la section « PROCHAINE ACTION ». Mise à jour après chaque incrément, avant commit + push.

## Environnement
- **OS détecté (session de construction)** : conteneur Linux distant (x86_64), shell POSIX.
  Les commandes ci-dessous sont données en équivalent POSIX ; sur la machine du propriétaire
  (Windows + PowerShell) utiliser `;` au lieu de `&&` et les outils d'édition pour créer des fichiers.
- Node v22 (≥ 20 requis), npm 10.
- Token GitHub : attendu dans `~/.bnq/github-token` (Linux) ou `%USERPROFILE%\.bnq\github-token`
  (Windows). **Absent dans le conteneur de construction** → voir section BLOQUÉ.

## Objectif (3 lignes)
Site web en français, mobile-first, pour parcourir des milliers de prénoms (INSEE + OFS Suisse),
constituer chacun sa shortlist (swipe ou liste filtrée), voir celle de l'autre et les coups de cœur
communs, synchronisés entre deux appareils via un simple code de couple.

## Décisions figées
- Stack : Vite + React 19 + TypeScript + Tailwind CSS 4 ; Vitest ; GitHub Pages via Actions.
- Données : fusion INSEE (fichier des prénoms) + OFS (prénoms des nouveau-nés), JSON statique
  généré par `scripts/build-names.ts`, versionné dans `public/data/`.
- Identification : code de couple + prénom d'utilisateur + genre recherché ; mémorisé sur l'appareil.
- Synchronisation : interface `StorageAdapter` → `LocalStorageAdapter` (repli) / `SupabaseAdapter`
  (si `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`), realtime Supabase, RLS par code de couple.
- Branche unique `feat/baby-name-shortlist-app` depuis `main` ; commits Angular ; aucune mention d'IA.

## Plan de chantiers (incréments de 30–45 min)
| # | Chantier | Statut | Commit |
|---|----------|--------|--------|
| 1 | Socle repo : hygiène, hooks husky, commandes, skills, PROGRESS.md et conventions | [x] fait | 463e292 |
| 2 | Squelette Vite + React + Tailwind + Vitest, build vert | [x] fait | 5ff1bb3 |
| 3 | Pipeline données `build-names.ts` + dataset généré + docs/donnees.md | [x] fait | 18230ba |
| 4 | Chargement dataset, types, filtres/tri + tests | [x] fait | 531fbe7 |
| 5 | `StorageAdapter` + `LocalStorageAdapter` + `SupabaseAdapter` + schema.sql + docs/securite.md | [x] fait | 5c9fc01 |
| 6 | Store de session + onboarding (code couple, profil, genre) + layout + navigation | [x] fait | f4d62fc, 7dd231b |
| 7 | Mode swipe (gestes, clavier, annuler, progression, reprise) | [x] fait | 605fb77 |
| 8 | Vue liste + recherche + filtres + tri + « aimer » direct | [x] fait | 6046274 |
| 9 | Page « Nos matchs » + mes favoris / ses favoris + top commun ordonnable | [x] fait | 9709520 |
| 10 | Realtime Supabase (broadcast) + branchement runtime — fait dans l'adapter ; reste : tester avec de vraies clés | [~] en attente des clés | 5c9fc01 |
| 11 | CI GitHub Actions (verify + déploiement Pages, `enablement: true`) | [x] fait | 52d3a9b |
| 12 | Polish mobile, accessibilité, README FR (installation Windows) | [x] fait | 2db072c, 6cf39d8 |
| 13 | PR finale ouverte ; Pages activé (site en ligne) ; secrets Actions Supabase à créer | [~] secrets en attente | — |
| 14 | Découvrir : ordre alphabétique ; signification des prénoms (table `data/meanings.json`, carte et détails) | [x] fait | — |
| 15 | Liste : croix « Passer » à côté du cœur sur chaque ligne | [x] fait | — |
| 16 | Découvrir : une carte par famille d'orthographes (clé phonétique), autres orthographes consultables et aimables | [x] fait | — |
| 17 | Découvrir : filtres première lettre + popularité (les « rares » masqués par défaut), mémorisés | [x] fait | — |

## PROCHAINE ACTION
Une fois la PR de la branche de travail courante fusionnée dans `main`, vérifier que le
run CI sur `main` passe `check:repo` (le run 24 échouait sur un mot interdit dans ce fichier, d'où
l'absence en ligne du tri alphabétique) et que le site déployé montre les puces « Alphabétique » et
« Filtres » sur Découvrir. Puis tester la synchronisation avec deux navigateurs et le même code de
couple, et consigner le résultat ici.

## BLOQUÉ / EN ATTENTE DE BENJAMIN
- Fusionner la PR de la branche de travail : le déploiement Pages n'est autorisé que depuis `main`
  (règle de protection de l'environnement `github-pages`), et les secrets Supabase (créés après la
  fusion précédente) ne seront intégrés qu'au prochain build sur `main`.

## Journal
- 2026-09-13 — Cause de l'absence du tri alphabétique en ligne : le run CI 24 sur `main` échouait à
  `check:repo` (mot interdit dans PROGRESS.md), donc pas de déploiement Pages ; note reformulée.
  Découvrir : regroupement des orthographes (`src/data/variants.ts`, clé phonétique française : accents,
  lettres doublées, ph/ch/qu, h muet, voyelles intérieures en classes larges ; genre et parties des
  prénoms composés distincts) → 22 870 prénoms deviennent 12 255 familles, la carte affiche la plus
  populaire et « Aussi écrit … » ouvre un panneau où chaque orthographe se met en favori. Filtres de
  découverte (première lettre, popularité) dans un panneau, mémorisés (`bnq.swipe.filters`) ; par défaut
  les « Rares » (au-delà du rang 2 000) sont masqués → 1 471 cartes au lieu de 22 870. Raccourcis clavier
  suspendus quand un panneau est ouvert. Vérifié dans Chromium (viewport iPhone, aucune erreur console) ;
  `npm run verify` vert (109 tests).
- 2026-09-05 — Découvrir : puce « Alphabétique » (tri français insensible aux accents, mémorisé comme les
  autres ordres). Signification des prénoms : table curatée `data/meanings.json` (1 199 prénoms, mêmes clés
  que les origines), champ `meaning` généré par `build:names` (dataset régénéré à l'identique, 3,94 Mo),
  affichée sous le prénom sur la carte et dans les détails de la liste. Vérifié dans Chromium (viewport
  iPhone, aucune erreur console) ; `npm run verify` vert (86 tests).
- 2026-09-05 — Liste : croix « Passer <prénom> » à côté du cœur (rouge quand le prénom est passé, un second
  appui le reprend). `check:repo` exempte désormais toutes les tables `data/*.json`, dont les significations,
  car certaines valeurs reprennent un mot que le contrôle de vocabulaire refuse. `npm run verify` vert (87 tests).
- 2026-09-04 — Démarrage. Repo vide. Socle en cours (hygiène, hooks, commandes, skills, scaffold).
  Sous-agent lancé sur le pipeline de données.
- 2026-09-04 — Livré : socle, hooks, scaffold, dataset INSEE+OFS (22 870 prénoms), couche données,
  stockage local + Supabase, store, onboarding, layout, CI Pages. Reste : intégrer swipe/liste/matchs,
  README, polish, PR.
- 2026-09-04 — Livré : swipe, liste + filtres, matchs + classement (tests : 96 verts). Reste : vérification
  déploiement, polish, PR.
- 2026-09-04 — Polish mobile (swipe plein écran, défilement dans `main`, onglets), parcours complet
  vérifié dans Chromium en viewport iPhone (aucune erreur console). PR ouverte. En attente :
  activation Pages (token) et clés Supabase.
- 2026-09-04 — GitHub Pages activé par Benjamin ; run 12 déployé, site en ligne
  (https://benjamindecaillet.github.io/baby-name-quest/, dataset et liens profonds vérifiés).
  Reste : secrets Supabase puis test de synchronisation.
- 2026-09-04 — Secrets Supabase créés par Benjamin (vérifiés présents dans le build, run 18). Le
  déploiement depuis la branche de travail est refusé par la protection d'environnement ; workflow
  ajusté pour ne déployer que depuis `main`.
