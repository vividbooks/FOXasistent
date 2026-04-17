-- RLS pro SPA na GitHub Pages (Supabase Auth JWT → user_metadata.app_user_id, role)
-- Po migraci: ověř přihlášení a dotazy z aplikace; TeamCredential už může mít politiky z dřívějška.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Shift" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LocationPing" ENABLE ROW LEVEL SECURITY;

-- User
DROP POLICY IF EXISTS "User_select_authenticated" ON "User";
CREATE POLICY "User_select_authenticated" ON "User" FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "User_insert_admin" ON "User";
CREATE POLICY "User_insert_admin" ON "User" FOR INSERT TO authenticated
WITH CHECK ((auth.jwt()->'user_metadata'->>'role') = 'ADMIN');

DROP POLICY IF EXISTS "User_update_admin" ON "User";
CREATE POLICY "User_update_admin" ON "User" FOR UPDATE TO authenticated
USING ((auth.jwt()->'user_metadata'->>'role') = 'ADMIN')
WITH CHECK ((auth.jwt()->'user_metadata'->>'role') = 'ADMIN');

-- Expense
DROP POLICY IF EXISTS "Expense_select" ON "Expense";
CREATE POLICY "Expense_select" ON "Expense" FOR SELECT TO authenticated
USING (
  (auth.jwt()->'user_metadata'->>'role') = 'ADMIN'
  OR "createdById" = (auth.jwt()->'user_metadata'->>'app_user_id')
);

DROP POLICY IF EXISTS "Expense_insert" ON "Expense";
CREATE POLICY "Expense_insert" ON "Expense" FOR INSERT TO authenticated
WITH CHECK ("createdById" = (auth.jwt()->'user_metadata'->>'app_user_id'));

DROP POLICY IF EXISTS "Expense_update" ON "Expense";
CREATE POLICY "Expense_update" ON "Expense" FOR UPDATE TO authenticated
USING (
  (auth.jwt()->'user_metadata'->>'role') = 'ADMIN'
  OR "createdById" = (auth.jwt()->'user_metadata'->>'app_user_id')
)
WITH CHECK (
  (auth.jwt()->'user_metadata'->>'role') = 'ADMIN'
  OR "createdById" = (auth.jwt()->'user_metadata'->>'app_user_id')
);

DROP POLICY IF EXISTS "Expense_delete" ON "Expense";
CREATE POLICY "Expense_delete" ON "Expense" FOR DELETE TO authenticated
USING (
  (auth.jwt()->'user_metadata'->>'role') = 'ADMIN'
  OR "createdById" = (auth.jwt()->'user_metadata'->>'app_user_id')
);

-- Shift
DROP POLICY IF EXISTS "Shift_select" ON "Shift";
CREATE POLICY "Shift_select" ON "Shift" FOR SELECT TO authenticated
USING (
  (auth.jwt()->'user_metadata'->>'role') = 'ADMIN'
  OR "userId" = (auth.jwt()->'user_metadata'->>'app_user_id')
);

DROP POLICY IF EXISTS "Shift_insert" ON "Shift";
CREATE POLICY "Shift_insert" ON "Shift" FOR INSERT TO authenticated
WITH CHECK ("userId" = (auth.jwt()->'user_metadata'->>'app_user_id'));

DROP POLICY IF EXISTS "Shift_update" ON "Shift";
CREATE POLICY "Shift_update" ON "Shift" FOR UPDATE TO authenticated
USING (
  (auth.jwt()->'user_metadata'->>'role') = 'ADMIN'
  OR "userId" = (auth.jwt()->'user_metadata'->>'app_user_id')
)
WITH CHECK (
  (auth.jwt()->'user_metadata'->>'role') = 'ADMIN'
  OR "userId" = (auth.jwt()->'user_metadata'->>'app_user_id')
);

-- LocationPing
DROP POLICY IF EXISTS "LocationPing_select" ON "LocationPing";
CREATE POLICY "LocationPing_select" ON "LocationPing" FOR SELECT TO authenticated
USING (
  (auth.jwt()->'user_metadata'->>'role') = 'ADMIN'
  OR EXISTS (
    SELECT 1 FROM "Shift" s
    WHERE s.id = "LocationPing"."shiftId"
    AND s."userId" = (auth.jwt()->'user_metadata'->>'app_user_id')
  )
);

DROP POLICY IF EXISTS "LocationPing_insert" ON "LocationPing";
CREATE POLICY "LocationPing_insert" ON "LocationPing" FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "Shift" s
    WHERE s.id = "LocationPing"."shiftId"
    AND s."userId" = (auth.jwt()->'user_metadata'->>'app_user_id')
    AND s."endedAt" IS NULL
  )
);
