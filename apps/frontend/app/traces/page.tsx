"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
type Trace = {
  id: string;
  question: string;
  answer?: string;
  createdAt: string;
  traces: {
    id: string;
    stage: string;
    sequence: number;
    rank?: number;
    score?: number;
    latencyMs: number;
    details?: Record<string, unknown> & { filename?: string };
    chunk?: { content: string; document?: { filename: string } };
  }[];
};
export default function Traces() {
  const [items, setItems] = useState<Trace[]>([]);
  const [selected, setSelected] = useState<Trace>();
  useEffect(() => {
    apiFetch("/traces")
      .then((r) => r.json())
      .then(setItems);
  }, []);
  return (
    <main className="dashboard">
      <aside>
        <div className="brand">
          AEGIS <span>RAG</span>
        </div>
        <nav>
          <a href="/dashboard">Overview</a>
          <a href="/documents">Documents</a>
          <a href="/traces">Traces</a>
        </nav>
      </aside>
      <section>
        <div className="eyebrow">RETRIEVAL OBSERVABILITY</div>
        <h1>Query traces</h1>
        <div className="trace-grid">
          <div className="empty">
            {items.length ? (
              items.map((x) => (
                <button
                  className="trace-row"
                  key={x.id}
                  onClick={() => setSelected(x)}
                >
                  {x.question}
                  <small>{new Date(x.createdAt).toLocaleString()}</small>
                </button>
              ))
            ) : (
              <p>No traces yet.</p>
            )}
          </div>
          <div className="empty">
            <h2>{selected?.question ?? "Select a query"}</h2>
            {selected && (
              <>
                <p>{selected.answer}</p>
                {selected.traces.map((t) => (
                  <article className="trace-stage" key={t.id}>
                    <strong>{t.stage}</strong>
                    <span>
                      rank {t.rank ?? "—"} · score {t.score ?? "—"} ·{" "}
                      {t.latencyMs}ms
                    </span>
                    <p>
                      {t.chunk?.document?.filename ??
                        t.details?.filename ??
                        "Retrieval event"}
                    </p>
                    {t.chunk && <small>{t.chunk.content.slice(0, 280)}</small>}
                    {t.details && Object.keys(t.details).length > 0 && (
                      <pre>{JSON.stringify(t.details, null, 2)}</pre>
                    )}
                  </article>
                ))}
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
