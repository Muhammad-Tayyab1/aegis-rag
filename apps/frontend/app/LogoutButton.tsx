"use client";

import { usePathname, useRouter } from "next/navigation";
import { apiFetch, clearSession } from "../lib/api";

export function LogoutButton() {
  const pathname = usePathname();
  const router = useRouter();
  if (["/", "/login", "/register"].includes(pathname)) return null;

  async function logout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      clearSession();
      router.replace("/login");
    }
  }

  return (
    <button className="logout-button" onClick={logout}>
      Sign out
    </button>
  );
}
