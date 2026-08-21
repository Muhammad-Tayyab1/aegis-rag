"use client";
import { useEffect, useState } from "react";
export default function Usage() {
  const [u, setU] = useState<any>();
  useEffect(() => {
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/usage`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("aegis.accessToken") ?? ""}`,
        },
      },
    )
      .then((r) => r.json())
      .then(setU);
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
          <a href="/usage">Usage</a>
        </nav>
      </aside>
      <section>
        <div className="eyebrow">TENANT METERING</div>
        <h1>Usage</h1>
        <div className="metrics">
          <article>
            <small>Queries</small>
            <strong>{u?.queries ?? "—"}</strong>
          </article>
          <article>
            <small>Tokens</small>
            <strong>{u?.tokens ?? "—"}</strong>
          </article>
          <article>
            <small>Estimated cost</small>
            <strong>${Number(u?.cost ?? 0).toFixed(4)}</strong>
          </article>
        </div>
        <div className="empty">
          <h2>Metering is active</h2>
          <p>
            Usage is scoped to this tenant and can optionally notify a billing
            webhook when the configured threshold is reached.
          </p>
        </div>
      </section>
    </main>
  );
}
