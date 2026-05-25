# MarchéLink — Product Requirements Document (PRD)

**Version :** 1.0 (MVP scoping locked)
**Date :** 2026-05-17
**Auteur :** Capstone — Engineering with Claude Code (cohorte Abidjan, juin 2026)
**Domaine :** `marchelink.kanso.dev`

---

## 1. Project Overview & Problem Statement

### 1.1 Le problème
Le marché d'Adjamé (Abidjan) connecte des milliers de grossistes à des dizaines de milliers de boutiquiers de quartier (Yopougon, Abobo, Koumassi, Treichville). Aujourd'hui chaque commerçant doit **se déplacer physiquement plusieurs fois par semaine** pour consulter les catalogues, passer commande, payer et organiser le transport. Perte de temps, coûts de transport, exposition au vol, rupture de stock — toutes conséquences directes.

### 1.2 La solution
MarchéLink est une **plateforme B2B multi-tenant** qui digitalise la relation grossiste ↔ boutiquier. Un boutiquier navigue depuis un compte unique les catalogues de N grossistes, passe commande, paie via Mobile Money (mocké en v1) et suit la livraison. Un grossiste gère depuis son tenant : catalogue, stock, commandes entrantes, livreurs et tableau de bord.

### 1.3 Killer feature (focus MVP)
**Commande cross-tenant cloisonnée** — un compte acheteur unique navigue librement les catalogues de N grossistes, mais chaque commande est **scopée** au tenant du grossiste ciblé. La donnée commande appartient au grossiste — jamais de fuite cross-tenant. C'est l'épine dorsale architecturale du projet.

### 1.4 Feature secondaire
**Flow Mobile Money mocké** — initialisation du paiement → webhook simulé → réconciliation idempotente du statut de la commande. Pas d'intégration Wave/Orange Money/MTN MoMo en v1, mais le contrat technique est conçu pour qu'une vraie intégration s'insère sans rework.

---

## 2. User Roles & Permissions

| Rôle | Appartient à | Peut faire |
|---|---|---|
| `wholesaler_admin` | Tenant grossiste | Gérer équipe, catalogue, stock, commandes, livraisons, dashboard |
| `wholesaler_seller` | Tenant grossiste | Gérer catalogue, voir/traiter commandes |
| `delivery_operator` | Tenant grossiste | Voir livraisons assignées, marquer livrées |
| `buyer` | Aucun tenant — compte personnel | Naviguer tous les grossistes, commander, payer, suivre |
| `platform_admin` | Aucun (super-admin) | Onboarding manuel des grossistes (v1) |

**Règle cross-tenant fondamentale :** un `buyer` n'est membre d'aucun tenant grossiste — son `organization_id` est `NULL`. Une commande porte deux clés : `wholesaler_org_id` (tenant propriétaire) **et** `buyer_user_id` (acheteur). Toute requête business filtre par l'une de ces deux clés selon le contexte.

---

## 3. Core Features (In-Scope MVP)

- [ ] **F1** — Onboarding grossiste (invitation manuelle par platform_admin, v1)
- [ ] **F2** — Gestion catalogue grossiste : CRUD produits avec stock et prix
- [ ] **F3** — Inscription / connexion acheteur (JWT en cookies httpOnly)
- [ ] **F4** — Navigation cross-tenant : l'acheteur voit les produits de tous les grossistes
- [ ] **F5** — Placement de commande (acheteur cible un grossiste à la fois)
- [ ] **F6** — Validation grossiste + initialisation paiement Mobile Money mocké
- [ ] **F7** — Webhook paiement mocké + réconciliation idempotente du statut
- [ ] **F8** — Assignation livraison + workflow opérateur de livraison
- [ ] **F9** — Dashboard grossiste : commandes du jour, CA, alertes stock bas
- [ ] **F10** — Isolation multi-tenant stricte (chaque requête filtre par `wholesaler_org_id` ou `buyer_user_id`)

---

## 4. Numbered Use Cases (UC-XX) — Ancrages de Tests

> Chaque UC ci-dessous devient une référence de test E2E (règle CLAUDE.md).
> Tout test E2E doit commencer par son numéro d'UC dans son nom.

### Wholesaler admin / seller
- **UC-01** — `wholesaler_admin` crée un produit dans son catalogue
- **UC-02** — `wholesaler_admin` met à jour le stock et le prix d'un produit
- **UC-03** — `wholesaler_admin` **ne peut pas** voir un produit appartenant à un autre tenant *(isolation cross-tenant)*
- **UC-04** — `wholesaler_admin` voit la liste des commandes destinées à son org
- **UC-05** — `wholesaler_admin` accepte ou rejette une commande `pending`
- **UC-06** — `wholesaler_admin` assigne une livraison à un `delivery_operator` de son org
- **UC-07** — `wholesaler_admin` voit sur le dashboard : CA du jour, nb commandes, alertes stock bas

