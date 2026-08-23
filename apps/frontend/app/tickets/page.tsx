"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
type Ticket = {
  id: string;
  summary: string;
  priority: string;
  status: string;
  createdAt: string;
};
export default function Tickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  useEffect(() => {
    apiFetch("/tools/tickets")
      .then((r) => r.json())
      .then(setTickets);
  }, []);
  return (
    <main className="dashboard">
      <aside>
        <div className="brand">
          AEGIS <span>RAG</span>
        </div>
        <nav>
          <a href="/dashboard">Overview</a>
          <a href="/chat">Chat</a>
          <a href="/tickets">Tickets</a>
          <a href="/traces">Traces</a>
        </nav>
      </aside>
      <section>
        <div className="eyebrow">TOOL ACTIONS</div>
        <h1>Tickets</h1>
        <div className="empty">
          {tickets.length ? (
            tickets.map((t) => (
              <article className="trace-stage" key={t.id}>
                <strong>{t.summary}</strong>
                <span>
                  {t.priority} priority · {t.status}
                </span>
                <small>{new Date(t.createdAt).toLocaleString()}</small>
              </article>
            ))
          ) : (
            <p>No tickets yet. Ask chat to “file a bug for…” to create one.</p>
          )}
        </div>
      </section>
    </main>
  );
}
