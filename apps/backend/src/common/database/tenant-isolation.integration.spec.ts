import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "./prisma.service";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("tenant row-level isolation", () => {
  const owner = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const scoped = new PrismaService({
    datasources: { db: { url: databaseUrl } },
  });
  const tenantA = randomUUID();
  const tenantB = randomUUID();

  beforeAll(async () => {
    await owner.tenant.createMany({
      data: [
        { id: tenantA, name: "Isolation A", slug: `isolation-a-${tenantA}` },
        { id: tenantB, name: "Isolation B", slug: `isolation-b-${tenantB}` },
      ],
    });
    await owner.document.createMany({
      data: [
        {
          tenantId: tenantA,
          filename: "tenant-a-secret.txt",
          sourceType: "test",
          status: "ready",
        },
        {
          tenantId: tenantB,
          filename: "tenant-b-secret.txt",
          sourceType: "test",
          status: "ready",
        },
      ],
    });
    await owner.auditEvent.createMany({
      data: [
        { tenantId: tenantA, action: "document.upload", result: "success" },
        { tenantId: tenantB, action: "tenant.update", result: "success" },
      ],
    });
  });

  afterAll(async () => {
    await owner.tenant.deleteMany({
      where: { id: { in: [tenantA, tenantB] } },
    });
    await Promise.all([owner.$disconnect(), scoped.$disconnect()]);
  });

  it("filters even a raw query that omits tenant_id", async () => {
    const rowsA = await scoped.withTenant(
      tenantA,
      (tx) =>
        tx.$queryRaw<
          Array<{ filename: string }>
        >`SELECT filename FROM documents ORDER BY filename`,
    );
    const rowsB = await scoped.withTenant(
      tenantB,
      (tx) =>
        tx.$queryRaw<
          Array<{ filename: string }>
        >`SELECT filename FROM documents ORDER BY filename`,
    );
    expect(rowsA).toEqual([{ filename: "tenant-a-secret.txt" }]);
    expect(rowsB).toEqual([{ filename: "tenant-b-secret.txt" }]);
  });

  it("blocks cross-tenant writes through the restricted runtime role", async () => {
    const changed = await scoped.withTenant(tenantA, (tx) =>
      tx.document.updateMany({
        where: { tenantId: tenantB },
        data: { filename: "leaked.txt" },
      }),
    );
    expect(changed.count).toBe(0);
    await expect(
      scoped.withTenant(tenantA, (tx) =>
        tx.document.create({
          data: {
            tenantId: tenantB,
            filename: "forbidden.txt",
            sourceType: "test",
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it("isolates audit records and keeps them append-only", async () => {
    const visible = await scoped.withTenant(tenantA, (tx) =>
      tx.auditEvent.findMany({ select: { action: true } }),
    );
    expect(visible).toEqual([{ action: "document.upload" }]);
    await expect(
      scoped.withTenant(tenantA, (tx) =>
        tx.auditEvent.deleteMany({ where: { tenantId: tenantA } }),
      ),
    ).rejects.toThrow();
  });
});
