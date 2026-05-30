#!/usr/bin/env bash
# =============================================================================
# scaffold.sh — MarchéLink bootstrap (Phase 0 → 1)
# Aligne le repo sur CLAUDE.md : monorepo pnpm, TS strict, Postgres 16,
# Express + Knex + Zod + pino + Helmet, React 18 + Vite, GitHub Actions.
# Idempotent : peut être re-exécuté sans casser un repo existant.
# =============================================================================
set -euo pipefail

PROJECT_NAME="marchelink"
NODE_VERSION="20"
POSTGRES_VERSION="16"

cyan()  { printf '\033[36m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow(){ printf '\033[33m%s\033[0m\n' "$*"; }

require() {
  command -v "$1" >/dev/null 2>&1 || { yellow "[!] '$1' manquant — installe-le avant de continuer"; exit 1; }
}

cyan "[1/10] Vérification des prérequis..."
require git
require node
require pnpm
# docker est optionnel pour le scaffold mais requis pour `docker compose up`
command -v docker >/dev/null 2>&1 || yellow "[!] docker non détecté — installe-le avant de lancer la DB"

# -----------------------------------------------------------------------------
# 2. Arborescence
# -----------------------------------------------------------------------------
cyan "[2/10] Création de l'arborescence..."
mkdir -p \
  docs/ADR \
  apps/api/src/{config,middleware,modules,errors,db/migrations,db/seeds} \
  apps/api/src/modules/{auth,products,orders,payments,deliveries,dashboard} \
  apps/web/src/{api,components/primitives,components/features,pages,hooks} \
  packages/shared/src \
  infra/{docker,nginx,pm2} \
  .github/workflows

# -----------------------------------------------------------------------------
# 3. Git + .gitignore + .env.example
# -----------------------------------------------------------------------------
cyan "[3/10] Init Git et fichiers d'environnement..."
[ -d .git ] || git init -q

cat > .gitignore <<'EOF'
# Node
node_modules/
.pnpm-store/
dist/
build/
coverage/
*.log
.npm
.pnpm-debug.log*

# Env
.env
.env.*
!.env.example

# OS / IDE
.DS_Store
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
.idea/

# Tests
playwright-report/
test-results/

# Docker
*.pid
EOF

cat > .env.example <<'EOF'
# === API ===
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# === Database ===
DATABASE_URL=postgres://marchelink:marchelink@localhost:5432/marchelink_dev
DATABASE_URL_TEST=postgres://marchelink:marchelink@localhost:5432/marchelink_test

# === Auth (Session 6) ===
JWT_ACCESS_SECRET=change_me_access_min_32_chars_xxxxxxxx
JWT_REFRESH_SECRET=change_me_refresh_min_32_chars_xxxxxxx
JWT_ACCESS_TTL_SEC=900
JWT_REFRESH_TTL_SEC=604800
COOKIE_DOMAIN=marchelink.kanso.dev
COOKIE_SECURE=true

# === Mock Mobile Money (Payments) ===
PAYMENTS_MOCK_WEBHOOK_SECRET=change_me_webhook_secret

# === CORS ===
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://marchelink.kanso.dev

# === Frontend ===
VITE_API_BASE_URL=http://localhost:3000/api
EOF

cat > .nvmrc <<EOF
${NODE_VERSION}
EOF

# -----------------------------------------------------------------------------
# 4. Workspace racine (pnpm)
# -----------------------------------------------------------------------------
cyan "[4/10] Configuration du workspace pnpm..."
cat > pnpm-workspace.yaml <<'EOF'
packages:
  - 'apps/*'
  - 'packages/*'
EOF

cat > package.json <<EOF
{
  "name": "${PROJECT_NAME}",
  "version": "0.1.0",
  "private": true,
  "engines": {
    "node": ">=${NODE_VERSION}",
    "pnpm": ">=9"
  },
  "scripts": {
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "e2e": "pnpm -F web e2e"
  },
  "devDependencies": {
    "@types/node": "^20.12.0",
    "typescript": "^5.4.5",
    "eslint": "^9.0.0",
    "prettier": "^3.2.5",
    "husky": "^9.0.11",
    "lint-staged": "^15.2.2"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"]
  }
}
EOF

cat > tsconfig.base.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": false,
    "sourceMap": true
  }
}
EOF

cat > .prettierrc.json <<'EOF'
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
EOF

# -----------------------------------------------------------------------------
# 5. packages/shared (types + zod partagés)
# -----------------------------------------------------------------------------
cyan "[5/10] Bootstrap packages/shared..."
cat > packages/shared/package.json <<'EOF'
{
  "name": "@marchelink/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint src",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.0"
  }
}
EOF

