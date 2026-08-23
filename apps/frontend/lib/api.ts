const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
let refreshInFlight: Promise<boolean> | null = null;

export function clearSession() {
  localStorage.removeItem("aegis.accessToken");
  localStorage.removeItem("aegis.refreshToken");
}

async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = localStorage.getItem("aegis.refreshToken");
    if (!refreshToken) return false;
    const response = await fetch(`${api}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      clearSession();
      return false;
    }
    const tokens = await response.json();
    localStorage.setItem("aegis.accessToken", tokens.accessToken);
    localStorage.setItem("aegis.refreshToken", tokens.refreshToken);
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
      headers: {
        ...init.headers,
        Authorization: `Bearer ${accessToken}`,
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
