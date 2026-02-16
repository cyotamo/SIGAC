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

export function carregarJSONP(url) {
  return new Promise((resolve, reject) => {
    const callbackName = "cb_" + Date.now();

    window[callbackName] = (data) => {
      resolve(data);
      delete window[callbackName];
      script.remove();
    };

    const script = document.createElement("script");
    script.src = url + "&callback=" + callbackName;
    script.onerror = reject;

    document.body.appendChild(script);
  });
}

export async function postJSON(url, payload = {}) {
  const form = new URLSearchParams();
  Object.entries(payload || {}).forEach(([k, v]) => form.append(k, String(v ?? "")));

  const response = await fetch(url, {
    method: "POST",
    body: form,
  });

  const data = await response.json();
  return data;
}
