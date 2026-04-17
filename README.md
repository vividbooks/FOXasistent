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

**Čtení účtenek a PDF** ve výchozím stavu běží **v prohlížeči** (Tesseract + PDF.js). **Gemini Vision** můžeš napojit **čistě přes Supabase** (bez Vercelu kvůli OCR): nasaď Edge Function [`supabase/functions/extract-receipt`](supabase/functions/extract-receipt/index.ts), nastav secret `GEMINI_API_KEY` (klíč z [Google AI Studio](https://aistudio.google.com/apikey)) přes `supabase secrets set GEMINI_API_KEY=…`, pak `supabase functions deploy extract-receipt`. Na GitHub Pages build zapni **`VITE_USE_GEMINI_EXTRACT=1`** — aplikace volá `https://<projekt>.supabase.co/functions/v1/extract-receipt` s JWT + `apikey` (anon). Při selhání nebo vypnutém přepínači zůstává lokální Tesseract. Volitelně má Next na Vercelu stále **`POST /api/extract-document`** se stejným Gemini + Tesseract fallbackem pro vývoj mimo Pages.

### Jednorázově na GitHubu

1. **`base`** v [`static-web/vite.config.ts`](static-web/vite.config.ts) musí odpovídat názvu repa (teď `/FOXasistent/`).
2. **Settings → Pages** → zdroj **GitHub Actions**.
3. Konfigurace pro build: [`static-web/.env.production`](static-web/.env.production) — **`VITE_SUPABASE_URL`** a **`VITE_SUPABASE_ANON_KEY`** (stejné hodnoty jako u Supabase v projektu).

### Databáze, RLS, Auth

1. `npx prisma migrate deploy` — včetně RLS na `User`, `Expense`, `Shift`, `LocationPing` (JWT `user_metadata.app_user_id` + `role`).
2. **`npm run sync-auth`** (volitelné hromadně) — doplní Auth uživatele se syntetickým e-mailem `ascii-slug-z-username@fox-app.local` (diakritika se při zápisu do Auth odebere, aby GoTrue nepádoval na *invalid format*) + `authUserId` v `User`. Po přidání zaměstnance z adminu na **Vercelu** nebo z **GitHub Pages** (s nastaveným `VITE_NEXT_API_ORIGIN`) se Auth účet vytvoří **automaticky**.
3. Na GitHub Pages buildu nastav v [`static-web/.env.production`](static-web/.env.production) nebo v CI proměnnou **`VITE_NEXT_API_ORIGIN`** = kořenová URL Next aplikace na Vercelu (bez `/` na konci), např. `https://tvoje-app.vercel.app`. Volitelně na Vercelu **`PAGES_ADMIN_ALLOWED_ORIGINS`** = `https://tvuj-uzivatel.github.io` (CSV, pokud chceš CORS jen z Pages).
4. **Storage:** název bucketu pro účtenky musí sedět s [`static-web/.env.production`](static-web/.env.production) → **`VITE_SUPABASE_STORAGE_BUCKET`** (výchozí v kódu je `receipts`). Jinak hláška *Bucket not found*. Pro bucket `fakturyauctenky` nastav tuto proměnnou a spusť [`supabase/storage-fakturyauctenky-spa.sql`](supabase/storage-fakturyauctenky-spa.sql) (nebo obecný [`storage-receipts-spa.sql`](supabase/storage-receipts-spa.sql) po úpravě id). Na Vercelu doplň **`SUPABASE_STORAGE_BUCKET`** a pro správné náhledy v Next **`NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`** (stejná hodnota).
5. **Staré URL v DB** (`…/object/…/receipts/…` vs. soubory ve `fakturyauctenky`) způsobí v prohlížeči **400** u náhledu. Aplikace umí URL při zobrazení přemapovat; trvale lze opravit SQL [`supabase/expense-receipt-url-replace-bucket.sql`](supabase/expense-receipt-url-replace-bucket.sql) (uprav názvy bucketů podle sebe).
6. Přihlášení na Pages: **uživatelské jméno** + **`FOX_SHARED_PASSWORD`**.

Adresa: `https://<uživatel>.github.io/FOXasistent/#/login` (hash routing kvůli GitHub Pages).

### Účty a hesla (sdílená tabulka)

V Postgresu je tabulka **`TeamCredential`** (Prisma model stejného jména): název služby, login, heslo (plain text — interní), URL, poznámka. **RLS** povoluje SELECT/INSERT/UPDATE/DELETE jen roli `authenticated` (přihlášení přes Supabase Auth na Pages). Po přihlášení se tabulka zobrazí a jde přidávat / mazat řádky. Pokud v SQL Editoru spouštíš migraci ručně a hlásí to *relation already exists*, použij jen [`supabase/team-credential-rls-only.sql`](supabase/team-credential-rls-only.sql) (bez `CREATE TABLE`).
