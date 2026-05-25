# marchelink

> Plateforme B2B multi-tenant connectant les grossistes d'Adjamé aux boutiquiers d'Abidjan.
> Capstone — *Engineering with Claude Code*, cohorte juin 2026.

## Stack
Node.js 20 · Express · Knex · PostgreSQL 16 · React 18 · Vite · TypeScript strict · Zod · pino · Helmet · Jest/Supertest · Vitest/RTL · Playwright · Docker · nginx · PM2

## Quickstart
```bash
pnpm install
cp .env.example .env                # personnalise les secrets
docker compose up -d                # Postgres 16
pnpm -F api db:migrate
pnpm -F api dev                     # API → http://localhost:3000
pnpm -F web dev                     # Web → http://localhost:5173
```

## Docs
- `docs/PRD.md` — Product Requirements (UC-01 à UC-22)
- `CLAUDE.md` — règles d'or pour Claude Code (à lire en premier)
- `docs/ADR/` — Architecture Decision Records (à venir)

## Domaine
Prod cible : `https://marchelink.kanso.dev`
