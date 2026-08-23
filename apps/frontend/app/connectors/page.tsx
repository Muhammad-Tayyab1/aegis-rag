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
  const [type, setType] = useState<"rest" | "crawler" | "postgres">("crawler");
  const [maxPages, setMaxPages] = useState("10");
  const [connectionString, setConnectionString] = useState("");
  const [query, setQuery] = useState("SELECT * FROM policies LIMIT 1000");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState("");
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
    setError("");
    setSaving(true);
    try {
      const config =
        type === "postgres"
          ? { connectionString, query }
          : type === "crawler"
            ? { url, maxPages }
            : { url };
      const response = await fetch(api + "/connectors", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ name, type, config }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          Array.isArray(body.message)
            ? body.message.join(", ")
            : (body.message ?? "Unable to add connector"),
        );
      setName("");
      setUrl("");
      setConnectionString("");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to add connector",
      );
    } finally {
      setSaving(false);
    }
  }
  async function sync(id: string) {
    setError("");
    setSyncing(id);
    try {
      const response = await fetch(`${api}/connectors/${id}/sync`, {
        method: "POST",
        headers: headers(),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Sync failed");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sync failed");
    } finally {
      setSyncing("");
    }
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
            Connector type
            <select
              value={type}
              onChange={(e) =>
                setType(e.target.value as "rest" | "crawler" | "postgres")
              }
            >
              <option value="crawler">Website / sitemap crawler</option>
              <option value="rest">REST API</option>
              <option value="postgres">PostgreSQL query</option>
            </select>
          </label>
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          {type === "postgres" ? (
            <>
              <label>
                PostgreSQL connection string
                <input
                  type="password"
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  placeholder="postgresql://readonly:password@db.example.com/client"
                  autoComplete="off"
                  required
                />
              </label>
              <label>
                Read-only SELECT query
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  rows={5}
                  spellCheck={false}
                  required
                />
              </label>
              <p>
                Use a least-privilege database user. Aegis encrypts the
                connection string and executes the query in a read-only
                transaction with a 10-second timeout.
              </p>
            </>
          ) : (
            <label>
              {type === "crawler"
                ? "HTTPS page or sitemap URL"
                : "HTTPS REST URL"}
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </label>
          )}
          {type === "crawler" && (
            <label>
              Maximum pages (1–20)
              <input
                type="number"
                min="1"
                max="20"
                value={maxPages}
                onChange={(e) => setMaxPages(e.target.value)}
                required
              />
            </label>
          )}
          {error && <p className="error">{error}</p>}
          <button className="button" disabled={saving}>
            {saving ? "Adding connector…" : "Add connector"}
          </button>
        </form>
        <div className="empty">
          {list.length ? (
            list.map((c) => (
              <p key={c.id}>
                <strong>{c.name}</strong> · {c.type} ·{" "}
                {c.lastSyncedAt
                  ? `synced ${new Date(c.lastSyncedAt).toLocaleString()}`
                  : "not synced"}{" "}
                <button onClick={() => sync(c.id)} disabled={syncing === c.id}>
                  {syncing === c.id ? "Syncing…" : "Sync"}
                </button>
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
