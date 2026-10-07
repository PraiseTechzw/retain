-- RLS policies are maintained by the ordered schema migrations.
-- This bootstrap script only enables RLS and deliberately creates no broad
-- signed-in-user policies; apply all migrations to install scoped policies.

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.exit_requests enable row level security;
alter table public.clearance_steps enable row level security;
alter table public.assets enable row level security;
alter table public.asset_history enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.audit_events enable row level security;
alter table public.system_settings enable row level security;
alter table public.notifications enable row level security;
