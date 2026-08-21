import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../common/database/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly database: PrismaService) {}
  @Get() async check() {
    await this.database.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
}
