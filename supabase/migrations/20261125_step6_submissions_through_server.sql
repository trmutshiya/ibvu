-- IBVU v6.16 — database step 6: herb submissions only through the server.
-- Run this AFTER site-forms version 3 is deployed and website v6.16 is live.
-- Before: visitors could save a submission straight into the submissions table with the
-- site's public key, skipping the Cloudflare spam check. After: only the site-forms
-- function (which checks the security token first) can add submissions. Herb reviewers
-- still read and change submissions as before.
drop policy if exists "submissions: anyone sends one" on public.submissions;
revoke insert on public.submissions from anon;
revoke insert (common_name, other_names, traditional_uses, country, email, consent, pubmed_status, pubmed_count, review_status, created_at, id, target_herb, target_name, match_note) on public.submissions from anon;
