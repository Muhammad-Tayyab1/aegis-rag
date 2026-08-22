import { Body, Controller, Post } from "@nestjs/common";
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
}
