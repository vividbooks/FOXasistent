-- CreateTable
CREATE TABLE "TeamCredential" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "login" TEXT,
    "password" TEXT NOT NULL,
    "url" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamCredential_sortOrder_idx" ON "TeamCredential"("sortOrder");

-- RLS: přístup jen pro Supabase Auth (role authenticated)
ALTER TABLE "TeamCredential" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TeamCredential_authenticated_select"
ON "TeamCredential" FOR SELECT TO authenticated USING (true);

CREATE POLICY "TeamCredential_authenticated_insert"
ON "TeamCredential" FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "TeamCredential_authenticated_update"
ON "TeamCredential" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "TeamCredential_authenticated_delete"
ON "TeamCredential" FOR DELETE TO authenticated USING (true);
