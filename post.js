
/***********************
 * CONFIG
 ************************/
const SPREADSHEET_ID = ""; // deixar vazio = Spreadsheet activo

const PASTA_EVIDENCIAS_ID = "1uUPbfOdm168fZvIiiHmrkQHcCYagvRPe";

// Ordem das colunas (tem de bater com o teu template)
const COLS = [
  "id",
  "dataRegisto",
  "area",
  "acao",
  "objectivos",
  "localizacao",
  "indicador",
  "metaAnual",
  "metaT1",
  "metaT2",
  "metaT3",
  "metaT4",
  "benefTotal",
  "homens",
  "mulheres",
  "fonteFin",
  "orcamentoMZN",
  "responsavel",
  "periodoInicio",   // S (19)
  "periodoFim",      // T (20)
  "observacoes",     // U (21)
  "estado",          // V (22)
  "motivo",          // W (23)
  "linkEvidencias"   // X (24)
];

/***********************
 * WEB APP ENTRYPOINT
 ************************/
function doPost(e) {
  let body = {};
  try {
    body = parseJsonBody_(e);

    const acao = String(body.operacao || body.acao || "criar")
      .trim()
      .toLowerCase();

    if (acao === "gerar_relatorio") {
      return jsonCore_(gerarRelatorio(body), 200, e, body);
    }

    if (acao === "enviar_relatorio_dc") {
      return jsonCore_(enviarRelatorioDc_(body), 200, e, body);
    }

    const email = String(body.email || "").trim().toLowerCase();
    if (!email) {
      return jsonCore_({ sucesso: false, mensagem: "Email não enviado." }, 400, e, body);
    }

    const nomeSheet = getSheetByEmail_(email);
    if (!nomeSheet) {
      return jsonCore_({ sucesso: false, mensagem: "Email sem permissão." }, 403, e, body);
    }

    switch (acao) {
      case "criar":
        return criarAtividade_(body, nomeSheet, e);

      case "atualizar":
      case "actualizar":
        return atualizarAtividade_(body, nomeSheet, e);

      default:
        return jsonCore_(
          { sucesso: false, mensagem: `Acção inválida: "${acao}"` },
          400,
          e,
          body
        );
    }

  } catch (err) {
    return jsonCore_(
      { sucesso: false, mensagem: String(err && err.message ? err.message : err) },
      500,
      e,
      body
    );
  }
}





/***********************
 * CRIAR (appendRow)
 ************************/
function criarAtividade_(body, nomeSheet,) {
  const erros = validarPayload_(body);
  if (erros.length) {
    return jsonCore_({ sucesso: false, mensagem: "Validação falhou.", erros }, 400);
  }

  const ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  const sh = ss.getSheetByName(nomeSheet);
  if (!sh) {
    return jsonCore_({ sucesso: false, mensagem: `Sheet '${nomeSheet}' não existe.` }, 404);
  }

  garantirCabecalho_(sh);

  const row = COLS.map(k => normalizarValor_(k, body[k]));
  sh.appendRow(row);

  return jsonCore_({
    sucesso: true,
    mensagem: "Registo gravado com sucesso.",
    sheet: nomeSheet,
    id: body.id
  }, 200);
}


/***********************
 * ATUALIZAR (S/T/V/W/X + evidência)
 ************************/
function atualizarAtividade_(body, nomeSheet) {
  const id = String(body.id || "").trim();
  if (!id) return jsonCore_({ sucesso: false, mensagem: "ID da actividade é obrigatório (body.id)." }, 400);

  // Só actualiza o que vier no body
  const periodoInicio = body.periodoInicio ?? body.periodo_inicio; // S
  const periodoFim    = body.periodoFim ?? body.periodo_fim;       // T
  const estado        = body.estado;                               // V
  const motivo        = body.motivo;                               // W

  // Evidência: URL directo OU ficheiro base64
  const evidenciaUrl = body.evidenciaUrl ?? body.evidencia_url; // X
  const evidenciaObj = body.evidencia; // { nome, mimeType, base64 }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SPREADSHEET_ID
      ? SpreadsheetApp.openById(SPREADSHEET_ID)
      : SpreadsheetApp.getActiveSpreadsheet();

    const sh = ss.getSheetByName(nomeSheet);
    if (!sh) return jsonCore_({ sucesso: false, mensagem: `Sheet '${nomeSheet}' não existe.` }, 404);

    const rowIndex = findRowById_(sh, id);
    if (rowIndex < 2) return jsonCore_({ sucesso: false, mensagem: "Actividade não encontrada para este ID.", id, sheet: nomeSheet }, 404);

    // Colunas fixas: S=19, T=20, V=22, W=23, X=24
    if (periodoInicio !== undefined) sh.getRange(rowIndex, 19).setValue(parseDateFlexible_(periodoInicio));
    if (periodoFim !== undefined)    sh.getRange(rowIndex, 20).setValue(parseDateFlexible_(periodoFim));
    if (estado !== undefined)        sh.getRange(rowIndex, 22).setValue(String(estado || "").trim());
    if (motivo !== undefined)        sh.getRange(rowIndex, 23).setValue(String(motivo || "").trim());

    let evidenciaFinalUrl = "";
    if (evidenciaObj && evidenciaObj.base64) {
      evidenciaFinalUrl = saveEvidenceFile_(id, evidenciaObj);
      sh.getRange(rowIndex, 24).setValue(evidenciaFinalUrl);
    } else if (evidenciaUrl !== undefined) {
      evidenciaFinalUrl = String(evidenciaUrl || "").trim();
      sh.getRange(rowIndex, 24).setValue(evidenciaFinalUrl);
    }

    return jsonCore_({
      sucesso: true,
      mensagem: "Actividade actualizada com sucesso.",
      sheet: nomeSheet,
      id,
      linha: rowIndex,
      evidenciaUrl: evidenciaFinalUrl
    }, 200);

  } finally {
    lock.releaseLock();
  }
}



