import { BadRequestException } from "@nestjs/common";
import { MembersService } from "./members.service";

describe("MembersService", () => {
  it("prevents demoting the final active administrator", async () => {
    const tx = {
      $queryRaw: jest.fn(),
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: "admin-1",
          role: "admin",
          status: "active",
        }),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
    };
    const service = new MembersService({
      withTenant: (_tenantId: string, callback: any) => callback(tx),
    } as any);
    await expect(
      service.update("tenant-1", "admin-1", { role: "member" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("revokes the member session when access changes", async () => {
    const tx = {
      $queryRaw: jest.fn(),
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: "member-1",
          role: "member",
          status: "active",
        }),
        update: jest.fn().mockResolvedValue({ id: "member-1" }),
      },
    };
    const service = new MembersService({
      withTenant: (_tenantId: string, callback: any) => callback(tx),
    } as any);
    await service.update("tenant-1", "member-1", { status: "suspended" });
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "suspended", refreshTokenHash: null },
      }),
    );
  });

  it("returns a high-entropy token but stores only its hash", async () => {
    const create = jest.fn().mockImplementation(({ data }) => ({
      id: "invitation-1",
      email: data.email,
      role: data.role,
      expiresAt: data.expiresAt,
    }));
    const tx = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      invitation: { updateMany: jest.fn(), create },
    };
    const service = new MembersService({
      withTenant: (_tenantId: string, callback: any) => callback(tx),
    } as any);
    const result = await service.invite(
      "11111111-1111-4111-8111-111111111111",
      "admin-1",
      "Member@Example.com",
      "member",
    );
    expect(result.token).toMatch(
      /^11111111-1111-4111-8111-111111111111\.[A-Za-z0-9_-]{40,}$/,
    );
    expect(create.mock.calls[0][0].data.tokenHash).not.toContain(result.token);
    expect(create.mock.calls[0][0].data.email).toBe("member@example.com");
  });
});
