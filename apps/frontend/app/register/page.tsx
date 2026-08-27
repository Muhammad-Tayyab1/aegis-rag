"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [invitationToken, setInvitationToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setInvitationToken(
      new URLSearchParams(window.location.search).get("token") ?? "",
    );
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/auth/register`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            invitationToken: invitationToken.trim(),
            email: email.trim().toLowerCase(),
            password,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(", ")
            : (data.message ?? "Unable to create account"),
        );
      localStorage.setItem("aegis.accessToken", data.accessToken);
      localStorage.setItem("aegis.csrfToken", data.csrfToken);
      localStorage.removeItem("aegis.refreshToken");
      router.push("/dashboard");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to create account",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth">
      <form onSubmit={submit} className="card">
        <div className="eyebrow">AEGIS RAG</div>
        <h1>Join a workspace</h1>
        <p>Accept an invitation from your workspace administrator.</p>
        <label>
          Invitation token
          <input
            value={invitationToken}
            onChange={(event) => setInvitationToken(event.target.value)}
            placeholder="Paste your invitation token"
            autoComplete="off"
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={12}
            autoComplete="new-password"
            required
          />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            minLength={12}
            autoComplete="new-password"
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="button" disabled={loading}>
          {loading ? "Creating account…" : "Create account →"}
        </button>
        <p>
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
