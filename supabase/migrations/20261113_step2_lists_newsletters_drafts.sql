-- IBVU database step 2 (website v6.03, 13 Nov 2026). Run once in the Supabase SQL editor.
-- It only ADDS things: nothing that exists is changed or removed, so the live
-- site keeps working while it runs. No email address is written in this file.
--
-- 1. Mailing lists (columns on newsletter_signups and contact_messages)
-- 2. Newsletters: issues and the record of every email sent
-- 3. Admin reminder emails: who receives them and the settings
-- 4. Draft changes to live articles, blog posts, events and pages
-- 5. The 5-minute timer that sends scheduled newsletters and reminders

-- ── 1. Mailing lists ─────────────────────────────────────────────────────
alter table public.newsletter_signups
  add column if not exists lists text[] not null default '{}',
  add column if not exists pending_lists text[] not null default '{}',
  add column if not exists source text not null default '',
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirm_token uuid not null default gen_random_uuid(),
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();
alter table public.newsletter_signups
  add constraint newsletter_known_lists check (
    lists <@ array['monthly','mailclub','business','research']::text[]
    and pending_lists <@ array['monthly','mailclub','business','research']::text[]
  );
create unique index if not exists newsletter_confirm_token on public.newsletter_signups (confirm_token);
create unique index if not exists newsletter_unsubscribe_token on public.newsletter_signups (unsubscribe_token);
alter table public.contact_messages
  add column if not exists wants_updates boolean not null default false;

