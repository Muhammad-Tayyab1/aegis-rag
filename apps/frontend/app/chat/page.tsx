"use client";
import { useState } from "react";
export default function Chat() {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [c, setC] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setA("");
    setC([]);
    const r = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/chat/stream`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("aegis.accessToken") ?? ""}`,
        },
        body: JSON.stringify({ question: q }),
      },
    );
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
        if (event.includes("citations")) setC(data.citations);
      }
    }
    setBusy(false);
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
          {c.map((x) => (
            <article className="trace-stage" key={x.chunkId}>
              <strong>{x.document}</strong>
              <small>{x.snippet}</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
