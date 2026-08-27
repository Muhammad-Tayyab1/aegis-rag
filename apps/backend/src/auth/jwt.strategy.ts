import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthenticatedUser } from "../common/tenant/tenant.types";
import { PrismaService } from "../common/database/prisma.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_SECRET"),
    });
  }
  async validate(payload: AuthenticatedUser & { tokenType?: string }) {
    if (payload.tokenType !== "access")
      throw new UnauthorizedException("Invalid access token");
    const user = await this.prisma.withTenant(payload.tenantId, (tx) =>
      tx.user.findFirst({
        where: { id: payload.id, tenantId: payload.tenantId, status: "active" },
        select: { id: true, tenantId: true, email: true, role: true },
      }),
    );
    if (!user) throw new UnauthorizedException("Account is not active");
    return user as AuthenticatedUser;
  }
}
