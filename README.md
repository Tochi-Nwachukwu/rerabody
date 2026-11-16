# Rera Body store

Next.js 16 storefront and admin for Rera Body (body butters and nightwear). Postgres through Prisma 7, Better Auth, Stripe Checkout, Cloudflare R2, Resend.

- Build brief: `docs/BUILD_PLAN.md`, `docs/build-plan.md`
- Choices made during the build: `docs/decisions.md`
- Deploying: `docs/deploy.md`
- For the store owner: `docs/admin-guide.md`

## Local setup

Needs Node 22+, pnpm 10 and Postgres 16.

```bash
pnpm install
cp .env.example .env    # fill in values; see below
createdb rerabody && createdb rerabody_test && createdb rerabody_e2e
pnpm db:migrate && pnpm db:seed
pnpm dev
```

For local work without third-party accounts, set in `.env`:

```bash
PAYMENT_PROVIDER=fake     # test payment page instead of Stripe
EMAIL_TRANSPORT=log       # emails written to .emails/outbox.jsonl
STORAGE_DRIVER=local      # uploads stored in .uploads/
TEST_DATABASE_URL=postgresql://localhost:5432/rerabody_test
E2E_DATABASE_URL=postgresql://localhost:5432/rerabody_e2e
```

The other service keys still need a non-empty value (placeholders are fine with the settings above).

## Scripts

| Script                                       | What it does                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm dev`                                   | Development server                                                                               |
| `pnpm typecheck`, `pnpm lint`, `pnpm format` | Checks and formatting                                                                            |
| `pnpm test`                                  | Vitest unit and integration tests (uses `TEST_DATABASE_URL`, wiped between tests)                |
| `pnpm test:e2e`                              | Playwright suite (resets, migrates and seeds `E2E_DATABASE_URL`, builds and serves on port 3100) |
| `pnpm db:migrate`                            | Apply committed migrations (non-interactive)                                                     |
| `pnpm db:migrate:dev --name x`               | Create a new migration in development                                                            |
| `pnpm db:seed`                               | Roles, owner account and placeholder content                                                     |

## Layout

Server Actions in `src/server/actions` parse input with Zod, check the session and permission, then call a service in `src/server/services`. Services take a Prisma client and hold the business rules; they are what the tests cover. Route handlers exist only for webhooks, cron, upload presigning and search suggestions.
