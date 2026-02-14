import { auth } from "./firebase-init.js";

function withOrigin(url) {
  const u = new URL(url);
  u.searchParams.set("__origin", window.location.origin);
  return u.toString();
}

export async function getIdTokenOrThrow() {
  if (!auth.currentUser) {
    throw new Error("Sessão inválida");
  }

  return auth.currentUser.getIdToken();
}

export async function fetchComToken(url, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sessão inválida");

  const token = await user.getIdToken();

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "text/plain;charset=utf-8");
  }

  const finalUrl = withOrigin(url);

  return fetch(finalUrl, {
    ...options,
    headers
  });
}
