// login.js
// - Coloca o cursor (I) a piscar ao focar automaticamente o primeiro campo
// - Actualiza o texto de sessão conforme selecções

(function () {
  function $(sel) { return document.querySelector(sel); }

  const form = $(".login-form");
  const perfil = $("#perfil");
  const faculdade = $("#faculdade");
  const ano = $("#ano");
  const sessaoTxt = $("#sessaoTxt");

  // Foco automático (cursor a piscar)
  window.addEventListener("load", () => {
    // Escolhe o primeiro campo útil para o utilizador:
    // Se quiseres que seja o "Ano lectivo", troca para: ano?.focus();
    perfil?.focus();
  });

  function actualizarSessao() {
    const perfilTxt = perfil?.options[perfil.selectedIndex]?.text || "";
    const facTxt = faculdade?.options[faculdade.selectedIndex]?.text || "";
    const anoTxt = (ano?.value || "").trim() || "—";
    sessaoTxt.textContent = `Sessão: ${perfilTxt} (${facTxt}) — ${anoTxt}`;
  }

  perfil?.addEventListener("change", actualizarSessao);
  faculdade?.addEventListener("change", actualizarSessao);
  ano?.addEventListener("input", actualizarSessao);

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    // Aqui vais ligar à tua autenticação real.
    // Por agora, apenas demonstração:
    actualizarSessao();
    alert("Login de demonstração: sessão actualizada.");
  });

  // Botões do header (demo)
  $("#btnExportar")?.addEventListener("click", () => alert("Exportar (demo)"));
  $("#btnRepor")?.addEventListener("click", () => alert("Repor demo (demo)"));

  actualizarSessao();
})();
