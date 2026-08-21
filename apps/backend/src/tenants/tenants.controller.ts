import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { CurrentUser } from "../common/tenant/current-user.decorator";
import { AuthenticatedUser } from "../common/tenant/tenant.types";
import { TenantsService } from "./tenants.service";

@UseGuards(AuthGuard("jwt"))
@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}
  @Get("me") mine(@CurrentUser() user: AuthenticatedUser) {
    return this.tenants.mine(user.tenantId);
  }
}
