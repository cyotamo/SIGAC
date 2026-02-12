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
const resumo = document.getElementById("gestorResumo");
const totalRelatoriosEnviados = document.getElementById("totalRelatoriosEnviados");
const relatorioSaida = document.getElementById("relatorioSaida");
const botoesEstado = Array.from(document.querySelectorAll(".gestor-tab"));

const botoesRelatorio = {
  geral: document.getElementById("btnRelatorioGeral"),
  planificada: document.getElementById("btnRelatorioPlanificadas"),
  executada: document.getElementById("btnRelatorioExecutadas"),
  cancelada: document.getElementById("btnRelatorioCanceladas"),
  estatisticas: document.getElementById("btnDadosEstatisticos")
};

let faculdadeActual = "";
let estadoActual = "Planificada";
let contadorRelatorios = 0;

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
    resumo.textContent = "Sem faculdade seleccionada.";
    return;
  }

  const actividades = dadosFaculdades[faculdadeActual];
  const filtradas = actividades.filter((item) => item.estado === estadoActual);

  resumo.textContent = `${faculdadeActual}: ${filtradas.length} actividade(s) ${estadoActual.toLowerCase()}(s).`;

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

function registarRelatorioGerado() {
  contadorRelatorios += 1;
  totalRelatoriosEnviados.textContent = String(contadorRelatorios);
}

function gerarRelatorio(estado) {
  if (!faculdadeActual || !dadosFaculdades[faculdadeActual]) {
    relatorioSaida.textContent = "Escolha uma faculdade e clique em buscar antes de gerar relatório.";
    return;
  }

  const actividades = dadosFaculdades[faculdadeActual];
  const lista = estado ? actividades.filter((item) => item.estado === estado) : actividades;

  const cabecalho = [
    `RELATÓRIO SIGAC - ${faculdadeActual}`,
    `Data: ${new Date().toLocaleDateString("pt-PT")}`,
    `Filtro: ${estado || "Geral"}`,
    ""
  ];

  const linhas = lista.length
    ? lista.map((item, index) => `${index + 1}. ${item.actividade} | ${item.estado} | ${item.periodo} | ${item.responsavel}`)
    : ["Sem actividades para o filtro seleccionado."];

  relatorioSaida.textContent = [...cabecalho, ...linhas].join("\n");
  registarRelatorioGerado();
}

btnBuscarFaculdade.addEventListener("click", () => {
  faculdadeActual = faculdadeSelect.value;
  actualizarPainel();
  relatorioSaida.textContent = "Faculdade carregada. Agora já pode gerar relatórios e dados estatísticos.";
});

botoesEstado.forEach((botao) => {
  botao.addEventListener("click", () => {
    estadoActual = botao.dataset.estado;
    actualizarTabs(estadoActual);
    actualizarPainel();
  });
});

botoesRelatorio.geral.addEventListener("click", () => gerarRelatorio());
botoesRelatorio.planificada.addEventListener("click", () => gerarRelatorio("Planificada"));
botoesRelatorio.executada.addEventListener("click", () => gerarRelatorio("Executada"));
botoesRelatorio.cancelada.addEventListener("click", () => gerarRelatorio("Cancelada"));
botoesRelatorio.estatisticas.addEventListener("click", () => {
  if (!faculdadeActual || !dadosFaculdades[faculdadeActual]) {
    relatorioSaida.textContent = "Escolha uma faculdade e clique em buscar para gerar dados estatísticos.";
    return;
  }

  relatorioSaida.textContent = "Botão de geração de dados estatísticos preparado. A lógica será adicionada na próxima etapa.";
});

carregarFaculdades();
actualizarTabs(estadoActual);
actualizarPainel();
