import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
const memberPassword = process.env.SEED_MEMBER_PASSWORD;
if (!adminPassword || !memberPassword)
  throw new Error(
    "Set SEED_ADMIN_PASSWORD and SEED_MEMBER_PASSWORD before seeding",
  );

const tenants = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Aegis Demo",
    slug: "aegis-demo",
    email: "admin@aegis.local",
    role: "admin" as const,
    password: adminPassword,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Northwind Research",
    slug: "northwind",
    email: "member@northwind.local",
    role: "member" as const,
    password: memberPassword,
  },
];
for (const item of tenants) {
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
  await prisma.user.upsert({
    where: { email: item.email },
    update: { passwordHash: await argon2.hash(item.password), role: item.role },
    create: {
      tenantId: item.id,
      email: item.email,
      passwordHash: await argon2.hash(item.password),
      role: item.role,
    },
  });
}
await prisma.$disconnect();
console.log("Seeded two isolated tenant users.");
