import { BadRequestException, Injectable } from "@nestjs/common";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_PAGES = 20;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;

async function readLimitedBody(response: Response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new BadRequestException(
        "Connector response exceeds the 1 MB limit",
      );
    }
    body += decoder.decode(chunk.value, { stream: true });
  }
  return body + decoder.decode();
}

export function isPrivateAddress(address: string) {
  const value = address.toLowerCase();
  if (value === "::1" || value === "::" || value.startsWith("fe80:"))
    return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  if (!isIP(value)) return true;
  if (value.includes(":")) return false;
  const [a, b] = value.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

export function extractCrawlerLinks(body: string, pageUrl: URL) {
  const links = new Set<string>();
  const pattern =
    /<(?:loc|a\s[^>]*href)\s*(?:=\s*["']([^"']+)["'][^>]*>|>([^<]+)<\/loc>)/gi;
  for (const match of body.matchAll(pattern)) {
    try {
      const url = new URL((match[1] ?? match[2]).trim(), pageUrl);
      url.hash = "";
      if (url.protocol === "https:" && url.origin === pageUrl.origin)
        links.add(url.toString());
    } catch {
      continue;
    }
  }
  return [...links];
}

function readableText(html: string) {
  return html
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

@Injectable()
export class UrlCrawlerService {
  private async assertPublicHttps(url: URL) {
    if (url.protocol !== "https:")
      throw new BadRequestException("Connector URLs must use HTTPS");
    if (url.username || url.password)
      throw new BadRequestException(
        "Connector URLs cannot contain credentials",
      );
    const records = await lookup(url.hostname, { all: true });
    if (
      !records.length ||
      records.some((record) => isPrivateAddress(record.address))
    )
      throw new BadRequestException(
        "Connector URL must resolve to a public address",
      );
  }

  private async fetchPage(
    url: URL,
    redirects = 0,
  ): Promise<{ body: string; url: URL }> {
    await this.assertPublicHttps(url);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: { "user-agent": "Aegis-RAG-Crawler/1.0" },
    });
    if (response.status >= 300 && response.status < 400) {
      if (redirects >= MAX_REDIRECTS)
        throw new BadRequestException("Crawler redirect limit exceeded");
      const location = response.headers.get("location");
      if (!location)
        throw new BadRequestException("Crawler received an invalid redirect");
      return this.fetchPage(new URL(location, url), redirects + 1);
    }
    if (!response.ok)
      throw new BadRequestException(
        `Crawler source returned ${response.status}`,
      );
    const declaredSize = Number(response.headers.get("content-length") ?? 0);
    if (declaredSize > MAX_RESPONSE_BYTES)
      throw new BadRequestException(
        "Connector response exceeds the 1 MB limit",
      );
    const body = await readLimitedBody(response);
    return { body, url };
  }

  async fetchPublicText(sourceUrl: string) {
    let url: URL;
    try {
      url = new URL(sourceUrl);
    } catch {
      throw new BadRequestException("Connector requires a valid URL");
    }
    return this.fetchPage(url);
  }

  async crawl(startUrl: string, requestedLimit?: string) {
    let start: URL;
    try {
      start = new URL(startUrl);
    } catch {
      throw new BadRequestException("Crawler requires a valid URL");
    }
    const parsedLimit = Number(requestedLimit ?? 10);
    const limit = Number.isInteger(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), MAX_PAGES)
      : 10;
    const pending = [start.toString()];
    const visited = new Set<string>();
    const documents: string[] = [];
    while (pending.length && visited.size < limit) {
      const candidate = pending.shift()!;
      if (visited.has(candidate)) continue;
      const page = await this.fetchPublicText(candidate);
      if (page.url.origin !== start.origin)
        throw new BadRequestException(
          "Crawler redirects must stay on the configured origin",
        );
      visited.add(page.url.toString());
      const text = readableText(page.body);
      if (text) documents.push(`Source: ${page.url.toString()}\n${text}`);
      for (const link of extractCrawlerLinks(page.body, page.url)) {
        if (!visited.has(link) && !pending.includes(link)) pending.push(link);
      }
    }
    if (!documents.length)
      throw new BadRequestException("Crawler found no readable content");
    return { text: documents.join("\n\n"), pages: visited.size };
  }
}
