import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const tenants = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Aegis Demo",
    slug: "aegis-demo",
    email: "admin@aegis.local",
    role: "admin" as const,
    passwordEnv: "SEED_ADMIN_PASSWORD",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Northwind Research",
    slug: "northwind",
    email: "member@northwind.local",
    role: "member" as const,
    passwordEnv: "SEED_MEMBER_PASSWORD",
  },
];

async function main() {
  const prisma = new PrismaClient();
  for (const item of tenants) {
    const password = process.env[item.passwordEnv];
    if (!password)
      throw new Error(
        "Set SEED_ADMIN_PASSWORD and SEED_MEMBER_PASSWORD before seeding",
      );
    await prisma.tenant.upsert({
      where: { id: item.id },
      update: { name: item.name },
      create: {
        id: item.id,
        name: item.name,
        slug: item.slug,
        config: { create: {} },
      },
    });
    const passwordHash = await argon2.hash(password);
    await prisma.user.upsert({
      where: { email: item.email },
      update: { passwordHash, role: item.role },
      create: {
        tenantId: item.id,
        email: item.email,
        passwordHash,
        role: item.role,
      },
    });
  }
  await prisma.$disconnect();
  console.log("Seeded two isolated tenant users.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
