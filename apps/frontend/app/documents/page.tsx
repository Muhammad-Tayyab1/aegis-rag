"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
export default function Documents() {
  const [docs, setDocs] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const load = async () => {
    const response = await apiFetch("/documents");
    if (response.ok) setDocs(await response.json());
  };
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 2000);
    return () => window.clearInterval(timer);
  }, []);
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const b = new FormData();
    b.append("file", f);
    setUploading(true);
    try {
      const r = await apiFetch("/documents/upload", {
        method: "POST",
        body: b,
      });
      setMessage(r.ok ? "Upload queued for processing" : "Upload failed");
      await load();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }
  async function retry(id: string) {
    const response = await apiFetch(`/documents/${id}/retry`, {
      method: "POST",
    });
    setMessage(response.ok ? "Retry queued" : "Could not retry ingestion");
    await load();
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
        <label className={`button ${uploading ? "disabled" : ""}`}>
          {uploading ? "Uploading…" : "Upload document"}
          <input
            hidden
            type="file"
            accept=".pdf,.docx,.txt,.md,.csv,.json"
            onChange={upload}
            disabled={uploading}
          />
        </label>
        {message && <p>{message}</p>}
        <div className="empty">
          {docs.length ? (
            docs.map((d) => (
              <div className="document-row" key={d.id}>
                <div>
                  <strong>{d.filename}</strong>{" "}
                  <span className={`status status-${d.status}`}>
                    {d.status}
                  </span>
                  {d.status === "pending" && d.attempts > 0 && (
                    <small>
                      Retry {d.attempts}/{d.maxAttempts} is scheduled
                    </small>
                  )}
                  {d.error && <small className="error">{d.error}</small>}
                </div>
                <div className="document-actions">
                  {d.status === "failed" && (
                    <button onClick={() => retry(d.id)}>Retry</button>
                  )}
                  <button onClick={() => remove(d.id)}>Remove</button>
                </div>
              </div>
            ))
          ) : (
            <p>No documents uploaded yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
