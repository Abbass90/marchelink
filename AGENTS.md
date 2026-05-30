# AGENTS.md — MarchéLink

> Ce fichier est le **contrat écrit** exécutoire entre le développeur et Codex pour MarchéLink. Si un nouveau pattern est introduit, **mettre à jour CE fichier AVANT d'implémenter**, jamais après. Écrit en mode impératif : Always, Never, Use, Require.
>
> Pour la numérotation des cas d'usage, se référer à `docs/PRD.md` (UC-01 à UC-22). Chaque test E2E/Intégration doit référencer un UC.

---

## Project Status

**Phase :** 0 → 1 — Scoping validé, ready pour l'initialisation du scaffolding (Monorepo pnpm + Docker Compose). Aucun code métier écrit.

---

## Project Overview

MarchéLink est une plateforme B2B multi-tenant connectant les grossistes du marché d'Adjamé aux petits boutiquiers d'Abidjan. Un compte acheteur unique (Kouadio) navigue de façon transversale sur les catalogues de N grossistes ; chaque commande passée est strictement cloisonnée et appartient au tenant grossiste cible. Mobile Money mocké en v1 (initialisation, webhook et réconciliation).

**Stack :** Node.js 20 + Express + Knex + PostgreSQL 16 + React (Vite). Déploiement sur VPS (Hetzner/DigitalOcean) via Docker multi-stage + nginx + PM2 sur `marchelink.kanso.dev`.

---

## Always-On Behaviors (IA Prompt Hacks)

1. **Read First :** Lire obligatoirement ce fichier `AGENTS.md` au tout début de chaque nouvelle conversation avant de générer ou modifier le moindre bloc de code.
2. **Plan Before Code :** Lorsqu'il t'est demandé de planifier ou d'implémenter une feature complexe, affiche systématiquement une **check-list numérotée** de tes étapes de conception et attends la validation explicite de l'utilisateur avant d'écrire le code.
3. **Always Rollback :** Lors de la génération d'une migration Knex, écris obligatoirement la fonction `down()` (rollback) complète et testable.
4. **Mandatory Tenant Filter :** Lors de l'écriture ou de la modification d'une méthode de Repository, inclus systématiquement le filtre par `organization_id` (ou `buyer_user_id`).

---

## Architecture & Tech Stack — Locked