cat > packages/shared/tsconfig.json <<'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src" },
  "include": ["src/**/*"]
}
EOF

cat > packages/shared/src/index.ts <<'EOF'
// Types et schémas Zod partagés entre apps/api et apps/web
// Conformément à CLAUDE.md (Naming Conventions), les schémas sont PascalCase + suffixe Schema.

export * from './order-status';
EOF

cat > packages/shared/src/order-status.ts <<'EOF'
import { z } from 'zod';

// State machine des commandes (cf. docs/PRD.md §5)
export const OrderStatusSchema = z.enum([
  'pending',
  'accepted',
  'rejected',
  'paid',
  'assigned',
  'delivered',
  'cancelled',
]);

export type OrderStatus = z.infer<typeof OrderStatusSchema>;
EOF

# -----------------------------------------------------------------------------
# 6. apps/api (Express + Knex + Zod + pino + Helmet)
# -----------------------------------------------------------------------------
cyan "[6/10] Bootstrap apps/api..."
cat > apps/api/package.json <<'EOF'
{
  "name": "@marchelink/api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "test:cov": "jest --coverage --coverageReporters=text --coverageReporters=lcov",
    "db:migrate": "knex --knexfile src/config/knexfile.ts migrate:latest",
    "db:rollback": "knex --knexfile src/config/knexfile.ts migrate:rollback",
    "db:seed": "knex --knexfile src/config/knexfile.ts seed:run",
    "db:reset": "pnpm db:rollback --all && pnpm db:migrate && pnpm db:seed"
  },
  "dependencies": {
    "@marchelink/shared": "workspace:*",
    "bcrypt": "^5.1.1",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.2.0",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "knex": "^3.1.0",
    "pg": "^8.11.5",
    "pino": "^9.1.0",
    "pino-http": "^9.0.0",
    "uuid": "^9.0.1",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/cookie-parser": "^1.4.7",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/pg": "^8.11.5",
    "@types/supertest": "^6.0.2",
    "@types/uuid": "^9.0.8",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.1.2",
    "tsx": "^4.7.2"
  }
}
EOF

cat > apps/api/tsconfig.json <<'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node", "jest"]
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "**/__tests__/**"]
}
EOF

cat > apps/api/jest.config.ts <<'EOF'
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: [
    'src/modules/**/*.service.ts',
    'src/modules/**/*.repository.ts',
  ],
  coverageThreshold: {
    global: { lines: 70, statements: 70, functions: 70, branches: 60 },
  },
};

export default config;
EOF

# -- knexfile (config DB) --
cat > apps/api/src/config/knexfile.ts <<'EOF'
import 'dotenv/config';
import type { Knex } from 'knex';

const shared: Knex.Config = {
  client: 'pg',
  pool: { min: 2, max: 10 },
  migrations: {
    directory: '../db/migrations',
    extension: 'ts',
  },
  seeds: { directory: '../db/seeds' },
};

const config: Record<string, Knex.Config> = {
  development: {
    ...shared,
    connection: process.env.DATABASE_URL,
  },
  test: {
    ...shared,
    connection: process.env.DATABASE_URL_TEST,
  },
  production: {
    ...shared,
    connection: process.env.DATABASE_URL,
    pool: { min: 4, max: 20 },
  },
};

export default config;
EOF

# -- middleware: correlation-id (CLAUDE.md §22) --
cat > apps/api/src/middleware/correlation-id.middleware.ts <<'EOF'
import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare module 'express-serve-static-core' {
  interface Request {
    correlationId: string;
  }
}

// CLAUDE.md §22 : chaque requête entrante reçoit un correlation_id (UUID v4)
// injecté dans le header de réponse et propagé tout au long du cycle.
export function correlationId() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.header('x-correlation-id');
    const id = incoming && /^[a-f0-9-]{36}$/.test(incoming) ? incoming : uuidv4();
    req.correlationId = id;
    res.setHeader('x-correlation-id', id);
    next();
  };
}
EOF

# -- middleware: error handler (CLAUDE.md §21, §24) --
cat > apps/api/src/middleware/error-handler.middleware.ts <<'EOF'
import type { ErrorRequestHandler } from 'express';
import { logger } from '../config/logger.js';

