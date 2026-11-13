-- IBVU: step 3 of the database work — sending articles and blog posts for review,
-- taking them back, and comments (website v6.11, 13 Nov 2026).
-- ADDS two private tables and two read functions, and adds one check to the rule
-- that lets Writers change drafts (a Writer cannot change an article while it is
-- waiting for review). Nothing is removed. Safe to run more than once.
-- No email address is written in this file.
--
-- How it works:
-- - Writers, Editors and Owners never write to these tables directly. Every step
--   (send for review, take back, send back, comment, mark done, published) goes
--   through the article-review server function, which checks the person's role
--   and the article's state, and sends the emails.
-- - Staff read them through the two functions below, which leave out email
--   addresses (comments show the role, as the History page does).

-- ── 1. Where each article is in the review ──────────────────────────────────
create table if not exists public.article_reviews (
  article_id   uuid primary key references public.site_articles (id) on delete cascade,
  state        text not null default 'draft' check (state in ('draft', 'review', 'changes')),
  writer_email text not null default '',   -- who sent it for review (private)
  note         text not null default '',   -- the Writer's note when sending
  sent_at      timestamptz,
  back_note    text not null default '',   -- the note when it was sent back
  back_by      text not null default '',   -- the role of who sent it back ("Editor", "Owner")
  log          jsonb not null default '[]'::jsonb,  -- [{ at, who (role), what }]
  updated_at   timestamptz not null default now()
);
alter table public.article_reviews enable row level security;
revoke all on table public.article_reviews from anon, authenticated;

-- ── 2. Comments ──────────────────────────────────────────────────────────────
create table if not exists public.article_comments (
  id           uuid primary key default gen_random_uuid(),
  article_id   uuid not null references public.site_articles (id) on delete cascade,
  parent_id    uuid references public.article_comments (id) on delete cascade,  -- a reply
  author_email text not null,              -- private
  author_role  text not null check (author_role in ('owner', 'editor', 'writer')),
  quote        text not null default '',   -- the words it is about ('' = the whole article)
  mark_id      text not null default '',   -- the highlight in the text
  body         text not null check (char_length(body) between 1 and 2000),
  resolved     boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists article_comments_article on public.article_comments (article_id, created_at);
alter table public.article_comments enable row level security;
revoke all on table public.article_comments from anon, authenticated;

-- ── 3. Reading (staff only, without email addresses) ─────────────────────────
create or replace function public.article_reviews_list() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public.site_role() is null then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object(
      'article_id', r.article_id, 'state', r.state, 'note', r.note, 'sent_at', r.sent_at,
      'back_note', r.back_note, 'back_by', r.back_by, 'log', r.log, 'updated_at', r.updated_at,
      'sent_by_me', r.writer_email = lower(coalesce((select auth.jwt()) ->> 'email', ''))))
    from public.article_reviews r), '[]'::jsonb) end
$$;
create or replace function public.article_comments_list() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public.site_role() is null then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'article_id', c.article_id, 'parent_id', c.parent_id, 'author_role', c.author_role,
      'quote', c.quote, 'mark_id', c.mark_id, 'body', c.body, 'resolved', c.resolved, 'created_at', c.created_at,
      'mine', c.author_email = lower(coalesce((select auth.jwt()) ->> 'email', ''))) order by c.created_at)
    from public.article_comments c), '[]'::jsonb) end
$$;
revoke all on function public.article_reviews_list() from public, anon;
revoke all on function public.article_comments_list() from public, anon;
grant execute on function public.article_reviews_list() to authenticated;
grant execute on function public.article_comments_list() to authenticated;

-- ── 4. A Writer cannot change an article while it is waiting for review ───────
-- (Editors and Owners can, as before. The Writer can take it back first.)
create or replace function public.article_waiting_for_review(article uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.article_reviews r where r.article_id = article and r.state = 'review')
$$;
revoke all on function public.article_waiting_for_review(uuid) from public, anon;
grant execute on function public.article_waiting_for_review(uuid) to authenticated;

drop policy if exists "articles: editors change anything, writers change drafts" on public.site_articles;
create policy "articles: editors change anything, writers change drafts"
  on public.site_articles for update to authenticated
  using ((select public.site_role()) in ('owner', 'editor')
         or ((select public.site_role()) = 'writer' and status = 'draft' and not public.article_waiting_for_review(id)))
  with check ((select public.site_role()) in ('owner', 'editor')
         or ((select public.site_role()) = 'writer' and status = 'draft' and not public.article_waiting_for_review(id)));
