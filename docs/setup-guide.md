# Setup Guide

## Prerequisites

- Node.js 22 or later
- pnpm 10 or later
- Docker Desktop or compatible Docker runtime

## First-time setup

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Run `pnpm install`.
4. Run `pnpm prisma:generate`.
5. Run `pnpm prisma:migrate`.
6. Run `pnpm dev`.

## Available apps

- API: `apps/api`
- Web: `apps/web`

## First module boundaries

The foundation intentionally stops at shell-level application scaffolding. Business entities, permissions, audit workflows, SharePoint integrations, and scheduler behavior will be added in later modules.
