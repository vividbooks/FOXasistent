/**
 * Uživatele v Supabase Auth (email = username@fox-app.local): vytvoří chybějící,
 * u existujících s authUserId sjednotí heslo na FOX_SHARED_PASSWORD. Spusť s .env.
 *
 *   node scripts/sync-auth-users.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const shared = process.env.FOX_SHARED_PASSWORD?.trim() || "zmen-mne";

if (!url || !service) {
  console.error("Chybí NEXT_PUBLIC_SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  for (const u of users) {
    const email = `${u.username}@fox-app.local`;
    if (u.authUserId) {
      const { error } = await supabase.auth.admin.updateUserById(u.authUserId, {
        password: shared,
        user_metadata: { app_user_id: u.id, role: u.role, name: u.name },
      });
      if (error) console.error("Auth update hesla", u.username, error.message);
      else console.log("Heslo sync:", u.username, "→", email);
      continue;
    }
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: shared,
      email_confirm: true,
      user_metadata: { app_user_id: u.id, role: u.role, name: u.name },
    });
    if (error) {
      console.error("Auth create", u.username, error.message);
      continue;
    }
    const authId = data.user?.id;
    if (!authId) continue;
    await prisma.user.update({
      where: { id: u.id },
      data: { authUserId: authId },
    });
    console.log("OK:", u.username, "→", email);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
