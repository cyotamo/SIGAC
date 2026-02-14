import { auth } from "./firebase-init.js";

export async function getIdTokenOrThrow() {
  if (!auth.currentUser) {
    throw new Error("Sessão inválida");
  }

  return auth.currentUser.getIdToken();
}

export async function fetchComToken(url, options = {}) {
  const token = await getIdTokenOrThrow();
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "text/plain;charset=utf-8");

  return fetch(url, {
    ...options,
    headers
  });
}
