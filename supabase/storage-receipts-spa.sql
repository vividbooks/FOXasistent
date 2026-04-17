-- Spusť v Supabase SQL Editoru, pokud nahrávání účtenek z aplikace (SPA) hlásí RLS / permission.
-- Bucket id musí sedět s proměnnou VITE_SUPABASE_STORAGE_BUCKET / SUPABASE_STORAGE_BUCKET (výchozí „receipts“).
-- Jiný název bucketu (např. fakturyauctenky): buď v celém souboru nahraď 'receipts' → tvůj id,
-- nebo použij hotový skript storage-fakturyauctenky-spa.sql.
-- Bucket může být veřejný nebo soukromý; aplikace používá getPublicUrl.

DROP POLICY IF EXISTS "fox_receipts_select_public" ON storage.objects;
CREATE POLICY "fox_receipts_select_public" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "fox_receipts_insert_auth" ON storage.objects;
CREATE POLICY "fox_receipts_insert_auth" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "fox_receipts_update_auth" ON storage.objects;
CREATE POLICY "fox_receipts_update_auth" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'receipts') WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "fox_receipts_delete_auth" ON storage.objects;
CREATE POLICY "fox_receipts_delete_auth" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'receipts');
