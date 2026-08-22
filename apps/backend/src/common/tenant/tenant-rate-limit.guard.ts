import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { AuthenticatedUser } from "./tenant.types";

@Injectable()
export class TenantRateLimitGuard implements CanActivate {
  private static readonly windows = new Map<
    string,
    { startedAt: number; count: number }
  >();
  canActivate(context: ExecutionContext) {
    const user = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) return true;
    const now = Date.now();
    const limit = Number(process.env.TENANT_RATE_LIMIT_PER_MINUTE ?? 120);
    const current = TenantRateLimitGuard.windows.get(user.tenantId);
    const window =
      !current || now - current.startedAt >= 60000
        ? { startedAt: now, count: 0 }
        : current;
    window.count += 1;
    TenantRateLimitGuard.windows.set(user.tenantId, window);
    if (window.count > limit)
      throw new HttpException(
        "Tenant request limit exceeded",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    return true;
  }
}
