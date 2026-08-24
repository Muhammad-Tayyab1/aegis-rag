import { Body, Controller, Header, Post, Res, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString } from "class-validator";
import { Response } from "express";
import { CurrentUser } from "../common/tenant/current-user.decorator";
import { AuthenticatedUser } from "../common/tenant/tenant.types";
import { PrismaService } from "../common/database/prisma.service";
import { RetrievalService } from "../retrieval/retrieval.service";
import { LlmService } from "./llm.service";
import { TenantRateLimitGuard } from "../common/tenant/tenant-rate-limit.guard";
import { SemanticCacheService } from "./semantic-cache.service";
import { estimatedTokens } from "./usage-cost";
import { traceSequence } from "../tracing/trace-order";
class Ask {
  @IsString() question!: string;
}
@UseGuards(AuthGuard("jwt"), TenantRateLimitGuard)
@Controller("chat")
export class ChatController {
  constructor(
    private r: RetrievalService,
    private p: PrismaService,
    private llm: LlmService,
    private cache: SemanticCacheService,
  ) {}
  private async context(b: Ask, u: AuthenticatedUser) {
    const cached = await this.cache.find(u.tenantId, b.question);
    let hits = cached ? [] : await this.r.search(u.tenantId, b.question);
    let rerouted = false;
    let rerouteLatencyMs = 0;
    let reformulatedQuestion = "";
    if (!cached && (!hits.length || hits[0].score < 0.02)) {
      rerouted = true;
      reformulatedQuestion = `${b.question} detailed policy procedure`;
      const rerouteStarted = performance.now();
      hits = await this.r.search(u.tenantId, reformulatedQuestion);
      rerouteLatencyMs = Math.round(performance.now() - rerouteStarted);
    }
    const ticketMatch = b.question.match(
      /(?:file|create|open)\s+(?:a\s+)?(?:bug|ticket)(?:\s+for)?\s+(.+)/i,
    );
    const generationStarted = performance.now();
    const generation = cached
      ? {
          text: cached.answer,
          provider: "semantic-cache",
          model: "cached-answer",
          inputTokens: estimatedTokens(b.question),
          outputTokens: estimatedTokens(cached.answer),
          estimatedCostUsd: 0,
        }
      : ticketMatch
        ? {
            text: `Ticket created: ${ticketMatch[1]}`,
            provider: "tool",
            model: "create_ticket",
            inputTokens: estimatedTokens(b.question),
            outputTokens: estimatedTokens(`Ticket created: ${ticketMatch[1]}`),
            estimatedCostUsd: 0,
          }
        : await this.llm.answer(b.question, hits);
    const generationLatencyMs = Math.round(
      performance.now() - generationStarted,
    );
    const answer = generation.text;
    return this.p.withTenant(u.tenantId, async (tx) => {
      const q = await tx.query.create({
        data: {
          tenantId: u.tenantId,
          userId: u.id,
          question: b.question,
          answer,
          tokensUsed: generation.inputTokens + generation.outputTokens,
          estimatedCostUsd: generation.estimatedCostUsd,
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
            sequence: traceSequence("tool:create_ticket"),
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
            sequence: traceSequence("reroute"),
            latencyMs: rerouteLatencyMs,
            details: {
              reason: "weak initial context",
              originalQuestion: b.question,
              reformulatedQuestion,
            },
          },
        });
      if (cached)
        await tx.queryTrace.create({
          data: {
            tenantId: u.tenantId,
            queryId: q.id,
            stage: "semantic_cache",
            sequence: traceSequence("semantic_cache"),
            latencyMs: 0,
            score: cached.similarity,
            details: {
              cacheId: cached.id,
              matchedQuestion: cached.question,
            },
          },
        });
      await tx.queryTrace.createMany({
        data: hits.flatMap((h) =>
          (h.stages ?? ["fusion"]).map((stage) => ({
            tenantId: u.tenantId,
            queryId: q.id,
            stage,
            sequence: traceSequence(stage),
            chunkId: h.id,
            rank: h.stageRanks?.[stage] ?? h.rank,
            score: h.stageScores?.[stage] ?? h.score,
            latencyMs: h.stageLatencies?.[stage] ?? 0,
            details: { filename: h.filename },
          })),
        ),
      });
      await tx.queryTrace.create({
        data: {
          tenantId: u.tenantId,
          queryId: q.id,
          stage: "generation",
          sequence: traceSequence("generation"),
          latencyMs: generationLatencyMs,
          details: {
            provider: generation.provider,
            model: generation.model,
            inputTokens: generation.inputTokens,
            outputTokens: generation.outputTokens,
            estimatedCostUsd: generation.estimatedCostUsd,
            fallbackReasons:
              "fallbackReasons" in generation ? generation.fallbackReasons : [],
          },
        },
      });
      const citations = hits.map((h) => ({
        chunkId: h.id,
        document: h.filename,
        snippet: h.content.slice(0, 240),
      }));
      if (!cached && !ticketMatch)
        await this.cache.store(u.tenantId, b.question, answer, citations, tx);
      return {
        queryId: q.id,
        answer,
        citations: cached ? (cached.citations as any[]) : citations,
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
