-- IBVU: step 1 of the database work (approved by Tatenda, 12 Nov 2026).
-- ADDS new tables, image storage and rules. It does not change or remove
-- anything that exists, so the current live site keeps working as it is.
-- No email address is written in this file.

-- ── People: who may sign in to admin, and with which role ────────────────
create table public.site_people (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique check (email = lower(email)),
  role        text not null check (role in ('owner', 'editor', 'writer')),
  herb_review boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.site_people enable row level security;

-- The role of the person making the request, or null if they are not on the
-- People list. It looks the person up by their verified sign-in, so it cannot
-- be faked from the browser.
create function public.site_role() returns text
language sql stable security definer set search_path = '' as $$
  select p.role
  from public.site_people p
  join auth.users u on lower(u.email) = p.email
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null
$$;

-- True for Owners and for people with the herb review tick.
create function public.site_can_review_herbs() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p.role = 'owner' or p.herb_review
    from public.site_people p
    join auth.users u on lower(u.email) = p.email
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
  ), false)
$$;

revoke all on function public.site_role() from public;
revoke all on function public.site_can_review_herbs() from public;
grant execute on function public.site_role() to anon, authenticated, service_role;
grant execute on function public.site_can_review_herbs() to anon, authenticated, service_role;

-- There must always be at least one Owner.
create function public.site_people_keep_an_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.site_people where role = 'owner') then
    raise exception 'There must always be at least one Owner.';
  end if;
  return null;
end $$;
create trigger site_people_keep_an_owner
  after update or delete on public.site_people
  for each statement execute function public.site_people_keep_an_owner();

create policy "people: signed-in staff see their own entry, owners see all"
  on public.site_people for select to authenticated
  using ((select public.site_role()) = 'owner' or email = lower(coalesce((select auth.jwt()) ->> 'email', '')));
create policy "people: owners add"    on public.site_people for insert to authenticated with check ((select public.site_role()) = 'owner');
create policy "people: owners change" on public.site_people for update to authenticated using ((select public.site_role()) = 'owner') with check ((select public.site_role()) = 'owner');
create policy "people: owners remove" on public.site_people for delete to authenticated using ((select public.site_role()) = 'owner');

-- The first Owners are the people who can already sign in to herb review.
insert into public.site_people (email, role, herb_review)
select distinct lower(email), 'owner', true
from auth.users
where email is not null and email_confirmed_at is not null
on conflict (email) do nothing;

