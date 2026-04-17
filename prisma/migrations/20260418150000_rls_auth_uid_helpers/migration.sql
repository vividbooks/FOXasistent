-- Spolehlivější RLS: role a app user id z tabulky User přes auth.uid(), ne jen JWT user_metadata.

CREATE OR REPLACE FUNCTION public.app_current_app_user_id() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u."id"::text FROM "User" u WHERE u."authUserId" = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_app_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "User" u
    WHERE u."authUserId" = auth.uid()
    AND u."role" = 'ADMIN'
  );
$$;

GRANT EXECUTE ON FUNCTION public.app_current_app_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

-- User
DROP POLICY IF EXISTS "User_insert_admin" ON "User";
CREATE POLICY "User_insert_admin" ON "User" FOR INSERT TO authenticated
WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS "User_update_admin" ON "User";
CREATE POLICY "User_update_admin" ON "User" FOR UPDATE TO authenticated
USING (public.is_app_admin())
WITH CHECK (public.is_app_admin());

-- Expense
DROP POLICY IF EXISTS "Expense_select" ON "Expense";
CREATE POLICY "Expense_select" ON "Expense" FOR SELECT TO authenticated
USING (
  public.is_app_admin()
  OR "createdById" = public.app_current_app_user_id()
);

DROP POLICY IF EXISTS "Expense_insert" ON "Expense";
CREATE POLICY "Expense_insert" ON "Expense" FOR INSERT TO authenticated
WITH CHECK ("createdById" = public.app_current_app_user_id());

DROP POLICY IF EXISTS "Expense_update" ON "Expense";
CREATE POLICY "Expense_update" ON "Expense" FOR UPDATE TO authenticated
USING (
  public.is_app_admin()
  OR "createdById" = public.app_current_app_user_id()
)
WITH CHECK (
  public.is_app_admin()
  OR "createdById" = public.app_current_app_user_id()
);

DROP POLICY IF EXISTS "Expense_delete" ON "Expense";
CREATE POLICY "Expense_delete" ON "Expense" FOR DELETE TO authenticated
USING (
  public.is_app_admin()
  OR "createdById" = public.app_current_app_user_id()
);

-- Shift
DROP POLICY IF EXISTS "Shift_select" ON "Shift";
CREATE POLICY "Shift_select" ON "Shift" FOR SELECT TO authenticated
USING (
  public.is_app_admin()
  OR "userId" = public.app_current_app_user_id()
);

DROP POLICY IF EXISTS "Shift_insert" ON "Shift";
CREATE POLICY "Shift_insert" ON "Shift" FOR INSERT TO authenticated
WITH CHECK ("userId" = public.app_current_app_user_id());

DROP POLICY IF EXISTS "Shift_update" ON "Shift";
CREATE POLICY "Shift_update" ON "Shift" FOR UPDATE TO authenticated
USING (
  public.is_app_admin()
  OR "userId" = public.app_current_app_user_id()
)
WITH CHECK (
  public.is_app_admin()
  OR "userId" = public.app_current_app_user_id()
);

-- LocationPing
DROP POLICY IF EXISTS "LocationPing_select" ON "LocationPing";
CREATE POLICY "LocationPing_select" ON "LocationPing" FOR SELECT TO authenticated
USING (
  public.is_app_admin()
  OR EXISTS (
    SELECT 1 FROM "Shift" s
    WHERE s.id = "LocationPing"."shiftId"
    AND s."userId" = public.app_current_app_user_id()
  )
);

DROP POLICY IF EXISTS "LocationPing_insert" ON "LocationPing";
CREATE POLICY "LocationPing_insert" ON "LocationPing" FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "Shift" s
    WHERE s.id = "LocationPing"."shiftId"
    AND s."userId" = public.app_current_app_user_id()
    AND s."endedAt" IS NULL
  )
);