-- ── 2. Newsletters ───────────────────────────────────────────────────────
create table public.newsletter_issues (
  id           uuid primary key default gen_random_uuid(),
  title        text not null default '',
  slug         text not null unique,
  subject      text not null default '',
  preview_text text not null default '',
  cover        text not null default '',
  body         text not null default '',
  lists        text[] not null default '{monthly}' check (lists <@ array['monthly','mailclub','business','research']::text[]),
  show_on_site boolean not null default true,
  -- draft → (scheduled) → sending → sent. Only the sending function sets sending / sent.
  status       text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent')),
  send_at      timestamptz,
  sent_at      timestamptz,
  sent_by      text not null default '',
  recipients   integer not null default 0,
  failures     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.newsletter_issues enable row level security;

-- Everyone may read issues that were sent and are shown on the website;
-- Owners and Editors read all of them.
create policy "issues: everyone reads sent and shown, editors read all"
  on public.newsletter_issues for select to anon, authenticated
  using ((status = 'sent' and show_on_site) or (select public.site_role()) in ('owner', 'editor'));
-- Editors write drafts; only Owners schedule. Sent issues cannot be edited.
create policy "issues: editors add drafts, owners may schedule"
  on public.newsletter_issues for insert to authenticated
  with check (((select public.site_role()) = 'editor' and status = 'draft') or ((select public.site_role()) = 'owner' and status in ('draft', 'scheduled')));
create policy "issues: change drafts and scheduled issues"
  on public.newsletter_issues for update to authenticated
  using ((select public.site_role()) in ('owner', 'editor') and status in ('draft', 'scheduled'))
  with check (((select public.site_role()) = 'editor' and status = 'draft') or ((select public.site_role()) = 'owner' and status in ('draft', 'scheduled')));
create policy "issues: delete drafts"
  on public.newsletter_issues for delete to authenticated
  using ((select public.site_role()) in ('owner', 'editor') and status = 'draft');

-- One row per email sent: the record of who received what.
create table public.newsletter_sends (
  id       uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.newsletter_issues (id) on delete cascade,
  email    text not null,
  status   text not null check (status in ('sent', 'failed')),
  error    text not null default '',
  sent_at  timestamptz not null default now(),
  unique (issue_id, email)
);
alter table public.newsletter_sends enable row level security;
revoke all on table public.newsletter_sends from anon;
create policy "sends: owners read" on public.newsletter_sends for select to authenticated using ((select public.site_role()) = 'owner');

-- How many confirmed people are on each list (Owners and Editors see the
-- numbers while writing an issue, without seeing the addresses).
create function public.newsletter_list_counts() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public.site_role() in ('owner', 'editor') then coalesce((
    select jsonb_object_agg(k, n) from (
      select k, count(*) as n
      from public.newsletter_signups s, unnest(s.lists) as k
      where s.unsubscribed_at is null
      group by k
    ) t), '{}'::jsonb) else '{}'::jsonb end
$$;
-- Owners can show or hide a sent issue on the website (its words cannot change).
create function public.newsletter_set_visible(issue uuid, visible boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.site_role() is distinct from 'owner' then raise exception 'Only an Owner can do this.'; end if;
  update public.newsletter_issues set show_on_site = visible where id = issue and status = 'sent';
end $$;
revoke all on function public.newsletter_list_counts() from public, anon;
revoke all on function public.newsletter_set_visible(uuid, boolean) from public, anon;
grant execute on function public.newsletter_list_counts() to authenticated;
grant execute on function public.newsletter_set_visible(uuid, boolean) to authenticated;

-- ── 3. Admin reminder emails ─────────────────────────────────────────────
create table public.admin_reminder_recipients (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.admin_reminder_recipients enable row level security;
revoke all on table public.admin_reminder_recipients from anon;
create policy "reminder people: owners read"   on public.admin_reminder_recipients for select to authenticated using ((select public.site_role()) = 'owner');
create policy "reminder people: owners add"    on public.admin_reminder_recipients for insert to authenticated with check ((select public.site_role()) = 'owner');
create policy "reminder people: owners remove" on public.admin_reminder_recipients for delete to authenticated using ((select public.site_role()) = 'owner');

create table public.newsletter_reminder_settings (
  id             integer primary key default 1 check (id = 1),
  due_enabled    boolean not null default true,
  due_day        integer not null default 25 check (due_day between 1 and 28),
  due_list       text not null default 'monthly' check (due_list in ('monthly', 'mailclub', 'business', 'research')),
  before_enabled boolean not null default true,
  before_hours   integer not null default 24 check (before_hours between 1 and 168),
  after_enabled  boolean not null default true,
  updated_at     timestamptz not null default now()
);
insert into public.newsletter_reminder_settings (id) values (1) on conflict (id) do nothing;
alter table public.newsletter_reminder_settings enable row level security;
revoke all on table public.newsletter_reminder_settings from anon;
create policy "reminder settings: owners read"   on public.newsletter_reminder_settings for select to authenticated using ((select public.site_role()) = 'owner');
create policy "reminder settings: owners change" on public.newsletter_reminder_settings for update to authenticated using ((select public.site_role()) = 'owner') with check ((select public.site_role()) = 'owner');

-- Which reminders have gone out, so none is sent twice. Only the server uses it.
create table public.admin_reminders_sent (
  key     text primary key,
  sent_at timestamptz not null default now()
);
alter table public.admin_reminders_sent enable row level security;
revoke all on table public.admin_reminders_sent from anon, authenticated;

-- ── 4. Draft changes to live content ─────────────────────────────────────
-- Changes saved as a draft for something already live. The live version stays
-- as it is until someone with the right role publishes the changes.
create table public.content_drafts (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('event', 'article', 'page')),
  item_key   text not null,
  data       jsonb not null,
  saved_by   text not null default '',
  updated_at timestamptz not null default now(),
  unique (kind, item_key)
);
alter table public.content_drafts enable row level security;
revoke all on table public.content_drafts from anon;
create policy "drafts: staff read" on public.content_drafts for select to authenticated using ((select public.site_role()) is not null);
create policy "drafts: staff add"
  on public.content_drafts for insert to authenticated
  with check ((select public.site_role()) in ('owner', 'editor') or ((select public.site_role()) = 'writer' and kind <> 'page'));
create policy "drafts: staff change"
  on public.content_drafts for update to authenticated
  using ((select public.site_role()) in ('owner', 'editor') or ((select public.site_role()) = 'writer' and kind <> 'page'))
  with check ((select public.site_role()) in ('owner', 'editor') or ((select public.site_role()) = 'writer' and kind <> 'page'));
create policy "drafts: staff remove"
  on public.content_drafts for delete to authenticated
  using ((select public.site_role()) in ('owner', 'editor') or ((select public.site_role()) = 'writer' and kind <> 'page'));

-- ── 5. The timer ─────────────────────────────────────────────────────────
-- Every 5 minutes, ask the send-newsletter function to send anything that is
-- due (scheduled issues, reminders). Asking early does nothing: the function
-- only ever sends what is due, and never sends the same thing twice. The key
-- below is the site's public key, which is already visible on the website.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule(
  'ibvu-newsletter-timer',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://ctaqrokulhezjrlojdjf.supabase.co/functions/v1/send-newsletter',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0YXFyb2t1bGhlempybG9qZGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDYxNzUsImV4cCI6MjA4ODQ4MjE3NX0.P8oDzn9ws_pU6bB6Aj1A1s979Gk4ut3rIvsRfYcbhyM"}'::jsonb,
    body := '{"action": "tick"}'::jsonb
  );
  $cron$
);
