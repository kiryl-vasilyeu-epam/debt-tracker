# Debt Tracker

React + TypeScript app with shared storage via Supabase.

## Why this stack

GitHub Pages hosts only static files, so it cannot store shared mutable data by itself.
Supabase solves this by providing:

- PostgreSQL database for people, transactions and balances
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

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('gave', 'took', 'gave_for')),
  from_person_id uuid not null,
  from_person_name text,
  to_person_id uuid not null,
  to_person_name text,
  for_person_id uuid,
  for_person_name text,
  amount_hkd numeric(12,2) not null check (amount_hkd > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.balances (
  id text primary key,
  debtor_id uuid not null,
  debtor_name text,
  creditor_id uuid not null,
  creditor_name text,
  amount_hkd numeric(12,2) not null check (amount_hkd > 0),
  created_at timestamptz not null default now()
);

alter table public.people enable row level security;
alter table public.transactions enable row level security;
alter table public.balances enable row level security;

create policy "Allow public read people"
on public.people
for select
to anon
using (true);

create policy "Allow public insert people"
on public.people
for insert
to anon
with check (true);

create policy "Allow public delete people"
on public.people
for delete
to anon
using (true);

create policy "Allow public upsert people"
on public.people
for update
to anon
using (true)
with check (true);

create policy "Allow public read transactions"
on public.transactions
for select
to anon
using (true);

create policy "Allow public insert transactions"
on public.transactions
for insert
to anon
with check (true);

create policy "Allow public delete transactions"
on public.transactions
for delete
to anon
using (true);

create policy "Allow public read balances"
on public.balances
for select
to anon
using (true);

create policy "Allow public upsert balances"
on public.balances
for update
to anon
using (true)
with check (true);

create policy "Allow public insert balances"
on public.balances
for insert
to anon
with check (true);

create policy "Allow public delete balances"
on public.balances
for delete
to anon
using (true);
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
- Local browser storage is used only for UI preferences (active person and selected debt tab per person).
- People, balances and transaction history are now loaded from Supabase only.
- Transaction history is loaded lazily when user opens history/transactions tab.

## SQL migration for notes in transactions

If the `transactions` table is already created, run this in Supabase SQL Editor:

```sql
alter table public.transactions
add column if not exists note text;
```

Optional limit for small notes (up to 280 chars):

```sql
alter table public.transactions
drop constraint if exists transactions_note_length_check;

alter table public.transactions
add constraint transactions_note_length_check
check (note is null or char_length(note) <= 280);
```
