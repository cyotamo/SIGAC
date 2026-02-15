    import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
    import { emailAutorizado, normalizarEmail } from "./autorizacao.js";
    import { auth } from "./firebase-init.js";
    import { carregarJSONP } from "./authFetch.js";
const WEB_URL = "https://script.google.com/macros/s/AKfycbyAz_m2w8vmzB2sEbND6l2kWgSE50qmn70cizqe_s8ZhSgmxZyVzbuqLoxAC-Qrn-Xfdg/exec";
const API_URL = WEB_URL;

    let EMAIL_ATUAL = "";
    let relatorioGeradoUrl = "";

    function esconderAuthGate() {
      document.getElementById("authGate")?.setAttribute("hidden", "hidden");
    }

    function obterEmailUtilizador() {
      const email = normalizarEmail(auth.currentUser?.email || EMAIL_ATUAL);
      if (!email) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }
      return email;
    }

    function atualizarContextoUtilizador(email) {
      const el = document.getElementById("ctx");
      if (!el) return;
      el.innerHTML = `Utilizador: <strong>${escapeHtml(email)}</strong> • Ano lectivo: <strong>2026</strong>`;
    }

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }

      EMAIL_ATUAL = normalizarEmail(user.email);
      if (EMAIL_ATUAL === "dc@unirovuma.ac.mz") {
        window.location.href = "gestor.html";
        return;
      }

      if (!emailAutorizado(EMAIL_ATUAL)) {
        await signOut(auth).finally(() => {
          window.location.href = "index.html";
        });
        return;
      }

      if (EMAIL_ATUAL) {
        atualizarContextoUtilizador(EMAIL_ATUAL);
        esconderAuthGate();
        carregarDoBackend().catch(console.error);
      }
    });

    document.getElementById("btnLogout")?.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "index.html";
    });

    // ---------------------------
    // DEMO DATA / STATE
    function normalizarParaAPI(a) {
      const email = obterEmailUtilizador();

      return {
        operacao: "criar",
        email,
        id: a.id,
        dataRegisto: a.createdAt || "",
        area: a.area,
        acao: a.accao,
        objectivos: a.obj,
        localizacao: a.local,
        indicador: a.indicador,

        metaAnual: a.metaAnual,
        metaT1: a.metas?.t1 ?? "",
        metaT2: a.metas?.t2 ?? "",
        metaT3: a.metas?.t3 ?? "",
        metaT4: a.metas?.t4 ?? "",

        benefTotal: a.benef?.total ?? "",
        homens: a.benef?.h ?? "",
        mulheres: a.benef?.m ?? "",

        fonteFin: a.fonte,
        orcamentoMZN: a.orcamento,
        responsavel: a.resp,
        periodoInicio: a.inicio,
        periodoFim: a.fim,
        observacoes: a.nota || "",
        estado: a.estado || ""
      };
    }

    async function chamarAPI(payload = {}) {
      const params = new URLSearchParams();
      Object.entries(payload).forEach(([chave, valor]) => {
        if (valor === undefined || valor === null) return;
        params.set(chave, String(valor));
      });

      const data = await carregarJSONP(`${API_URL}?${params.toString()}`);
      if (!data || data.sucesso !== true) {
        console.log("RESPOSTA API ->", data);
        const detalhes = (data && (data.erros ? data.erros.join(" | ") : data.mensagem))
          || (data && data.httpStatus ? `HTTP ${data.httpStatus}` : "Erro ao contactar API");
        throw new Error(detalhes);
      }
      return data;
    }

    async function enviarParaBackend(a) {
      const payload = normalizarParaAPI(a);
      console.log("PAYLOAD cadastro ->", payload);

      return chamarAPI(payload);
    }

    function fileToBase64SemPrefixo(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const conteudo = String(reader.result || "");
          const base64 = conteudo.includes(",") ? conteudo.split(",")[1] : conteudo;
          resolve(base64);
        };
        reader.onerror = () => reject(new Error("Falha ao ler ficheiro de evidência."));
        reader.readAsDataURL(file);
      });
    }

    async function atualizarAtividade(payload) {
      payload.operacao = payload.operacao || "atualizar";
      payload.email = obterEmailUtilizador();
      console.log("PAYLOAD atualizar ->", payload);

      return chamarAPI(payload);
    }

    function normalizarDoBackend(item, idx) {
      return {
        id: item.id,
        num: String(idx + 1),
        area: item.area,
        accao: item.acao,
        obj: item.objectivos,
        indicador: item.indicador,
        local: item.localizacao,
        metas: { t1: item.metaT1, t2: item.metaT2, t3: item.metaT3, t4: item.metaT4 },
        metaAnual: item.metaAnual,
        benef: { total: item.benefTotal, h: item.homens, m: item.mulheres },
        orcamento: item.orcamentoMZN,
        fonte: item.fonteFin,
        resp: item.responsavel,
        inicio: item.periodoInicio,
        fim: item.periodoFim,
        nota: item.observacoes,
        estado: item.estado === "Adiada" ? "Adiar" : item.estado,
        motivo: item.motivo,
        evidenciasText: item.linkEvidencias || "",
        evidenciasCount: item.linkEvidencias ? 1 : 0,
        createdAt: item.dataRegisto
      };
    }

    async function carregarDoBackend(estado) {
      const email = obterEmailUtilizador();
      // TODO Nível 2: backend deve ignorar email do cliente e usar apenas o token validado.
      const params = new URLSearchParams({ email });
      if (estado) params.set("estado", estado);

      const url = `${API_URL}?${params.toString()}`;
      console.log("GET listar ->", url);

      const data = await carregarJSONP(url);

      if (!data || data.sucesso !== true || !Array.isArray(data.dados)) {
        console.log("RESPOSTA listar ->", data);
        throw new Error((data && data.mensagem) || "Erro ao carregar dados");
      }

      // limpar arrays sempre que recarrega
      state.cadastradas = [];
      state.executadas = [];
      state.canceladas = [];

      data.dados.forEach((item, idx) => {
        const a = normalizarDoBackend(item, idx);

        // Se pedimos um estado específico, encher só o array correspondente
        if (estado === "Executada") {
          state.executadas.unshift(a);
          return;
        }
        if (estado === "Cancelada") {
          state.canceladas.unshift(a);
          return;
        }

        // modo geral (sem filtro)
        if (a.estado === "Executada") state.executadas.unshift(a);
        else if (a.estado === "Cancelada") state.canceladas.unshift(a);
        else state.cadastradas.unshift(a); // Planificada/Adiada
      });

      render();
    }

    // ---------------------------
    const state = {
      cadastradas: [],
      executadas: [],
      canceladas: [],
      docentes: [],
      currentEdit: null,
      currentDocenteId: "",
      page: {
        cadastradas: 1,
        executadas: 1,
        canceladas: 1
      }
    };

    const PAGE_SIZE = 10;

    const $ = (s) => document.querySelector(s);
    const parsePositiveNumber = (value) => {
      const sanitized = String(value || "").replace(/[^\d.-]/g, "").replace(",", ".").trim();
      const n = Number(sanitized);
      return Number.isFinite(n) && n > 0 ? n : 0;
    };
    const parseCurrencyInputToNumber = (value) => {
      const digits = String(value || "").replace(/\D+/g, "");
      if (!digits) return 0;
      return Number(digits) / 100;
    };
    const formatCurrencyWithDots = (value) => {
      const digits = String(value || "").replace(/\D+/g, "");
      if (!digits) return "";
      const padded = digits.padStart(3, "0");
      const cents = padded.slice(-2);
      let integer = padded.slice(0, -2).replace(/^0+(?=\d)/, "");
      if (!integer) integer = "0";
      integer = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      return `${integer}.${cents}`;
    };
    const fmtMoney = (v) => {
      const n = parseCurrencyInputToNumber(v);
      if (Number.isNaN(n)) return "—";
      return n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MZN";
    };

    const fmtPeriodo = (ini, fim) => {
      if (!ini && !fim) return "—";
      const a = ini ? new Date(ini).toLocaleDateString("pt-PT") : "—";
      const b = fim ? new Date(fim).toLocaleDateString("pt-PT") : "—";
      return `${a} → ${b}`;
    };

    function toDateOnly(dateValue) {
      if (!dateValue) return null;
      const d = new Date(dateValue);
      if (Number.isNaN(d.getTime())) return null;
      d.setHours(0, 0, 0, 0);
      return d;
    }

    function getEstadoVisual(a) {
      const estado = String(a?.estado || "").trim();
      if (estado !== "Planificada") return estado || "Planificada";

      const hoje = toDateOnly(new Date());
      const fim = toDateOnly(a?.fim || a?.inicio);
      if (hoje && fim && hoje > fim) return "Atrasada";

      return "Planificada";
    }

    function renderPeriodoComAlerta(a) {
      const textoPeriodo = fmtPeriodo(a?.inicio, a?.fim);
      const estadoVisual = getEstadoVisual(a);
      if (estadoVisual !== "Planificada") return textoPeriodo;

      const hoje = toDateOnly(new Date());
      const inicio = toDateOnly(a?.inicio);
      if (!hoje || !inicio) return textoPeriodo;

      const msPorDia = 1000 * 60 * 60 * 24;
      const diasAteInicio = Math.round((inicio.getTime() - hoje.getTime()) / msPorDia);
      if (diasAteInicio < 0 || diasAteInicio > 7) return textoPeriodo;

      return `${textoPeriodo} <span class="period-alert" title="Execução prevista nos próximos 7 dias">⚠️</span>`;
    }

    function getAreaClass(area = "") {
      const key = String(area).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (key.includes("extensao")) return "is-extensao";
      if (key.includes("pos-graduacao") || key.includes("pos graduacao") || key.includes("posgraduacao")) return "is-posgraduacao";
      if (key.includes("pesquisa")) return "is-pesquisa";
      if (key.includes("publicacao")) return "is-publicacao";
      return "is-area-default";
    }

    function renderAreaTag(area = "") {
      return `<span class="area-tag ${getAreaClass(area)}">${escapeHtml(area || "—")}</span>`;
    }

    function chipEstado(estado){
      if (estado === "Executada") return `<span class="chip ok">● ${estado}</span>`;
      if (estado === "Cancelada" || estado === "Atrasada") return `<span class="chip bad">● ${estado}</span>`;
      if (estado === "Adiada" || estado === "Adiar") return `<span class="chip warn">● ${estado}</span>`;
      if (estado === "Planificada") return `<span class="chip plan">● ${estado}</span>`;
      return `<span class="chip">● ${estado}</span>`;
    }

    function getNumeroOrdem(tipo, indexNaPagina) {
      return ((state.page[tipo] - 1) * PAGE_SIZE) + indexNaPagina + 1;
    }

    function getRowClassByEstado(estado) {
      if (estado === "Executada") return "status-row status-row-executada";
      if (estado === "Cancelada" || estado === "Atrasada") return "status-row status-row-cancelada";
      if (estado === "Planificada") return "status-row status-row-planificada";
      return "status-row";
    }

    function renderLoading(tbodyId, colspan) {
      const tbody = $(tbodyId);
      if (!tbody) return;
      tbody.innerHTML = `<tr><td colspan="${colspan}" class="muted loading-cell">A carregar<span class="loading-dots" aria-hidden="true">....</span></td></tr>`;
    }

    function renderEmpty(tbodyId, colspan) {
      const tbody = $(tbodyId);
      if (!tbody) return;
      tbody.innerHTML = `<tr><td colspan="${colspan}" class="muted">Sem dados</td></tr>`;
    }

    function renderPagination(tipo, total) {
      const el = $(`#pagination${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
      if (!el) return;
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const currentPage = Math.min(state.page[tipo], totalPages);
      state.page[tipo] = currentPage;
      el.innerHTML = `
        <button type="button" class="btn-sm" data-page="prev" data-tipo="${tipo}" ${currentPage <= 1 ? "disabled" : ""}>&lt;</button>
        <span>${currentPage} de ${totalPages}</span>
        <button type="button" class="btn-sm" data-page="next" data-tipo="${tipo}" ${currentPage >= totalPages ? "disabled" : ""}>&gt;</button>
      `;
    }

    function paginar(lista, tipo) {
      const totalPages = Math.max(1, Math.ceil(lista.length / PAGE_SIZE));
      const page = Math.min(state.page[tipo], totalPages);
      state.page[tipo] = page;
      const start = (page - 1) * PAGE_SIZE;
      return lista.slice(start, start + PAGE_SIZE);
    }

    function render(){
      const cadastradasPage = paginar(state.cadastradas, "cadastradas");
      const executadasPage = paginar(state.executadas, "executadas");
      const canceladasPage = paginar(state.canceladas, "canceladas");

      // Cadastradas
      if (!state.cadastradas.length) {
        renderEmpty("#tbCadastradas", 8);
      } else {
        $("#tbCadastradas").innerHTML = cadastradasPage.map((a, idx) => {
        const estadoVisual = getEstadoVisual(a);
        return `
        <tr class="${getRowClassByEstado(estadoVisual)}">
          <td><strong>${getNumeroOrdem("cadastradas", idx)}</strong></td>
          <td>${renderAreaTag(a.area)}</td>
          <td><div style="font-weight:900">${escapeHtml(a.accao)}</div></td>
          <td>${escapeHtml(a.local || "—")}</td>
          <td class="periodo-cell">${renderPeriodoComAlerta(a)}</td>
          <td>${fmtMoney(a.orcamento)}</td>
          <td>${chipEstado(estadoVisual)}</td>
          <td>
            <button class="btn-sm" onclick="openModal('${a.id}')">Editar</button>
          </td>
        </tr>
      `;
      }).join("");
      }
      renderPagination("cadastradas", state.cadastradas.length);

      // Executadas
      if (!state.executadas.length) {
        renderEmpty("#tbExecutadas", 7);
      } else {
        $("#tbExecutadas").innerHTML = executadasPage.map((a, idx) => `
        <tr class="${getRowClassByEstado("Executada")}">
          <td><strong>${getNumeroOrdem("executadas", idx)}</strong></td>
          <td>${renderAreaTag(a.area)}</td>
          <td><div style="font-weight:900">${escapeHtml(a.accao)}</div></td>
          <td class="periodo-cell">${fmtPeriodo(a.inicio, a.fim)}</td>
          <td>${escapeHtml(a.resp || "—")}</td>
          <td>
            ${a.evidenciasText
              ? `<a href="${escapeHtml(a.evidenciasText)}" target="_blank" rel="noopener noreferrer">Ver evidência</a>`
              : ((a.evidenciasCount || 0) > 0 ? `<span class="chip ok">📎 ${a.evidenciasCount}</span>` : `<span class="chip">—</span>`)}
          </td>
          <td>${chipEstado("Executada")}</td>
        </tr>
      `).join("");
      }
      renderPagination("executadas", state.executadas.length);

      // Canceladas
      if (!state.canceladas.length) {
        renderEmpty("#tbCanceladas", 6);
      } else {
        $("#tbCanceladas").innerHTML = canceladasPage.map((a, idx) => `
        <tr class="${getRowClassByEstado("Cancelada")}">
          <td><strong>${getNumeroOrdem("canceladas", idx)}</strong></td>
          <td>${renderAreaTag(a.area)}</td>
          <td><div style="font-weight:900">${escapeHtml(a.accao)}</div></td>
          <td class="periodo-cell">${fmtPeriodo(a.inicio, a.fim)}</td>
          <td>${escapeHtml(a.motivo || "—")}</td>
          <td>${chipEstado("Cancelada")}</td>
        </tr>
      `).join("");
      }
      renderPagination("canceladas", state.canceladas.length);

      // Docentes
      if (!state.docentes.length) {
        renderEmpty("#tbDocentes", 4);
      } else {
        $("#tbDocentes").innerHTML = state.docentes.map((d, idx) => `
          <tr>
            <td><strong>${idx + 1}</strong></td>
            <td>${escapeHtml(d.nome || "—")}</td>
            <td>${escapeHtml(d.nivel || "—")}</td>
            <td>${escapeHtml(d.area || "—")}</td>
          </tr>
        `).join("");
      }

    }

    function carregarDocentesLocal() {
      try {
        const bruto = localStorage.getItem("sigac_docentes");
        if (!bruto) {
          state.docentes = [];
          return;
        }
        const dados = JSON.parse(bruto);
        if (!Array.isArray(dados)) {
          state.docentes = [];
          return;
        }
        state.docentes = dados.map((d) => ({
          id: d.id || crypto.randomUUID(),
          nome: d.nome || "",
          nivel: d.nivel || "",
          area: d.area || "",
          formacao: d.formacao || "",
          instituicao: d.instituicao || "",
          pais: d.pais || ""
        }));
      } catch (err) {
        console.error("Falha ao carregar docentes locais:", err);
        state.docentes = [];
      }
    }

    function guardarDocentesLocal() {
      localStorage.setItem("sigac_docentes", JSON.stringify(state.docentes));
    }

    function renderSelectDocentes(filtro = "") {
      const select = $("#docenteSelecionado");
      if (!select) return;
      const filtroNormalizado = String(filtro || "").trim().toLowerCase();
      const docentesFiltrados = state.docentes.filter((d) =>
        (d.nome || "").toLowerCase().includes(filtroNormalizado)
      );

      select.innerHTML = `<option value="">Novo docente</option>${docentesFiltrados
        .map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.nome || "Sem nome")}</option>`)
        .join("")}`;
      select.value = state.currentDocenteId || "";
    }

    function limparFormularioDocente() {
      state.currentDocenteId = "";
      $("#docenteNome").value = "";
      $("#docenteNivel").value = "";
      $("#docenteArea").value = "";
      $("#docenteFormacao").value = "";
      $("#docenteInstituicao").value = "";
      $("#docentePais").value = "";
      $("#docenteSelecionado").value = "";
    }

    function preencherFormularioDocente(id) {
      const docente = state.docentes.find((d) => d.id === id);
      if (!docente) {
        limparFormularioDocente();
        return;
      }
      state.currentDocenteId = docente.id;
      $("#docenteNome").value = docente.nome || "";
      $("#docenteNivel").value = docente.nivel || "";
      $("#docenteArea").value = docente.area || "";
      $("#docenteFormacao").value = docente.formacao || "";
      $("#docenteInstituicao").value = docente.instituicao || "";
      $("#docentePais").value = docente.pais || "";
      $("#docenteSelecionado").value = docente.id;
    }

    function escapeHtml(str){
      return String(str || "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
    }

    // ---------------------------
    // Tabs
    // ---------------------------
    function switchTab(tabName){
      document.querySelectorAll(".tab").forEach(tab => {
        const isActive = tab.dataset.tab === tabName;
        tab.setAttribute("aria-selected", String(isActive));
      });

      document.querySelectorAll(".pane").forEach(panel => {
        const isActive = panel.id === `pane-${tabName}`;
        panel.classList.toggle("active", isActive);
        panel.hidden = !isActive;
      });
    }

    document.querySelectorAll(".tab").forEach(btn => {
      btn.addEventListener("click", async () => {
        const tab = btn.dataset.tab;
        if (!tab) return;
        switchTab(tab);

        try {
          if (tab === "canceladas") {
            renderLoading("#tbCanceladas", 6);
            await carregarDoBackend("Cancelada");
          } else if (tab === "executadas") {
            renderLoading("#tbExecutadas", 7);
            await carregarDoBackend("Executada");
          } else if (tab === "cadastradas") {
            renderLoading("#tbCadastradas", 8);
            await carregarDoBackend();
          }
        } catch (err) {
          console.error(err);
        }
      });
    });

    switchTab("cadastro");

    function aplicarMascaraNumericaInteira(selector){
      const input = $(selector);
      if (!input) return;

      input.addEventListener("input", () => {
        const somenteDigitos = input.value.replace(/\D+/g, "");
        if (input.value !== somenteDigitos) {
          input.value = somenteDigitos;
        }
      });

      input.addEventListener("paste", (event) => {
        event.preventDefault();
        const texto = event.clipboardData?.getData("text") || "";
        input.value = texto.replace(/\D+/g, "");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }

    function aplicarMascaraOrcamento(selector) {
      const input = $(selector);
      if (!input) return;

      input.addEventListener("input", () => {
        input.value = formatCurrencyWithDots(input.value);
      });

      input.addEventListener("paste", (event) => {
        event.preventDefault();
        const texto = event.clipboardData?.getData("text") || "";
        input.value = formatCurrencyWithDots(texto);
      });
    }

    function habilitarNavegacaoPorSetasNoFormulario() {
      const form = $("#formCadastro");
      if (!form) return;

      const campos = () => Array.from(form.querySelectorAll("input, select, textarea"))
        .filter((el) => !el.disabled && el.type !== "hidden" && el.id !== "metaAnual" && el.id !== "benefTotal");

      form.addEventListener("keydown", (event) => {
        if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(event.key)) return;
        const lista = campos();
        const index = lista.indexOf(event.target);
        if (index < 0) return;

        const nextIndex = (event.key === "ArrowRight" || event.key === "ArrowDown") ? index + 1 : index - 1;
        const destino = lista[nextIndex];
        if (!destino) return;

        event.preventDefault();
        destino.focus();
        if (typeof destino.select === "function" && destino.tagName === "INPUT") {
          destino.select();
        }
      });
    }

    function updateMetaAnual(){
      const total = ["#t1", "#t2", "#t3", "#t4"]
        .map((selector) => parsePositiveNumber($(selector).value))
        .reduce((acc, value) => acc + value, 0);

      $("#metaAnual").value = String(total);
    }

    function updateBeneficiariosTotal(){
      const total = parsePositiveNumber($("#benefH").value) + parsePositiveNumber($("#benefM").value);
      $("#benefTotal").value = String(total);
    }

    function updateOrcamentoTotal() {
      const valorEstado = parseCurrencyInputToNumber($("#orcamentoEstado").value);
      const valorExterno = parseCurrencyInputToNumber($("#orcamentoExterno").value);
      const total = valorEstado + valorExterno;
      $("#orcamento").value = formatCurrencyWithDots(Math.round(total * 100));
    }

    function obterFonteFinanciamento() {
      const valorEstado = parseCurrencyInputToNumber($("#orcamentoEstado").value);
      const valorExterno = parseCurrencyInputToNumber($("#orcamentoExterno").value);
      if (valorEstado > 0 && valorExterno > 0) return "OE+Externo";
      if (valorEstado > 0) return "OE";
      if (valorExterno > 0) return "Externo";
      return "OE";
    }

    ["#t1", "#t2", "#t3", "#t4", "#benefH", "#benefM"].forEach(aplicarMascaraNumericaInteira);
    aplicarMascaraOrcamento("#orcamentoEstado");
    aplicarMascaraOrcamento("#orcamentoExterno");
    habilitarNavegacaoPorSetasNoFormulario();

    document.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-page][data-tipo]");
      if (!btn) return;
      const { page, tipo } = btn.dataset;
      state.page[tipo] += page === "next" ? 1 : -1;
      render();
    });

    ["#t1", "#t2", "#t3", "#t4"].forEach((selector) => {
      $(selector).addEventListener("input", updateMetaAnual);
    });

    ["#benefH", "#benefM"].forEach((selector) => {
      $(selector).addEventListener("input", updateBeneficiariosTotal);
    });

    ["#orcamentoEstado", "#orcamentoExterno"].forEach((selector) => {
      $(selector).addEventListener("input", updateOrcamentoTotal);
    });

    updateOrcamentoTotal();

    // ---------------------------
    // Cadastro
    // ---------------------------
    $("#formCadastro").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const submitButton = form.querySelector('button[type="submit"]');
      const cadastroFeedback = $("#cadastroFeedback");

      if (cadastroFeedback) {
        cadastroFeedback.textContent = "";
        cadastroFeedback.classList.remove("is-error");
      }

      if (submitButton) {
        submitButton.classList.add("is-loading");
        submitButton.setAttribute("aria-busy", "true");
      }

      const a = {
        id: crypto.randomUUID(),
        num: String(state.cadastradas.length + state.executadas.length + state.canceladas.length + 1),
        area: $("#area").value,
        accao: $("#accao").value.trim(),
        obj: $("#obj").value.trim(),
        indicador: $("#indicador").value.trim(),
        metaAnual: $("#metaAnual").value.trim(),
        metas: { t1: $("#t1").value.trim(), t2: $("#t2").value.trim(), t3: $("#t3").value.trim(), t4: $("#t4").value.trim() },
        local: $("#local").value.trim(),
        benef: { total: $("#benefTotal").value.trim(), h: $("#benefH").value.trim(), m: $("#benefM").value.trim() },
        orcamento: parseCurrencyInputToNumber($("#orcamento").value.trim()).toFixed(2),
        fonte: obterFonteFinanciamento(),
        resp: $("#resp").value.trim(),
        inicio: $("#inicio").value,
        fim: $("#fim").value,
        nota: $("#nota").value.trim(),
        estado: "Planificada",
        motivo: "",
        evidenciasText: "",
        evidenciasCount: 0,
        createdAt: new Date().toISOString()
      };

      try {
        if (submitButton) submitButton.disabled = true;

        await enviarParaBackend(a);
        await carregarDoBackend();

        form.reset();
        $("#area").value = "Pós-Graduação";
        updateMetaAnual();
        updateBeneficiariosTotal();
        updateOrcamentoTotal();

        if (cadastroFeedback) {
          cadastroFeedback.textContent = "Dados enviados com sucesso!";
          cadastroFeedback.classList.remove("is-error");
        }
      } catch (err) {
        console.error(err);
        state.cadastradas = state.cadastradas.filter(x => x.id !== a.id);
        if (cadastroFeedback) {
          cadastroFeedback.textContent = "Erro ao gravar: " + (err?.message || "erro inesperado");
          cadastroFeedback.classList.add("is-error");
        }
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.classList.remove("is-loading");
          submitButton.removeAttribute("aria-busy");
        }
      }
    });

    // ---------------------------
    // Modal open/close
    // ---------------------------
    window.openModal = (id) => {
      const a = state.cadastradas.find(x => x.id === id) || state.executadas.find(x => x.id === id) || state.canceladas.find(x => x.id === id);
      if (!a) return;

      state.currentEdit = a;

      $("#mAccao").value = a.accao || "";
      $("#mInicio").value = a.inicio || "";
      $("#mFim").value = a.fim || "";
      $("#mEstado").value = a.estado === "Adiada" ? "Adiar" : (a.estado || "Planificada");
      $("#mMotivo").value = a.motivo || "";
      $("#mEvidenciaUrl").value = a.evidenciasText || "";
      $("#mFicheiros").value = "";
      $("#modalFeedback").textContent = "";
      $("#modalFeedback").classList.remove("is-error");
      $("#mInfo").textContent = `Actividade #${a.num} • ${a.area}`;

      $("#modalBackdrop").classList.add("show");
      $("#modalBackdrop").setAttribute("aria-hidden", "false");
      setTimeout(()=> $("#mAccao").focus(), 50);
    };

    function closeModal(){
      $("#modalBackdrop").classList.remove("show");
      $("#modalBackdrop").setAttribute("aria-hidden", "true");
      state.currentEdit = null;
    }
    $("#btnFechar").addEventListener("click", closeModal);
    $("#modalBackdrop").addEventListener("click", (e) => { if (e.target.id === "modalBackdrop") closeModal(); });
    function closeRelatorioModal(){
      const backdrop = $("#modalRelatorioBackdrop");
      if (!backdrop) return;
      backdrop.classList.remove("show");
      backdrop.setAttribute("aria-hidden", "true");
    }

    function actualizarAccoesRelatorio({ mostrar = false, url = "" } = {}) {
      const btnVerRelatorio = $("#btnVerRelatorioGerado");
      const btnEnviarDc = $("#btnEnviarRelatorioDc");

      relatorioGeradoUrl = mostrar ? (url || "") : "";

      if (btnVerRelatorio) {
        btnVerRelatorio.hidden = !mostrar;
        btnVerRelatorio.disabled = !relatorioGeradoUrl;
      }

      if (btnEnviarDc) {
        btnEnviarDc.hidden = !mostrar;
        btnEnviarDc.disabled = !mostrar;
        btnEnviarDc.textContent = "Enviar à DC";
      }
    }

    function openRelatorioModal(){
      const backdrop = $("#modalRelatorioBackdrop");
      if (!backdrop) return;
      const feedback = $("#relatorioFeedback");
      if (feedback) {
        feedback.textContent = "";
        feedback.classList.remove("is-error");
      }
      actualizarAccoesRelatorio({ mostrar: false });
      backdrop.classList.add("show");
      backdrop.setAttribute("aria-hidden", "false");
      setTimeout(() => $("#relatorioTipo")?.focus(), 50);
    }

    $("#btnGerarRelatorio")?.addEventListener("click", openRelatorioModal);
    $("#btnFecharRelatorio").addEventListener("click", closeRelatorioModal);
    $("#modalRelatorioBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "modalRelatorioBackdrop") closeRelatorioModal();
    });

    $("#btnVerRelatorioGerado")?.addEventListener("click", () => {
      if (!relatorioGeradoUrl) return;
      window.open(relatorioGeradoUrl, "_blank", "noopener,noreferrer");
    });

    $("#btnEnviarRelatorioDc")?.addEventListener("click", async () => {
      const feedback = $("#relatorioFeedback");
      const btnEnviarRelatorioDc = $("#btnEnviarRelatorioDc");

      try {
        const email = obterEmailUtilizador().trim().toLowerCase();
        if (!email) throw new Error("Sessão sem email.");

        const relatorioUrl = String(relatorioGeradoUrl || "").trim();
        if (!relatorioUrl) throw new Error("Relatório ainda não foi gerado.");

        if (feedback) {
          feedback.textContent = "A enviar à DC...";
          feedback.classList.remove("is-error");
        }

        const params = new URLSearchParams();
        params.set("operacao", "enviar_relatorio_dc");
        params.set("email", email);
        params.set("relatorioUrl", relatorioUrl);

        const data = await carregarJSONP(`${API_URL}?${params.toString()}`);
        if (!data?.sucesso) {
          throw new Error(data?.mensagem || "Erro ao enviar relatório");
        }

        if (feedback) {
          feedback.textContent = data.mensagem || "Enviado à DC com sucesso.";
          feedback.classList.remove("is-error");
        }

        if (btnEnviarRelatorioDc) {
          btnEnviarRelatorioDc.disabled = true;
          btnEnviarRelatorioDc.textContent = "Enviado";
        }
      } catch (err) {
        console.error(err);
        if (feedback) {
          feedback.textContent = err?.message || "Erro ao enviar relatório.";
          feedback.classList.add("is-error");
        }
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      closeModal();
      closeRelatorioModal();
      closeDocenteModal();
    });

    function openDocenteModal() {
      const backdrop = $("#modalDocenteBackdrop");
      if (!backdrop) return;
      const feedback = $("#docenteFeedback");
      if (feedback) {
        feedback.textContent = "";
        feedback.classList.remove("is-error");
      }
      $("#buscaDocente").value = "";
      renderSelectDocentes("");
      limparFormularioDocente();
      backdrop.classList.add("show");
      backdrop.setAttribute("aria-hidden", "false");
      setTimeout(() => $("#buscaDocente")?.focus(), 50);
    }

    function closeDocenteModal() {
      const backdrop = $("#modalDocenteBackdrop");
      if (!backdrop) return;
      backdrop.classList.remove("show");
      backdrop.setAttribute("aria-hidden", "true");
    }

    $("#btnCadastrarEditarDocente")?.addEventListener("click", openDocenteModal);
    $("#btnFecharDocente")?.addEventListener("click", closeDocenteModal);
    $("#modalDocenteBackdrop")?.addEventListener("click", (e) => {
      if (e.target.id === "modalDocenteBackdrop") closeDocenteModal();
    });

    $("#buscaDocente")?.addEventListener("input", (e) => {
      renderSelectDocentes(e.target.value);
    });

    $("#docenteSelecionado")?.addEventListener("change", (e) => {
      const id = e.target.value;
      if (!id) {
        limparFormularioDocente();
        return;
      }
      preencherFormularioDocente(id);
    });

    $("#btnGuardarDocente")?.addEventListener("click", () => {
      const feedback = $("#docenteFeedback");
      const nome = $("#docenteNome").value.trim();
      if (!nome) {
        feedback.textContent = "Informe o nome do docente.";
        feedback.classList.add("is-error");
        return;
      }

      const payload = {
        id: state.currentDocenteId || crypto.randomUUID(),
        nome,
        nivel: $("#docenteNivel").value.trim(),
        area: $("#docenteArea").value.trim(),
        formacao: $("#docenteFormacao").value.trim(),
        instituicao: $("#docenteInstituicao").value.trim(),
        pais: $("#docentePais").value.trim()
      };

      const idx = state.docentes.findIndex((d) => d.id === payload.id);
      if (idx >= 0) {
        state.docentes[idx] = payload;
      } else {
        state.docentes.unshift(payload);
      }

      guardarDocentesLocal();
      render();
      renderSelectDocentes($("#buscaDocente").value);
      preencherFormularioDocente(payload.id);
      feedback.textContent = idx >= 0 ? "Docente actualizado com sucesso." : "Docente cadastrado com sucesso.";
      feedback.classList.remove("is-error");
    });

    // ---------------------------
    // Modal save: move items between tabs
    // ---------------------------
    $("#btnGuardarModal").addEventListener("click", async () => {
      const a = state.currentEdit;
      if (!a) return;
      const modalFeedback = $("#modalFeedback");
      const btnGuardarModal = $("#btnGuardarModal");

      const novoEstado = $("#mEstado").value;
      const ficheirosInput = $("#mFicheiros").files || [];
      const ficheiros = ficheirosInput.length;
      const evidenciaUrlDigitada = $("#mEvidenciaUrl").value.trim();

      const payload = {
        operacao: "atualizar",
        id: a.id,
        acao: $("#mAccao").value.trim() || undefined,
        periodoInicio: $("#mInicio").value || undefined,
        periodoFim: $("#mFim").value || undefined,
        estado: novoEstado || undefined,
        motivo: $("#mMotivo").value.trim() || undefined,
        evidenciaUrl: evidenciaUrlDigitada || undefined
      };

      if (ficheirosInput[0]) {
        payload.evidencia = {
          nome: ficheirosInput[0].name,
          mimeType: ficheirosInput[0].type || "application/octet-stream",
          base64: await fileToBase64SemPrefixo(ficheirosInput[0])
        };
      }

      try {
        btnGuardarModal.disabled = true;
        btnGuardarModal.classList.add("is-loading");
        btnGuardarModal.setAttribute("aria-busy", "true");
        if (modalFeedback) {
          modalFeedback.textContent = "A actualizar actividade...";
          modalFeedback.classList.remove("is-error");
        }

        const data = await atualizarAtividade(payload);

        a.accao = payload.acao || a.accao;
        a.inicio = payload.periodoInicio || "";
        a.fim = payload.periodoFim || "";
        a.estado = novoEstado === "Adiada" ? "Adiar" : novoEstado;
        a.motivo = payload.motivo || "";
        a.evidenciasCount = ficheiros;
        a.evidenciasText = data.evidenciaUrl || payload.evidenciaUrl || a.evidenciasText || "";

        // Remover de qualquer lista e reenfileirar conforme estado
        removeFromAll(a.id);

        if (novoEstado === "Executada") state.executadas.unshift(a);
        else if (novoEstado === "Cancelada") state.canceladas.unshift(a);
        else state.cadastradas.unshift(a); // Planificada/Adiar ficam aqui

        if (modalFeedback) {
          modalFeedback.textContent = data.mensagem || "Actividade actualizada com sucesso.";
          modalFeedback.classList.remove("is-error");
        }

        closeModal();
        render();
      } catch (err) {
        console.error(err);
        if (modalFeedback) {
          modalFeedback.textContent = `Erro ao actualizar: ${err?.message || "erro inesperado"}`;
          modalFeedback.classList.add("is-error");
        }
      } finally {
        btnGuardarModal.disabled = false;
        btnGuardarModal.classList.remove("is-loading");
        btnGuardarModal.removeAttribute("aria-busy");
      }
    });

    function removeFromAll(id){
      state.cadastradas = state.cadastradas.filter(x => x.id !== id);
      state.executadas = state.executadas.filter(x => x.id !== id);
      state.canceladas = state.canceladas.filter(x => x.id !== id);
    }

    function normalizarOpcaoRelatorioFront_(tipo) {
      const t = String(tipo || "").trim().toLowerCase();

      if (t.startsWith("toda")) return "Todas";
      if (t.startsWith("execut")) return "Executadas";
      if (t.startsWith("planif")) return "Planificadas";
      if (t.startsWith("cancel")) return "Canceladas";

      return tipo;
    }

    async function gerarRelatorioViaAPI({ tipo, inicio, fim, formato }) {
      const feedback = $("#relatorioFeedback");

      console.log("relatorioTipo.value =", tipo);

      const formatoBack = (formato === "xls") ? "xlsx" : formato;
      const porPeriodo = Boolean(inicio && fim);

      const emailUtilizador = obterEmailUtilizador();
      const formatoSelecionado = formatoBack;
      const opcaoSelecionada = normalizarOpcaoRelatorioFront_(tipo);
      const usarPeriodo = porPeriodo;
      const dataInicio = porPeriodo ? inicio : "";
      const dataFim = porPeriodo ? fim : "";
      const tituloRelatorio = "Relatório de Actividades";

      let data;
      try {
        const payload = new URLSearchParams({
          operacao: "gerar_relatorio",
          email: emailUtilizador,
          formato: formatoSelecionado,
          opcao: opcaoSelecionada,
          porPeriodo: String(usarPeriodo),
          dataInicio: dataInicio || "",
          dataFim: dataFim || "",
          titulo: tituloRelatorio,
          __origin: window.location.origin
        });

        const resp = await fetch(API_URL, {
          method: "POST",
          body: payload
        });

        data = await resp.json();

        if (!data?.ficheiro?.url) {
          throw new Error("Sem ficheiro.url");
        }
      } catch (err) {
        if (feedback) {
          feedback.textContent = "Falha de rede ao gerar relatório. Verifica a ligação e tenta novamente.";
          feedback.classList.add("is-error");
        }
        console.error(err);
        return;
      }

      if (!data || data.sucesso !== true) {
        const msg = (data && data.mensagem) ? data.mensagem : "Erro ao gerar relatório";
        if (feedback) {
          feedback.textContent = msg;
          feedback.classList.add("is-error");
        }
        console.error("Erro ao gerar relatório:", data);
        return;
      }

      const fileUrl = data.ficheiro.url;

      if (feedback) {
        feedback.textContent = "Relatório gerado com sucesso.";
        feedback.classList.remove("is-error");
      }

      actualizarAccoesRelatorio({ mostrar: true, url: fileUrl });
    }

    // ---------------------------
    // Relatório
    // ---------------------------
    $("#btnGerarRelatorioModal").addEventListener("click", async () => {
      const tipo = $("#relatorioTipo").value;
      const inicio = $("#relatorioInicio").value;
      const fim = $("#relatorioFim").value;
      const formato = $("#relatorioFormato").value;
      const feedback = $("#relatorioFeedback");

      if (inicio && fim && inicio > fim) {
        if (feedback) {
          feedback.textContent = "O período é inválido: a data de início deve ser anterior ou igual à data de fim.";
          feedback.classList.add("is-error");
        }
        return;
      }

      if (feedback) {
        const formatoLabel = formato === "xls" ? "Xls" : (formato === "doc" ? ".doc" : "PDF");
        feedback.textContent = `A gerar relatório (${formatoLabel})...`;
        feedback.classList.remove("is-error");
      }

      await gerarRelatorioViaAPI({ tipo, inicio, fim, formato });
    });

    function filtrarActividadesRelatorio(tipo){
      if (tipo === "Planificada") return state.cadastradas.filter(a => a.estado === "Planificada");
      if (tipo === "Cancelada") return state.canceladas;
      if (tipo === "Todas") return [...state.cadastradas, ...state.executadas, ...state.canceladas];
      return state.executadas;
    }

    function dentroDoPeriodo(atividade, inicio, fim){
      const inicioAtividade = atividade.inicio || "";
      const fimAtividade = atividade.fim || "";
      if (inicio && fimAtividade && fimAtividade < inicio) return false;
      if (fim && inicioAtividade && inicioAtividade > fim) return false;
      return true;
    }

    function gerarRelatorioImprimivel(opcoes = {}){
      const tipo = opcoes.tipo || "Executada";
      const inicio = opcoes.inicio || "";
      const fim = opcoes.fim || "";
      const formato = opcoes.formato || "pdf";
      const atividades = filtrarActividadesRelatorio(tipo).filter((a) => dentroDoPeriodo(a, inicio, fim));

      const rows = atividades.map(a => `
        <tr>
          <td>${escapeHtml(a.num)}</td>
          <td>${escapeHtml(a.area)}</td>
          <td>${escapeHtml(a.accao)}</td>
          <td>${escapeHtml(fmtPeriodo(a.inicio, a.fim))}</td>
          <td>${escapeHtml(a.resp || "—")}</td>
          <td>${escapeHtml(fmtMoney(a.orcamento))}</td>
          <td>${escapeHtml((a.evidenciasText || "").trim() || ((a.evidenciasCount||0) ? (a.evidenciasCount + " evidência(s)") : "—"))}</td>
        </tr>
      `).join("");

      const w = window.open("", "_blank");
      const tituloTipo =
        tipo === "Planificada" ? "Actividades Planificadas"
        : tipo === "Cancelada" ? "Actividades Canceladas"
        : tipo === "Todas" ? "Todas as Actividades"
        : "Actividades Executadas";
      const periodoTexto = inicio || fim
        ? `${inicio ? new Date(inicio).toLocaleDateString("pt-PT") : "—"} → ${fim ? new Date(fim).toLocaleDateString("pt-PT") : "—"}`
        : "Todos os períodos";
      const formatoTexto = formato === "xls" ? "Xls" : (formato === "doc" ? ".doc" : "PDF");

      w.document.write(`
        <!doctype html>
        <html lang="pt-PT">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Relatório — ${tituloTipo} (SIGAC)</title>
          <style>
            body{ font-family: Arial, sans-serif; margin: 24px; color:#111827; }
            h1{ font-size: 16px; margin:0; }
            h2{ font-size: 13px; font-weight: normal; margin:6px 0 18px; color:#374151; }
            table{ width:100%; border-collapse: collapse; }
            th, td{ border:1px solid #d1d5db; padding:8px; font-size: 12px; vertical-align: top; }
            th{ background:#f3f4f6; text-align:left; }
            .meta{ margin: 10px 0 14px; font-size: 12px; color:#374151; }
            .foot{ margin-top: 12px; font-size: 11px; color:#6b7280; }
            @media print { button{ display:none; } }
          </style>
        </head>
        <body>
          <h1>Universidade Rovuma — Direcção Científica</h1>
          <h2>Relatório de ${tituloTipo} (SIGAC) • Faculdade: FACEE • Ano lectivo: 2026</h2>
          <div class="meta">Período: <strong>${periodoTexto}</strong> • Tipo de ficheiro seleccionado: <strong>${formatoTexto}</strong></div>
          <div class="meta">Total de actividades: <strong>${atividades.length}</strong></div>
          <table>
            <thead>
              <tr>
                <th>Nº</th><th>Área</th><th>Acção</th><th>Período</th><th>Responsável</th><th>Orçamento</th><th>Evidências</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="7">Sem registos para os filtros seleccionados.</td></tr>`}</tbody>
          </table>
          <div class="foot">Gerado pelo SIGAC (demo). Para exportar em PDF, use “Imprimir” do navegador.</div>
          <button onclick="window.print()">Imprimir / Guardar em PDF</button>
        </body>
        </html>
      `);
      w.document.close();
    }

    // Start
    carregarDocentesLocal();
    render();
  
