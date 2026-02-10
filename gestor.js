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
const tabelaGestorActividades = document.getElementById("tabelaGestorActividades");
const resumo = document.getElementById("gestorResumo");
const totalPlanificadas = document.getElementById("totalPlanificadas");
const totalExecutadas = document.getElementById("totalExecutadas");
const totalCanceladas = document.getElementById("totalCanceladas");
const relatorioSaida = document.getElementById("relatorioSaida");

const botoesRelatorio = {
  geral: document.getElementById("btnRelatorioGeral"),
  planificada: document.getElementById("btnRelatorioPlanificadas"),
  executada: document.getElementById("btnRelatorioExecutadas"),
  cancelada: document.getElementById("btnRelatorioCanceladas")
};

function carregarFaculdades() {
  const faculdades = Object.keys(dadosFaculdades);
  faculdades.forEach((sigla) => {
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

function actualizarPainel(sigla) {
  if (!sigla || !dadosFaculdades[sigla]) {
    tabelaGestorActividades.innerHTML = '<tr><td colspan="5" class="empty-cell">Seleccione uma faculdade para iniciar a monitoria.</td></tr>';
    resumo.textContent = "Sem faculdade seleccionada.";
    totalPlanificadas.textContent = "0";
    totalExecutadas.textContent = "0";
    totalCanceladas.textContent = "0";
    return;
  }

  const actividades = dadosFaculdades[sigla];
  const planificadas = actividades.filter((item) => item.estado === "Planificada").length;
  const executadas = actividades.filter((item) => item.estado === "Executada").length;
  const canceladas = actividades.filter((item) => item.estado === "Cancelada").length;

  totalPlanificadas.textContent = String(planificadas);
  totalExecutadas.textContent = String(executadas);
  totalCanceladas.textContent = String(canceladas);
  resumo.textContent = `${sigla}: ${actividades.length} actividade(s) registada(s).`;

  tabelaGestorActividades.innerHTML = actividades
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

function gerarRelatorio(sigla, estado) {
  if (!sigla || !dadosFaculdades[sigla]) {
    relatorioSaida.textContent = "Escolha uma faculdade antes de gerar relatório.";
    return;
  }

  const actividades = dadosFaculdades[sigla];
  const lista = estado ? actividades.filter((item) => item.estado === estado) : actividades;

  const cabecalho = [
    `RELATÓRIO SIGAC - ${sigla}`,
    `Data: ${new Date().toLocaleDateString("pt-PT")}`,
    `Filtro: ${estado || "Geral"}`,
    ""
  ];

  const linhas = lista.length
    ? lista.map((item, index) => `${index + 1}. ${item.actividade} | ${item.estado} | ${item.periodo} | ${item.responsavel}`)
    : ["Sem actividades para o filtro seleccionado."];

  relatorioSaida.textContent = [...cabecalho, ...linhas].join("\n");
}

faculdadeSelect.addEventListener("change", (event) => {
  actualizarPainel(event.target.value);
  relatorioSaida.textContent = "Clique num botão para gerar o relatório da faculdade seleccionada.";
});

botoesRelatorio.geral.addEventListener("click", () => gerarRelatorio(faculdadeSelect.value));
botoesRelatorio.planificada.addEventListener("click", () => gerarRelatorio(faculdadeSelect.value, "Planificada"));
botoesRelatorio.executada.addEventListener("click", () => gerarRelatorio(faculdadeSelect.value, "Executada"));
botoesRelatorio.cancelada.addEventListener("click", () => gerarRelatorio(faculdadeSelect.value, "Cancelada"));

carregarFaculdades();
actualizarPainel("");
