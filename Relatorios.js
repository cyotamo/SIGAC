// @ts-ignore
/*************************************************************
 * API: GERAR RELATÓRIO (PDF / DOC / XLSX)
 * Endpoint (WebApp): GET JSONP (?operacao=gerar_relatorio_faculdade&callback=...)
 *************************************************************/

// ========= CONFIGURAÇÃO (AJUSTA AQUI) =========
const CFG = {
  SPREADSHEET_ID: "1WXygPNhGpU6MfQ2Al5GZojEwcvZQuxDpOnu1D3BcWvM",

  ABA_DADOS: null, // agora será definido dinamicamente fora do CFG

  PASTA_RELATORIOS_ID: "14jtZJ2mjVa2YUkYbXeQzT8JUQSlXY-MR",

  COLS: {
    DATA: 1,
    AREA: 2,
    ACCAO: 3,
    OBJETIVOS: 4,
    LOCALIZACAO: 5,
    INDICADOR: 6,
    META_ANUAL: 7,
    META_T1: 8,
    META_T2: 9,
    META_T3: 10,
    META_T4: 11,
    BENEF_TOTAL: 12,
    HOMENS: 13,
    MULHERES: 14,
    FONTE: 15,
    ORCAMENTO: 16,
    RESPONSAVEL: 17,
    PERIODO_INI: 18,
    PERIODO_FIM: 19,
    OBS: 20,
    ESTADO: 21,
    MOTIVO: 22
  }
};


// ========= FUNÇÃO PRINCIPAL =========
function gerarRelatorio(payload) {
  const formato = normLower(payload.formato || "pdf");
  const opcao = String(payload.opcao || payload.tipoRelatorio || "Todas").trim();
  const porPeriodo = toBoolean_(payload.porPeriodo);
  const dataInicio = porPeriodo ? parseISODate(payload.dataInicio) : null;
  const dataFim = porPeriodo ? parseISODate(payload.dataFim) : null;
  const titulo = String(payload.titulo || "Relatório de Actividades").trim();

  const email = String(payload.email || "").trim().toLowerCase();
  if (!email) throw new Error("Email não foi enviado no payload.");

  const nomeFaculdade = getNomeFaculdadeByEmail_(email);

  if (!["pdf", "doc", "xlsx"].includes(formato)) {
    throw new Error("formato inválido. Use: pdf | doc | xlsx");
  }
  if (porPeriodo && (!dataInicio || !dataFim)) {
    throw new Error("Para porPeriodo=true, envie dataInicio e dataFim (YYYY-MM-DD).");
  }
  if (porPeriodo && dataInicio.getTime() > dataFim.getTime()) {
    throw new Error("dataInicio não pode ser maior que dataFim.");
  }

  // 1) Ler e filtrar dados (AGORA PASSA O EMAIL)
  const registos = obterRegistosFiltrados({ opcao, porPeriodo, dataInicio, dataFim, email });
  if (!registos.length) throw new Error("Nenhum registo encontrado para os critérios seleccionados.");

  // 2) Gerar ficheiro
  const pasta = DriveApp.getFolderById(CFG.PASTA_RELATORIOS_ID);
  const carimbo = Utilities.formatDate(new Date(), "Africa/Maputo", "yyyyMMdd_HHmmss");
  const nomeBase = `${titulo} - ${opcao}${porPeriodo ? ` (${payload.dataInicio} a ${payload.dataFim})` : ""} - ${carimbo}`;

  let out;
  if (!Array.isArray(registos)) throw new Error("DEBUG: registos não é array (ver chamadas/assinaturas).");

  if (formato === "doc") {
    out = gerarRelatorioDOC(
      pasta, nomeBase, titulo, nomeFaculdade,
      opcao, porPeriodo, payload.dataInicio, payload.dataFim, registos
    );
  } else if (formato === "pdf") {
    out = gerarRelatorioPDF(
      pasta, nomeBase, titulo, nomeFaculdade,
      opcao, porPeriodo, payload.dataInicio, payload.dataFim, registos
    );
  } else {
    out = gerarRelatorioXLSX(
      pasta, nomeBase, titulo, nomeFaculdade,
      opcao, porPeriodo, payload.dataInicio, payload.dataFim, registos
    );
  }

  return {
    sucesso: true,
    mensagem: "Relatório gerado com sucesso.",
    formato,
    ficheiro: out
  };
}


