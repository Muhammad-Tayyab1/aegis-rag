import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../common/database/prisma.service';
import { AuthenticatedUser } from '../common/tenant/tenant.types';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}
  async register(input: RegisterDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: input.tenantSlug }, select: { id: true } });
    if (!tenant) throw new UnauthorizedException('Unknown workspace');
    const existing = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() }, select: { id: true } });
    if (existing) throw new ConflictException('Email already registered');
    const hash = await argon2.hash(input.password);
    const user = await this.prisma.user.create({ data: { tenantId: tenant.id, email: input.email.toLowerCase(), passwordHash: hash } });
    return this.issue(user);
  }
  async login(input: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || !(await argon2.verify(user.passwordHash, input.password))) throw new UnauthorizedException('Invalid email or password');
    return this.issue(user);
  }
  private issue(user: { id: string; tenantId: string; email: string; role: string }) {
    const payload: AuthenticatedUser = { id: user.id, tenantId: user.tenantId, email: user.email, role: user.role as AuthenticatedUser['role'] };
    return { accessToken: this.jwt.sign(payload), user: payload };
  }
}
