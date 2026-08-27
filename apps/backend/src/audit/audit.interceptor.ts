import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, catchError, from, map, mergeMap, throwError } from "rxjs";
import { AuthenticatedUser } from "../common/tenant/tenant.types";
import { AuditService } from "./audit.service";

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    if (!["POST", "PATCH", "DELETE"].includes(request.method))
      return next.handle();
    const started = Date.now();
    const user = request.user as AuthenticatedUser | undefined;
    return next.handle().pipe(
      mergeMap((response) => {
        const responseUser = response?.user as AuthenticatedUser | undefined;
        const actor = user ?? responseUser;
        if (!actor?.tenantId) return from([response]);
        return from(
          this.audit.record(
            this.event(request, actor, response, "success", started),
          ),
        ).pipe(map(() => response));
      }),
      catchError((error) => {
        if (!user?.tenantId) return throwError(() => error);
        return from(
          this.audit.record(
            this.event(request, user, undefined, "failure", started, error),
          ),
        ).pipe(mergeMap(() => throwError(() => error)));
      }),
    );
  }

  private event(
    request: any,
    user: AuthenticatedUser,
    response: any,
    result: "success" | "failure",
    started: number,
    error?: any,
  ) {
    const path = String(request.route?.path ?? request.path ?? "unknown");
    const controller = String(request.originalUrl ?? request.url ?? "")
      .split("?")[0]
      .split("/")
      .filter(Boolean)
      .filter((segment) => segment !== "api")[0];
    const resourceType =
      controller === "tools" ? "ticket" : controller?.replace(/s$/, "");
    return {
      tenantId: user.tenantId,
      actorId: user.id,
      actorEmail: user.email,
      action: `${resourceType ?? "request"}.${this.operation(request.method, path)}`,
      resourceType,
      resourceId: request.params?.id ?? response?.id,
      result,
      ipAddress: request.ip,
      metadata: {
        method: request.method,
        path,
        latencyMs: Date.now() - started,
        statusCode: error?.status,
      },
    };
  }

  private operation(method: string, path: string) {
    if (path.includes("login")) return "login";
    if (path.includes("logout")) return "logout";
    if (path.includes("refresh")) return "refresh";
    if (path.includes("register")) return "register";
    if (path.includes("retry")) return "retry";
    if (path.includes("sync")) return "sync";
    if (path.includes("upload")) return "upload";
    return method === "DELETE"
      ? "delete"
      : method === "PATCH"
        ? "update"
        : "create";
  }
}
