-- IBVU step 1, second lock on the private tables (applied 12 Nov 2026).
revoke all on table public.contact_messages   from anon;
revoke all on table public.newsletter_signups from anon;
revoke all on table public.site_people        from anon;
revoke all on table public.site_history       from anon;
revoke execute on function public.site_people_keep_an_owner() from public, anon, authenticated;
