-- Volitelné: interní „kamarádská“ app bez RLS (kdokoli s anon klíčem vidí DB).
-- Veřejný repozitář + anon klíč v prohlížeči = NIKDY bez správného RLS.
-- Pro produkci zapni RLS a politiky místo tohoto.

-- ALTER TABLE "User" DISABLE ROW LEVEL SECURITY;
-- (doplň další tabulky podle potřeby)
