import { ExecutionContext, HttpException } from "@nestjs/common";
import {
  tenantRateLimit,
  TenantRateLimitGuard,
} from "./tenant-rate-limit.guard";

function context(tenantId?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () =>
        tenantId
          ? {
              user: {
                tenantId,
                id: "user",
                email: "u@example.com",
                role: "member",
              },
            }
          : {},
    }),
  } as ExecutionContext;
}

describe("distributed tenant rate limiter", () => {
  it("bounds invalid configuration", () => {
    expect(tenantRateLimit()).toBe(120);
    expect(tenantRateLimit("0")).toBe(1);
    expect(tenantRateLimit("20000")).toBe(10_000);
    expect(tenantRateLimit("invalid")).toBe(120);
  });

  it("allows public requests without touching the database", async () => {
    const withTenant = jest.fn();
    const guard = new TenantRateLimitGuard({ withTenant } as any);
    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it("rejects a tenant after its shared counter exceeds the limit", async () => {
    const query = jest.fn().mockResolvedValue([{ requestCount: 3 }]);
    const withTenant = jest.fn((_tenant, callback) =>
      callback({ $queryRaw: query }),
    );
    const guard = new TenantRateLimitGuard({ withTenant } as any);
    const previous = process.env.TENANT_RATE_LIMIT_PER_MINUTE;
    process.env.TENANT_RATE_LIMIT_PER_MINUTE = "2";
    await expect(
      guard.canActivate(context("tenant-id")),
    ).rejects.toBeInstanceOf(HttpException);
    if (previous === undefined) delete process.env.TENANT_RATE_LIMIT_PER_MINUTE;
    else process.env.TENANT_RATE_LIMIT_PER_MINUTE = previous;
  });
});