/***********************
 * HELPERS
 ************************/
function parseJsonBody_(e) {
  // 1) Ler conteúdo bruto (pode vir JSON ou form-urlencoded)
  const raw = (e && e.postData && e.postData.contents) ? String(e.postData.contents) : "";

  // 2) Tentar JSON primeiro (mantém compatibilidade com ReqBin e testes actuais)
  if (raw) {
    try {
      const obj = JSON.parse(raw);
      if (typeof obj === "object" && obj !== null) return obj;
    } catch (err) {
      // cai para form-urlencoded
    }
  }

  // 3) Fallback: form-urlencoded no Apps Script aparece em e.parameter
  const p = (e && e.parameter) ? e.parameter : null;
  if (p && typeof p === "object") {
    const body = {};
    Object.keys(p).forEach(k => body[k] = p[k]);
    return body;
  }

  // 4) Se não veio nada utilizável
  throw new Error("Sem body válido (envie JSON ou x-www-form-urlencoded).");
}


function validarPayload_(b) {
  const erros = [];

  if (!b.id) erros.push("Campo 'id' é obrigatório (recomendado UUID).");
  if (!b.area) erros.push("Campo 'area' é obrigatório.");
  if (!b.acao) erros.push("Campo 'acao' é obrigatório.");

  const nums = ["metaAnual","metaT1","metaT2","metaT3","metaT4","benefTotal","homens","mulheres","orcamentoMZN"];
  nums.forEach(k => {
    if (b[k] !== undefined && b[k] !== null && b[k] !== "") {
      const v = Number(b[k]);
      if (!isFinite(v)) erros.push(`Campo '${k}' deve ser numérico.`);
      else if (v < 0) erros.push(`Campo '${k}' não pode ser negativo.`);
    }
  });

  const hasMeta = ["metaAnual","metaT1","metaT2","metaT3","metaT4"].every(k => b[k] !== undefined && b[k] !== null && b[k] !== "");
  if (hasMeta) {
    const mA = Number(b.metaAnual);
    const soma = Number(b.metaT1) + Number(b.metaT2) + Number(b.metaT3) + Number(b.metaT4);
    if (mA !== soma) erros.push("Meta anual deve ser igual à soma de Meta T1+T2+T3+T4.");
  }

  const hasBen = ["benefTotal","homens","mulheres"].every(k => b[k] !== undefined && b[k] !== null && b[k] !== "");
  if (hasBen) {
    const tot = Number(b.benefTotal);
    const soma = Number(b.homens) + Number(b.mulheres);
    if (tot !== soma) erros.push("Beneficiários (Total) deve ser igual a Homens+Mulheres.");
  }

  if (b.periodoInicio && !isDataOk_(b.periodoInicio)) erros.push("Campo 'periodoInicio' deve ser data (YYYY-MM-DD ou dd/mm/aaaa).");
  if (b.periodoFim && !isDataOk_(b.periodoFim)) erros.push("Campo 'periodoFim' deve ser data (YYYY-MM-DD ou dd/mm/aaaa).");

  if (b.periodoInicio && b.periodoFim) {
    const di = toDate_(b.periodoInicio);
    const df = toDate_(b.periodoFim);
    if (di && df && df.getTime() < di.getTime()) erros.push("Período (Fim) não pode ser anterior ao Período (Início).");
  }

  return erros;
}