function toBoolean_(value) {
  if (typeof value === "boolean") return value;
  const t = String(value || "").trim().toLowerCase();
  return t === "true" || t === "1" || t === "sim";
}

// ========= OBTENÇÃO + FILTRO =========
function obterRegistosFiltrados({ opcao, porPeriodo, dataInicio, dataFim, email }) {
  const ss = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);

  const nomeSheet = getSheetByEmail_(email);
  if (!nomeSheet) throw new Error("Email não autorizado.");

  const sh = ss.getSheetByName(nomeSheet);
  if (!sh) throw new Error(`Aba não encontrada: ${nomeSheet}`);

  const values = sh.getDataRange().getValues();
  if (values.length <= 1) return [];

  const rows = values.slice(1);
  const want = normalizarOpcaoParaEstados(opcao); // array de estados permitidos, ou null para todos

  const res = [];
  for (const r of rows) {
    const dt = toDateSafe(r[CFG.COLS.DATA]);
    const estado = String(r[CFG.COLS.ESTADO] || "").trim();

    if (!dt) continue;

    // filtro estado
    if (want && !want.includes(normEstado(estado))) continue;

    // filtro período (inclusivo)
    if (porPeriodo) {
      if (dt.getTime() < dataInicio.getTime()) continue;
      if (dt.getTime() > fimDoDia(dataFim).getTime()) continue;
    }

    res.push({
      dataRegisto: dt,

      area: String(r[CFG.COLS.AREA] || "").trim(),
      accao: String(r[CFG.COLS.ACCAO] || "").trim(),
      objetivos: String(r[CFG.COLS.OBJETIVOS] || "").trim(),
      localizacao: String(r[CFG.COLS.LOCALIZACAO] || "").trim(),
      indicador: String(r[CFG.COLS.INDICADOR] || "").trim(),

      metaAnual: r[CFG.COLS.META_ANUAL],
      metaT1: r[CFG.COLS.META_T1],
      metaT2: r[CFG.COLS.META_T2],
      metaT3: r[CFG.COLS.META_T3],
      metaT4: r[CFG.COLS.META_T4],

      beneficiariosTotal: r[CFG.COLS.BENEF_TOTAL],
      homens: r[CFG.COLS.HOMENS],
      mulheres: r[CFG.COLS.MULHERES],

      fonteFinanciamento: String(r[CFG.COLS.FONTE] || "").trim(),
      orcamentoMZN: r[CFG.COLS.ORCAMENTO],

      responsavel: String(r[CFG.COLS.RESPONSAVEL] || "").trim(),
      periodoInicio: r[CFG.COLS.PERIODO_INI],
      periodoFim: r[CFG.COLS.PERIODO_FIM],

      observacoes: String(r[CFG.COLS.OBS] || "").trim(),
      estado: String(r[CFG.COLS.ESTADO] || "").trim(),
      motivo: String(r[CFG.COLS.MOTIVO] || "").trim()
    });
  }

  // ordenar por data asc
  res.sort((a, b) => a.dataRegisto.getTime() - b.dataRegisto.getTime());

  return res;
}


function normalizarOpcaoParaEstados(opcao) {
  const op = normLower(opcao);

  if (op.startsWith("todas")) return null;

  if (op.startsWith("execut")) return ["executada"];      // Executada/Executadas
  if (op.startsWith("planif")) return ["planificada"];    // Planificada/Planificadas
  if (op.startsWith("cancel")) return ["cancelada"];      // Cancelada/Canceladas

  throw new Error("opcao inválida. Use: Executadas | Planificadas | Canceladas | Todas");
}


function normEstado(s) {
  const t = normLower(s);
  if (t.startsWith("execut")) return "executada";
  if (t.startsWith("planif")) return "planificada";
  if (t.startsWith("cancel")) return "cancelada";
  return t;
}

