import { UnauthorizedException } from "@nestjs/common";
import { JwtStrategy } from "./jwt.strategy";

const payload = {
  id: "user-1",
  tenantId: "11111111-1111-4111-8111-111111111111",
  email: "old@example.com",
  role: "admin" as const,
  tokenType: "access",
};

describe("JwtStrategy account state", () => {
  function strategy(user: unknown) {
    return new JwtStrategy(
      { getOrThrow: () => "a-test-secret-that-is-long-enough" } as any,
      {
        withTenant: (_tenantId: string, callback: any) =>
          callback({ user: { findFirst: jest.fn().mockResolvedValue(user) } }),
      } as any,
    );
  }

  it("uses the current database role instead of stale token claims", async () => {
    await expect(
      strategy({
        ...payload,
        email: "current@example.com",
        role: "member",
      }).validate(payload),
    ).resolves.toEqual(
      expect.objectContaining({ email: "current@example.com", role: "member" }),
    );
  });

  it("rejects users that are no longer active", async () => {
    await expect(strategy(null).validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
