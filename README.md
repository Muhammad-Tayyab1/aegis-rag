# Aegis RAG

Aegis RAG is a multi-tenant retrieval platform built with Next.js, NestJS, Postgres/pgvector, and Prisma. It is designed to make retrieval systems explainable: every client workspace is isolated and its retrieval decisions can be traced.

## Foundation included

- Prisma schema and migration for tenants, configuration, users, documents, chunks, queries, traces, and feedback.
- pgvector and Postgres full-text columns, plus indexes for hybrid retrieval.
- Postgres row-level security policies enforced by `PrismaService.withTenant()` transaction context.
- JWT login/registration and a protected tenant configuration endpoint.
- A Next.js login screen and tenant dashboard shell.

## Local setup

1. Copy `.env.example` to `.env` and set a strong `JWT_SECRET`.
2. Run `npm install`.
3. Start Postgres: `docker compose up -d postgres`.
4. Apply the Prisma migration: `npm run db:migrate`.
5. Start the API: `npm run dev:api`.
6. In another terminal, start the web app: `npm run dev`.

The API is served at `http://localhost:4000/api`; the frontend runs at `http://localhost:3000`.

## Tenant isolation

Authenticated routes derive the tenant identifier solely from the verified JWT. Tenant-facing database operations run through `PrismaService.withTenant`, which sets `app.tenant_id` for the transaction. The migration's row-level security policies use that setting as a second enforcement layer, preventing a cross-tenant result even if a future query accidentally omits a tenant filter.

## Next implementation slice

The next slice is document ingestion: file upload, text extraction/chunking, embeddings, and Prisma-backed document/chunk writes. Hybrid vector and keyword retrieval follows on that storage layer.
