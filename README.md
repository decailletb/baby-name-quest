# Baby Name Quest 👶

Un site web, en français et pensé pour le téléphone, pour parcourir des milliers de prénoms
et constituer sa shortlist **à deux** : chacun aime ou passe, voit les favoris de l'autre, et
les coups de cœur communs remontent dans « Nos matchs ».

**Site déployé :** https://decaileltb.github.io/baby-name-quest/

## Fonctionnalités
- **Découvrir (swipe)** : un prénom à la fois, ❤️ j'aime / ✕ je passe, gestes tactiles et flèches
  clavier, annulation de la dernière décision, progression, reprise là où on s'était arrêté ;
  ordre de popularité, ordre alphabétique ou mélange. Pour chaque prénom : naissances en France et
  en Suisse, popularité, tendance sur 10 ans, origine et signification.
- **Liste** : recherche instantanée (insensible aux accents), filtres genre / première lettre /
  longueur / popularité / tendance / origine, tri, et « aimer » directement depuis la liste.
- **Nos matchs** : les prénoms aimés par les deux, avec un top commun que l'on peut ordonner ;
  vues « Mes favoris » et « Ses favoris » avec notes.
- **Identification sans compte** : un code de couple partagé, un prénom d'utilisateur, le genre
  recherché. Mémorisé sur l'appareil.
- **Synchronisation** entre appareils via Supabase (temps réel), avec repli automatique sur le
  stockage local du navigateur quand Supabase n'est pas configuré.

## Données
22 870 prénoms issus de deux sources officielles, fusionnées et dédoublonnées :
- **INSEE** — Fichier des prénoms (France, 1900–2025), Licence Ouverte 2.0.
- **OFS/BFS** — Prénoms des nouveau-nés (Suisse, 2000–2025), OPEN-BY.

Détails, règles de fusion et régénération : [`docs/donnees.md`](docs/donnees.md).

## Installation (Windows, PowerShell)
Prérequis : [Node.js](https://nodejs.org/) ≥ 20 (`node --version`) et Git.

```powershell
git clone https://github.com/BenjaminDecaillet/baby-name-quest.git
cd baby-name-quest
npm install
npm run dev
```

Puis ouvrir http://localhost:5173/. Les mêmes commandes fonctionnent sous macOS et Linux.

> Sous PowerShell, enchaîner les commandes avec `;` (pas `&&`). Les fichiers du dépôt sont en
> UTF-8 sans BOM avec des fins de ligne LF ; `.gitattributes` et `.editorconfig` s'en chargent,
> et les hooks git refusent tout écart.

## Commandes
| Commande | Rôle |
|----------|------|
| `npm run dev` | Serveur de développement avec rechargement à chaud |
| `npm run build` | Build de production dans `dist/` (+ `404.html` pour GitHub Pages) |
| `npm run preview` | Sert le build de production localement |
| `npm run test` | Tests unitaires et de rendu (Vitest) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run verify` | lint + typecheck + test + build |
| `npm run check:repo` | UTF-8 sans BOM, LF, aucun secret, aucune mention interdite |
| `npm run build:names` | Régénère `public/data/names.json` depuis l'INSEE et l'OFS |
| `npm run pages:enable` | Active GitHub Pages (source : GitHub Actions) via l'API |
| `npm run secrets:github` | Crée les secrets Actions Supabase via l'API (valeurs jamais affichées) |

## Synchronisation avec Supabase
Sans configuration, le site fonctionne en **mode local** (les deux profils sur le même appareil).
Pour synchroniser deux téléphones, suivre [`docs/supabase.md`](docs/supabase.md) : créer le schéma
avec `supabase/schema.sql`, puis fournir `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
(fichier `.env` en local, secrets GitHub Actions pour le déploiement). Aucun changement de code
n'est nécessaire : l'adaptateur de stockage est choisi à l'exécution.

Le modèle de sécurité (clé anon publique, protection par le code de couple, RLS) est décrit
dans [`docs/securite.md`](docs/securite.md).

## Déploiement
Chaque push et chaque PR déclenchent `.github/workflows/ci.yml` : lint, typecheck, tests, contrôle
du dépôt, build avec `VITE_BASE_PATH=/baby-name-quest/`. Le déploiement sur GitHub Pages n'a lieu
que depuis `main` (l'environnement `github-pages` y est restreint).

## Structure
```
public/data/        dataset généré (names.json, names.meta.json)
scripts/            pipeline de données, hooks git, outils API GitHub (Node/TypeScript)
src/data/           types, chargement, filtres et tri
src/storage/        StorageAdapter, LocalStorageAdapter, SupabaseAdapter
src/store/          session (couple, profil), votes, matchs
src/features/       onboarding, swipe, list, matches, profile
src/components/     composants partagés
supabase/           schema.sql (tables, index, RLS)
docs/               documentation en français
```

## Conventions
Commits en convention Angular (`type(scope): description`), une branche de travail
`feat/baby-name-shortlist-app`, hooks husky (message de commit, secrets, BOM, CRLF).
Voir [`CLAUDE.md`](CLAUDE.md) pour le détail.
