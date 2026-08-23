import { AuthService } from "./auth.service";

describe("AuthService logout", () => {
  it("revokes the persisted refresh token", async () => {
    const update = jest.fn().mockResolvedValue({});
    const service = new AuthService({ user: { update } } as any, {} as any);
    await service.logout("user-id");
    expect(update).toHaveBeenCalledWith({
      where: { id: "user-id" },
      data: { refreshTokenHash: null },
    });
  });
});
