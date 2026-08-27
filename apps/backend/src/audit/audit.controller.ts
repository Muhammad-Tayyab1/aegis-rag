import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CurrentUser } from "../common/tenant/current-user.decorator";
import { AuthenticatedUser } from "../common/tenant/tenant.types";
import { AuditService } from "./audit.service";

class AuditQuery {
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() actorEmail?: string;
  @IsOptional() @IsString() resourceType?: string;
  @IsOptional() @IsIn(["success", "failure"]) result?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}

@Roles("admin")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("audit-events")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() query: AuditQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.audit.list(user.tenantId, query);
  }
}
