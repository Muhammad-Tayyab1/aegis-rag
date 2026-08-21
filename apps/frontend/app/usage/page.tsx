"use client";

import { useEffect, useState } from "react";

type Usage = { queries: number; tokens: number; cost: string | number };

export default function UsagePage() {
  const [usage, setUsage] = useState<Usage>();
  const [error, setError] = useState("");

  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
    const token = localStorage.getItem("aegis.accessToken") ?? "";
    fetch(`${api}/usage`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load usage data");
        return response.json();
      })
      .then(setUsage)
      .catch((cause: Error) => setError(cause.message));
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
          <a href="/chat">Chat</a>
          <a href="/traces">Traces</a>
          <a href="/usage">Usage</a>
        </nav>
      </aside>
      <section>
        <div className="eyebrow">TENANT METERING</div>
        <h1>Usage</h1>
        {error ? (
          <p className="error">{error}</p>
        ) : (
          <div className="metrics">
            <article>
              <small>Total queries</small>
              <strong>{usage?.queries ?? "—"}</strong>
            </article>
            <article>
              <small>Tokens used</small>
              <strong>{usage?.tokens?.toLocaleString() ?? "—"}</strong>
            </article>
            <article>
              <small>Estimated cost</small>
              <strong>${Number(usage?.cost ?? 0).toFixed(4)}</strong>
            </article>
          </div>
        )}
        <div className="empty">
          <h2>Cost-aware retrieval</h2>
          <p>
            Usage is isolated per tenant and can trigger the optional billing
            webhook when the configured threshold is reached.
          </p>
        </div>
      </section>
    </main>
  );
}
