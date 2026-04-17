/**
 * Synchronizuje všechny řádky User → Supabase Auth (stejné jako dřívější .mjs).
 *
 *   node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/sync-auth-users.ts
 */
import { prisma } from "../lib/prisma";
import { provisionSupabaseAuthForUserById } from "../lib/sync-supabase-auth-for-user";

async function main() {
  const users = await prisma.user.findMany();
  for (const u of users) {
    const r = await provisionSupabaseAuthForUserById(u.id);
    if (r.ok) {
      console.log("OK:", u.username, "→", `${u.username}@fox-app.local`);
    } else {
      console.error("Chyba:", u.username, r.error);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
