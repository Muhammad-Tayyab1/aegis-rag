import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsIn, IsString, MinLength } from "class-validator";
import { PrismaService } from "../common/database/prisma.service";
import { CurrentUser } from "../common/tenant/current-user.decorator";
import { AuthenticatedUser } from "../common/tenant/tenant.types";
class TicketInput {
  @IsString() @MinLength(3) summary!: string;
  @IsIn(["low", "medium", "high"]) priority!: string;
}
@UseGuards(AuthGuard("jwt"))
@Controller("tools")
export class TicketController {
  constructor(private readonly prisma: PrismaService) {}
  @Post("create-ticket") create(
    @Body() b: TicketInput,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.prisma.withTenant(u.tenantId, (tx) =>
      tx.ticket.create({
        data: {
          tenantId: u.tenantId,
          summary: b.summary,
          priority: b.priority,
        },
      }),
    );
  }
}