// ========= GERAR DOC =========
// ========= GERAR DOC (AJUSTADO: HORIZONTAL + 9 COLUNAS + LARGURAS) =========
function gerarRelatorioDOC(pasta, nomeBase, titulo, nomeFaculdade, opcao, porPeriodo, di, df, registos) {
  const doc = DocumentApp.create(nomeBase);

  // ✅ Página em HORIZONTAL (Landscape) — A4 aprox.
  doc.setPageWidth(842).setPageHeight(595);

  const body = doc.getBody();

  // ✅ Margens menores para caber a tabela
  body.setMarginLeft(24).setMarginRight(24).setMarginTop(24).setMarginBottom(24);

  body.appendParagraph("Universidade Rovuma")
    .setHeading(DocumentApp.ParagraphHeading.HEADING1)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph(nomeFaculdade)
    .setHeading(DocumentApp.ParagraphHeading.HEADING2)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph(titulo)
    .setHeading(DocumentApp.ParagraphHeading.HEADING3)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph(" ");

  const subt = [
    `Opção: ${opcao}`,
    porPeriodo ? `Período: ${di} a ${df}` : "Período: (não aplicado)",
    `Gerado em: ${Utilities.formatDate(new Date(), "Africa/Maputo", "dd/MM/yyyy HH:mm")}`
  ].join(" | ");

  body.appendParagraph(subt).setItalic(true).setFontSize(9);
  body.appendParagraph(" ");

  // ✅ Apenas 9 colunas
  const header = [
    "Acção",
    "Objectivo",
    "Indicador do Produto",
    "Meta Anual",
    "Beneficiário",
    "Orçamento Total (MZN)",
    "Período (Início)",
    "Período (Fim)"
  ];

  // ✅ Larguras (em pontos) — ajusta se quiseres
 const widths = [130, 210, 170, 45, 55, 70, 70, 70];

const grupos = {};

registos.forEach(it => {
  const area = it.area || "Sem Área";
  if (!grupos[area]) grupos[area] = [];
  grupos[area].push(it);
});

  const table = body.appendTable();

  // Cabeçalho
  const hr = table.appendTableRow();
  header.forEach((h, i) => {
    const cell = hr.appendTableCell(h);
    cell.setWidth(widths[i]);
    cell.getChild(0).asParagraph()
      .setBold(true)
      .setFontSize(9)
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  });

  // Linhas
Object.keys(grupos).forEach(area => {

  // Título da Área
  body.appendParagraph(area)
      .setHeading(DocumentApp.ParagraphHeading.HEADING4);

  const table = body.appendTable();

  // Cabeçalho
  const hr = table.appendTableRow();
  header.forEach((h, i) => {
    const cell = hr.appendTableCell(h);
    cell.setWidth(widths[i]);
    cell.getChild(0).asParagraph()
      .setBold(true)
      .setFontSize(9)
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  });

  // Linhas por área
  grupos[area].forEach(it => {
    const row = table.appendTableRow();

    const cols = [
      it.accao || "",
      it.objetivos || "",
      it.indicador || "",
      String(it.metaAnual ?? ""),
      String(it.beneficiariosTotal ?? ""),
      String(it.orcamentoMZN ?? ""),
      formatDateCell_(it.periodoInicio),
      formatDateCell_(it.periodoFim)
    ];

    cols.forEach((val, i) => {
      const cell = row.appendTableCell(val);
      cell.setWidth(widths[i]);
      cell.getChild(0).asParagraph()
        .setFontSize(9)
        .setAlignment(i >= 3 ? DocumentApp.HorizontalAlignment.CENTER : DocumentApp.HorizontalAlignment.LEFT);
    });
  });

  body.appendParagraph(" ");
});


  doc.saveAndClose();

  const file = DriveApp.getFileById(doc.getId());
  const moved = file.moveTo(pasta);

  return {
    id: moved.getId(),
    nome: moved.getName(),
    url: moved.getUrl(),
    mimeType: moved.getMimeType()
  };
}


// ========= GERAR PDF =========
function gerarRelatorioPDF(pasta, nomeBase, titulo, nomeFaculdade, opcao, porPeriodo, di, df, registos) {
  // cria DOC temporário e exporta para PDF
  const tmp = gerarRelatorioDOC(pasta, nomeBase + " (DOC_TEMP)", titulo, nomeFaculdade, opcao, porPeriodo, di, df, registos);
  const docFile = DriveApp.getFileById(tmp.id);

  const blobPdf = docFile.getBlob().getAs(MimeType.PDF).setName(nomeBase + ".pdf");
  const pdfFile = pasta.createFile(blobPdf);

  // apagar doc temp
  try { docFile.setTrashed(true); } catch (_) {}

  return {
    id: pdfFile.getId(),
    nome: pdfFile.getName(),
    url: pdfFile.getUrl(),
    mimeType: pdfFile.getMimeType()
  };
}

