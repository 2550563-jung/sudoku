create table if not exists public.sudoku_account_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  progression jsonb not null default '{}'::jsonb,
  difficulty_stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.sudoku_account_profiles enable row level security;

drop policy if exists "sudoku account profiles select own" on public.sudoku_account_profiles;
create policy "sudoku account profiles select own"
on public.sudoku_account_profiles for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "sudoku account profiles insert own" on public.sudoku_account_profiles;
create policy "sudoku account profiles insert own"
on public.sudoku_account_profiles for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "sudoku account profiles update own" on public.sudoku_account_profiles;
create policy "sudoku account profiles update own"
on public.sudoku_account_profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.sudoku_account_profiles to authenticated;
revoke all on public.sudoku_account_profiles from anon;
