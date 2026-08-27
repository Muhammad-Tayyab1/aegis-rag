import { lastValueFrom, of, throwError } from "rxjs";
import { AuditInterceptor } from "./audit.interceptor";

function context(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe("AuditInterceptor", () => {
  const record = jest.fn().mockResolvedValue(undefined);
  const interceptor = new AuditInterceptor({ record } as any);
  const user = {
    id: "user-1",
    tenantId: "tenant-1",
    email: "admin@example.com",
    role: "admin",
  };

  beforeEach(() => record.mockClear());

  it("records successful mutations with a resource and actor", async () => {
    const request = {
      method: "POST",
      originalUrl: "/api/documents/upload",
      route: { path: "/api/documents/upload" },
      params: {},
      user,
      ip: "127.0.0.1",
    };
    await lastValueFrom(
      interceptor.intercept(context(request), {
        handle: () => of({ id: "document-1" }),
      }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        actorId: "user-1",
        action: "document.upload",
        resourceType: "document",
        resourceId: "document-1",
        result: "success",
      }),
    );
  });

  it("records authenticated mutation failures and preserves the error", async () => {
    const error = Object.assign(new Error("bad input"), { status: 400 });
    const request = {
      method: "PATCH",
      originalUrl: "/api/tenants/config",
      route: { path: "/api/tenants/config" },
      params: {},
      user,
      ip: "127.0.0.1",
    };
    await expect(
      lastValueFrom(
        interceptor.intercept(context(request), {
          handle: () => throwError(() => error),
        }),
      ),
    ).rejects.toBe(error);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tenant.update",
        result: "failure",
        metadata: expect.objectContaining({ statusCode: 400 }),
      }),
    );
  });
});
