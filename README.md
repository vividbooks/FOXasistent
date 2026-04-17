# FOXasistent

Next.js aplikace (Fox Catering) přímo v kořeni tohoto repa — **evidence směn, polohy a nákladů na jídlo**. Databáze a soubory: **Supabase** (Postgres + Storage).

## Lokálně

```bash
git clone https://github.com/vividbooks/FOXasistent.git
cd FOXasistent
cp .env.example .env
# doplň hodnoty podle .env.example
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

### Supabase

Veřejná URL API: `NEXT_PUBLIC_SUPABASE_URL=https://hxsdhfszkvnamgmnuuuc.supabase.co`  
V Storage bucket **`receipts`** (veřejný pro náhledy).

---

## Vercel (nejednodušší postup)

1. [vercel.com/new](https://vercel.com/new) → Import **vividbooks/FOXasistent**.
2. **Neměň Root Directory** — nech prázdné / kořen repa (aplikace je už v kořeni).
3. **Environment Variables** — zkopíruj z lokálního `.env` (včetně `DATABASE_URL`, `DIRECT_URL`, **`PRISMA_DISABLE_PREPARED_STATEMENTS=true`** u Supabase pooleru, `AUTH_SECRET`, **`AUTH_URL`** = přesná produkční URL bez `/` na konci), všechny `NEXT_PUBLIC_*`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Deploy.

Statická stránka z `docs/` zůstává pro GitHub Pages (přesměrování na Vercel).

---

## GitHub Pages

`docs/index.html` může přesměrovat na tvou Vercel URL (např. `project-dusf9.vercel.app`). *Settings → Pages → Source: GitHub Actions.*

---

## Licence

Podle rozhodnutí vlastníka repozitáře.
