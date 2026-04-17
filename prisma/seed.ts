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
      hourlyRateKc: 200,
    },
  });

  console.log("Seed hotovo. Admin: admin / " + password + " | Zaměstnanec: jan / demo123");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