// ========= GERAR XLSX =========
function gerarRelatorioXLSX(pasta, nomeBase, titulo,nomeFaculdade, opcao, porPeriodo, di, df, registos) {
  const ss = SpreadsheetApp.create(nomeBase + " (TEMP)");
  const sh = ss.getSheets()[0];
  sh.setName("Relatorio");

  // Cabeçalho com TODAS as colunas
  const header = [[
    "Área", "Acção", "Objectivos específicos", "Localização", "Indicador de produto",
    "Meta anual", "Meta T1", "Meta T2", "Meta T3", "Meta T4",
    "Beneficiários (Total)", "Homens", "Mulheres",
    "Fonte de financiamento", "Orçamento (MZN)", "Responsável",
    "Período (Início)", "Período (Fim)", "Observações", "Estado", "Motivo"
  ]];

  sh.getRange(1, 1, 1, header[0].length).setValues(header);

  // Linhas (21 colunas) — datas protegidas
  const linhas = registos.map(it => ([
    it.area || it.faculdade || "",
    it.accao || it.titulo || "",
    it.objetivos || "",
    it.localizacao || "",
    it.indicador || "",

    it.metaAnual ?? "",
    it.metaT1 ?? "",
    it.metaT2 ?? "",
    it.metaT3 ?? "",
    it.metaT4 ?? "",

    it.beneficiariosTotal ?? "",
    it.homens ?? "",
    it.mulheres ?? "",

    it.fonteFinanciamento || "",
    it.orcamentoMZN ?? "",
    it.responsavel || "",

    fmtDateXlsx_(it.periodoInicio),
    fmtDateXlsx_(it.periodoFim),

    it.observacoes || "",
    it.estado || "",
    it.motivo || ""
  ]));

  if (linhas.length) sh.getRange(2, 1, linhas.length, header[0].length).setValues(linhas);

  // Linha de título no topo (opcional)
  sh.insertRows(1);
  sh.getRange(1, 1).setValue(titulo);
  sh.getRange(2, 1).setValue(`Opção: ${opcao}`);
  sh.getRange(2, 2).setValue(porPeriodo ? `Período: ${di} a ${df}` : "Período: (não aplicado)");

  const xlsxBlob = exportSpreadsheetAsXlsx_(ss.getId(), nomeBase + ".xlsx");
  const xlsxFile = pasta.createFile(xlsxBlob);

  try { DriveApp.getFileById(ss.getId()).setTrashed(true); } catch (_) {}

  return {
    id: xlsxFile.getId(),
    nome: xlsxFile.getName(),
    url: xlsxFile.getUrl(),
    mimeType: xlsxFile.getMimeType()
  };
}

function exportSpreadsheetAsXlsx_(spreadsheetId, filename) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
  const token = ScriptApp.getOAuthToken();

  const resp = UrlFetchApp.fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    muteHttpExceptions: true
  });

  const code = resp.getResponseCode();
  if (code !== 200) throw new Error(`Falha ao exportar XLSX. HTTP ${code}: ${resp.getContentText()}`);

  return resp.getBlob()
    .setName(filename)
    .setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

// ========= HELPERS =========
function responseJSON(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function normLower(s) {
  return String(s || "").trim().toLowerCase();
}

function parseISODate(s) {
  const m = String(s || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  const dt = new Date(y, mo, d);
  return isNaN(dt.getTime()) ? null : dt;
}

function toDateSafe(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  const dt = new Date(v);
  if (dt instanceof Date && !isNaN(dt.getTime())) return dt;
  return null;
}

function fimDoDia(d) {
  const x = new Date(d.getTime());
  x.setHours(23, 59, 59, 999);
  return x;
}

function formatDateCell_(v) {
  const d = toDateSafe(v);
  return d ? Utilities.formatDate(d, "Africa/Maputo", "dd/MM/yyyy") : String(v || "");
}

function fmtDateXlsx_(v) {
  const d = toDateSafe(v);
  return d ? Utilities.formatDate(d, "Africa/Maputo", "yyyy-MM-dd") : String(v || "");
}

