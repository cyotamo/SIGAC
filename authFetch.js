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
  const user = auth.currentUser;
  if (!user) throw new Error("Sessão inválida");

  const token = await user.getIdToken();
  const method = (options.method || "GET").toUpperCase();
  const finalUrl = withOrigin(url);

  if (method === "POST") {
    let originalBody = {};

    if (options.body) {
      try {
        originalBody = JSON.parse(options.body);
      } catch {
        originalBody = {};
      }
    }

    const bodyComToken = { ...originalBody, __idToken: token };

    return fetch(finalUrl.toString(), {
      ...options,
      method,
      headers: {
        ...(options.headers || {}),
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(bodyComToken)
    });
  }

  finalUrl.searchParams.set("__idToken", token);

  return fetch(finalUrl.toString(), {
    ...options,
    method,
    headers: {
      ...(options.headers || {})
    }
  });
}
