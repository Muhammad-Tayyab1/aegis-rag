import { AuthService } from "./auth.service";
import { UnauthorizedException } from "@nestjs/common";

describe("AuthService logout", () => {
  it("revokes the persisted refresh token", async () => {
    const update = jest.fn().mockResolvedValue({});
    const service = new AuthService(
      { user: { update } } as any,
      {} as any,
      {} as any,
    );
    await service.logout("user-id");
    expect(update).toHaveBeenCalledWith({
      where: { id: "user-id" },
      data: { refreshTokenHash: null },
    });
  });
});

describe("AuthService invitation registration", () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const token = `${tenantId}.a-high-entropy-invitation-token`;

  function service(invitation: Record<string, unknown>) {
    return new AuthService(
      {
        withTenant: (_tenantId: string, callback: any) =>
          callback({
            invitation: {
              findUnique: jest.fn().mockResolvedValue(invitation),
            },
          }),
      } as any,
      {} as any,
      {} as any,
    );
  }

  it("rejects expired invitations", async () => {
    await expect(
      service({
        tenantId,
        email: "member@example.com",
        acceptedAt: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1),
      }).register({
        email: "member@example.com",
        password: "a secure password",
        invitationToken: token,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects replayed invitations", async () => {
    await expect(
      service({
        tenantId,
        email: "member@example.com",
        acceptedAt: new Date(),
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      }).register({
        email: "member@example.com",
        password: "a secure password",
        invitationToken: token,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
