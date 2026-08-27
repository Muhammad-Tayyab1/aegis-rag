import { AuthController, csrfMatches, parseCookies } from "./auth.controller";

describe("browser session protection", () => {
  it("parses encoded cookies without truncating equals signs", () => {
    expect(parseCookies("aegis.csrf=abc%3Ddef; theme=dark")).toEqual({
      "aegis.csrf": "abc=def",
      theme: "dark",
    });
  });

  it("requires an exact CSRF cookie and header match", () => {
    expect(csrfMatches("same-token", "same-token")).toBe(true);
    expect(csrfMatches("same-token", "different-token")).toBe(false);
    expect(csrfMatches(undefined, "same-token")).toBe(false);
  });

  it("keeps the refresh token out of the browser response", async () => {
    const login = jest.fn().mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: {
        id: "user-1",
        tenantId: "tenant-1",
        email: "admin@example.com",
        role: "admin",
      },
    });
    const response = { cookie: jest.fn() };
    const controller = new AuthController({ login } as any);
    const result = await controller.login(
      { email: "admin@example.com", password: "password" },
      { headers: { origin: "http://localhost:3000" } } as any,
      response as any,
    );
    expect(result).toEqual({
      accessToken: "access-token",
      csrfToken: expect.any(String),
      user: expect.objectContaining({ id: "user-1" }),
    });
    expect(result).not.toHaveProperty("refreshToken");
    expect(response.cookie).toHaveBeenCalledWith(
      "aegis.refresh",
      "refresh-token",
      expect.objectContaining({ httpOnly: true, sameSite: "strict" }),
    );
  });
});
