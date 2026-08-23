# Aegis RAG 90-second demo

This walkthrough demonstrates the client-facing value of Aegis without paid API keys. Start from a seeded local environment and sign in as `admin@aegis.local`.

## Prepare

Create a short file named `hospital-policy.md`:

```md
# Infection Prevention Policy IPC-104

Staff must report a suspected isolation breach to Infection Prevention immediately. Preserve relevant records and open a high-priority incident ticket before the end of the shift.
```

Start the stack, upload the file from `/documents`, and keep the browser tabs `/chat`, `/traces`, `/usage`, and `/tickets` ready.

## Shot list and narration

| Time   | Screen and action                                                                     | Suggested narration                                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–10s  | Landing page, then workspace overview                                                 | “Aegis is a multi-tenant RAG workspace for hospitals and other regulated operations teams.”                                                                           |
| 10–22s | Upload `hospital-policy.md`                                                           | “Files and external sources are parsed, protected by basic injection and PII checks, chunked, and stored in tenant-scoped PostgreSQL.”                                |
| 22–40s | Ask `What does IPC-104 require after an isolation breach?`                            | “Hybrid retrieval combines semantic similarity with full-text search, so an exact policy identifier is not lost. The answer streams with the precise source snippet.” |
| 40–55s | Open `/traces` and select the query                                                   | “An administrator can inspect vector and keyword candidates, fusion, reranking, scores, and latency to explain why the answer happened.”                              |
| 55–65s | Ask a deliberately vague question such as `What is the procedure?` and reopen traces  | “Weak context triggers one visible reformulation and retrieval retry instead of an untracked guess.”                                                                  |
| 65–77s | Ask `File a high priority ticket for an IPC-104 isolation breach` and open `/tickets` | “Intent-gated tool calling creates a tenant ticket and records the action in the trace.”                                                                              |
| 77–90s | Open `/usage`, then return to chat citations                                          | “Queries, tokens, estimated cost, feedback, and cached answers provide an operational improvement loop—all with row-level tenant isolation.”                          |

## Recording checklist

- Use a 1280×720 or larger browser window and hide personal bookmarks or notifications.
- Keep the final recording between 60 and 90 seconds.
- Show the citation card and trace details long enough to read.
- Do not show `.env`, access tokens, connection strings, or real patient/client data.
- Export as MP4 for a portfolio and optionally create a compressed GIF preview for the README.

The demo uses synthetic policy text and does not imply regulatory certification.
