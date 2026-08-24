"use client";
import { useState } from "react";
import { apiFetch } from "../../lib/api";
export default function Chat() {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [c, setC] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [queryId, setQueryId] = useState("");
  const [rated, setRated] = useState(false);
  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setA("");
    setC([]);
    setQueryId("");
    setRated(false);
    const r = await apiFetch("/chat/stream", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ question: q }),
    });
    const reader = r.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { x, done } = await reader
        .read()
        .then((v) => ({ x: v.value, done: v.done }));
      if (done) break;
      buffer += decoder.decode(x);
      for (const event of buffer.split("\n\n").slice(0, -1)) {
        const line = event.split("\n").find((v) => v.startsWith("data:"));
        if (!line) continue;
        const data = JSON.parse(line.slice(5));
        if (event.includes("token")) setA((v) => v + data.token);
        if (event.includes("citations")) {
          setC(data.citations);
          setQueryId(data.queryId);
        }
      }
    }
    setBusy(false);
  }
  async function rate(rating: 1 | -1) {
    await apiFetch(`/feedback/${queryId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ rating }),
    });
    setRated(true);
  }
  return (
    <main className="dashboard">
      <aside>
        <div className="brand">
          AEGIS <span>RAG</span>
        </div>
        <nav>
          <a href="/dashboard">Overview</a>
          <a href="/documents">Documents</a>
          <a href="/chat">Chat</a>
          <a href="/traces">Traces</a>
        </nav>
      </aside>
      <section>
        <div className="eyebrow">KNOWLEDGE ASSISTANT</div>
        <h1>Ask your workspace</h1>
        <form onSubmit={ask}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask about your documents…"
            required
          />
          <button className="button" disabled={busy}>
            {busy ? "Thinking…" : "Ask →"}
          </button>
        </form>
        <div className="empty">
          <p>{a || "Answers will stream here with retrieval citations."}</p>
          {queryId && (
            <p>
              {rated ? (
                "Thanks for the feedback."
              ) : (
                <>
                  <button onClick={() => rate(1)}>👍 Helpful</button>{" "}
                  <button onClick={() => rate(-1)}>👎 Needs work</button>
                </>
              )}
            </p>
          )}
          {c.map((x) => (
            <a
              className="trace-stage citation-card"
              key={x.chunkId}
              href={`/documents/${x.documentId}/chunks/${x.chunkId}`}
            >
              <strong>{x.document}</strong>
              <small>{x.snippet}</small>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
