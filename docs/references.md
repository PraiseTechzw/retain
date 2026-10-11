# Technical references

These links point to vendor-maintained documentation consulted while documenting repository practices. The repository's source code and migrations remain authoritative for CUT-ELAMS-specific behavior.

## GitHub repository documentation

- [About repository README files](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes) — README purpose, placement, relative links, and discoverability.
- [Creating diagrams](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams) — Mermaid code blocks and supported rendering locations in GitHub Markdown.
- [Setting guidelines for repository contributors](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors) — `CONTRIBUTING.md` and contribution templates.
- [Privately reporting a security vulnerability](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) — private vulnerability reporting when enabled by repository owners.
- [About issue and pull request templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates) — standardized issue and pull request intake.

## Next.js

- [Environment variables](https://nextjs.org/docs/app/guides/environment-variables) — server environment loading and `NEXT_PUBLIC_` browser bundling.
- [TypeScript configuration](https://nextjs.org/docs/app/api-reference/config/typescript) — production build type checks and the implications of `ignoreBuildErrors`.
- [Data security](https://nextjs.org/docs/app/guides/data-security) — handling secrets and server-side data access.

## Supabase

- [API keys](https://supabase.com/docs/guides/getting-started/api-keys) — publishable versus elevated secret/service-role keys and RLS bypass behavior.
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — grants, policies, and database authorization.
- [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions) — using `pg_cron`, `pg_net`, and Vault for scheduled function calls.
- [Database migrations](https://supabase.com/docs/guides/deployment/database-migrations) — versioned migration workflow, status comparison, and deployment coordination.
- [Supabase with Next.js](https://supabase.com/docs/guides/auth/quickstarts/nextjs) — environment setup and authenticated Next.js applications.

Review vendor documentation again when upgrading major versions or changing deployment strategy.