### Stack Principale (Aucune alternative acceptée)
- **Node.js 20 LTS** — Strictement (pas Node 18, pas Node 22).
- **TypeScript 5.x (Strict Mode)** — Configuration : `strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`, `noImplicitReturns: true`.
- **Express 4.x** — Pas de Fastify, pas de NestJS.
- **Knex.js** — Query builder et outil de migration unique (interdiction stricte d'utiliser Prisma, TypeORM ou Sequelize).
- **PostgreSQL 16** — Pas de fallback SQLite ou en mémoire, même pour les environnements de test locaux.
- **React 18 + Vite 5** — Pas de Next.js, pas de Create React App.
- **Zod** — Outil unique de validation de schéma (pas de Joi, pas de Yup, pas de validation custom).
- **Jest + Supertest** (Backend), **Vitest + React Testing Library** (Frontend), **Playwright** (E2E).
- **pino** — Logger structuré JSON de production (interdiction d'utiliser `console.log`).
- **Docker multi-stage**, **nginx**, **PM2 cluster mode**.

### Pattern d'architecture — Vertical Slice + Repository
Chaque fonctionnalité doit traverser les couches de manière étanche et dans cet ordre strict :
**Route → Middleware → Controller → Service → Repository → Database**
Une feature doit être complétée de bout en bout (end-to-end) avant de passer à la suivante. Aucun état intermédiaire ou partiel ne doit être committé.

### Folder Structure — Enforced

```
/
├── AGENTS.md
├── docs/
│   ├── PRD.md
│   ├── PLAN.md
│   └── ADR/                          # Architecture Decision Records
├── apps/
│   ├── api/                          # Backend Express
│   │   ├── src/
│   │   │   ├── config/               # env loader, db connection, knexfile
│   │   │   ├── middleware/           # auth, error handler, rate-limit, correlation-id
│   │   │   ├── modules/              # vertical slices, un dossier par domaine
│   │   │   │   ├── auth/
│   │   │   │   ├── products/
│   │   │   │   │   ├── product.routes.ts
│   │   │   │   │   ├── product.controller.ts
│   │   │   │   │   ├── product.service.ts
│   │   │   │   │   ├── product.repository.ts
│   │   │   │   │   ├── product.schema.ts        # schémas zod
│   │   │   │   │   └── __tests__/
│   │   │   │   ├── orders/
│   │   │   │   ├── payments/
│   │   │   │   ├── deliveries/
│   │   │   │   └── dashboard/
│   │   │   ├── errors/               # classes d'erreur typées
│   │   │   ├── db/
│   │   │   │   ├── migrations/       # YYYYMMDDHHMM_verb_noun.ts
│   │   │   │   ├── seeds/
│   │   │   │   └── knex.ts
│   │   │   └── server.ts
│   │   └── package.json
│   └── web/                          # Frontend React
│       ├── src/
│       │   ├── api/                  # UN SEUL module client API
│       │   ├── components/
│       │   │   ├── primitives/       # design tokens, variables CSS
│       │   │   └── features/
│       │   ├── pages/
│       │   ├── hooks/
│       │   └── main.tsx
│       └── package.json
├── packages/
│   └── shared/                       # types + schémas zod partagés (monorepo link)
├── infra/
│   ├── docker/
│   ├── nginx/
│   └── pm2/
├── .github/workflows/                # CI: lint, test, security-audit
├── docker-compose.yml                # dev local : postgres + api + web
└── pnpm-workspace.yaml
```

---

## Naming Conventions — Strict

- **Tables DB :** `snake_case` au pluriel (`products`, `order_items`, `payments`).
- **Colonnes DB :** `snake_case` (`organization_id`, `created_at`, `total_xof`).
- **Routes API :** `kebab-case` au pluriel (`/api/products`, `/api/order-items`, `/api/payments/webhook`).
- **Fichiers TypeScript :** `kebab-case.ts` (`product.repository.ts`, `auth.middleware.ts`).
- **Composants React :** `PascalCase` pour le nom du fichier et l'export par défaut (`ProductCatalog.tsx`).
- **Fonctions de service :** `camelCase` sous la forme verbe-nom (`createOrder`, `findOrderById`, `assertBuyerOwnsOrder`).
- **Migrations Knex :** `YYYYMMDDHHMM_verb_noun.ts` (`202605171730_create_products.ts`).
- **Schémas Zod :** `PascalCase` suffixé `Schema` (`CreateProductSchema`, `OrderStatusSchema`).
- **Classes d'erreur :** `PascalCase` suffixé `Error` (`ValidationError`, `NotFoundError`, `CrossTenantError`).
- **Fichiers de Tests :** `xxx.test.ts` (unitaires/intégration), `xxx.e2e.spec.ts` (Playwright).

---

## Database Rules (Non-Negotiable)

1. **UUID v4 obligatoires en clé primaire** — Ne jamais utiliser d'entiers auto-incrémentés afin d'éviter l'énumération de ressources via les URLs.
2. **Colonnes d'audit systématiques** sur toutes les tables : `created_at`, `updated_at`, `created_by`, `updated_by`.
3. **Soft Delete par défaut** via la colonne `deleted_at TIMESTAMPTZ NULL`. Aucun `DELETE FROM` n'est toléré dans le code applicatif.
4. **Clé Multi-Tenant obligatoire :** Chaque table métier doit porter un `organization_id` ou un `buyer_user_id` avec une contrainte Foreign Key explicite et indexée.
5. **`NOT NULL` par défaut :** La nullabilité d'une colonne est une exception explicite qui doit être justifiée par un commentaire dans le fichier de migration.
6. **Contraintes FK enforced :** Toutes les relations physiques sont configurées avec `ON DELETE RESTRICT` au niveau SQL (le soft delete se charge de la logique applicative).
7. **Gestion financière stricte :** Stocker l'argent en type `BIGINT` représentant des **XOF (Franc CFA) entiers** (pas de `FLOAT`, pas de `DECIMAL` pour éviter les dérives d'arrondis).
8. **Rollback fonctionnel :** Chaque méthode `down()` de migration doit être testée et validée en CI via l'enchaînement `db:rollback` puis `db:latest`.
9. **Performance requêtes :** Exécuter un `EXPLAIN ANALYZE` sur toute requête SQL dépassant 50ms ou scannant plus de 1000 lignes. Ajouter l'index composite pertinent avant de fusionner la branche.
10. **Immutabilité des migrations :** Ne jamais modifier un fichier de migration déjà poussé sur la branche principale. Toujours générer une nouvelle migration corrective.

---

## Security Non-Negotiables

11. **JWT sécurisés :** Stockage obligatoire dans des cookies `httpOnly` + `Secure` + `SameSite=Strict`. Interdiction formelle d'utiliser le `localStorage` ou le `sessionStorage`.
12. **Tokens TTL :** Access Token limité à 15 minutes. Refresh Token limité à 7 jours avec rotation stricte (RTR) à chaque utilisation.
13. **Isolation Tenant Enforced :** Toutes les requêtes en base de données doivent intégrer dynamiquement le filtrage par `organization_id` (ou `buyer_user_id`). Cette logique doit être centralisée dans une classe d'abstraction Repository parente.
14. **Anti Info-Leak :** Si un ID de ressource recherché appartient à un autre tenant (tentative d'attaque cross-tenant), l'API doit renvoyer un statut **404 Not Found** (et non un 403), pour masquer l'existence de la donnée. Renvoyer un 403 uniquement pour un défaut de droits à l'intérieur de son propre tenant.
15. **Validation Edge :** Chaque payload entrant (`POST`, `PATCH`, `PUT`) doit être validé via Zod au niveau du middleware de route ou du controller. Aucun `req.body` brut ne doit atteindre la couche Service.
16. **Hashing des mots de passe :** Utilisation exclusive de `bcrypt` avec un cost factor ≥ 12. Les mots de passe ne doivent jamais être loggés, ni figurer dans aucun champ de réponse API.
17. **Headers de sécurité :** Intégration obligatoire et stricte du middleware **Helmet** à la racine de l'application Express pour configurer les politiques CSP, HSTS, X-Frame-Options et X-Content-Type-Options.
18. **CORS :** Liste blanche explicite des origines autorisées (pas de wildcard `*` en production).
19. **Rate Limiting actif :** Routes `/api/auth/*` limitées à 5 requêtes/minute/IP. Webhook de paiement limité à 20 requêtes/minute/IP.
20. **Idempotence Webhook :** Le endpoint `/api/payments/webhook` doit exiger une clé d'idempotence unique par transaction. Tout rejeu (replay) de payload déjà traité doit renvoyer un succès immédiat sans ré-exécuter le workflow métier (no-op).
21. **Zéro Stack Trace en prod :** Les réponses d'erreur de production doivent adopter une structure unique et sécurisée : `{ status, error, message, requestId }`.

---

## Observability Rules (DevOps Senior)

22. **Correlation ID :** Chaque requête HTTP entrante doit se voir attribuer un identifiant unique `correlation_id` (UUID v4) via un middleware dédié. Ce jeton doit être injecté dans le header de réponse et propagé tout au long du cycle de vie de la requête.
23. **Logs structurés JSON :** Interdiction d'utiliser `console.log`. Utiliser exclusivement le logger injecté `pino`. Le niveau par défaut est `info` en production, et `debug` en environnement de développement local.
24. **Contenu des logs d'erreur :** Chaque log capturant une exception dans le middleware centralisé doit obligatoirement inclure : `correlation_id`, `user_id` (si authentifié), `organization_id` (si identifiée), `error.name`, `error.message`, et `error.stack`.

---

## Testing Requirements

25. **TDD rigoureux :** Écriture obligatoire d'un test d'intégration unitaire ou API échouant (Rouge) avant d'écrire le code de validation (Vert) pour les flux critiques : Authentification, passation de commande, traitement du webhook de paiement et étanchéité cross-tenant.
26. **Seuil de Couverture (Gate) :** Couverture minimale de **70% des lignes** sur les couches `/services` et `/repositories`. La pipeline CI échoue automatiquement sous ce seuil.
27. **Traçabilité des tests E2E :** Chaque scénario de test Playwright doit inclure le numéro de son cas d'usage cible issu du PRD dans son libellé (Ex: `test('UC-03: l\'acheteur ne peut pas voir le catalogue d\'un grossiste non sollicité', ...)`).
28. **Vérification de l'idempotence :** Le test d'intégration du webhook de paiement doit explicitement valider qu'un double envoi du même payload ne duplique pas l'écriture comptable ou la mise à jour de statut.
29. **Test Database Réelle :** Les tests d'intégration s'exécutent sur une base de données PostgreSQL isolée dédiée (`marchelink_test`), réinitialisée à blanc via les factories stockées dans `__tests__/factories/` avant chaque bloc de test. Les mocks de base de données SQL ou l'utilisation d'un moteur SQLite en mémoire sont interdits.

---

## Frontend Rules (React 3-State Rule)

30. **Three-state rule :** Tout composant effectuant un appel asynchrone vers l'API client doit implémenter de manière graphique et explicite trois états : **Loading** (skeleton ou spinner), **Success** (rendu des données, l'état vide étant une sous-branche du succès) et **Error** (message lisible par l'humain et bouton "Retry"). Aucun état ne doit échouer silencieusement.
31. **Client API Unique :** Tous les appels réseaux doivent être localisés dans `apps/web/src/api/`. Interdiction d'écrire un `fetch()` ou un `axios.get()` brut au milieu d'un composant d'affichage.
32. **Design Tokens & Variabilisation :** Aucun style en ligne (inline styles) ou valeur brute. Les couleurs, marges, espacements et typographies doivent provenir exclusivement du fichier de variables CSS centralisé (`primitives/tokens.css`).
33. **Validation de Formulaire bilatérale :** Les formulaires valident les contraintes de saisie au moment du `blur` (perte de focus) ET du `submit`. Le bouton de soumission doit être désactivé (disabled) pendant la durée d'exécution de la requête réseau.
34. **Une responsabilité par fichier :** Un seul composant React par fichier, exporté par défaut, nommé en `PascalCase`. La taille d'un composant UI ne doit pas excéder 150 lignes sous peine de devoir être découpé en sous-composants.

---

## Forbidden Patterns (Résumé des interdictions)

- ❌ Utiliser `fetch()` ou `axios` directement à l'intérieur d'un composant React.
- ❌ Stocker des jetons d'authentification ou données sensibles dans le `localStorage` ou `sessionStorage`.
- ❌ Écrire une requête de sélection ou de modification SQL sans y lier le filtre `organization_id` ou `buyer_user_id`.
- ❌ Exécuter une commande de suppression physique `DELETE FROM` (utiliser impérativement le Soft Delete `deleted_at`).
- ❌ Utiliser le mot-clé `SELECT *` dans les requêtes de production (toujours lister explicitement les colonnes requises).
- ❌ Utiliser des types `FLOAT` ou `DECIMAL` pour stocker des montants monétaires (utiliser des `BIGINT` en Francs CFA entiers).
- ❌ Modifier un fichier de migration Knex déjà committé et validé.
- ❌ Laisser traîner des `console.log()` dans le code métier (utiliser Pino).

---

## Common Commands

```bash
# Lancement de l'environnement de développement local
docker compose up -d                              # Initialise Postgres 16
pnpm -F api dev                                   # API Express en mode watch (tsx)
pnpm -F web dev                                   # Serveur de développement Vite (React)

# Gestion de la Base de données (Knex)
pnpm -F api db:migrate                            # Applique les nouvelles migrations
pnpm -F api db:rollback                           # Annule le dernier batch de migrations
pnpm -F api db:seed                               # Injecte les données de démo (grossistes d'Adjamé, boutiquiers)
pnpm -F api db:reset                              # Rollback total + Migrate + Seed

# Exécution des suites de Tests
pnpm -F api test                                  # Lance les tests Jest + Supertest (Backend)
pnpm -F api test:cov                              # Analyse la couverture de code globale
pnpm -F web test                                  # Lance les tests Vitest (Frontend)
pnpm e2e                                          # Lance les tests Playwright (E2E)

# Validation Qualité & Sécurité
pnpm lint                                         # Analyse ESLint sur l'ensemble du monorepo
pnpm typecheck                                    # Validation stricte du compilateur TypeScript (tsc --noEmit)
/security-audit                                   # Audit des vulnérabilités OWASP (exigé pré-PR)
```

---

## Current Focus

**Objectif Actuel :** Scaffolding du projet — Initialiser le monorepo avec pnpm workspaces, configurer les fichiers de compilation `tsconfig.json` stricts, paramétrer le fichier `docker-compose.yml` avec l'image PostgreSQL 16, configurer la baseline Knex (`knexfile`, middleware de correlation-id) et poser l'architecture du premier vertical slice (`auth` module).

## Context Management & Session Ethics
- **Proactive Compaction:** Regularly monitor token usage. When the active session context approaches ~70%, actively advise the user or automatically trigger a `/compact` routine.
- **Compaction Focus:** When executing a compaction summary, strictly preserve core system architecture decisions, current state targets, and active debug loops.