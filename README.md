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

Na [GitHub Pages](https://pages.github.com/) je nasazená **jen statická úvodní stránka** z adresáře `docs/` (informace o projektu a odkazy).  
**Samotná aplikace** (přihlášení, formuláře, API) na Pages **běžet nemůže** — potřebuje Node.js hosting.

**Po prvním pushi:** *Settings → Pages → Build and deployment → Source: GitHub Actions*.

Stránka bude typicky na: `https://vividbooks.github.io/FOXasistent/` (přesné URL uvidíte v Settings → Pages po nasazení).

---

## Doporučené nasazení aplikace (Vercel + Supabase)

1. Import repozitáře do [Vercel](https://vercel.com) (root *nebo* nastavte **Root Directory** na `fox-catering`).
2. V *Environment Variables* zkopírujte hodnoty z `.env` (včetně `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
3. Build: `npm run build`, output standardní pro Next.js.
4. Po deployi nastavte v produkci stejné proměnné jako lokálně.

CI workflow v `.github/workflows/ci.yml` kontroluje build `fox-catering` při každém pushi.

---

## Licence

Podle rozhodnutí vlastníka repozitáře.
