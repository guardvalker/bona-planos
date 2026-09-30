-- ============================================================================
-- bona-planos — sync opcional de planos entre dispositivos (una fila por plano).
-- Ejecutar completo en el SQL Editor del proyecto Supabase (Database > SQL Editor >
-- New query > pegar todo > Run). Prefijo `bp_` para no chocar con otras apps que
-- comparten el proyecto.
-- ============================================================================

create table if not exists bp_plans (
  id uuid primary key,                     -- id del plano (lo genera el cliente)
  owner uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null default '',
  data jsonb not null,                     -- el plano completo (mismo JSON que exporta la app)
  updated_at timestamptz not null default now()   -- la app manda el updatedAt del plano
);

create index if not exists bp_plans_owner_idx on bp_plans (owner);

alter table bp_plans enable row level security;

-- RLS por sí sola no alcanza si el rol `authenticated` no tiene el permiso base.
grant select, insert, update, delete on bp_plans to authenticated;

-- Cada cuenta ve y modifica únicamente sus propios planos.
drop policy if exists "bp_plans_own" on bp_plans;
create policy "bp_plans_own" on bp_plans
  for all using (owner = auth.uid()) with check (owner = auth.uid());