// CLAUDE.md §21 : shape unique. §24 : log enrichi correlation_id + user_id + org_id.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next): void => {
  const status = (err as { status?: number }).status ?? 500;
  const errorCode = (err as { code?: string }).code ?? 'INTERNAL_ERROR';
  const message =
    status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message;

  logger.error({
    correlation_id: req.correlationId,
    user_id: (req as { user?: { id: string } }).user?.id,
    organization_id: (req as { user?: { organization_id?: string } }).user?.organization_id,
    error_name: err.name,
    error_message: err.message,
    error_stack: err.stack,
  });

  res.status(status).json({
    status,
    error: errorCode,
    message,
    requestId: req.correlationId,
  });
};
EOF

# -- logger pino (CLAUDE.md §23) --
cat > apps/api/src/config/logger.ts <<'EOF'
import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

// CLAUDE.md §23 : pino structuré JSON. info en prod, debug en dev.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss' },
    },
  }),
  redact: ['req.headers.cookie', 'req.headers.authorization', '*.password', '*.password_hash'],
});
EOF

# -- erreurs typées (CLAUDE.md Naming + §14) --
cat > apps/api/src/errors/index.ts <<'EOF'
// Classes d'erreur typées — cf. CLAUDE.md Naming Conventions.
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(422, 'VALIDATION_ERROR', message);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Forbidden in this tenant') {
    // CLAUDE.md §14 : 403 uniquement pour défaut de droits intra-tenant.
    super(403, 'AUTHORIZATION_ERROR', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class CrossTenantError extends NotFoundError {
  // CLAUDE.md §14 : tentative cross-tenant → 404, jamais 403.
  constructor() {
    super('Not found');
  }
}
EOF

# -- server.ts (entrée Express, Helmet câblé) --
cat > apps/api/src/server.ts <<'EOF'
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { correlationId } from './middleware/correlation-id.middleware.js';
import { errorHandler } from './middleware/error-handler.middleware.js';
import { logger } from './config/logger.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// CLAUDE.md §17 : Helmet à la racine.
app.use(helmet());

// CLAUDE.md §18 : whitelist CORS explicite, jamais '*'.
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));
app.use(correlationId());
app.use(pinoHttp({ logger }));

// Health check (Session 7 — Docker healthcheck cible cet endpoint)
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// TODO: monter ici les routers des vertical slices :
// app.use('/api/auth', authRouter);
// app.use('/api/products', productsRouter);
// ...

// Error handler centralisé (CLAUDE.md §21)
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'API up');
});
EOF

# Placeholder pour le premier vertical slice (auth)
cat > apps/api/src/modules/auth/.gitkeep <<'EOF'
# Premier vertical slice à implémenter (UC-08, UC-21) — voir docs/PRD.md.
EOF

# -----------------------------------------------------------------------------
# 7. apps/web (React 18 + Vite + Vitest + Playwright)
# -----------------------------------------------------------------------------
cyan "[7/10] Bootstrap apps/web..."
cat > apps/web/package.json <<'EOF'
{
  "name": "@marchelink/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@marchelink/shared": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.43.0",
    "@testing-library/jest-dom": "^6.4.2",
    "@testing-library/react": "^15.0.5",
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.2.1",
    "jsdom": "^24.0.0",
    "vite": "^5.2.10",
    "vitest": "^1.5.2"
  }
}
EOF

cat > apps/web/tsconfig.json <<'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src/**/*"]
}
EOF

cat > apps/web/vite.config.ts <<'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
} as any);
EOF

cat > apps/web/index.html <<'EOF'
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MarchéLink</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

cat > apps/web/src/main.tsx <<'EOF'
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './components/primitives/tokens.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main>
      <h1>MarchéLink</h1>
      <p>Premier composant à scaffolder : <code>ProductCatalog</code> (pattern three-state).</p>
    </main>
  </StrictMode>,
);
EOF

cat > apps/web/src/test-setup.ts <<'EOF'
import '@testing-library/jest-dom';
EOF

# Design tokens CSS (CLAUDE.md §32)
cat > apps/web/src/components/primitives/tokens.css <<'EOF'
/* CLAUDE.md §32 : seule source de vérité pour couleurs, espacements, typo. */
:root {
  /* Couleurs — palette de base à raffiner */
  --color-bg: #ffffff;
  --color-text: #0f172a;
  --color-primary: #f97316;     /* orange Adjamé */
  --color-primary-fg: #ffffff;
  --color-muted: #64748b;
  --color-border: #e2e8f0;
  --color-success: #16a34a;
  --color-danger: #dc2626;

  /* Espacements (échelle 4px) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* Typo */
  --font-sans: ui-sans-serif, system-ui, sans-serif;
  --text-sm: 14px;
  --text-md: 16px;
  --text-lg: 20px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-bg);
}
EOF

