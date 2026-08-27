import { IngestionWorkerService } from "./ingestion-worker.service";

describe("IngestionWorkerService retries", () => {
  const jobUpdate = jest.fn();
  const documentUpdate = jest.fn();
  const prisma = {
    withTenant: jest.fn((_tenantId, callback) =>
      callback({
        ingestionJob: { update: jobUpdate },
        document: { update: documentUpdate },
      }),
    ),
  };
  const worker = new IngestionWorkerService(
    prisma as never,
    {} as never,
    { record: jest.fn() } as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("reschedules a transient failure", async () => {
    await (worker as any).fail(
      {
        id: "job-1",
        tenantId: "tenant-1",
        documentId: "document-1",
        attempts: 1,
        maxAttempts: 3,
      },
      new Error("temporary"),
    );
    expect(jobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "pending",
          lastError: "temporary",
        }),
      }),
    );
    expect(documentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "pending" }),
      }),
    );
  });

  it("marks the document failed after the final attempt", async () => {
    await (worker as any).fail(
      {
        id: "job-1",
        tenantId: "tenant-1",
        documentId: "document-1",
        attempts: 3,
        maxAttempts: 3,
      },
      new Error("permanent"),
    );
    expect(jobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "failed",
          lastError: "permanent",
        }),
      }),
    );
    expect(documentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed" }),
      }),
    );
  });
});
