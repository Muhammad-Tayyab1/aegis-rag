"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

type Member = {
  id: string;
  email: string;
  role: "admin" | "member";
  status: "active" | "suspended" | "removed";
  createdAt: string;
};
type Invitation = {
  id: string;
  email: string;
  role: "admin" | "member";
  expiresAt: string;
};

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [message, setMessage] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  async function load() {
    const response = await apiFetch("/members");
    if (!response.ok) {
      setMessage("Administrator access is required.");
      return;
    }
    const data = await response.json();
    setMembers(data.members);
    setInvitations(data.invitations);
  }
  useEffect(() => {
    load();
  }, []);

  async function createInvitation(event: FormEvent) {
    event.preventDefault();
    const response = await apiFetch("/members/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    if (!response.ok) {
      const body = await response.json();
      setMessage(body.message ?? "Could not create invitation");
      return;
    }
    const invitation = await response.json();
    showToken(invitation.token);
    setEmail("");
    await load();
  }

  function showToken(token: string) {
    const link = `${location.origin}/register?token=${encodeURIComponent(token)}`;
    setInviteLink(link);
    navigator.clipboard?.writeText(link).catch(() => undefined);
    setMessage(
      "Invitation link created and copied when clipboard access is available.",
    );
  }

  async function resend(id: string) {
    const response = await apiFetch(`/members/invitations/${id}/resend`, {
      method: "POST",
    });
    if (response.ok) showToken((await response.json()).token);
    else setMessage("Could not resend invitation.");
    await load();
  }

  async function revoke(id: string) {
    await apiFetch(`/members/invitations/${id}`, { method: "DELETE" });
    setInviteLink("");
    await load();
  }

  async function update(
    id: string,
    data: Partial<Pick<Member, "role" | "status">>,
  ) {
    const response = await apiFetch(`/members/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const body = await response.json();
      setMessage(body.message ?? "Could not update member");
    }
    await load();
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this member and revoke their sessions?"))
      return;
    const response = await apiFetch(`/members/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json();
      setMessage(body.message ?? "Could not remove member");
    }
    await load();
  }

  return (
    <main className="dashboard">
      <aside>
        <div className="brand">
          AEGIS <span>RAG</span>
        </div>
        <nav>
          <Link href="/dashboard">Overview</Link>
          <Link href="/members">Members</Link>
          <Link href="/audit">Audit log</Link>
        </nav>
      </aside>
      <section>
        <div className="eyebrow">ACCESS CONTROL</div>
        <h1>Members</h1>
        <form className="member-invite" onSubmit={createInvitation}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="colleague@example.com"
            required
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as any)}
          >
            <option value="member">Member</option>
            <option value="admin">Administrator</option>
          </select>
          <button className="button">Create invitation</button>
        </form>
        {message && <p>{message}</p>}
        {inviteLink && (
          <div className="invite-link">
            <strong>Invitation link</strong>
            <input
              readOnly
              value={inviteLink}
              onFocus={(event) => event.target.select()}
            />
          </div>
        )}
        <h2>Workspace members</h2>
        <div className="member-list">
          {members.map((member) => (
            <article className="member-row" key={member.id}>
              <div>
                <strong>{member.email}</strong>
                <small>
                  Joined {new Date(member.createdAt).toLocaleDateString()}
                </small>
              </div>
              <select
                value={member.role}
                disabled={member.status === "removed"}
                onChange={(event) =>
                  update(member.id, {
                    role: event.target.value as Member["role"],
                  })
                }
              >
                <option value="member">Member</option>
                <option value="admin">Administrator</option>
              </select>
              <select
                value={member.status}
                onChange={(event) =>
                  update(member.id, {
                    status: event.target.value as Member["status"],
                  })
                }
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                {member.status === "removed" && (
                  <option value="removed">Removed</option>
                )}
              </select>
              {member.status !== "removed" && (
                <button onClick={() => remove(member.id)}>Remove</button>
              )}
            </article>
          ))}
        </div>
        <h2>Pending invitations</h2>
        <div className="member-list">
          {invitations.map((invitation) => (
            <article className="member-row" key={invitation.id}>
              <div>
                <strong>{invitation.email}</strong>
                <small>
                  Expires {new Date(invitation.expiresAt).toLocaleString()}
                </small>
              </div>
              <span>{invitation.role}</span>
              <button onClick={() => resend(invitation.id)}>Resend</button>
              <button onClick={() => revoke(invitation.id)}>Revoke</button>
            </article>
          ))}
          {!invitations.length && <p>No pending invitations.</p>}
        </div>
      </section>
    </main>
  );
}
