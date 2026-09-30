/**
 * URL of the lobby: everything that selects a match or a local game is dropped,
 * only the backend override survives. Reloading the current URL would rejoin
 * the finished match instead.
 */
export function lobbyUrl(search: string): string {
  const backend = new URLSearchParams(search).get("backend");
  return backend ? `/?backend=${encodeURIComponent(backend)}` : "/";
}
