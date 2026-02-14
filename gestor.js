    import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
    import { EMAILS_POR_FACULDADE, normalizarEmail } from "./autorizacao.js";
    import { auth } from "./firebase-init.js";
    import { fetchComToken } from "./authFetch.js";

    const API_URL = "https://script.google.com/macros/s/AKfycbz2uYJ7708eNcCnHonI6i0a0YQA2GiyrVId6hOO4lwuQiFyg9nlLH4FSUF7uqQNErnt_Q/exec";

    // Mapa de faculdade -> email esperado pelo backend
    const EMAIL_POR_FACULDADE = Object.fromEntries(
      Object.entries(EMAILS_POR_FACULDADE).map(([email, faculdade]) => [faculdade, email])
    );

    let EMAIL_ATUAL = "";

    function obterEmailSessao_() {
      return normalizarEmail(auth.currentUser?.email || EMAIL_ATUAL);
    }

    function isDC_(email) {
      return normalizarEmail(email) === "dc@unirovuma.ac.mz";
    }

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

    function atualizarContextoUtilizador() {
      const el = document.getElementById("ctx");
      if (!el) return;

      el.textContent = "Utilizador: dc@unirovuma.ac.mz • Ano lectivo: 2026 Sessão: DC.";
    }

    function atualizarContextoFaculdade() {
      const el = document.getElementById("ctx");
      if (!el) return;
      el.textContent = "Utilizador: dc@unirovuma.ac.mz • Ano lectivo: 2026 Sessão: DC.";
    }

    function setCtxLoading(isLoading, faculdade = "") {
      const status = document.getElementById("statusCarregamento");
      if (!status) return;
      status.textContent = isLoading ? `A carregar dados de ${faculdade || "faculdade"}...` : "";
    }

    function preencherFiltroFaculdades() {
      const filtro = document.getElementById("filtroFaculdade");
      if (!filtro) return;

      const faculdades = [...new Set(Object.values(EMAILS_POR_FACULDADE))].sort();
      filtro.innerHTML = faculdades
        .map((faculdade) => `<option value="${escapeHtml(faculdade)}">${escapeHtml(faculdade)}</option>`)
        .join("");
      filtro.value = "DC";
    }

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }

      EMAIL_ATUAL = normalizarEmail(user.email);
      if (EMAIL_ATUAL !== "dc@unirovuma.ac.mz") {
        await signOut(auth);
        window.location.href = "index.html";
        return;
      }

      atualizarContextoUtilizador();
      preencherFiltroFaculdades();
      esconderAuthGate();

      carregarDoBackend().catch(console.error);
    });

    document.getElementById("btnAplicarFiltroFaculdade")?.addEventListener("click", async () => {
      try {
        const faculdade = document.getElementById("filtroFaculdade")?.value || "";
        if (!faculdade) {
          alert("Seleccione uma faculdade.");
          return;
        }

        atualizarContextoFaculdade(faculdade);

        const emailFaculdade = EMAIL_POR_FACULDADE[faculdade];
        if (!emailFaculdade) {
          alert("Email da faculdade não configurado no front.");
          return;
        }

        state.emailParaBackend = emailFaculdade;
        setCtxLoading(true, faculdade);

        await carregarDoBackend();
      } catch (err) {
        console.error(err);
        alert("Erro ao carregar dados.");
      } finally {
        setCtxLoading(false);
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

    async function parseBackendResponse(res) {
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.sucesso !== true) {
        console.log("RESPOSTA API ->", data);
        const detalhes = (data && (data.erros ? data.erros.join(" | ") : data.mensagem))
          || (data && data.httpStatus ? `HTTP ${data.httpStatus}` : `HTTP ${res.status}`);
        throw new Error(detalhes);
      }
      return data;
    }

    async function enviarParaBackend(a) {
      const payload = normalizarParaAPI(a);
      console.log("PAYLOAD cadastro ->", payload);

      const res = await fetchComToken(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });

      return parseBackendResponse(res);
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

      const res = await fetchComToken(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });

      return parseBackendResponse(res);
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
        estado: item.estado,
        motivo: item.motivo,
        evidenciasText: item.linkEvidencias || "",
        evidenciasCount: item.linkEvidencias ? 1 : 0,
        createdAt: item.dataRegisto
      };
    }

    async function carregarDoBackend(estado) {
      const emailAtual = obterEmailUtilizador();
      const email = state.emailParaBackend || emailAtual;
      // TODO Nível 2: backend deve ignorar email do cliente e usar apenas o token validado.
      const params = new URLSearchParams({ email });
      if (estado) params.set("estado", estado);

      const url = `${API_URL}?${params.toString()}`;
      console.log("GET listar ->", url);

      const res = await fetchComToken(url);

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.sucesso !== true || !Array.isArray(data.dados)) {
        console.log("RESPOSTA listar ->", data);
        throw new Error((data && data.mensagem) || `HTTP ${res.status}`);
      }

      if (data.sheet) {
        const filtro = document.getElementById("filtroFaculdade");
        if (filtro) filtro.value = data.sheet;
        atualizarContextoFaculdade(data.sheet);
      }

      // limpar arrays sempre que recarrega
      state.cadastradas = [];
      state.executadas = [];
      state.canceladas = [];

      data.dados.forEach((item, idx) => {
        const a = normalizarDoBackend(item, idx);
        const estadoNormalizado = String(item.estado || "").trim().toLowerCase();

        // Se pedimos um estado específico, encher só o array correspondente
        if (estado === "Executada") {
          if (estadoNormalizado === "executada") state.executadas.unshift(a);
          return;
        }
        if (estado === "Cancelada") {
          if (estadoNormalizado === "cancelada") state.canceladas.unshift(a);
          return;
        }

        // modo geral (sem filtro)
        if (estadoNormalizado === "planificada") state.cadastradas.unshift(a);
        else if (estadoNormalizado === "executada") state.executadas.unshift(a);
        else if (estadoNormalizado === "cancelada") state.canceladas.unshift(a);
        else state.cadastradas.unshift(a);
      });

      render();
    }

    async function carregarRelatoriosEnviadosDC_() {
      const email = obterEmailSessao_();
      const tbody = document.getElementById("tbodyRelatoriosDc");
      const msgEl = document.getElementById("relatoriosDcMsg");
      if (!tbody) return;

      if (!isDC_(email)) {
        mostrarSemPermissaoRelatorios_();
        return;
      }

      tbody.innerHTML = `<tr><td colspan="4" class="muted loading-cell">A carregar<span class="loading-dots" aria-hidden="true">....</span></td></tr>`;
      if (msgEl) msgEl.textContent = "";

      // TODO Nível 2: backend deve ignorar email do cliente e usar apenas o token validado.
      const url = `${API_URL}?op=listar_relatorios_dc&email=${encodeURIComponent(email)}`;
      console.log("URL Relatórios DC:", url);
      let data;

      try {
        const resp = await fetchComToken(url, { method: "GET" });
        data = await resp.json();
      } catch (_) {
        if (msgEl) msgEl.textContent = "Falha ao carregar relatórios.";
        return;
      }

      if (!data?.sucesso) {
        if (msgEl) msgEl.textContent = data?.mensagem || "Erro ao carregar relatórios.";
        return;
      }

      const dados = Array.isArray(data.dados) ? data.dados : [];
      if (!dados.length) {
        if (msgEl) msgEl.textContent = "Nenhum registo encontrado.";
        return;
      }

      tbody.innerHTML = dados.map((item) => {
        const ord = escapeHtml_(item.ord ?? "");
        const unidade = escapeHtml_(item.unidadeOrganica ?? "");
        const urlPdf = String(item.url || "").trim();
        const dataEnvio = escapeHtml_(String(item.dataEnvio || "").trim());

        const relatorioHtml = urlPdf
          ? `<a href="${escapeHtml_(urlPdf)}" target="_blank" rel="noopener" class="pdf-link" title="Abrir PDF"><span class="pdf-ico" aria-label="PDF">📕</span></a>`
          : `<span class="nao-enviado">Não enviado</span>`;

        return `
          <tr>
            <td>${ord}</td>
            <td>${unidade}</td>
            <td>${relatorioHtml}</td>
            <td>${dataEnvio}</td>
          </tr>
        `;
      }).join("");

      if (msgEl) msgEl.textContent = "";
    }

    function mostrarSemPermissaoRelatorios_() {
      const msgEl = document.getElementById("relatoriosDcMsg");
      const tbody = document.getElementById("tbodyRelatoriosDc");
      if (tbody) tbody.innerHTML = "";
      if (msgEl) msgEl.textContent = "Sem permissão.";
    }

    // ---------------------------
    const state = {
      cadastradas: [],
      executadas: [],
      canceladas: [],
      emailParaBackend: null,
      currentEdit: null
    };

    const $ = (s) => document.querySelector(s);
    const parsePositiveNumber = (value) => {
      const sanitized = String(value || "").replace(",", ".").trim();
      const n = Number(sanitized);
      return Number.isFinite(n) && n > 0 ? n : 0;
    };
    const fmtMoney = (v) => {
      const n = Number(String(v || "0").replace(",", "."));
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

    function getRowClassByEstado(estado) {
      if (estado === "Executada") return "status-row status-row-executada";
      if (estado === "Cancelada" || estado === "Atrasada") return "status-row status-row-cancelada";
      if (estado === "Planificada") return "status-row status-row-planificada";
      return "status-row";
    }

    function render(){
      renderEmptyRow("#tbCadastradas", state.cadastradas.length, "Sem registos planificados.");
      renderEmptyRow("#tbExecutadas", state.executadas.length, "Sem registos executados.");
      renderEmptyRow("#tbCanceladas", state.canceladas.length, "Sem registos cancelados.");

      // Cadastradas
      if (state.cadastradas.length) {
      $("#tbCadastradas").innerHTML = state.cadastradas.map((a, idx) => {
        const estadoVisual = getEstadoVisual(a);
        return `
        <tr class="${getRowClassByEstado(estadoVisual)}">
          <td><strong>${idx + 1}</strong></td>
          <td>${renderAreaTag(a.area)}</td>
          <td><div style="font-weight:900">${escapeHtml(a.accao)}</div></td>
          <td>${escapeHtml(a.local || "—")}</td>
          <td class="periodo-cell">${renderPeriodoComAlerta(a)}</td>
          <td>${fmtMoney(a.orcamento)}</td>
          <td>${chipEstado(estadoVisual)}</td>
        </tr>
      `;
      }).join("");
      }

      // Executadas
      if (state.executadas.length) {
      $("#tbExecutadas").innerHTML = state.executadas.map((a, idx) => `
        <tr class="${getRowClassByEstado("Executada")}">
          <td><strong>${idx + 1}</strong></td>
          <td>${renderAreaTag(a.area)}</td>
          <td>
            <div style="font-weight:900">${escapeHtml(a.accao)}</div>
          </td>
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

      // Canceladas
      if (state.canceladas.length) {
      $("#tbCanceladas").innerHTML = state.canceladas.map((a, idx) => `
        <tr class="${getRowClassByEstado("Cancelada")}">
          <td><strong>${idx + 1}</strong></td>
          <td>${renderAreaTag(a.area)}</td>
          <td>
            <div style="font-weight:900">${escapeHtml(a.accao)}</div>
          </td>
          <td class="periodo-cell">${fmtPeriodo(a.inicio, a.fim)}</td>
          <td>${escapeHtml(a.motivo || "—")}</td>
          <td>${chipEstado("Cancelada")}</td>
        </tr>
      `).join("");
      }

      const orcamentoExecutado = state.executadas.reduce((total, atividade) => {
        return total + parsePositiveNumber(atividade.orcamento);
      }, 0);

      const statPlanificadas = document.getElementById("statPlanificadas");
      const statExecutadas = document.getElementById("statExecutadas");
      const statCanceladas = document.getElementById("statCanceladas");
      const statOrcamento = document.getElementById("statOrcamento");

      if (statPlanificadas) statPlanificadas.value = String(state.cadastradas.length);
      if (statExecutadas) statExecutadas.value = String(state.executadas.length);
      if (statCanceladas) statCanceladas.value = String(state.canceladas.length);
      if (statOrcamento) statOrcamento.value = fmtMoney(orcamentoExecutado);

    }

    function renderEmptyRow(selector, total, mensagem) {
      if (total > 0) return;
      const tbody = $(selector);
      if (!tbody) return;

      const colSpanBySelector = {
        "#tbCadastradas": 7,
        "#tbExecutadas": 7,
        "#tbCanceladas": 6
      };
      const colSpan = colSpanBySelector[selector] || 1;
      tbody.innerHTML = `<tr><td colspan="${colSpan}" class="muted">${escapeHtml(mensagem)}</td></tr>`;
    }

    function escapeHtml(str){
      return String(str || "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
    }

    function escapeHtml_(str){
      return escapeHtml(str);
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
        switchTab(tab);

        try {
          if (tab === "canceladas") {
            await carregarDoBackend("Cancelada");
          } else if (tab === "executadas") {
            await carregarDoBackend("Executada");
          } else if (tab === "cadastradas" || tab === "estatisticas") {
            await carregarDoBackend();
          } else if (tab === "relatorios-enviados") {
            await carregarRelatoriosEnviadosDC_();
          }
        } catch (err) {
          console.error(err);
          if (tab === "relatorios-enviados") {
            const msgEl = document.getElementById("relatoriosDcMsg");
            if (msgEl) msgEl.textContent = (err && err.message) ? err.message : "Erro ao carregar relatórios.";
          }
        }
      });
    });

    switchTab("cadastradas");

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

    ["#t1", "#t2", "#t3", "#t4", "#benefH", "#benefM"].forEach(aplicarMascaraNumericaInteira);

    ["#t1", "#t2", "#t3", "#t4"].forEach((selector) => {
      $(selector)?.addEventListener("input", updateMetaAnual);
    });

    ["#benefH", "#benefM"].forEach((selector) => {
      $(selector)?.addEventListener("input", updateBeneficiariosTotal);
    });

    // ---------------------------
    // Cadastro
    // ---------------------------
    $("#formCadastro")?.addEventListener("submit", async (e) => {
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
        orcamento: $("#orcamento").value.trim(),
        fonte: $("#fonte").value,
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
        $("#fonte").value = "OE";
        updateMetaAnual();
        updateBeneficiariosTotal();

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
      $("#mEstado").value = a.estado || "Planificada";
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

    function openRelatorioModal(){
      const backdrop = $("#modalRelatorioBackdrop");
      if (!backdrop) return;
      const feedback = $("#relatorioFeedback");
      if (feedback) {
        feedback.textContent = "";
        feedback.classList.remove("is-error");
      }
      backdrop.classList.add("show");
      backdrop.setAttribute("aria-hidden", "false");
      setTimeout(() => $("#relatorioTipo")?.focus(), 50);
    }

    $("#btnGerarRelatorio")?.addEventListener("click", openRelatorioModal);
    $("#btnFecharRelatorio")?.addEventListener("click", closeRelatorioModal);
    $("#modalRelatorioBackdrop")?.addEventListener("click", (e) => {
      if (e.target.id === "modalRelatorioBackdrop") closeRelatorioModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      closeModal();
      closeRelatorioModal();
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
        a.estado = novoEstado;
        a.motivo = payload.motivo || "";
        a.evidenciasCount = ficheiros;
        a.evidenciasText = data.evidenciaUrl || payload.evidenciaUrl || a.evidenciasText || "";

        // Remover de qualquer lista e reenfileirar conforme estado
        removeFromAll(a.id);

        if (novoEstado === "Executada") state.executadas.unshift(a);
        else if (novoEstado === "Cancelada") state.canceladas.unshift(a);
        else state.cadastradas.unshift(a); // Planificada/Adiada ficam aqui

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

      const payload = {
        operacao: "gerar_relatorio",
        email: obterEmailUtilizador(),
        formato: formatoBack,
        opcao: normalizarOpcaoRelatorioFront_(tipo),
        porPeriodo,
        dataInicio: porPeriodo ? inicio : undefined,
        dataFim: porPeriodo ? fim : undefined,
        titulo: "Relatório de Actividades"
      };

      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

      let res;
      let data;
      try {
        res = await fetchComToken(API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload)
        });

        const txt = await res.text();
        data = JSON.parse(txt);
      } catch (err) {
        if (feedback) {
          feedback.textContent = "Falha de rede ao gerar relatório. Verifica a ligação e tenta novamente.";
          feedback.classList.add("is-error");
        }
        console.error(err);
        return;
      }

      if (!res.ok || !data || data.sucesso !== true) {
        const msg = (data && data.mensagem) ? data.mensagem : `Erro HTTP ${res.status}`;
        if (feedback) {
          feedback.textContent = msg;
          feedback.classList.add("is-error");
        }
        console.error("Erro ao gerar relatório:", data);
        return;
      }

      const fileUrl = data?.ficheiro?.url;
      if (!fileUrl) {
        if (feedback) {
          feedback.textContent = "Relatório gerado, mas não foi devolvido o link do ficheiro.";
          feedback.classList.add("is-error");
        }
        console.error("Sem ficheiro.url:", data);
        return;
      }

      if (feedback) {
        feedback.textContent = "Relatório gerado com sucesso. A abrir...";
        feedback.classList.remove("is-error");
      }

      window.open(fileUrl, "_blank", "noopener,noreferrer");
      closeRelatorioModal();
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
    render();
  