function garantirCabecalho_(sh) {
  const width = Math.max(sh.getLastColumn(), COLS.length);
  const firstRow = sh.getRange(1, 1, 1, width).getValues()[0];
  const precisa = firstRow.filter(Boolean).length === 0;

  if (precisa) {
    const headers = [
      "ID","Data de registo","Área","Acção","Objectivos específicos","Localização","Indicador de produto",
      "Meta anual","Meta T1","Meta T2","Meta T3","Meta T4",
      "Beneficiários (Total)","Homens","Mulheres",
      "Fonte de financiamento","Orçamento (MZN)","Responsável",
      "Período (Início)","Período (Fim)","Observações",
      "Estado","Motivo","Link Evidências"
    ];
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
}

function normalizarValor_(k, v) {
  if (v === undefined || v === null) return "";

  if (k === "dataRegisto") {
    if (v === "") return new Date();
    const d = toDate_(v);
    return d || v;
  }

  if (k === "periodoInicio" || k === "periodoFim") {
    if (v === "") return "";
    const d = toDate_(v);
    return d || v;
  }

  if (["metaAnual","metaT1","metaT2","metaT3","metaT4","benefTotal","homens","mulheres","orcamentoMZN"].includes(k)) {
    if (v === "") return "";
    const n = Number(v);
    return isFinite(n) ? n : v;
  }

  return String(v).trim();
}

function isDataOk_(s) {
  return !!toDate_(s);
}

function toDate_(s) {
  if (s instanceof Date) return s;
  if (typeof s !== "string") return null;

  const t = s.trim();
  if (!t) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/;
  const m1 = t.match(iso);
  if (m1) {
    const y = Number(m1[1]), mo = Number(m1[2]) - 1, d = Number(m1[3]);
    const dt = new Date(y, mo, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  const pt = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const m2 = t.match(pt);
  if (m2) {
    const d = Number(m2[1]), mo = Number(m2[2]) - 1, y = Number(m2[3]);
    const dt = new Date(y, mo, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  return null;
}

function parseDateFlexible_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  const s = String(v || "").trim();
  if (!s) return "";
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const pt = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (pt) return new Date(Number(pt[3]), Number(pt[2]) - 1, Number(pt[1]));
  return s;
}

function findRowById_(sh, id) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;

  const lastCol = sh.getLastColumn();
  const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const idNorm = String(id).trim();

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    for (let j = 0; j < row.length; j++) {
      if (String(row[j] ?? "").trim() === idNorm) return i + 2;
    }
  }
  return -1;
}

function saveEvidenceFile_(id, evidencia) {
  const folder = DriveApp.getFolderById(PASTA_EVIDENCIAS_ID);

  const nomeBase = String(evidencia.nome || `evidencia-${id}`).trim();
  const mimeType = String(evidencia.mimeType || "application/octet-stream").trim();
  const base64 = String(evidencia.base64 || "").trim();

  if (!base64) throw new Error("Evidência sem base64.");

  const cleaned = base64.includes(",") ? base64.split(",").pop() : base64;
  const bytes = Utilities.base64Decode(cleaned);
  const blob = Utilities.newBlob(bytes, mimeType, nomeBase);

  const file = folder.createFile(blob);
  return file.getUrl();
}

function json_(obj, statusCode) {
  obj.httpStatus = statusCode;

  const out = ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);

  // CORS mínimo
  out.setHeader("Access-Control-Allow-Origin", "*");
  out.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  out.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  return out;
}




function responseJSON(obj, e) {
  // se a tua gerarRelatorio já devolve {sucesso:...} está ok
  return json_(obj, 200, e);
}


function zzz_teste_menu_() {
  Logger.log("APARECI NO MENU");
}

function getSheetByEmail_(email) {
  const mapa = {
    "facee@unirovuma.ac.mz": "FACEE",
    "fcsf@unirovuma.ac.mz": "FCSF",
    "dc@unirovuma.ac.mz": "__DC__" // especial
    // adicionar aqui as restantes 13 faculdades
  };

  return mapa[String(email).toLowerCase()] || null;
}


function getNomeFaculdadeByEmail_(email) {
  const mapa = {
    "facee@unirovuma.ac.mz": "Faculdade de Ciências Económicas e Empresariais",
    "fcsf@unirovuma.ac.mz": "Faculdade de Ciências Sociais e Filosofia"
    // adicionar aqui as restantes faculdades
  };

  return mapa[String(email).toLowerCase()] || "Universidade Rovuma";
}

function enviarRelatorioDc_(body) {
  const email = String(body.email || "").trim().toLowerCase();
  if (!email) throw new Error("Email não enviado.");

  const relatorioUrl = String(body.relatorioUrl || "").trim();
  if (!relatorioUrl) throw new Error("Link do relatório não enviado.");

  const ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  const sh = ss.getSheetByName("Relatorios");
  if (!sh) throw new Error("Sheet 'Relatorios' não existe.");

  // define a linha pelo email (ajusta ao teu cenário real)
  const linhaPorEmail = {
    "facee@unirovuma.ac.mz": 2, // FACEE
    "fcsf@unirovuma.ac.mz": 3   // FCSF
    // ...
  };

  const linha = linhaPorEmail[email];
  if (!linha) throw new Error("Email sem permissão.");

  const cellUrl = sh.getRange(linha, 2); // B{linha}
  const cellDt  = sh.getRange(linha, 3); // C{linha}

  const atual = String(cellUrl.getDisplayValue() || "").trim();
  if (atual) throw new Error("Erro ao gerar relatório: já existe um relatório enviado à DC.");

  cellUrl.setValue(relatorioUrl);
  cellDt.setValue(new Date());

  return { sucesso: true, mensagem: "Relatório enviado à DC com sucesso." };
}

function jsonp_(data, e){
  const cb = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : "callback";
  return ContentService
    .createTextOutput(`${cb}(${JSON.stringify(data)})`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}



