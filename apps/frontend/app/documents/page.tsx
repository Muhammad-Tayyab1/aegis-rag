"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
export default function Documents() {
  const [docs, setDocs] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const load = () =>
    apiFetch("/documents")
      .then((r) => r.json())
      .then(setDocs);
  useEffect(() => {
    load();
  }, []);
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const b = new FormData();
    b.append("file", f);
    const r = await apiFetch("/documents/upload", {
      method: "POST",
      body: b,
    });
    setMessage(r.ok ? "Uploaded successfully" : "Upload failed");
    load();
  }
  async function remove(id: string) {
    await apiFetch("/documents/" + id, {
      method: "DELETE",
    });
    load();
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
        </nav>
      </aside>
      <section>
        <div className="eyebrow">KNOWLEDGE BASE</div>
        <h1>Documents</h1>
        <label className="button">
          Upload document
          <input
            hidden
            type="file"
            accept=".pdf,.docx,.txt,.md,.csv,.json"
            onChange={upload}
          />
        </label>
        {message && <p>{message}</p>}
        <div className="empty">
          {docs.length ? (
            docs.map((d) => (
              <p key={d.id}>
                <strong>{d.filename}</strong> · {d.status}{" "}
                <button onClick={() => remove(d.id)}>Remove</button>
              </p>
            ))
          ) : (
            <p>No documents uploaded yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
