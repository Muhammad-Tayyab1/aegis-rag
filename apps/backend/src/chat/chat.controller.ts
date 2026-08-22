import { Body, Controller, Header, Post, Res, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString } from "class-validator";
import { Response } from "express";
import { CurrentUser } from "../common/tenant/current-user.decorator";
import { AuthenticatedUser } from "../common/tenant/tenant.types";
import { PrismaService } from "../common/database/prisma.service";
import { RetrievalService } from "../retrieval/retrieval.service";
import { LlmService } from "./llm.service";
class Ask {
  @IsString() question!: string;
}
@UseGuards(AuthGuard("jwt"))
@Controller("chat")
export class ChatController {
  constructor(
    private r: RetrievalService,
    private p: PrismaService,
    private llm: LlmService,
  ) {}
  private async context(b: Ask, u: AuthenticatedUser) {
    const cached = await this.p.withTenant(u.tenantId, (tx) =>
      tx.semanticCache.findFirst({
        where: {
          tenantId: u.tenantId,
          question: b.question,
          expiresAt: { gt: new Date() },
        },
      }),
    );
    let hits = cached ? [] : await this.r.search(u.tenantId, b.question);
    let rerouted = false;
    if (!cached && (!hits.length || hits[0].score < 0.02)) {
      rerouted = true;
      hits = await this.r.search(
        u.tenantId,
        `${b.question} detailed policy procedure`,
      );
    }
    const ticketMatch = b.question.match(
      /(?:file|create|open)\s+(?:a\s+)?(?:bug|ticket)(?:\s+for)?\s+(.+)/i,
    );
    let answer = cached
      ? cached.answer
      : await this.llm.answer(b.question, hits);
    if (ticketMatch) answer = `Ticket created: ${ticketMatch[1]}`;
    return this.p.withTenant(u.tenantId, async (tx) => {
      const q = await tx.query.create({
        data: {
          tenantId: u.tenantId,
          userId: u.id,
          question: b.question,
          answer,
          tokensUsed: Math.ceil(answer.length / 4),
        },
      });
      if (ticketMatch) {
        const ticket = await tx.ticket.create({
          data: {
            tenantId: u.tenantId,
            queryId: q.id,
            summary: ticketMatch[1],
            priority: /urgent|critical|high/i.test(b.question)
              ? "high"
              : "medium",
          },
        });
        await tx.queryTrace.create({
          data: {
            tenantId: u.tenantId,
            queryId: q.id,
            stage: "tool:create_ticket",
            latencyMs: 0,
            details: { ticketId: ticket.id, priority: ticket.priority },
          },
        });
      }
      if (rerouted)
        await tx.queryTrace.create({
          data: {
            tenantId: u.tenantId,
            queryId: q.id,
            stage: "reroute",
            latencyMs: 0,
            details: { reason: "weak initial context" },
          },
        });
      await tx.queryTrace.createMany({
        data: hits.flatMap((h) =>
          [...(h.stages ?? ["fusion"]), "rerank"].map((stage) => ({
            tenantId: u.tenantId,
            queryId: q.id,
            stage,
            chunkId: h.id,
            rank: h.rank,
            score: h.score,
            latencyMs: h.stageLatencies?.[stage] ?? 0,
            details: { filename: h.filename },
          })),
        ),
      });
      if (!cached && !ticketMatch)
        await tx.semanticCache.create({
          data: {
            tenantId: u.tenantId,
            question: b.question,
            answer,
            citations: hits.map((h) => ({
              chunkId: h.id,
              document: h.filename,
              snippet: h.content.slice(0, 240),
            })),
            expiresAt: new Date(Date.now() + 86400000),
          },
        });
      return {
        queryId: q.id,
        answer,
        citations: cached
          ? (cached.citations as any[])
          : hits.map((h) => ({
              chunkId: h.id,
              document: h.filename,
              snippet: h.content.slice(0, 240),
            })),
      };
    });
  }
  @Post() ask(@Body() b: Ask, @CurrentUser() u: AuthenticatedUser) {
    return this.context(b, u);
  }
  @Post("stream")
  @Header("Content-Type", "text/event-stream")
  @Header("Cache-Control", "no-cache")
  async stream(
    @Body() b: Ask,
    @CurrentUser() u: AuthenticatedUser,
    @Res() res: Response,
  ) {
    res.flushHeaders();
    const result = await this.context(b, u);
    for (const token of result.answer.split(/(\s+)/)) {
      res.write(`event: token\ndata: ${JSON.stringify({ token })}\n\n`);
      await new Promise((r) => setTimeout(r, 8));
    }
    res.write(
      `event: citations\ndata: ${JSON.stringify({ queryId: result.queryId, citations: result.citations })}\n\n`,
    );
    res.write("event: done\ndata: {}\n\n");
    res.end();
  }
}
