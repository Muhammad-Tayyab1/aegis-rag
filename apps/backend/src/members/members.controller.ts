import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsEmail, IsIn, IsOptional } from "class-validator";
import { UserRole, UserStatus } from "@prisma/client";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CurrentUser } from "../common/tenant/current-user.decorator";
import { AuthenticatedUser } from "../common/tenant/tenant.types";
import { MembersService } from "./members.service";

class InviteDto {
  @IsEmail() email!: string;
  @IsIn(["admin", "member"]) role!: UserRole;
}

class UpdateMemberDto {
  @IsOptional() @IsIn(["admin", "member"]) role?: UserRole;
  @IsOptional() @IsIn(["active", "suspended"]) status?: UserStatus;
}

@Roles("admin")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("members")
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.members.list(user.tenantId);
  }

  @Post("invitations")
  invite(@Body() body: InviteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.members.invite(user.tenantId, user.id, body.email, body.role);
  }

  @Post("invitations/:id/resend")
  resend(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.members.resend(user.tenantId, user.id, id);
  }

  @Delete("invitations/:id")
  revoke(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.members.revoke(user.tenantId, id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.members.update(user.tenantId, id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.members.remove(user.tenantId, id);
  }
}
