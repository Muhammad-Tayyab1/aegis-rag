import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/database/prisma.service";

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}
  async mine(tenantId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        include: { config: true },
      });
      if (!tenant || !tenant.config)
        throw new NotFoundException("Tenant not found");
      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        chunkSize: tenant.config.chunkSize,
        chunkOverlap: tenant.config.chunkOverlap,
        embeddingModel: tenant.config.embeddingModel,
        retrievalStrategy: tenant.config.retrievalStrategy,
        rerankEnabled: tenant.config.rerankEnabled,
      };
    });
  }
}