-- ── Events ───────────────────────────────────────────────────────────────
create table public.site_events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default '',
  event_date  date,
  event_time  text not null default '',
  location    text not null default '',
  description text not null default '',
  image       text not null default '',
  booking_url text not null default '',
  status      text not null default 'draft' check (status in ('draft', 'published')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.site_events enable row level security;
create policy "events: everyone reads published, staff read all"
  on public.site_events for select to anon, authenticated
  using (status = 'published' or (select public.site_role()) is not null);
create policy "events: editors add anything, writers add drafts"
  on public.site_events for insert to authenticated
  with check ((select public.site_role()) in ('owner', 'editor') or ((select public.site_role()) = 'writer' and status = 'draft'));
create policy "events: editors change anything, writers change drafts"
  on public.site_events for update to authenticated
  using ((select public.site_role()) in ('owner', 'editor') or ((select public.site_role()) = 'writer' and status = 'draft'))
  with check ((select public.site_role()) in ('owner', 'editor') or ((select public.site_role()) = 'writer' and status = 'draft'));
create policy "events: editors delete"
  on public.site_events for delete to authenticated
  using ((select public.site_role()) in ('owner', 'editor'));

-- ── Articles (Media) and blog posts ──────────────────────────────────────
create table public.site_articles (
  id           uuid primary key default gen_random_uuid(),
  section      text not null default 'media' check (section in ('media', 'blog')),
  title        text not null default '',
  slug         text not null unique,
  summary      text not null default '',
  cover        text not null default '',
  author       text not null default '',
  body         text not null default '',
  status       text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.site_articles enable row level security;
create policy "articles: everyone reads published, staff read all"
  on public.site_articles for select to anon, authenticated
  using (status = 'published' or (select public.site_role()) is not null);
create policy "articles: editors add anything, writers add drafts"
  on public.site_articles for insert to authenticated
  with check ((select public.site_role()) in ('owner', 'editor') or ((select public.site_role()) = 'writer' and status = 'draft'));
create policy "articles: editors change anything, writers change drafts"
  on public.site_articles for update to authenticated
  using ((select public.site_role()) in ('owner', 'editor') or ((select public.site_role()) = 'writer' and status = 'draft'))
  with check ((select public.site_role()) in ('owner', 'editor') or ((select public.site_role()) = 'writer' and status = 'draft'));
create policy "articles: editors delete"
  on public.site_articles for delete to authenticated
  using ((select public.site_role()) in ('owner', 'editor'));

-- ── Page wording edited in admin (one row per page) ──────────────────────
create table public.site_pages (
  key        text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_pages enable row level security;
create policy "pages: everyone reads" on public.site_pages for select to anon, authenticated using (true);
create policy "pages: editors add"    on public.site_pages for insert to authenticated with check ((select public.site_role()) in ('owner', 'editor'));
create policy "pages: editors change" on public.site_pages for update to authenticated using ((select public.site_role()) in ('owner', 'editor')) with check ((select public.site_role()) in ('owner', 'editor'));
create policy "pages: editors reset"  on public.site_pages for delete to authenticated using ((select public.site_role()) in ('owner', 'editor'));

-- ── History: who changed what (by role, never by email address) ──────────
create table public.site_history (
  id     uuid primary key default gen_random_uuid(),
  at     timestamptz not null default now(),
  who    text not null default '',
  action text not null default '',
  kind   text not null default '',
  title  text not null default ''
);
alter table public.site_history enable row level security;
create index site_history_at on public.site_history (at desc);
create policy "history: editors read" on public.site_history for select to authenticated using ((select public.site_role()) in ('owner', 'editor'));
create policy "history: staff add"    on public.site_history for insert to authenticated with check ((select public.site_role()) is not null);

-- ── Herb photos ──────────────────────────────────────────────────────────
create table public.herb_photos (
  id          uuid primary key default gen_random_uuid(),
  herb_key    text not null,
  herb_name   text not null,
  image_path  text not null,
  status      text not null default 'pending' check (status in ('pending', 'approved')),
  source      text not null default 'submission' check (source in ('submission', 'admin')),
  permission  boolean not null default false,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.herb_photos enable row level security;
create unique index herb_photos_one_approved_per_herb on public.herb_photos (herb_key) where status = 'approved';
create policy "herb photos: everyone sees approved, reviewers see all"
  on public.herb_photos for select to anon, authenticated
  using (status = 'approved' or (select public.site_can_review_herbs()));
create policy "herb photos: reviewers add"    on public.herb_photos for insert to authenticated with check ((select public.site_can_review_herbs()));
create policy "herb photos: reviewers change" on public.herb_photos for update to authenticated using ((select public.site_can_review_herbs())) with check ((select public.site_can_review_herbs()));
create policy "herb photos: reviewers remove" on public.herb_photos for delete to authenticated using ((select public.site_can_review_herbs()));

-- ── Contact messages and newsletter sign-ups (private) ───────────────────
-- Visitors cannot write to these directly. The site's form function saves
-- them after the spam check. Only Owners can read them.
create table public.contact_messages (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null,
  organisation text not null default '',
  enquiry_type text not null default '',
  message      text not null,
  created_at   timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
create policy "messages: owners read"   on public.contact_messages for select to authenticated using ((select public.site_role()) = 'owner');
create policy "messages: owners delete" on public.contact_messages for delete to authenticated using ((select public.site_role()) = 'owner');

create table public.newsletter_signups (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique check (email = lower(email)),
  first_name      text not null default '',
  last_name       text not null default '',
  consent_at      timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at      timestamptz not null default now()
);
alter table public.newsletter_signups enable row level security;
create policy "sign-ups: owners read"   on public.newsletter_signups for select to authenticated using ((select public.site_role()) = 'owner');
create policy "sign-ups: owners change" on public.newsletter_signups for update to authenticated using ((select public.site_role()) = 'owner') with check ((select public.site_role()) = 'owner');
create policy "sign-ups: owners delete" on public.newsletter_signups for delete to authenticated using ((select public.site_role()) = 'owner');

-- ── Image storage ────────────────────────────────────────────────────────
-- site-images: pictures shown on the site (articles, events, pages, approved
-- herb photos). Anyone can view a picture by its address; only staff can add.
-- herb-photo-submissions: photos sent in by visitors, private until approved.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('site-images', 'site-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('herb-photo-submissions', 'herb-photo-submissions', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "site-images: staff add"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'site-images' and (select public.site_role()) is not null);
create policy "site-images: editors and reviewers change"
  on storage.objects for update to authenticated
  using (bucket_id = 'site-images' and ((select public.site_role()) in ('owner', 'editor') or (select public.site_can_review_herbs())))
  with check (bucket_id = 'site-images' and ((select public.site_role()) in ('owner', 'editor') or (select public.site_can_review_herbs())));
create policy "site-images: editors and reviewers remove"
  on storage.objects for delete to authenticated
  using (bucket_id = 'site-images' and ((select public.site_role()) in ('owner', 'editor') or (select public.site_can_review_herbs())));
create policy "herb-photo-submissions: reviewers view"
  on storage.objects for select to authenticated
  using (bucket_id = 'herb-photo-submissions' and (select public.site_can_review_herbs()));
create policy "herb-photo-submissions: reviewers remove"
  on storage.objects for delete to authenticated
  using (bucket_id = 'herb-photo-submissions' and (select public.site_can_review_herbs()));
