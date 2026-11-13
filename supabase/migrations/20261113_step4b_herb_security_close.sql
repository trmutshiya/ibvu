-- IBVU: step 4b of the database work — the security fix, part B (website v6.12, 13 Nov 2026).
-- Run this AFTER website v6.12 is live on ibvu.org and the two updated functions
-- (send-approval-email, generate-description) are deployed. It REMOVES the old open access:
-- - Visitors (the site's public key) can no longer add, change or delete published herbs,
--   read or change submissions, or read or change the herb edit log.
-- - Visitors can still send a herb submission (as new, never as approved) and read the
--   public columns of published herbs — not the submitter's email address, whether they
--   agreed to be contacted, or who last edited the herb.
-- If anything goes wrong, steps 4a's reviewer rules keep the admin working.
-- No email address is written in this file.

-- ── Published herbs ───────────────────────────────────────────────────────────
drop policy if exists "Allow public inserts on approved_herbs" on public.approved_herbs;
drop policy if exists "Allow anon update on approved_herbs" on public.approved_herbs;
drop policy if exists "Allow anon delete on approved_herbs" on public.approved_herbs;
-- ("Allow public reads on approved_herbs" stays: everyone may read published herbs,
--  but only these columns.)
revoke select, insert, update, delete, truncate, references, trigger on public.approved_herbs from anon;
grant select (id, created_at, name, latin, category, origin, description, uses, conditions, color, pubmed_count, other_names)
  on public.approved_herbs to anon;

-- ── Submissions ───────────────────────────────────────────────────────────────
drop policy if exists "Allow public reads" on public.submissions;
drop policy if exists "Allow anon patch on submissions" on public.submissions;
drop policy if exists "Allow public inserts" on public.submissions;
drop policy if exists "submissions: anyone sends one" on public.submissions;
create policy "submissions: anyone sends one" on public.submissions for insert to anon, authenticated
  with check (coalesce(review_status, 'pending') = 'pending');
revoke select, update, delete, truncate, references, trigger on public.submissions from anon;

-- ── The herb edit log ─────────────────────────────────────────────────────────
drop policy if exists "herb_edits_insert" on public.herb_edits;
drop policy if exists "herb_edits_select" on public.herb_edits;
drop policy if exists "herb_edits_update" on public.herb_edits;
revoke all on table public.herb_edits from anon;
