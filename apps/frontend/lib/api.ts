const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
let refreshInFlight: Promise<boolean> | null = null;

export function clearSession() {
  localStorage.removeItem("aegis.accessToken");
  // Remove tokens created by releases before refresh credentials moved to cookies.
  localStorage.removeItem("aegis.refreshToken");
  localStorage.removeItem("aegis.csrfToken");
}

function csrfToken() {
  const stored = localStorage.getItem("aegis.csrfToken");
  if (stored) return stored;
  const prefix = "aegis.csrf=";
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : "";
}

async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const response = await fetch(`${api}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "x-csrf-token": csrfToken() },
    });
    if (!response.ok) {
      clearSession();
      return false;
    }
    const tokens = await response.json();
    localStorage.setItem("aegis.accessToken", tokens.accessToken);
    localStorage.setItem("aegis.csrfToken", tokens.csrfToken);
    return true;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const request = (accessToken: string) =>
    fetch(`${api}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...init.headers,
        Authorization: `Bearer ${accessToken}`,
        ...(["POST", "PATCH", "DELETE"].includes(
          (init.method ?? "GET").toUpperCase(),
        )
          ? { "x-csrf-token": csrfToken() }
          : {}),
      },
    });
  let accessToken = localStorage.getItem("aegis.accessToken") ?? "";
  let response = await request(accessToken);
  if (response.status !== 401) return response;
  const rotatedAccessToken = localStorage.getItem("aegis.accessToken") ?? "";
  if (rotatedAccessToken && rotatedAccessToken !== accessToken)
    return request(rotatedAccessToken);
  if (!(await refreshAccessToken())) return response;
  accessToken = localStorage.getItem("aegis.accessToken") ?? "";
  response = await request(accessToken);
  return response;
}
