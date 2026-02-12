const dadosFaculdades = {
  FACEE: [
    { actividade: "Seminário de Metodologia Científica", estado: "Planificada", periodo: "10/02/2026 - 12/02/2026", responsavel: "Prof. Mário Alberto" },
    { actividade: "Feira de Inovação Académica", estado: "Executada", periodo: "18/03/2026 - 20/03/2026", responsavel: "Dra. Irene Mucavele" },
    { actividade: "Conferência sobre Sustentabilidade", estado: "Cancelada", periodo: "05/04/2026 - 05/04/2026", responsavel: "Prof. Amélia Nhampossa" }
  ],
  FCS: [
    { actividade: "Jornadas de Investigação em Saúde", estado: "Executada", periodo: "08/01/2026 - 10/01/2026", responsavel: "Dr. Luís Cossa" },
    { actividade: "Workshop de Bioética", estado: "Planificada", periodo: "22/05/2026 - 23/05/2026", responsavel: "Dra. Ana Cândida" }
  ],
  FENG: [
    { actividade: "Hackathon de Engenharia", estado: "Planificada", periodo: "11/06/2026 - 13/06/2026", responsavel: "Eng. Carlos Miguel" },
    { actividade: "Visita Técnica Industrial", estado: "Cancelada", periodo: "19/07/2026 - 19/07/2026", responsavel: "Eng. Rosa Manjate" },
    { actividade: "Mostra de Protótipos", estado: "Executada", periodo: "21/08/2026 - 22/08/2026", responsavel: "Eng. Joana Matola" }
  ]
};

const faculdadeSelect = document.getElementById("faculdadeSelect");
const btnBuscarFaculdade = document.getElementById("btnBuscarFaculdade");
const tabelaGestorActividades = document.getElementById("tabelaGestorActividades");
const botoesEstado = Array.from(document.querySelectorAll(".gestor-tab"));

let faculdadeActual = "";
let estadoActual = "Planificada";

function carregarFaculdades() {
  Object.keys(dadosFaculdades).forEach((sigla) => {
    const option = document.createElement("option");
    option.value = sigla;
    option.textContent = sigla;
    faculdadeSelect.appendChild(option);
  });
}

function classEstado(estado) {
  if (estado === "Executada") return "chip ok";
  if (estado === "Cancelada") return "chip bad";
  return "chip";
}

function actualizarTabs(estado) {
  botoesEstado.forEach((botao) => {
    const activo = botao.dataset.estado === estado;
    botao.classList.toggle("active", activo);
    botao.setAttribute("aria-selected", String(activo));
  });
}

function actualizarPainel() {
  if (!faculdadeActual || !dadosFaculdades[faculdadeActual]) {
    tabelaGestorActividades.innerHTML = '<tr><td colspan="5" class="empty-cell">Seleccione uma faculdade para iniciar a monitoria.</td></tr>';
    return;
  }

  const actividades = dadosFaculdades[faculdadeActual];
  const filtradas = actividades.filter((item) => item.estado === estadoActual);

  if (!filtradas.length) {
    tabelaGestorActividades.innerHTML = '<tr><td colspan="5" class="empty-cell">Sem actividades para o filtro seleccionado.</td></tr>';
    return;
  }

  tabelaGestorActividades.innerHTML = filtradas
    .map(
      (item, index) => `
      <tr>
        <td><strong>${index + 1}</strong></td>
        <td>${item.actividade}</td>
        <td><span class="${classEstado(item.estado)}">${item.estado}</span></td>
        <td>${item.periodo}</td>
        <td>${item.responsavel}</td>
      </tr>
    `
    )
    .join("");
}

btnBuscarFaculdade.addEventListener("click", () => {
  faculdadeActual = faculdadeSelect.value;
  actualizarPainel();
});

botoesEstado.forEach((botao) => {
  botao.addEventListener("click", () => {
    estadoActual = botao.dataset.estado;
    actualizarTabs(estadoActual);
    actualizarPainel();
  });
});

carregarFaculdades();
actualizarTabs(estadoActual);
actualizarPainel();
