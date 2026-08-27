"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

type AuditEvent = {
  id: string;
  actorEmail: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  result: "success" | "failure";
  ipAddress: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [action, setAction] = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [result, setResult] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(reset = true) {
    setLoading(true);
    setError("");
    const current = reset ? [] : events;
    const params = new URLSearchParams({ limit: "50" });
    if (action) params.set("action", action);
    if (actorEmail) params.set("actorEmail", actorEmail);
    if (resourceType) params.set("resourceType", resourceType);
    if (result) params.set("result", result);
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(`${to}T23:59:59.999`).toISOString());
    if (!reset && events.length) params.set("cursor", events.at(-1)!.id);
    try {
      const response = await apiFetch(`/audit-events?${params}`);
      if (!response.ok)
        throw new Error(
          response.status === 403
            ? "Administrator access is required."
            : "Could not load audit events.",
        );
      const next = (await response.json()) as AuditEvent[];
      setEvents([...current, ...next]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load audit events.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function filter(event: FormEvent) {
    event.preventDefault();
    load();
  }

  return (
    <main className="dashboard">
      <aside>
        <div className="brand">
          AEGIS <span>RAG</span>
        </div>
        <nav>
          <Link href="/dashboard">Overview</Link>
          <Link href="/documents">Documents</Link>
          <Link href="/connectors">Connectors</Link>
          <Link href="/traces">Traces</Link>
          <Link href="/audit">Audit log</Link>
        </nav>
      </aside>
      <section>
        <div className="eyebrow">ADMINISTRATION</div>
        <h1>Audit log</h1>
        <form className="audit-filters" onSubmit={filter}>
          <input
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder="Action"
          />
          <input
            value={actorEmail}
            onChange={(event) => setActorEmail(event.target.value)}
            placeholder="Actor email"
          />
          <input
            value={resourceType}
            onChange={(event) => setResourceType(event.target.value)}
            placeholder="Resource type"
          />
          <select
            value={result}
            onChange={(event) => setResult(event.target.value)}
          >
            <option value="">All results</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
          <input
            type="date"
            aria-label="From date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
          <input
            type="date"
            aria-label="To date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
          <button className="button" disabled={loading}>
            Filter
          </button>
        </form>
        {error && <p className="error">{error}</p>}
        <div className="audit-list">
          {events.map((event) => (
            <article key={event.id} className="audit-row">
              <div>
                <strong>{event.action}</strong>{" "}
                <span className={`status status-${event.result}`}>
                  {event.result}
                </span>
                <small>
                  {event.actorEmail ?? "System"} ·{" "}
                  {new Date(event.createdAt).toLocaleString()}
                </small>
              </div>
              <div className="audit-resource">
                {event.resourceType ?? "—"}
                {event.resourceId ? ` · ${event.resourceId}` : ""}
                {event.ipAddress && <small>{event.ipAddress}</small>}
              </div>
            </article>
          ))}
          {!loading && !error && events.length === 0 && (
            <p>No audit events found.</p>
          )}
        </div>
        {events.length > 0 && events.length % 50 === 0 && (
          <button onClick={() => load(false)} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </button>
        )}
      </section>
    </main>
  );
}
