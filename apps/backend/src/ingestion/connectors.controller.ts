import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsIn, IsObject, IsString } from "class-validator";
import { Client } from "pg";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { CurrentUser } from "../common/tenant/current-user.decorator";
import { AuthenticatedUser } from "../common/tenant/tenant.types";
import { PrismaService } from "../common/database/prisma.service";
import { IngestionService } from "./ingestion.service";
import { TenantRateLimitGuard } from "../common/tenant/tenant-rate-limit.guard";
import { UrlCrawlerService } from "./url-crawler.service";
class CreateConnector {
  @IsString() name!: string;
  @IsIn(["rest", "postgres", "crawler"]) type!: string;
  @IsObject() config!: Record<string, string>;
}
export function isReadOnlySelect(query?: string) {
  return Boolean(
    query &&
    /^select\s/i.test(query.trim()) &&
    !/;|\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy)\b/i.test(
      query,
    ),
  );
}
@UseGuards(AuthGuard("jwt"), TenantRateLimitGuard)
@Controller("connectors")
export class ConnectorsController {
  constructor(
    private p: PrismaService,
    private i: IngestionService,
    private crawler: UrlCrawlerService,
  ) {}
  private key() {
    const value = process.env.CONNECTOR_ENCRYPTION_KEY;
    if (!value || !/^[a-f0-9]{64}$/i.test(value))
      throw new Error(
        "CONNECTOR_ENCRYPTION_KEY must be 32 bytes encoded as hex",
      );
    return Buffer.from(value, "hex");
  }
  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), encrypted]
      .map((x) => x.toString("base64"))
      .join(".");
  }
  private decrypt(value: string) {
    const [iv, tag, encrypted] = value
      .split(".")
      .map((x) => Buffer.from(x, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", this.key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  }
  @Get() list(@CurrentUser() u: AuthenticatedUser) {
    return this.p.withTenant(u.tenantId, (tx) =>
      tx.connector.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          type: true,
          lastSyncedAt: true,
          createdAt: true,
        },
      }),
    );
  }
  @Post() create(
    @Body() b: CreateConnector,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    const config = { ...b.config };
    if (b.type === "postgres") {
      if (
        !/^postgres(?:ql)?:\/\//i.test(config.connectionString ?? "") ||
        !isReadOnlySelect(config.query)
      )
        throw new BadRequestException(
          "PostgreSQL connectors require a connection string and one read-only SELECT query",
        );
      config.connectionString = this.encrypt(config.connectionString);
      config.query = config.query.trim();
    } else if (!config.url?.startsWith("https://")) {
      throw new BadRequestException("HTTP connectors require an HTTPS URL");
    }
    return this.p.withTenant(u.tenantId, (tx) =>
      tx.connector.create({
        data: {
          tenantId: u.tenantId,
          name: b.name,
          type: b.type,
          config,
        },
      }),
    );
  }
  @Post(":id/sync") async sync(
    @Param("id") id: string,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    const c = await this.p.withTenant(u.tenantId, (tx) =>
      tx.connector.findFirst({ where: { id } }),
    );
    if (!c) throw new NotFoundException("Connector not found");
    const cfg = c.config as Record<string, string>;
    let text = "";
    if (c.type === "crawler") {
      const result = await this.crawler.crawl(cfg.url, cfg.maxPages);
      text = result.text;
    } else if (c.type === "rest") {
      text = (await this.crawler.fetchPublicText(cfg.url)).body;
    } else {
      if (!cfg.connectionString || !isReadOnlySelect(cfg.query))
        throw new Error(
          "Postgres connector requires one read-only SELECT query",
        );
      const db = new Client({
        connectionString: this.decrypt(cfg.connectionString),
        statement_timeout: 10000,
      });
      await db.connect();
      try {
        await db.query("BEGIN READ ONLY");
        const r = await db.query(cfg.query);
        text = r.rows.map((x) => JSON.stringify(x)).join("\n");
        if (Buffer.byteLength(text) > 1_000_000)
          throw new BadRequestException(
            "PostgreSQL connector result exceeds the 1 MB limit",
          );
      } finally {
        await db.query("ROLLBACK").catch(() => undefined);
        await db.end();
      }
    }
    const d = await this.i.ingest(u.tenantId, c.name, text, c.type, cfg.url);
    await this.p.withTenant(u.tenantId, (tx) =>
      tx.connector.update({
        where: { id },
        data: { lastSyncedAt: new Date() },
      }),
    );
    return d;
  }
}
