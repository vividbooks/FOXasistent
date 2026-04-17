-- Spusť v Supabase → SQL Editor, když tabulka "TeamCredential" UŽ EXISTUJE
-- (např. po `npx prisma migrate deploy`). Nespouštěj znovu CREATE TABLE z migrace.

ALTER TABLE "TeamCredential" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "TeamCredential_authenticated_select" ON "TeamCredential";
DROP POLICY IF EXISTS "TeamCredential_authenticated_insert" ON "TeamCredential";
DROP POLICY IF EXISTS "TeamCredential_authenticated_update" ON "TeamCredential";
DROP POLICY IF EXISTS "TeamCredential_authenticated_delete" ON "TeamCredential";

CREATE POLICY "TeamCredential_authenticated_select"
ON "TeamCredential" FOR SELECT TO authenticated USING (true);

CREATE POLICY "TeamCredential_authenticated_insert"
ON "TeamCredential" FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "TeamCredential_authenticated_update"
ON "TeamCredential" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "TeamCredential_authenticated_delete"
ON "TeamCredential" FOR DELETE TO authenticated USING (true);
