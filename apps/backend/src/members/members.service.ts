import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, UserRole, UserStatus } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../common/database/prisma.service";

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => ({
      members: await tx.user.findMany({
        where: { tenantId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
      }),
      invitations: await tx.invitation.findMany({
        where: { tenantId, acceptedAt: null, revokedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          role: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
    }));
  }

  async invite(
    tenantId: string,
    actorId: string,
    emailInput: string,
    role: UserRole,
  ) {
    const email = emailInput.toLowerCase();
    return this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.user.findFirst({
        where: { tenantId, email },
      });
      if (existing) throw new ConflictException("User is already a member");
      await tx.invitation.updateMany({
        where: { tenantId, email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return this.createInvitation(tx, tenantId, actorId, email, role);
    });
  }

  async resend(tenantId: string, actorId: string, invitationId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const invitation = await tx.invitation.findFirst({
        where: {
          id: invitationId,
          tenantId,
          acceptedAt: null,
          revokedAt: null,
        },
      });
      if (!invitation) throw new NotFoundException("Invitation not found");
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { revokedAt: new Date() },
      });
      return this.createInvitation(
        tx,
        tenantId,
        actorId,
        invitation.email,
        invitation.role,
      );
    });
  }

  revoke(tenantId: string, invitationId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const changed = await tx.invitation.updateMany({
        where: {
          id: invitationId,
          tenantId,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      if (!changed.count) throw new NotFoundException("Invitation not found");
      return { revoked: true };
    });
  }

  update(
    tenantId: string,
    memberId: string,
    data: { role?: UserRole; status?: UserStatus },
  ) {
    if (!data.role && !data.status)
      throw new BadRequestException("Role or status is required");
    if (data.status === "removed")
      throw new BadRequestException("Use the remove member action");
    return this.prisma.withTenant(tenantId, async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`;
      const member = await tx.user.findFirst({
        where: { id: memberId, tenantId },
      });
      if (!member) throw new NotFoundException("Member not found");
      if (
        member.role === "admin" &&
        member.status === "active" &&
        (data.role === "member" || data.status === "suspended")
      )
        await this.assertAnotherAdmin(tx, tenantId, memberId);
      return tx.user.update({
        where: { id: memberId },
        data: { ...data, refreshTokenHash: null },
        select: { id: true, email: true, role: true, status: true },
      });
    });
  }

  remove(tenantId: string, memberId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`;
      const member = await tx.user.findFirst({
        where: { id: memberId, tenantId, status: { not: "removed" } },
      });
      if (!member) throw new NotFoundException("Member not found");
      if (member.role === "admin" && member.status === "active")
        await this.assertAnotherAdmin(tx, tenantId, memberId);
      return tx.user.update({
        where: { id: memberId },
        data: { status: "removed", refreshTokenHash: null },
        select: { id: true, email: true, role: true, status: true },
      });
    });
  }

  private async assertAnotherAdmin(
    tx: Prisma.TransactionClient,
    tenantId: string,
    memberId: string,
  ) {
    const others = await tx.user.count({
      where: {
        tenantId,
        id: { not: memberId },
        role: "admin",
        status: "active",
      },
    });
    if (!others)
      throw new BadRequestException(
        "At least one active administrator is required",
      );
  }

  private async createInvitation(
    tx: Prisma.TransactionClient,
    tenantId: string,
    actorId: string,
    email: string,
    role: UserRole,
  ) {
    const token = `${tenantId}.${randomBytes(32).toString("base64url")}`;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const configuredTtl = Number(process.env.INVITATION_TTL_HOURS ?? 72);
    const ttlHours = Number.isFinite(configuredTtl)
      ? Math.max(1, Math.min(168, configuredTtl))
      : 72;
    const invitation = await tx.invitation.create({
      data: {
        tenantId,
        email,
        role,
        tokenHash,
        createdById: actorId,
        expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
      },
      select: { id: true, email: true, role: true, expiresAt: true },
    });
    return { ...invitation, token };
  }
}
