import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { CurrentUser } from "../common/tenant/current-user.decorator";
import { AuthenticatedUser } from "../common/tenant/tenant.types";
import { AuthService } from "./auth.service";
import { LoginDto, RegisterDto } from "./dto";

const REFRESH_COOKIE = "aegis.refresh";
const CSRF_COOKIE = "aegis.csrf";

export function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        if (separator < 0) return [part, ""];
        return [
          part.slice(0, separator),
          decodeURIComponent(part.slice(separator + 1)),
        ];
      }),
  );
}

export function csrfMatches(cookie: string | undefined, header: unknown) {
  if (!cookie || typeof header !== "string") return false;
  const left = Buffer.from(cookie);
  const right = Buffer.from(header);
  return left.length === right.length && timingSafeEqual(left, right);
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post("register")
  async register(
    @Body() input: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(request);
    return this.browserSession(response, await this.auth.register(input));
  }
  @Post("login")
  async login(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(request);
    return this.browserSession(response, await this.auth.login(input));
  }
  @Post("refresh")
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(request);
    const cookies = parseCookies(request.headers.cookie);
    this.assertCsrf(cookies[CSRF_COOKIE], request.headers["x-csrf-token"]);
    if (!cookies[REFRESH_COOKIE])
      throw new ForbiddenException("Refresh cookie missing");
    return this.browserSession(
      response,
      await this.auth.refresh(cookies[REFRESH_COOKIE]),
    );
  }
  @Post("logout")
  @UseGuards(AuthGuard("jwt"))
  @HttpCode(204)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(request);
    const cookies = parseCookies(request.headers.cookie);
    if (cookies[REFRESH_COOKIE])
      this.assertCsrf(cookies[CSRF_COOKIE], request.headers["x-csrf-token"]);
    await this.auth.logout(user.id);
    this.clearCookies(response);
  }

  private browserSession(
    response: Response,
    session: Awaited<ReturnType<AuthService["login"]>>,
  ) {
    const secure = process.env.NODE_ENV === "production";
    const csrfToken = randomBytes(32).toString("base64url");
    response.cookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/api/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    response.cookie(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      secure,
      sameSite: "strict",
      path: "/api/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return {
      accessToken: session.accessToken,
      csrfToken,
      user: session.user,
    };
  }

  private assertCsrf(cookie: string | undefined, header: unknown) {
    if (!csrfMatches(cookie, header))
      throw new ForbiddenException("Invalid CSRF token");
  }

  private assertTrustedOrigin(request: Request) {
    const origin = request.headers.origin;
    if (!origin) return;
    const fallback =
      process.env.NODE_ENV === "production" ? "" : "http://localhost:3000";
    const allowed = (process.env.WEB_ORIGIN ?? fallback)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!allowed.includes(origin))
      throw new ForbiddenException("Untrusted origin");
  }

  private clearCookies(response: Response) {
    const secure = process.env.NODE_ENV === "production";
    response.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/api/auth",
    });
    response.clearCookie(CSRF_COOKIE, {
      httpOnly: false,
      secure,
      sameSite: "strict",
      path: "/api/auth",
    });
  }
}
