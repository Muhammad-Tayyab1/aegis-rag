"use client";
import { useEffect, useState } from "react";
type Connector = {
  id: string;
  name: string;
  type: string;
  lastSyncedAt?: string;
};
export default function Connectors() {
  const [list, setList] = useState<Connector[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
  const headers = () => ({
    "content-type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("aegis.accessToken") ?? ""}`,
  });
  const load = () =>
    fetch(api + "/connectors", { headers: headers() })
      .then((r) => r.json())
      .then(setList);
  useEffect(() => {
    load();
  }, []);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    await fetch(api + "/connectors", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ name, type: "rest", config: { url } }),
    });
    setName("");
    setUrl("");
    load();
  }
  async function sync(id: string) {
    await fetch(`${api}/connectors/${id}/sync`, {
      method: "POST",
      headers: headers(),
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
          <a href="/connectors">Connectors</a>
          <a href="/chat">Chat</a>
        </nav>
      </aside>
      <section>
        <div className="eyebrow">DATA SOURCES</div>
        <h1>Connectors</h1>
        <form className="card" onSubmit={create}>
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            HTTPS REST URL
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </label>
          <button className="button">Add connector</button>
        </form>
        <div className="empty">
          {list.length ? (
            list.map((c) => (
              <p key={c.id}>
                <strong>{c.name}</strong> · {c.type} ·{" "}
                {c.lastSyncedAt
                  ? `synced ${new Date(c.lastSyncedAt).toLocaleString()}`
                  : "not synced"}{" "}
                <button onClick={() => sync(c.id)}>Sync</button>
              </p>
            ))
          ) : (
            <p>No connectors configured.</p>
          )}
        </div>
      </section>
    </main>
  );
}
