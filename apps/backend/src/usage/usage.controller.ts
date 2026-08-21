import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { CurrentUser } from "../common/tenant/current-user.decorator";
import { AuthenticatedUser } from "../common/tenant/tenant.types";
import { PrismaService } from "../common/database/prisma.service";
@UseGuards(AuthGuard("jwt"))
@Controller("usage")
export class UsageController {
  constructor(private p: PrismaService) {}
  @Get() summary(@CurrentUser() u: AuthenticatedUser) {
    return this.p.withTenant(u.tenantId, async (tx) => {
      const a = await tx.query.aggregate({
        _sum: { tokensUsed: true, estimatedCostUsd: true },
        _count: true,
      });
      const usage = {
        queries: a._count,
        tokens: a._sum.tokensUsed ?? 0,
        cost: a._sum.estimatedCostUsd ?? 0,
      };
      const threshold = Number(process.env.BILLING_QUERY_THRESHOLD ?? 0);
      if (
        threshold > 0 &&
        usage.queries >= threshold &&
        process.env.BILLING_WEBHOOK_URL
      ) {
        await fetch(process.env.BILLING_WEBHOOK_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tenantId: u.tenantId, usage }),
        }).catch(() => undefined);
      }
      return usage;
    });
  }
}
