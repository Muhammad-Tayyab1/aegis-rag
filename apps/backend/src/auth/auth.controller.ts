import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { CurrentUser } from "../common/tenant/current-user.decorator";
import { AuthenticatedUser } from "../common/tenant/tenant.types";
import { AuthService } from "./auth.service";
import { LoginDto, RefreshDto, RegisterDto } from "./dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post("register") register(@Body() input: RegisterDto) {
    return this.auth.register(input);
  }
  @Post("login") login(@Body() input: LoginDto) {
    return this.auth.login(input);
  }
  @Post("refresh") refresh(@Body() input: RefreshDto) {
    return this.auth.refresh(input.refreshToken);
  }
  @Post("logout")
  @UseGuards(AuthGuard("jwt"))
  @HttpCode(204)
  async logout(@CurrentUser() user: AuthenticatedUser) {
    await this.auth.logout(user.id);
  }
}
