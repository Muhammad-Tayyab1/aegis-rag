import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AuthenticatedUser } from "./tenant.types";

export function tenantRateLimit(value?: string) {
  const parsed = Number(value ?? 120);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), 10_000) : 120;
}

@Injectable()
export class TenantRateLimitGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const user = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) return true;
    const rows = await this.prisma.withTenant(user.tenantId, (tx) =>
      tx.$queryRaw<Array<{ requestCount: number }>>(
        Prisma.sql`INSERT INTO tenant_rate_limit_windows
          (tenant_id, window_start, request_count)
          VALUES (${user.tenantId}::uuid, date_trunc('minute', clock_timestamp()), 1)
          ON CONFLICT (tenant_id) DO UPDATE SET
            request_count = CASE
              WHEN tenant_rate_limit_windows.window_start < date_trunc('minute', clock_timestamp()) THEN 1
              ELSE tenant_rate_limit_windows.request_count + 1
            END,
            window_start = CASE
              WHEN tenant_rate_limit_windows.window_start < date_trunc('minute', clock_timestamp())
                THEN date_trunc('minute', clock_timestamp())
              ELSE tenant_rate_limit_windows.window_start
            END
          RETURNING request_count AS "requestCount"`,
      ),
    );
    if (
      (rows[0]?.requestCount ?? 1) >
      tenantRateLimit(process.env.TENANT_RATE_LIMIT_PER_MINUTE)
    )
      throw new HttpException(
        "Tenant request limit exceeded",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    return true;
  }
}
