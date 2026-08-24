import { BadRequestException } from "@nestjs/common";
import { basename } from "node:path";

const textMimeTypes: Record<string, string[]> = {
  txt: ["text/plain"],
  md: ["text/markdown", "text/plain"],
  csv: ["text/csv", "text/plain", "application/vnd.ms-excel"],
  json: ["application/json", "text/json", "text/plain"],
};

export function validateUpload(file: Express.Multer.File) {
  const filename = basename(file.originalname.replaceAll("\\", "/"));
  const extension = filename.toLowerCase().split(".").pop() ?? "";
  const mimeType = file.mimetype.toLowerCase().split(";", 1)[0];
  if (extension === "pdf") {
    if (
      mimeType !== "application/pdf" ||
      file.buffer.subarray(0, 5).toString() !== "%PDF-"
    )
      throw new BadRequestException("PDF content does not match its file type");
  } else if (extension === "docx") {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
    ];
    if (
      !allowed.includes(mimeType) ||
      file.buffer.length < 4 ||
      file.buffer.readUInt32LE(0) !== 0x04034b50
    )
      throw new BadRequestException(
        "DOCX content does not match its file type",
      );
  } else if (textMimeTypes[extension]) {
    if (!textMimeTypes[extension].includes(mimeType) || file.buffer.includes(0))
      throw new BadRequestException(
        "Text content does not match its file type",
      );
    if (extension === "json") {
      try {
        JSON.parse(file.buffer.toString("utf8"));
      } catch {
        throw new BadRequestException("JSON document is not valid JSON");
      }
    }
  } else {
    throw new BadRequestException(
      "Supported formats: PDF, DOCX, TXT, MD, CSV, JSON",
    );
  }
  return { filename, extension };
}

export function sanitizeIngestedContent(content: string) {
  if (!content.trim())
    throw new BadRequestException("Document contains no readable content");
  if (
    /(?:ignore|disregard|override)\s+(?:(?:all|any)\s+)?(?:(?:previous|prior|above)\s+)?instructions|system\s+prompt|reveal\s+(your|the)\s+prompt/i.test(
      content,
    )
  )
    throw new BadRequestException(
      "Document contains a blocked prompt-injection pattern",
    );
  return content
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/(?:\+?\d[\d\s().-]{8,}\d)/g, "[REDACTED_PHONE]");
}
