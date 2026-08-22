import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CurrentUser } from "../common/tenant/current-user.decorator";
import { AuthenticatedUser } from "../common/tenant/tenant.types";
import { TenantsService } from "./tenants.service";
class UpdateConfigDto {
  @IsOptional() @IsInt() @Min(100) @Max(5000) chunkSize?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1000) chunkOverlap?: number;
  @IsOptional() @IsString() embeddingModel?: string;
  @IsOptional()
  @IsIn(["vector", "keyword", "hybrid"])
  retrievalStrategy?: string;
  @IsOptional() @IsBoolean() rerankEnabled?: boolean;
}

@UseGuards(AuthGuard("jwt"))
@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}
  @Get("me") mine(@CurrentUser() user: AuthenticatedUser) {
    return this.tenants.mine(user.tenantId);
  }
  @Roles("admin") @UseGuards(RolesGuard) @Patch("config") update(
    @Body() body: UpdateConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tenants.updateConfig(user.tenantId, body);
  }
}