### Buyer
- **UC-08** — `buyer` s'inscrit puis se connecte (cookie JWT httpOnly posé)
- **UC-09** — `buyer` parcourt le catalogue de n'importe quel grossiste
- **UC-10** — `buyer` consulte la fiche détail d'un produit
- **UC-11** — `buyer` ajoute des produits d'**un seul** grossiste dans un panier (pas de cart cross-grossiste en v1)
- **UC-12** — `buyer` place une commande — la commande est scopée au tenant grossiste cible
- **UC-13** — `buyer` initie le paiement Mobile Money mocké sur une commande acceptée
- **UC-14** — Le statut de la commande passe `pending → accepted → paid` après le webhook mocké
- **UC-15** — `buyer` **ne peut pas** voir ni modifier une commande d'un autre acheteur *(isolation per-user)*
- **UC-16** — `buyer` voit le statut `delivered` après que l'opérateur ait marqué la livraison

### Delivery operator
- **UC-17** — `delivery_operator` voit uniquement les livraisons qui lui sont assignées dans son tenant
- **UC-18** — `delivery_operator` marque une livraison comme `delivered`, déclenchant la transition de la commande
- **UC-19** — `delivery_operator` **ne peut pas** marquer une livraison hors de son tenant *(isolation cross-tenant)*

### Sécurité / cross-tenant
- **UC-20** — Toute tentative de fetch d'une ressource hors scope renvoie **404** (pas 403 — protection info-leak)
- **UC-21** — Un `buyer` ne peut pas escalader vers un rôle grossiste en manipulant les claims du JWT
- **UC-22** — Rate limiting actif sur `/api/auth/login` et `/api/payments/webhook`

---

## 5. Data Entities & Schema Sketch

Toutes les tables incluent par défaut : `id` (UUID v4), `created_at`, `updated_at`, `deleted_at` (soft delete), `created_by`, `updated_by`.

| Entité | Champs clés | Clé multi-tenant |
|---|---|---|
| `organizations` | `id`, `name`, `type` (`wholesaler` v1), `status` | elle-même |
| `users` | `id`, `email`, `password_hash`, `role`, `organization_id` (nullable pour buyer), `phone` | `organization_id` (si applicable) |
| `products` | `id`, `organization_id`, `sku`, `name`, `description`, `price_xof`, `stock_qty`, `unit`, `image_url` | `organization_id` |
| `orders` | `id`, `wholesaler_org_id`, `buyer_user_id`, `status`, `total_xof`, `payment_id`, `delivery_id` | `wholesaler_org_id` |
| `order_items` | `id`, `order_id`, `product_id`, `quantity`, `unit_price_xof`, `line_total_xof` | via `orders.wholesaler_org_id` |
| `payments` | `id`, `order_id`, `wholesaler_org_id`, `provider` (`mock_mobile_money`), `provider_ref`, `status`, `amount_xof`, `idempotency_key` | `wholesaler_org_id` |
| `deliveries` | `id`, `order_id`, `wholesaler_org_id`, `assigned_to_user_id`, `status`, `completed_at` | `wholesaler_org_id` |

### Statuts orders (state machine)
`pending → accepted → paid → assigned → delivered`
+ états terminaux : `rejected`, `cancelled`

