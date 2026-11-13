-- IBVU: test of the new rules. It changes NOTHING: everything it does is
-- undone at the end, and the results are shown as a message that starts with
-- "TEST RESULTS". (It ends with a deliberate "error" so the database undoes
-- the test's own rows; that is expected.)
do $$
declare uid uuid; c int; res text := '';
begin
  select u.id into uid from auth.users u join public.site_people p on p.email = lower(u.email) order by u.created_at limit 1;

  -- A VISITOR (not signed in)
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  res := res || E'\nvisitor role = ' || coalesce(public.site_role(), 'none');
  select count(*) into c from public.site_people;       res := res || E'\nvisitor sees people rows: ' || c;
  select count(*) into c from public.contact_messages;  res := res || E'\nvisitor sees messages: ' || c;
  begin insert into public.site_pages(key, data) values ('zz', '{}'); res := res || E'\nvisitor add page: ALLOWED (BAD)'; exception when others then res := res || E'\nvisitor add page: blocked'; end;
  begin insert into public.site_events(title, status) values ('x', 'published'); res := res || E'\nvisitor add event: ALLOWED (BAD)'; exception when others then res := res || E'\nvisitor add event: blocked'; end;
  begin insert into public.contact_messages(name, email, message) values ('a', 'b', 'c'); res := res || E'\nvisitor add message directly: ALLOWED (BAD)'; exception when others then res := res || E'\nvisitor add message directly: blocked'; end;
  begin insert into public.site_people(email, role) values ('x@example.org', 'owner'); res := res || E'\nvisitor add person: ALLOWED (BAD)'; exception when others then res := res || E'\nvisitor add person: blocked'; end;
  begin insert into public.herb_photos(herb_key, herb_name, image_path, status) values ('a', 'a', 'a', 'approved'); res := res || E'\nvisitor add herb photo: ALLOWED (BAD)'; exception when others then res := res || E'\nvisitor add herb photo: blocked'; end;
  execute 'reset role';

  -- SIGNED IN, but not on the People list
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', gen_random_uuid(), 'email', 'stranger@example.org')::text, true);
  execute 'set local role authenticated';
  res := res || E'\nstranger role = ' || coalesce(public.site_role(), 'none');
  select count(*) into c from public.site_people; res := res || E'\nstranger sees people rows: ' || c;
  begin insert into public.site_articles(title, slug) values ('x', 'zz-x'); res := res || E'\nstranger add article: ALLOWED (BAD)'; exception when others then res := res || E'\nstranger add article: blocked'; end;
  execute 'reset role';

  -- AN OWNER
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', uid)::text, true);
  execute 'set local role authenticated';
  res := res || E'\nowner role = ' || coalesce(public.site_role(), 'none') || ', herb review = ' || public.site_can_review_herbs();
  select count(*) into c from public.site_people; res := res || E'\nowner sees people rows: ' || c;
  begin insert into public.site_events(title, status) values ('zz test', 'published'); res := res || E'\nowner add published event: allowed'; exception when others then res := res || E'\nowner add published event: BLOCKED (BAD) ' || sqlerrm; end;
  begin insert into public.site_pages(key, data) values ('zz', '{}'); res := res || E'\nowner add page: allowed'; exception when others then res := res || E'\nowner add page: BLOCKED (BAD) ' || sqlerrm; end;
  begin insert into public.site_history(who, action) values ('Owner', 'test'); res := res || E'\nowner add history: allowed'; exception when others then res := res || E'\nowner add history: BLOCKED (BAD) ' || sqlerrm; end;
  begin insert into public.herb_photos(herb_key, herb_name, image_path, status, source) values ('zz', 'zz', 'zz.jpg', 'approved', 'admin'); res := res || E'\nowner add herb photo: allowed'; exception when others then res := res || E'\nowner add herb photo: BLOCKED (BAD) ' || sqlerrm; end;
  execute 'reset role';

  -- THE SAME PERSON AS A WRITER without herb review (inside this test only)
  update public.site_people p set role = 'writer', herb_review = false from auth.users u where lower(u.email) = p.email and u.id = uid;
  execute 'set local role authenticated';
  res := res || E'\nwriter role = ' || coalesce(public.site_role(), 'none') || ', herb review = ' || public.site_can_review_herbs();
  select count(*) into c from public.site_people; res := res || E'\nwriter sees people rows: ' || c;
  begin insert into public.site_articles(title, slug, status) values ('zz draft', 'zz-draft', 'draft'); res := res || E'\nwriter add draft article: allowed'; exception when others then res := res || E'\nwriter add draft article: BLOCKED (BAD) ' || sqlerrm; end;
  begin insert into public.site_articles(title, slug, status) values ('zz pub', 'zz-pub', 'published'); res := res || E'\nwriter add published article: ALLOWED (BAD)'; exception when others then res := res || E'\nwriter add published article: blocked'; end;
  begin update public.site_articles set status = 'published' where slug = 'zz-draft'; get diagnostics c = row_count; res := res || E'\nwriter publish own draft: rows changed ' || c || ' (BAD if 1)'; exception when others then res := res || E'\nwriter publish own draft: blocked'; end;
  update public.site_events set title = 'changed' where title = 'zz test'; get diagnostics c = row_count; res := res || E'\nwriter edit a published event: rows changed ' || c || ' (should be 0)';
  begin insert into public.site_pages(key, data) values ('zz2', '{}'); res := res || E'\nwriter add page: ALLOWED (BAD)'; exception when others then res := res || E'\nwriter add page: blocked'; end;
  begin insert into public.herb_photos(herb_key, herb_name, image_path) values ('zz2', 'zz', 'zz.jpg'); res := res || E'\nwriter add herb photo: ALLOWED (BAD)'; exception when others then res := res || E'\nwriter add herb photo: blocked'; end;
  select count(*) into c from public.site_history; res := res || E'\nwriter sees history rows: ' || c || ' (should be 0)';
  delete from public.site_articles where slug = 'zz-draft'; get diagnostics c = row_count; res := res || E'\nwriter delete article: rows deleted ' || c || ' (should be 0)';
  execute 'reset role';

  -- There must always be an Owner
  begin update public.site_people set role = 'editor'; res := res || E'\nremove every owner: ALLOWED (BAD)'; exception when others then res := res || E'\nremove every owner: blocked'; end;

  -- Undo everything the test did and show the results.
  raise exception E'TEST RESULTS (nothing was changed):%', res;
end $$;
