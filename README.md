# FOXasistent

Jednoduchá interní appka (Next.js + Supabase).

## Lokálně

```bash
cd FOXasistent
cp .env.example .env
# doplň hesla a URL z Supabase
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

## Vercel (minimum)

1. Import repa z GitHubu, **Root Directory prázdný** (app je v kořeni).
2. Do Environment Variables dej **stejné** jako v `.env`, hlavně:
   - `DATABASE_URL` = **Session pooler :5432** z Supabase (ne transaction :6543, pokud to zlobí).
   - `DIRECT_URL`, `PRISMA_DISABLE_PREPARED_STATEMENTS=true`
   - `AUTH_SECRET`, `AUTH_URL` (tvoje `https://….vercel.app`)
   - **`FOX_SHARED_PASSWORD`** = jedno heslo, které budete všichni používat (např. `kamosi2026`).
3. Z počítače jednou spusť **`npx prisma db seed`** s **stejným** `DATABASE_URL` jako na Vercelu (ať v DB jsou `admin` a `jan`).
4. Přihlášení: uživatel **`admin`** nebo **`jan`**, heslo = hodnota **`FOX_SHARED_PASSWORD`**.

Kontrola: otevři `https://TVOJE-APP.vercel.app/api/health` — má být `"ok":true` a `"users"` alespoň 1.

## GitHub Pages (hlavní appka pro kámoše)

**`static-web/`** je **React + Vite SPA** napojená přímo na **Supabase** (Auth, Postgres, Storage): směny, poloha, náklady, účtenky (nahrání souboru), admin přehled, tým, sdílené účty (`TeamCredential`). Build jde do **`docs/`**, deploy řeší [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

**Čtení účtenek a PDF** běží **přímo v prohlížeči** (Tesseract + PDF.js) — na GitHub Pages nepotřebuješ Vercel ani jiný server jen kvůli OCR. Worker, jádro a jazykové soubory se při `npm run build` kopírují / stahují do výstupu a volají se jako **stejná doména** jako stránka (výchozí CDN z jsdelivr často blokují rozšíření v prohlížeči). **Next.js v kořeni** zůstává volitelný pro lokální vývoj nebo plnou verzi s Prisma.

### Jednorázově na GitHubu

1. **`base`** v [`static-web/vite.config.ts`](static-web/vite.config.ts) musí odpovídat názvu repa (teď `/FOXasistent/`).
2. **Settings → Pages** → zdroj **GitHub Actions**.
3. Konfigurace pro build: [`static-web/.env.production`](static-web/.env.production) — **`VITE_SUPABASE_URL`** a **`VITE_SUPABASE_ANON_KEY`** (stejné hodnoty jako u Supabase v projektu).

### Databáze, RLS, Auth

1. `npx prisma migrate deploy` — včetně RLS na `User`, `Expense`, `Shift`, `LocationPing` (JWT `user_metadata.app_user_id` + `role`).
2. **`npm run sync-auth`** — Auth uživatelé `jméno@fox-app.local` + `authUserId` v `User`.
3. Pokud **nahrávání do bucketu `receipts`** z prohlížeče hlásí RLS, spusť v Supabase SQL Editoru [`supabase/storage-receipts-spa.sql`](supabase/storage-receipts-spa.sql).
4. Přihlášení na Pages: **uživatelské jméno** + **`FOX_SHARED_PASSWORD`**. Po přidání zaměstnance v admin rozhraní znovu **`npm run sync-auth`**, ať má účet v Supabase Auth.

Adresa: `https://<uživatel>.github.io/FOXasistent/#/login` (hash routing kvůli GitHub Pages).

### Účty a hesla (sdílená tabulka)

V Postgresu je tabulka **`TeamCredential`** (Prisma model stejného jména): název služby, login, heslo (plain text — interní), URL, poznámka. **RLS** povoluje SELECT/INSERT/UPDATE/DELETE jen roli `authenticated` (přihlášení přes Supabase Auth na Pages). Po přihlášení se tabulka zobrazí a jde přidávat / mazat řádky. Pokud v SQL Editoru spouštíš migraci ručně a hlásí to *relation already exists*, použij jen [`supabase/team-credential-rls-only.sql`](supabase/team-credential-rls-only.sql) (bez `CREATE TABLE`).
