import { auth } from "./firebase-init.js";

function withOrigin(url) {
  const u = new URL(url);
  u.searchParams.set("__origin", window.location.origin);
  return u;
}

export async function getIdTokenOrThrow() {
  if (!auth.currentUser) {
    throw new Error("Sessão inválida");
  }

  return auth.currentUser.getIdToken();
}

export async function fetchComToken(url, options = {}) {
  // Teste rápido de CORS/preflight: GET sem headers, sem credentials e sem Authorization.
  return fetch(url, { method: "GET", mode: "cors" });
}