### Invariants à coder en CHECK constraints
- `orders.wholesaler_org_id` DOIT correspondre au `products.organization_id` de **tous** les `order_items` liés.
- `payments.idempotency_key` UNIQUE par `wholesaler_org_id` (sécurité contre rejeu webhook).
- `users.role = 'buyer'` ⇒ `organization_id IS NULL`. Tout autre rôle ⇒ `organization_id IS NOT NULL`.
- Montants en `BIGINT` représentant des **francs CFA entiers** (XOF n'a pas de centime). Jamais de FLOAT.

---

## 6. User Journeys

### 6.1 Onboarding grossiste (J1)
Platform admin envoie invitation → grossiste pose son mot de passe → ajoute son premier produit → publie le catalogue (visible immédiatement par tous les acheteurs).

### 6.2 Parcours acheteur — la killer feature
Connexion → navigation cross-tenant des catalogues → sélection du grossiste « Tissus d'Aya » → ajout de 3 variantes au panier → confirmation panier (scopé à un grossiste) → placement commande (`pending`) → attente acceptation → sur `accepted`, init Mobile Money mock → webhook simulé bascule `paid` → assignation livreur → réception `delivered`.

### 6.3 Parcours grossiste — traitement commande
Alerte dashboard → revue commande → vérification stock → `accept` (décrémente le stock) → demande paiement → sur webhook `paid`, assignation livreur → suivi.

### 6.4 Parcours livreur
Connexion → liste des livraisons du jour assignées → sélection → marquage `delivered` → notification automatique côté acheteur (in-app + email mock).

---

## 7. Tech Stack Baseline

**Alignement strict avec la stack du cours. Aucune déviation.**

| Couche | Choix | Justification |
|---|---|---|
| Runtime | Node.js 20 LTS | Standard cours, LTS jusqu'à 2026-04 |
| Backend | Express 4.x | Standard cours, minimal et explicite |
| Langage | TypeScript 5.x (strict mode) | Type safety, levier IDE, standard cours |
| Query builder | Knex.js | Standard cours, SQL-close, migration-first |
| Database | PostgreSQL 16 | Multi-tenant friendly, JSONB pour flex fields |
| Frontend | React 18 + Vite 5 | Standard cours, HMR rapide |
| Frontend langage | TypeScript 5.x | Types partagés avec backend via `packages/shared` |
| Auth | JWT cookies httpOnly (access 15min + refresh 7j rotatif) | Session 6 |
| Validation | Zod | Schema-first, types inférés |
| Tests | Jest + Supertest (backend), Vitest + RTL (front), Playwright (E2E) | Session 8 |
| Container | Docker multi-stage build | Session 7 |
| Reverse proxy | nginx + Let's Encrypt | Session 7 |
| Process manager | PM2 cluster mode | Session 7 |
| CI/CD | GitHub Actions | Exigence capstone |
| Hosting | VPS Hetzner ou DigitalOcean | Choix utilisateur |
| Domaine | `marchelink.kanso.dev` (HTTPS) | Domaine utilisateur |
| Logging | pino (JSON structuré) | Session 10 |

### Pattern d'architecture
**Vertical Slice + Repository Pattern** (Session 4) :
`Route → Controller → Service → Repository → Database`

Une feature implémentée end-to-end avant la suivante. Pas d'état partiellement implémenté. Chaque test vert = un vertical slice complet.

---

## 8. Non-Functional Requirements

| NFR | Cible |
|---|---|
| Isolation multi-tenant | Toute requête filtre par `wholesaler_org_id` ou `buyer_user_id`. Vérifié par `/security-audit`. |
| Authentification | JWT httpOnly + Secure + SameSite=Strict. Jamais en localStorage. |
| Autorisation | Middleware role-based sur chaque route. 404 (jamais 403) pour les tentatives cross-tenant. |
| Validation input | Zod en bord d'API sur chaque POST/PATCH. Aucun accès brut à `req.body` dans un controller. |
| Performance | p95 < 300ms pour les endpoints de liste avec 10k produits / 100k commandes. EXPLAIN ANALYZE sur toute requête > 50ms. |
| Indexation | Indexes composites `(organization_id, created_at DESC)` sur orders/products. Covering indexes là où nécessaire. |
| Couverture de tests | ≥ 70% sur `services/` et `repositories/`. Chemins critiques : unit + integration + E2E. |
| Déploiement | Docker multi-stage, image < 150MB, HTTPS via Let's Encrypt, PM2 cluster derrière nginx. |
| CI/CD | GitHub Actions lance lint + tests + audit sur chaque push `main` et PR. |
| Observabilité | Logs JSON structurés (pino), `requestId` sur chaque requête. |
| Rate limiting | Par IP sur `/api/auth/*` (5 req/min) et `/api/payments/webhook` (20 req/min). |
| Soft delete | Toutes entités utilisent `deleted_at`. Aucun hard delete dans le code applicatif. |

---

## 9. Out of Scope (v1) — Liste Anti-Feature Creep Explicite

- ❌ Intégration réelle Wave / Orange Money / MTN MoMo (mocké, avec contrat designed pour drop-in)
- ❌ Géolocalisation GPS temps réel des livreurs
- ❌ Chat acheteur ↔ vendeur in-app
- ❌ Système de notation / review des grossistes
- ❌ Multi-langue (français uniquement en v1)
- ❌ Panier cross-grossiste (mono-grossiste en v1)
- ❌ App mobile native (web responsive uniquement)
- ❌ Notifications SMS (in-app + email mock uniquement)
- ❌ Self-service signup grossiste (gate manuel platform_admin en v1)
- ❌ Forecasting inventaire / recommandations ML
- ❌ Génération PDF de factures (post-MVP)
- ❌ Marketplace acheteur ↔ acheteur / revente

---

**Fin du PRD v1.0** — toute évolution implique bump de version et mise à jour de CLAUDE.md avant implémentation.
