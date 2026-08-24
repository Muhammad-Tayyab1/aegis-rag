"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "../../../../../lib/api";

type Chunk = {
  id: string;
  documentId: string;
  filename: string;
  ordinal: number;
  content: string;
};

export default function SourceChunk() {
  const params = useParams<{ documentId: string; chunkId: string }>();
  const [chunk, setChunk] = useState<Chunk>();
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/documents/${params.documentId}/chunks/${params.chunkId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load this source chunk");
        setChunk(await response.json());
      })
      .catch((reason) => setError(reason.message));
  }, [params.documentId, params.chunkId]);

  return (
    <main className="dashboard">
      <aside>
        <div className="brand">
          AEGIS <span>RAG</span>
        </div>
        <nav>
          <a href="/documents">← Documents</a>
          <a href="/chat">Chat</a>
          <a href="/traces">Traces</a>
        </nav>
      </aside>
      <section>
        <div className="eyebrow">EXACT CITED SOURCE</div>
        <h1>{chunk?.filename ?? "Source chunk"}</h1>
        {error ? (
          <div className="empty">
            <p>{error}</p>
          </div>
        ) : null}
        {chunk ? (
          <article className="empty">
            <small>
              Chunk {chunk.ordinal + 1} · {chunk.id}
            </small>
            <p className="source-content">{chunk.content}</p>
          </article>
        ) : !error ? (
          <p>Loading source…</p>
        ) : null}
      </section>
    </main>
  );
}
