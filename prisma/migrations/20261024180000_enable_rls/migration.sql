-- Lock every table behind Row Level Security with no policies.
-- The app connects as the table owner, which bypasses RLS, so nothing changes for it.
-- On Supabase this blocks the auto-generated REST/GraphQL APIs (anon/authenticated keys)
-- from reading or writing any data. Harmless on a self-hosted Postgres.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
