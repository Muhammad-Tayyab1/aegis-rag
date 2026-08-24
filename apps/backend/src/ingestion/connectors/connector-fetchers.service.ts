import { BadRequestException, Injectable } from "@nestjs/common";
import { Client } from "pg";
import { decryptConnectorSecret, isReadOnlySelect } from "./connector-security";
import { UrlCrawlerService } from "../url-crawler.service";
import { Connector, ConnectorConfig, RawDocument } from "./connector";

@Injectable()
export class RestConnector implements Connector {
  readonly type = "rest";
  constructor(private readonly crawler: UrlCrawlerService) {}
  async fetch(name: string, config: ConnectorConfig): Promise<RawDocument[]> {
    return [
      {
        filename: name,
        content: (await this.crawler.fetchPublicText(config.url)).body,
        sourceType: this.type,
        sourceUri: config.url,
      },
    ];
  }
}

@Injectable()
export class CrawlerConnector implements Connector {
  readonly type = "crawler";
  constructor(private readonly crawler: UrlCrawlerService) {}
  async fetch(name: string, config: ConnectorConfig): Promise<RawDocument[]> {
    return [
      {
        filename: name,
        content: (await this.crawler.crawl(config.url, config.maxPages)).text,
        sourceType: this.type,
        sourceUri: config.url,
      },
    ];
  }
}

@Injectable()
export class PostgresConnector implements Connector {
  readonly type = "postgres";
  async fetch(name: string, config: ConnectorConfig): Promise<RawDocument[]> {
    if (!config.connectionString || !isReadOnlySelect(config.query))
      throw new BadRequestException(
        "Postgres connector requires one read-only SELECT query",
      );
    const db = new Client({
      connectionString: decryptConnectorSecret(config.connectionString),
      statement_timeout: 10_000,
    });
    await db.connect();
    try {
      await db.query("BEGIN READ ONLY");
      const result = await db.query(config.query);
      const content = result.rows.map((row) => JSON.stringify(row)).join("\n");
      if (Buffer.byteLength(content) > 1_000_000)
        throw new BadRequestException(
          "PostgreSQL connector result exceeds the 1 MB limit",
        );
      return [{ filename: name, content, sourceType: this.type }];
    } finally {
      await db.query("ROLLBACK").catch(() => undefined);
      await db.end();
    }
  }
}

@Injectable()
export class ConnectorFetchers {
  private readonly fetchers: Map<string, Connector>;
  constructor(
    rest: RestConnector,
    crawler: CrawlerConnector,
    postgres: PostgresConnector,
  ) {
    this.fetchers = new Map(
      [rest, crawler, postgres].map((item) => [item.type, item]),
    );
  }
  fetch(type: string, name: string, config: ConnectorConfig) {
    const fetcher = this.fetchers.get(type);
    if (!fetcher)
      throw new BadRequestException(`Unsupported connector: ${type}`);
    return fetcher.fetch(name, config);
  }
}
