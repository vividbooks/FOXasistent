import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.ADMIN_PASSWORD ?? "admin123";
  const hash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { username: "admin" },
    create: {
      username: "admin",
      passwordHash: hash,
      role: "ADMIN",
      name: "Administrátor",
    },
    update: {
      passwordHash: hash,
      name: "Administrátor",
    },
  });

  const demoHash = await bcrypt.hash("demo123", 10);
  await prisma.user.upsert({
    where: { username: "jan" },
    create: {
      username: "jan",
      passwordHash: demoHash,
      role: "EMPLOYEE",
      name: "Jan Novák",
      hourlyRateKc: 200,
    },
    update: {
      passwordHash: demoHash,
      hourlyRateKc: 200,
      name: "Jan Novák",
    },
  });

  const sharedForVault =
    process.env.FOX_SHARED_PASSWORD?.trim() || process.env.ADMIN_PASSWORD?.trim() || password;
  await prisma.teamCredential.upsert({
    where: { id: "seed_fox_admin_login" },
    create: {
      id: "seed_fox_admin_login",
      title: "Přihlášení admin (FOX)",
      login: "admin",
      password: sharedForVault,
      notes: "Heslo = FOX_SHARED_PASSWORD (Pages + Vercel + Supabase Auth po sync-auth).",
      sortOrder: -100,
    },
    update: {
      login: "admin",
      password: sharedForVault,
      notes: "Heslo = FOX_SHARED_PASSWORD (Pages + Vercel + Supabase Auth po sync-auth).",
    },
  });

  console.log(
    "Seed hotovo. Admin: admin / " +
      password +
      " | Zaměstnanec: jan / demo123 | TeamCredential: řádek „Přihlášení admin (FOX)“ (heslo z FOX_SHARED_PASSWORD).",
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
