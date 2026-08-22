"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
type Config = {
  chunkSize: number;
  chunkOverlap: number;
  embeddingModel: string;
  retrievalStrategy: string;
  rerankEnabled: boolean;
};
export default function Settings() {
  const [form, setForm] = useState<Config>({
    chunkSize: 800,
    chunkOverlap: 100,
    embeddingModel: "all-MiniLM-L6-v2",
    retrievalStrategy: "hybrid",
    rerankEnabled: true,
  });
  const [msg, setMsg] = useState("");
  useEffect(() => {
    apiFetch("/tenants/me")
      .then((r) => r.json())
      .then(setForm);
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await apiFetch("/tenants/config", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    setMsg(r.ok ? "Settings saved" : "Administrator access required");
  }
  return (
    <main className="dashboard">
      <aside>
        <div className="brand">
          AEGIS <span>RAG</span>
        </div>
        <nav>
          <a href="/dashboard">Overview</a>
          <a href="/settings">Settings</a>
        </nav>
      </aside>
      <section>
        <div className="eyebrow">TENANT CONFIGURATION</div>
        <h1>Retrieval settings</h1>
        <form className="card" onSubmit={save}>
          <label>
            Chunk size
            <input
              type="number"
              min="100"
              max="5000"
              value={form.chunkSize}
              onChange={(e) =>
                setForm({ ...form, chunkSize: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Chunk overlap
            <input
              type="number"
              min="0"
              max="1000"
              value={form.chunkOverlap}
              onChange={(e) =>
                setForm({ ...form, chunkOverlap: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Embedding model
            <input
              value={form.embeddingModel}
              onChange={(e) =>
                setForm({ ...form, embeddingModel: e.target.value })
              }
            />
          </label>
          <label>
            Retrieval strategy
            <select
              value={form.retrievalStrategy}
              onChange={(e) =>
                setForm({ ...form, retrievalStrategy: e.target.value })
              }
            >
              <option value="hybrid">Hybrid</option>
              <option value="vector">Vector</option>
              <option value="keyword">Keyword</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.rerankEnabled}
              onChange={(e) =>
                setForm({ ...form, rerankEnabled: e.target.checked })
              }
            />{" "}
            Enable reranking
          </label>
          <button className="button">Save settings</button>
          {msg && <p>{msg}</p>}
        </form>
      </section>
    </main>
  );
}
