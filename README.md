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

## GitHub Pages (statická přihláška)

Plná Next.js aplikace na Pages nejde (žádný Node server). V repu je **`static-web/`** (Vite): po buildu se výstup píše do **`docs/`** a workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) ho nasadí na Pages.

### Jednorázově na GitHubu

1. **Název repozitáře** musí sedět s `base` v [`static-web/vite.config.ts`](static-web/vite.config.ts) (teď `/FOXasistent/`). Jinak uprav `base` na `/<tvůj-repo>/`.
2. V **Settings → Pages** nastav zdroj **GitHub Actions** (ne „Deploy from branch“). Při prvním deployi může GitHub chtít jednorázové schválení prostředí `github-pages`.
3. **Bez ručního zadávání Secrets:** veřejný Supabase URL a publishable klíč jsou v [`static-web/.env.production`](static-web/.env.production) (stejně by stejně končily v prohlížeči). Po pushi na `main` workflow sestaví `static-web/` a nasadí `docs/`.

### Databáze a Supabase Auth

1. `npx prisma migrate deploy` (sloupec `User.authUserId`).
2. Jednou **`npm run sync-auth`** (lokálně s `.env`: DB + service role + `FOX_SHARED_PASSWORD`) — vytvoří Auth uživatele `jméno@fox-app.local` a doplní `authUserId`.
3. Na Pages: přihlášení **jménem** (`admin` / `jan`) a **`FOX_SHARED_PASSWORD`**.

Úplná funkcionalita (účtenky, API) zatím zůstává na **Vercelu**; Pages verze je vstup přes Supabase Auth.
