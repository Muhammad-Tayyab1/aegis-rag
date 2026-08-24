import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { CurrentUser } from "../common/tenant/current-user.decorator";
import { AuthenticatedUser } from "../common/tenant/tenant.types";
import { PrismaService } from "../common/database/prisma.service";
import { billingMilestone } from "./billing";

type UsageSummary = { queries: number; tokens: number; cost: number };

@UseGuards(AuthGuard("jwt"))
@Controller("usage")
export class UsageController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async summary(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.prisma.withTenant(user.tenantId, async (tx) => {
      const aggregate = await tx.query.aggregate({
        _sum: { tokensUsed: true, estimatedCostUsd: true },
        _count: true,
      });
      const usage: UsageSummary = {
        queries: aggregate._count,
        tokens: aggregate._sum.tokensUsed ?? 0,
        cost: Number(aggregate._sum.estimatedCostUsd ?? 0),
      };
      const milestone = billingMilestone(
        usage.queries,
        process.env.BILLING_QUERY_THRESHOLD,
      );
      if (!milestone || !process.env.BILLING_WEBHOOK_URL)
        return { usage, eventId: null, milestone };
      const inserted = await tx.billingEvent.createMany({
        data: {
          tenantId: user.tenantId,
          milestone,
          payload: usage,
        },
        skipDuplicates: true,
      });
      if (!inserted.count) return { usage, eventId: null, milestone };
      const event = await tx.billingEvent.findUniqueOrThrow({
        where: {
          tenantId_milestone: { tenantId: user.tenantId, milestone },
        },
        select: { id: true },
      });
      return { usage, eventId: event.id, milestone };
    });

    if (result.eventId && process.env.BILLING_WEBHOOK_URL) {
      try {
        const response = await fetch(process.env.BILLING_WEBHOOK_URL, {
          method: "POST",
          signal: AbortSignal.timeout(10_000),
          headers: {
            "content-type": "application/json",
            "idempotency-key": result.eventId,
          },
          body: JSON.stringify({
            eventId: result.eventId,
            tenantId: user.tenantId,
            milestone: result.milestone,
            usage: result.usage,
          }),
        });
        if (!response.ok)
          throw new Error(`Billing webhook returned ${response.status}`);
        await this.prisma.withTenant(user.tenantId, (tx) =>
          tx.billingEvent.update({
            where: { id: result.eventId! },
            data: { deliveredAt: new Date() },
          }),
        );
      } catch {
        await this.prisma.withTenant(user.tenantId, (tx) =>
          tx.billingEvent.deleteMany({
            where: { id: result.eventId!, deliveredAt: null },
          }),
        );
      }
    }
    return result.usage;
  }
}
