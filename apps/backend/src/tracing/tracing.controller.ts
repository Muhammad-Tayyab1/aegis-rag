import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CurrentUser } from "../common/tenant/current-user.decorator";
import { AuthenticatedUser } from "../common/tenant/tenant.types";
import { PrismaService } from "../common/database/prisma.service";
@Roles("admin")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("traces")
export class TracingController {
  constructor(private p: PrismaService) {}
  @Get() list(@CurrentUser() u: AuthenticatedUser) {
    return this.p.withTenant(u.tenantId, (tx) =>
      tx.query.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { traces: true },
      }),
    );
  }
  @Get(":id") one(
    @Param("id") id: string,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.p.withTenant(u.tenantId, (tx) =>
      tx.query.findFirst({
        where: { id },
        include: {
          traces: { include: { chunk: { include: { document: true } } } },
        },
      }),
    );
  }
}
