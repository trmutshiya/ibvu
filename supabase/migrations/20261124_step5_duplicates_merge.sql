-- IBVU v6.15 — database step 5: catching duplicate herbs and merging them.
-- Only adds: no existing column, row or rule is changed or removed, so the live site keeps
-- working before and after. The website works without this step too (the new parts simply
-- stay switched off until it is run).
--
-- 1. herb_merges: one row per herb that was merged into another. The merged-away herb is
--    hidden from the Herbarium (not deleted) and its address forwards to the kept herb.
--    Undo = delete the row. A herb is named "approved:<id>" (published herbs) or
--    "builtin:<id>" (the built-in herbs).
-- 2. herb_not_duplicates: pairs an admin marked "not a duplicate", so they stay off the
--    Possible duplicates list.
-- 3. submissions: a submission can be "additions to an existing herb" (target_herb), with a
--    short note of why it matched.

create table if not exists public.herb_merges (
  from_ref   text primary key check (char_length(from_ref) <= 80),
  into_ref   text not null check (char_length(into_ref) <= 80),
  from_name  text check (char_length(from_name) <= 200),
  into_name  text check (char_length(into_name) <= 200),
  merged_at  timestamptz not null default now(),
  merged_by  text,                 -- the role ("Owner"), never an email address
  before     jsonb                 -- the kept herb's values before the merge, for Undo
);
alter table public.herb_merges enable row level security;
-- Visitors need to know which herbs are merged (to hide them and forward their address).
create policy "herb merges: everyone reads" on public.herb_merges
  for select to anon, authenticated using (true);
create policy "herb merges: reviewers add" on public.herb_merges
  for insert to authenticated with check ((select site_can_review_herbs()));
create policy "herb merges: reviewers change" on public.herb_merges
  for update to authenticated using ((select site_can_review_herbs())) with check ((select site_can_review_herbs()));
create policy "herb merges: reviewers remove" on public.herb_merges
  for delete to authenticated using ((select site_can_review_herbs()));
revoke all on public.herb_merges from anon;
grant select (from_ref, into_ref) on public.herb_merges to anon;
grant select, insert, update, delete on public.herb_merges to authenticated;

create table if not exists public.herb_not_duplicates (
  pair       text primary key check (char_length(pair) <= 170),
  created_at timestamptz not null default now(),
  created_by text
);
alter table public.herb_not_duplicates enable row level security;
create policy "not duplicates: reviewers read" on public.herb_not_duplicates
  for select to authenticated using ((select site_can_review_herbs()));
create policy "not duplicates: reviewers add" on public.herb_not_duplicates
  for insert to authenticated with check ((select site_can_review_herbs()));
create policy "not duplicates: reviewers remove" on public.herb_not_duplicates
  for delete to authenticated using ((select site_can_review_herbs()));
revoke all on public.herb_not_duplicates from anon;
grant select, insert, delete on public.herb_not_duplicates to authenticated;

alter table public.submissions add column if not exists target_herb text;
alter table public.submissions add column if not exists target_name text;
alter table public.submissions add column if not exists match_note  text;
do $$ begin
  alter table public.submissions add constraint submissions_target_sizes
    check (char_length(coalesce(target_herb,'')) <= 80 and char_length(coalesce(target_name,'')) <= 200 and char_length(coalesce(match_note,'')) <= 500);
exception when duplicate_object then null; end $$;
-- Visitors may fill these in when they send a submission (they still cannot read submissions).
grant insert (target_herb, target_name, match_note) on public.submissions to anon;
