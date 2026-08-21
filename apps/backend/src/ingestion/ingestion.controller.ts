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
@UseGuards(AuthGuard("jwt"))
@Controller("documents")
export class IngestionController {
  constructor(private readonly s: IngestionService) {}
  @Get() list(@CurrentUser() u: AuthenticatedUser) {
    return this.s.list(u.tenantId);
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
    const ext = f.originalname.toLowerCase().split(".").pop();
    let content: string;
    if (ext === "pdf") content = (await pdf(f.buffer)).text;
    else if (ext === "docx")
      content = (await mammoth.extractRawText({ buffer: f.buffer })).value;
    else if (["txt", "md", "csv", "json"].includes(ext ?? ""))
      content = f.buffer.toString();
    else
      throw new BadRequestException(
        "Supported formats: PDF, DOCX, TXT, MD, CSV, JSON",
      );
    if (
      /ignore\s+(all|previous)\s+instructions|system\s+prompt|reveal\s+(your|the)\s+prompt/i.test(
        content,
      )
    ) {
      throw new BadRequestException(
        "Document contains a blocked prompt-injection pattern",
      );
    }
    return this.s.ingest(u.tenantId, f.originalname, content, "file");
  }
}
