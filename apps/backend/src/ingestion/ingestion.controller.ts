import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AuthGuard } from "@nestjs/passport";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { CurrentUser } from "../common/tenant/current-user.decorator";
import { AuthenticatedUser } from "../common/tenant/tenant.types";
import { IngestionService } from "./ingestion.service";
import { TenantRateLimitGuard } from "../common/tenant/tenant-rate-limit.guard";
import { validateUpload } from "./ingestion-security";
@UseGuards(AuthGuard("jwt"), TenantRateLimitGuard)
@Controller("documents")
export class IngestionController {
  constructor(private readonly s: IngestionService) {}
  @Get() list(@CurrentUser() u: AuthenticatedUser) {
    return this.s.list(u.tenantId);
  }
  @Get(":documentId/chunks/:chunkId")
  chunk(
    @Param("documentId") documentId: string,
    @Param("chunkId") chunkId: string,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.s.chunkById(u.tenantId, documentId, chunkId);
  }
  @Delete(":id") remove(
    @Param("id") id: string,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.s.remove(u.tenantId, id);
  }
  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 10_000_000 } }),
  )
  async upload(
    @UploadedFile() f: Express.Multer.File,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    if (!f) throw new BadRequestException("file required");
    const { filename, extension: ext } = validateUpload(f);
    let content: string;
    if (ext === "pdf") content = (await pdf(f.buffer)).text;
    else if (ext === "docx")
      content = (await mammoth.extractRawText({ buffer: f.buffer })).value;
    else if (["txt", "md", "csv", "json"].includes(ext ?? ""))
      content = f.buffer.toString();
    else throw new BadRequestException("Unsupported document type");
    return this.s.ingest(u.tenantId, filename, content, "file");
  }
}
