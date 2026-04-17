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

## GitHub Pages

Složka `docs/` — často přesměruje na Vercel.