# Client API unique (CLAUDE.md §31)
cat > apps/web/src/api/client.ts <<'EOF'
// CLAUDE.md §31 : UN SEUL module API client. Aucun fetch() brut dans les composants.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include', // cookies httpOnly (CLAUDE.md §11)
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? 'UNKNOWN', body.message ?? res.statusText);
  }
  return (await res.json()) as T;
}
EOF

# -----------------------------------------------------------------------------
# 8. docker-compose (Postgres 16 healthchecké)
# -----------------------------------------------------------------------------
cyan "[8/10] docker-compose pour dev local..."
cat > docker-compose.yml <<'EOF'
services:
  postgres:
    image: postgres:16-alpine
    container_name: marchelink_postgres
    environment:
      POSTGRES_USER: marchelink
      POSTGRES_PASSWORD: marchelink
      POSTGRES_DB: marchelink_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/docker/init-test-db.sql:/docker-entrypoint-initdb.d/init-test-db.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U marchelink -d marchelink_dev"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  postgres_data:
EOF

cat > infra/docker/init-test-db.sql <<'EOF'
-- Base de test isolée (cf. CLAUDE.md §29).
CREATE DATABASE marchelink_test OWNER marchelink;
EOF

# -----------------------------------------------------------------------------
# 9. CI GitHub Actions
# -----------------------------------------------------------------------------
cyan "[9/10] Pipeline CI GitHub Actions..."
cat > .github/workflows/ci.yml <<'EOF'
name: ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  quality:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: marchelink
          POSTGRES_PASSWORD: marchelink
          POSTGRES_DB: marchelink_test
        ports: ['5432:5432']
        options: >-
          --health-cmd="pg_isready -U marchelink"
          --health-interval=5s
          --health-timeout=3s
          --health-retries=10

    env:
      DATABASE_URL: postgres://marchelink:marchelink@localhost:5432/marchelink_test
      DATABASE_URL_TEST: postgres://marchelink:marchelink@localhost:5432/marchelink_test
      JWT_ACCESS_SECRET: ci_only_access_secret_min_32_chars_xxxxx
      JWT_REFRESH_SECRET: ci_only_refresh_secret_min_32_chars_xxxx

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
EOF

# -----------------------------------------------------------------------------
# 10. README
# -----------------------------------------------------------------------------
cyan "[10/10] README..."
cat > README.md <<EOF
# ${PROJECT_NAME}

> Plateforme B2B multi-tenant connectant les grossistes d'Adjamé aux boutiquiers d'Abidjan.
> Capstone — *Engineering with Claude Code*, cohorte juin 2026.

## Stack
Node.js 20 · Express · Knex · PostgreSQL 16 · React 18 · Vite · TypeScript strict · Zod · pino · Helmet · Jest/Supertest · Vitest/RTL · Playwright · Docker · nginx · PM2

## Quickstart
\`\`\`bash
pnpm install
cp .env.example .env                # personnalise les secrets
docker compose up -d                # Postgres 16
pnpm -F api db:migrate
pnpm -F api dev                     # API → http://localhost:3000
pnpm -F web dev                     # Web → http://localhost:5173
\`\`\`

## Docs
- \`docs/PRD.md\` — Product Requirements (UC-01 à UC-22)
- \`CLAUDE.md\` — règles d'or pour Claude Code (à lire en premier)
- \`docs/ADR/\` — Architecture Decision Records (à venir)

## Domaine
Prod cible : \`https://marchelink.kanso.dev\`
EOF

green ""
green "============================================================"
green "  Scaffolding terminé."
green "============================================================"
green ""
green "Prochaines étapes :"
echo "  1.  pnpm install"
echo "  2.  cp .env.example .env  (et personnalise les secrets)"
echo "  3.  docker compose up -d"
echo "  4.  pnpm -F api dev   # http://localhost:3000/health doit répondre"
echo "  5.  Premier slice : auth module (UC-08, UC-21) en TDD."
echo ""
echo "Lis CLAUDE.md AVANT de lancer Claude Code."
