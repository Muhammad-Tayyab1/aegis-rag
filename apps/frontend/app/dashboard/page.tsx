"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
type Tenant = {
  name: string;
  slug: string;
  plan: string;
  chunkSize: number;
  retrievalStrategy: string;
  rerankEnabled: boolean;
};
export default function DashboardPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const token = localStorage.getItem("aegis.accessToken");
    if (!token) {
      location.assign("/login");
      return;
    }
    apiFetch("/tenants/me")
      .then(async (r) => {
        if (!r.ok) throw new Error("Your session has expired.");
        return r.json();
      })
      .then(setTenant)
      .catch((e: Error) => setError(e.message));
  }, []);
  return (
    <main className="dashboard">
      <aside>
        <div className="brand">
          AEGIS <span>RAG</span>
        </div>
        <nav>
          <Link href="/dashboard">Overview</Link>
          <span>
            Documents <em>soon</em>
          </span>
          <span>
            Chat <em>soon</em>
          </span>
          <span>
            Traces <em>soon</em>
          </span>
        </nav>
      </aside>
      <section>
        <div className="eyebrow">TENANT WORKSPACE</div>
        <h1>{tenant?.name ?? "Loading workspace…"}</h1>
        {error ? (
          <p className="error">
            {error} <Link href="/login">Sign in again.</Link>
          </p>
        ) : (
          tenant && (
            <div className="metrics">
              <article>
                <small>Plan</small>
                <strong>{tenant.plan}</strong>
              </article>
              <article>
                <small>Retrieval</small>
                <strong>{tenant.retrievalStrategy}</strong>
              </article>
              <article>
                <small>Reranking</small>
                <strong>{tenant.rerankEnabled ? "Enabled" : "Disabled"}</strong>
              </article>
              <article>
                <small>Chunk size</small>
                <strong>{tenant.chunkSize} tokens</strong>
              </article>
            </div>
          )
        )}
        <div className="empty">
          <h2>Knowledge base ready for ingestion</h2>
          <p>
            Connect a source or upload a document to begin building your
            retrieval index.
          </p>
          <button className="button" disabled>
            Connect source — coming next
          </button>
        </div>
      </section>
    </main>
  );
}
