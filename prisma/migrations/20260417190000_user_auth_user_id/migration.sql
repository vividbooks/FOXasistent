-- Propojení s Supabase Auth (statická app na GitHub Pages)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authUserId" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "User_authUserId_key" ON "User"("authUserId");
