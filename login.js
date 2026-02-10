// Cursor a piscar: foco automático no E-mail + ano no rodapé
window.addEventListener("load", () => {
  const email = document.getElementById("email");
  if (email) email.focus();

  const ano = document.getElementById("ano");
  if (ano) ano.textContent = new Date().getFullYear();
});

// Demo: impedir submit real (remove isto quando ligares ao backend)
document.addEventListener("submit", (e) => {
  e.preventDefault();
  alert("Login (demo). Liga aqui ao teu sistema de autenticação.");
});
