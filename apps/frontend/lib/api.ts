const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export async function apiFetch(path: string, init: RequestInit = {}) {
  const accessToken = localStorage.getItem("aegis.accessToken") ?? "";
  const request = () =>
    fetch(`${api}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${localStorage.getItem("aegis.accessToken") ?? accessToken}`,
      },
    });
  let response = await request();
  if (response.status !== 401) return response;
  const refreshToken = localStorage.getItem("aegis.refreshToken");
  if (!refreshToken) return response;
  const refreshed = await fetch(`${api}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!refreshed.ok) {
    localStorage.removeItem("aegis.accessToken");
    localStorage.removeItem("aegis.refreshToken");
    return response;
  }
  const tokens = await refreshed.json();
  localStorage.setItem("aegis.accessToken", tokens.accessToken);
  localStorage.setItem("aegis.refreshToken", tokens.refreshToken);
  response = await request();
  return response;
}
