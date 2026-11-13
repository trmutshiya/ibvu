-- IBVU: step 4a of the database work — the security fix, part A (website v6.12, 13 Nov 2026).
-- Run this BEFORE pushing website v6.12. It only ADDS: the live site keeps working as it is.
-- No email address is written in this file.
--
-- 1. Herb reviewers (Owners, or people with the herb review tick) can read and change the
--    herb review tables while signed in. v6.12 uses this; the old public-key access is
--    removed afterwards in step 4b.
-- 2. Email addresses are taken out of the herb edit log and the "updated by" of published
--    herbs: each becomes the person's role ("Owner", "Editor", "Writer"), or "Admin" if the
--    address is not on the People list. Submitters' addresses are taken out of the log.

-- ── 1. Signed-in herb reviewers ──────────────────────────────────────────────
drop policy if exists "herbs: reviewers read everything" on public.approved_herbs;
drop policy if exists "herbs: reviewers add" on public.approved_herbs;
drop policy if exists "herbs: reviewers change" on public.approved_herbs;
drop policy if exists "herbs: reviewers remove" on public.approved_herbs;
create policy "herbs: reviewers read everything" on public.approved_herbs for select to authenticated using ((select public.site_can_review_herbs()));
create policy "herbs: reviewers add" on public.approved_herbs for insert to authenticated with check ((select public.site_can_review_herbs()));
create policy "herbs: reviewers change" on public.approved_herbs for update to authenticated using ((select public.site_can_review_herbs())) with check ((select public.site_can_review_herbs()));
create policy "herbs: reviewers remove" on public.approved_herbs for delete to authenticated using ((select public.site_can_review_herbs()));

drop policy if exists "submissions: reviewers read" on public.submissions;
drop policy if exists "submissions: reviewers change" on public.submissions;
create policy "submissions: reviewers read" on public.submissions for select to authenticated using ((select public.site_can_review_herbs()));
create policy "submissions: reviewers change" on public.submissions for update to authenticated using ((select public.site_can_review_herbs())) with check ((select public.site_can_review_herbs()));

drop policy if exists "herb edits: reviewers read" on public.herb_edits;
drop policy if exists "herb edits: reviewers add" on public.herb_edits;
create policy "herb edits: reviewers read" on public.herb_edits for select to authenticated using ((select public.site_can_review_herbs()));
create policy "herb edits: reviewers add" on public.herb_edits for insert to authenticated with check ((select public.site_can_review_herbs()));

-- ── 2. No email addresses where they do not belong ────────────────────────────
update public.herb_edits e
   set changed_by = coalesce((select initcap(p.role) from public.site_people p where p.email = lower(trim(e.changed_by))), 'Admin')
 where e.changed_by like '%@%';
update public.approved_herbs h
   set updated_by = coalesce((select initcap(p.role) from public.site_people p where p.email = lower(trim(h.updated_by))), 'Admin')
 where h.updated_by like '%@%';
update public.herb_edits set new_values = new_values - 'submitter_email' where new_values ? 'submitter_email';
