# FOXasistent

Monorepo s aplikací **Fox Catering** (`fox-catering/`) — evidence směn, polohy a nákladů na jídlo. Backend: **Next.js** (API routes), databáze a soubory: **Supabase** (Postgres + Storage).

## Kód na GitHubu

```bash
git clone https://github.com/vividbooks/FOXasistent.git
cd FOXasistent/fox-catering
cp .env.example .env
# doplňte DATABASE_URL, AUTH_SECRET, Supabase URL a SUPABASE_SERVICE_ROLE_KEY
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

### Supabase projekt

Veřejná URL API (do `.env`): `NEXT_PUBLIC_SUPABASE_URL=https://hxsdhfszkvnamgmnuuuc.supabase.co`  
Heslo k DB a **service role** klíč jen z dashboardu Supabase — necommitujte je.

V Storage vytvořte veřejný bucket **`receipts`** (viz `fox-catering/.env.example`).

---

## GitHub Pages (tento repozitář)

Na [GitHub Pages](https://pages.github.com/) je ze složky `docs/` statická stránka. **Next.js aplikaci** na Pages spustit nejde — běží na Vercelu (nebo jiném Node hostu).

**Přesměrování z `github.io`:** `docs/index.html` přesměruje na produkční Vercel URL (aktuálně **`https://project-dusf9.vercel.app`**). Po přejmenování projektu ve Vercelu uprav URL v `docs/index.html` a pushni znovu.

**Po prvním pushi:** *Settings → Pages → Build and deployment → Source: GitHub Actions*.

Stránka bude typicky na: `https://vividbooks.github.io/FOXasistent/` (přesné URL uvidíte v Settings → Pages po nasazení).

---

## Doporučené nasazení aplikace (Vercel + Supabase)

1. Import repozitáře do [Vercel](https://vercel.com) a v **Settings → General → Root Directory** nastavte **`fox-catering`** (povinné pro tento monorepo).
2. V **Settings → Environment Variables** přidejte stejné hodnoty jako v lokálním `.env`: mimo jiné `DATABASE_URL`, **`DIRECT_URL`**, `AUTH_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Po pushi na `main` zkontrolujte **Deployments** — musí být alespoň jeden **zelený** Production build. Dokud build spadne nebo neproběhne, u `*.vercel.app` uvidíte **404 NOT_FOUND**.
4. Log chyby otevřete kliknutím na červený deployment → **Building** / **Logs**.

Soubor `fox-catering/vercel.json` a `postinstall` (`prisma generate`) pomáhají, aby Vercel správně sestavil Next.js + Prisma.

CI workflow v `.github/workflows/ci.yml` kontroluje build `fox-catering` při každém pushi.

---

## Licence

Podle rozhodnutí vlastníka repozitáře.
