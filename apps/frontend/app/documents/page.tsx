"use client";
import { useEffect, useState } from "react";
export default function Documents() {
  const [docs, setDocs] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
  const auth = () => ({
    Authorization:
      "Bearer " + (localStorage.getItem("aegis.accessToken") ?? ""),
  });
  const load = () =>
    fetch(api + "/documents", { headers: auth() })
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
    const r = await fetch(api + "/documents/upload", {
      method: "POST",
      headers: auth(),
      body: b,
    });
    setMessage(r.ok ? "Uploaded successfully" : "Upload failed");
    load();
  }
  async function remove(id: string) {
    await fetch(api + "/documents/" + id, {
      method: "DELETE",
      headers: auth(),
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
