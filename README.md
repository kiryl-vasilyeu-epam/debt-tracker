# Debt Tracker

React + TypeScript app with shared realtime storage via Supabase.

## Why this stack

GitHub Pages hosts only static files, so it cannot store shared mutable data by itself.
Supabase solves this by providing:

- PostgreSQL database for debt records
- Realtime subscriptions so all users instantly see updates
- Simple REST and JS client integration for static apps

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy env template and fill values:

```bash
cp .env.example .env.local
```

3. In Supabase SQL Editor, run:

```sql
create extension if not exists "pgcrypto";

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  person text not null,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now()
);

alter table public.debts enable row level security;

create policy "Allow public read debts"
on public.debts
for select
to anon
using (true);

create policy "Allow public insert debts"
on public.debts
for insert
to anon
with check (true);

create policy "Allow public delete debts"
on public.debts
for delete
to anon
using (true);

alter publication supabase_realtime add table public.debts;
```

4. Start dev server:

```bash
npm run dev
```

## GitHub Pages deploy

The repo includes workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

1. Add repository secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

2. In GitHub repo settings, open Pages and set source to GitHub Actions.
3. Push to `main` branch.
4. Workflow builds and publishes automatically.

## Notes for production

- Current RLS policies allow anonymous read/insert/delete to keep collaboration frictionless.
- If you need user-specific permissions, add Supabase Auth and tighten policies by `auth.uid()`.
