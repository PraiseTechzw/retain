# Contributing to CUT-ELAMS

Thank you for helping improve CUT-ELAMS. Changes should preserve employee privacy, least-privilege access, and clear separation between application behavior and institutional policy.

## Before you start

- Read the [system overview](docs/system-overview.md), [security model](docs/security.md), and [requirements audit](docs/requirements-audit.md).
- Use a private development or staging Supabase project with synthetic records. Never use production employee data for local screenshots or tests.
- Do not commit `.env`, `.env.local`, Supabase/Resend credentials, signed URLs, or real employee data.

## Local setup

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Populate local environment variables with test-project values. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Node.js 22 and pnpm are the supported local setup for this repository.

## Change workflow

1. Create a short-lived branch from the default branch.
2. Make the smallest coherent change that satisfies an issue or approved requirement.
3. If database behavior changes, include a new, ordered migration and document its data/security impact. Do not silently rewrite or delete a migration that may already be deployed; reconcile migration history with the project owner first.
4. If roles or staff data paths change, update both server-side checks and database policies, then add direct role/ownership acceptance scenarios.
5. Update the README, system overview, operations guide, and requirements audit when behavior or operating steps change.
6. Run `pnpm lint`, `pnpm typecheck`, and `pnpm build`. Test SQL and Edge Function changes in Supabase staging; include the exact environments and outcomes in the pull request.
7. Open a pull request using the template. Do not deploy or apply production migrations from an unreviewed change.

## Review expectations

Pull requests should explain the user-facing behavior, affected roles, data changes, migration/rollback considerations, privacy/security implications, and validation. For analytics or risk-scoring changes, document inputs, thresholds, limitations, and validation evidence. Do not claim that operational targets have been achieved without measured results.

## Useful commands

```bash
pnpm lint
pnpm typecheck
pnpm build
```

The scheduled notification Edge Function uses Deno and Supabase Edge Function APIs; validate it with the Deno/Supabase tooling in the staging workflow. Never send real digest emails from development.
