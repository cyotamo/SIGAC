import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase-init.js";
import { emailAutorizado, faculdadePorEmail, normalizarEmail } from "./autorizacao.js";

const ANO_LECTIVO = "2026";

function obterDestinoPosLogin(email) {
  const emailNormalizado = normalizarEmail(email);
  if (emailNormalizado === "dc@unirovuma.ac.mz") {
    return {
      pagina: "gestor.html",
      contexto: {
        faculdade: "DC",
        anoLectivo: ANO_LECTIVO,
        utilizador: "dc@unirovuma.ac.mz",
        seccao: "DC"
      }
    };
  }

  const faculdade = faculdadePorEmail(emailNormalizado) || "N/D";

  return {
    pagina: "faculdades.html",
    contexto: {
      faculdade,
      anoLectivo: ANO_LECTIVO,
      utilizador: emailNormalizado,
      seccao: faculdade
    }
  };
}

function guardarContextoLogin(contexto = {}) {
  Object.entries(contexto).forEach(([chave, valor]) => {
    localStorage.setItem(chave, String(valor ?? ""));
  });
}

function redirecionarPosLogin(email) {
  const { pagina, contexto } = obterDestinoPosLogin(email);
  guardarContextoLogin(contexto);
  window.location.href = pagina;
}

window.addEventListener("load", () => {
  const emailInput = document.getElementById("email");
  if (emailInput) emailInput.focus();

  const ano = document.getElementById("ano");
  if (ano) ano.textContent = new Date().getFullYear();
});

function mostrarErro(mensagem) {
  let erro = document.getElementById("mensagem-erro");

  if (!erro) {
    erro = document.createElement("p");
    erro.id = "mensagem-erro";
    erro.style.color = "#b42318";
    erro.style.marginTop = "0.75rem";
    erro.style.fontSize = "0.95rem";
    erro.setAttribute("role", "alert");

    const form = document.querySelector(".form");
    form?.appendChild(erro);
  }

  erro.textContent = mensagem;
}

const form = document.querySelector(".form");

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  if (emailAutorizado(user.email)) {
    redirecionarPosLogin(user.email);
    return;
  }

  await signOut(auth);
  mostrarErro("Utilizador autenticado, mas sem permissão para aceder a esta área.");
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email")?.value.trim();
  const senha = document.getElementById("senha")?.value;

  if (!email || !senha) {
    mostrarErro("Preencha o e-mail e a palavra-passe.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, senha);

    const user = auth.currentUser;
    if (emailAutorizado(user?.email)) {
      redirecionarPosLogin(user.email);
      return;
    }

    await signOut(auth);
    mostrarErro("Utilizador autenticado, mas sem permissão para aceder a esta área.");
  } catch (erro) {
    mostrarErro("Falha no login. Verifique os dados e tente novamente.");
    console.error("Erro no login:", erro);
  }
});
