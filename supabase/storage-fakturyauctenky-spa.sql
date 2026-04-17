-- RLS pro bucket id „fakturyauctenky“ (stejný název jako VITE_SUPABASE_STORAGE_BUCKET).
-- Spusť v Supabase SQL Editoru, pokud máš tento bucket místo výchozího „receipts“.

DROP POLICY IF EXISTS "fox_receipts_select_public" ON storage.objects;
CREATE POLICY "fox_receipts_select_public" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'fakturyauctenky');

DROP POLICY IF EXISTS "fox_receipts_insert_auth" ON storage.objects;
CREATE POLICY "fox_receipts_insert_auth" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'fakturyauctenky');

DROP POLICY IF EXISTS "fox_receipts_update_auth" ON storage.objects;
CREATE POLICY "fox_receipts_update_auth" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'fakturyauctenky') WITH CHECK (bucket_id = 'fakturyauctenky');

DROP POLICY IF EXISTS "fox_receipts_delete_auth" ON storage.objects;
CREATE POLICY "fox_receipts_delete_auth" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'fakturyauctenky');
