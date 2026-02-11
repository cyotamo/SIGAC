// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC-z5eNHi-rosi0Ak64bPeQZU-6oJA9DDk",
  authDomain: "sigacur00.firebaseapp.com",
  projectId: "sigacur00",
  storageBucket: "sigacur00.firebasestorage.app",
  messagingSenderId: "224944945440",
  appId: "1:224944945440:web:743589f8f137d25d44ff45"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const EMAIL_AUTORIZADO = "facee@unirovuma.ac.mz";

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

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email")?.value.trim();
  const senha = document.getElementById("senha")?.value;

  if (!email || !senha) {
    mostrarErro("Preencha o e-mail e a palavra-passe.");
    return;
  }

  try {
    const credenciais = await signInWithEmailAndPassword(auth, email, senha);

    if (credenciais.user.email?.toLowerCase() === EMAIL_AUTORIZADO) {
      window.location.href = "faculdades.html";
      return;
    }

    await signOut(auth);
    mostrarErro("Utilizador autenticado, mas sem permissão para aceder a esta área.");
  } catch (erro) {
    mostrarErro("Falha no login. Verifique os dados e tente novamente.");
    console.error("Erro no login:", erro);
  }
});
