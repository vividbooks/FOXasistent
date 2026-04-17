-- Spusť v Supabase SQL Editoru, pokud nahrávání účtenek z aplikace (SPA) hlásí RLS / permission.
-- V Storage musí existovat bucket s id přesně `receipts` (malá písmena). Může být veřejný nebo soukromý;
-- aplikace ukládá veřejné URL z getPublicUrl — pro soukromý bucket zvaž signed URL (zatím neřešíme).

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
