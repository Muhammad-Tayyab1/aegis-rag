import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { PrismaService } from "../common/database/prisma.service";
import { AuthenticatedUser } from "../common/tenant/tenant.types";
import { LoginDto, RegisterDto } from "./dto";
import { AuditService } from "../audit/audit.service";
import { createHash } from "node:crypto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}
  async register(input: RegisterDto) {
    const tenantId = input.invitationToken.split(".")[0];
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        tenantId,
      )
    )
      throw new UnauthorizedException("Invalid invitation");
    const email = input.email.toLowerCase();
    const tokenHash = createHash("sha256")
      .update(input.invitationToken)
      .digest("hex");
    const pending = await this.prisma.withTenant(tenantId, (tx) =>
      tx.invitation.findUnique({ where: { tokenHash } }),
    );
    this.assertInvitation(pending, tenantId, email);
    const hash = await argon2.hash(input.password);
    const user = await this.prisma.withTenant(tenantId, async (tx) => {
      const invitation = await tx.invitation.findUnique({
        where: { tokenHash },
      });
      this.assertInvitation(invitation, tenantId, email);
      let created;
      try {
        created = await tx.user.create({
          data: {
            tenantId,
            email,
            passwordHash: hash,
            role: invitation.role,
          },
        });
      } catch {
        throw new ConflictException("Email already registered");
      }
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
      return created;
    });
    return this.issue(user);
  }
  async login(input: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (
      !user ||
      user.status !== "active" ||
      !(await argon2.verify(user.passwordHash, input.password))
    ) {
      if (user)
        await this.audit.record({
          tenantId: user.tenantId,
          actorId: user.id,
          actorEmail: user.email,
          action: "auth.login",
          resourceType: "auth",
          result: "failure",
          metadata: {
            reason:
              user.status === "active"
                ? "invalid_credentials"
                : "account_inactive",
          },
        });
      throw new UnauthorizedException("Invalid email or password");
    }
    return this.issue(user);
  }
  async refresh(token: string) {
    try {
      const payload = this.jwt.verify<
        AuthenticatedUser & { tokenType: string }
      >(token);
      if (payload.tokenType !== "refresh") throw new Error();
      const user = await this.prisma.user.findUnique({
        where: { id: payload.id },
      });
      if (
        user?.status !== "active" ||
        !user?.refreshTokenHash ||
        !(await argon2.verify(user.refreshTokenHash, token))
      )
        throw new Error();
      return this.issue(user);
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }
  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }
  private assertInvitation(
    invitation: {
      tenantId: string;
      email: string;
      acceptedAt: Date | null;
      revokedAt: Date | null;
      expiresAt: Date;
    } | null,
    tenantId: string,
    email: string,
  ): asserts invitation is NonNullable<typeof invitation> {
    if (
      !invitation ||
      invitation.tenantId !== tenantId ||
      invitation.email !== email ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date()
    )
      throw new UnauthorizedException("Invalid or expired invitation");
  }
  private async issue(user: {
    id: string;
    tenantId: string;
    email: string;
    role: string;
  }) {
    const payload: AuthenticatedUser = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role as AuthenticatedUser["role"],
    };
    const accessToken = this.jwt.sign({ ...payload, tokenType: "access" });
    const refreshToken = this.jwt.sign(
      { ...payload, tokenType: "refresh" },
      { expiresIn: "7d" },
    );
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await argon2.hash(refreshToken) },
    });
    return { accessToken, refreshToken, user: payload };
  }
}
