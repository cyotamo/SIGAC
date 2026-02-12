    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
    import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
    import { EMAILS_POR_FACULDADE, emailAutorizado, faculdadePorEmail, normalizarEmail } from "./autorizacao.js";

    const API_URL = "https://script.google.com/macros/s/AKfycby6p9tqSV9FxD7L0I8VbLsrTbMRupMq9Ump-hXF8k415qL2K45PAjmxwi0QvYhXFQT5Mw/exec";

    const firebaseConfig = {
      apiKey: "AIzaSyC-z5eNHi-rosi0Ak64bPeQZU-6oJA9DDk",
      authDomain: "sigacur00.firebaseapp.com",
      projectId: "sigacur00",
      storageBucket: "sigacur00.firebasestorage.app",
      messagingSenderId: "224944945440",
      appId: "1:224944945440:web:743589f8f137d25d44ff45"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    let EMAIL_ATUAL = "";

    function obterEmailUtilizador() {
      const email = normalizarEmail(auth.currentUser?.email || EMAIL_ATUAL);
      if (!email) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }
      return email;
    }

    function guardarContextoLogin(contexto = {}) {
      Object.entries(contexto).forEach(([chave, valor]) => {
        localStorage.setItem(chave, String(valor ?? ""));
      });
    }

    function obterContextoLogin(email, faculdadeOverride) {
      const emailNormalizado = normalizarEmail(email);
      const faculdadeGuardada = localStorage.getItem("faculdade") || "";
      const anoLectivoGuardado = localStorage.getItem("anoLectivo") || "2026";
      const utilizadorGuardado = normalizarEmail(localStorage.getItem("utilizador") || emailNormalizado);
      const seccaoGuardada = localStorage.getItem("seccao") || "";

      const faculdade = faculdadeOverride || faculdadeGuardada || faculdadePorEmail(emailNormalizado) || "N/D";
      const contexto = {
        faculdade,
        anoLectivo: anoLectivoGuardado,
        utilizador: utilizadorGuardado || emailNormalizado,
        seccao: seccaoGuardada || faculdade
      };

      guardarContextoLogin(contexto);
      return contexto;
    }

    function atualizarContextoUtilizador(email) {
      const el = document.getElementById("ctx");
      if (!el) return;

      const contexto = obterContextoLogin(email);
      el.textContent = `Faculdade: ${contexto.faculdade} • Ano lectivo: ${contexto.anoLectivo} • Utilizador: ${contexto.utilizador} • Secção: ${contexto.seccao}`;
    }

    function atualizarContextoFaculdade(nomeFaculdade) {
      const el = document.getElementById("ctx");
      if (!el) return;

      const contexto = obterContextoLogin(obterEmailUtilizador(), nomeFaculdade || undefined);
      el.textContent = `Faculdade: ${contexto.faculdade} • Ano lectivo: ${contexto.anoLectivo} • Utilizador: ${contexto.utilizador} • Secção: ${contexto.seccao}`;
    }

    function preencherFiltroFaculdades() {
      const filtro = document.getElementById("filtroFaculdade");
      if (!filtro) return;

      const faculdades = [...new Set(Object.values(EMAILS_POR_FACULDADE))].sort();
      filtro.innerHTML = faculdades
        .map((faculdade) => `<option value="${escapeHtml(faculdade)}">${escapeHtml(faculdade)}</option>`)
        .join("");

      const faculdadeAtual = faculdadePorEmail(EMAIL_ATUAL);
      if (faculdadeAtual) {
        filtro.value = faculdadeAtual;
      }
    }

    onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }

      EMAIL_ATUAL = normalizarEmail(user.email);
      if (!emailAutorizado(EMAIL_ATUAL)) {
        signOut(auth).finally(() => {
          window.location.href = "index.html";
        });
        return;
      }

      if (EMAIL_ATUAL) {
        atualizarContextoUtilizador(EMAIL_ATUAL);
        preencherFiltroFaculdades();
        carregarDoBackend().catch(console.error);
      }
    });

    document.getElementById("btnAplicarFiltroFaculdade")?.addEventListener("click", () => {
      const faculdade = document.getElementById("filtroFaculdade")?.value || "";
      atualizarContextoFaculdade(faculdade);
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

      const res = await fetch(API_URL, {
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

      const res = await fetch(API_URL, {
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
      const email = obterEmailUtilizador();
      const params = new URLSearchParams({ email });
      if (estado) params.set("estado", estado);

      const url = `${API_URL}?${params.toString()}`;
      console.log("GET listar ->", url);

      const res = await fetch(url);

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.sucesso !== true || !Array.isArray(data.dados)) {
        console.log("RESPOSTA listar ->", data);
        throw new Error((data && data.mensagem) || `HTTP ${res.status}`);
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

    function chipEstado(estado){
      if (estado === "Executada") return `<span class="chip ok">● ${estado}</span>`;
      if (estado === "Cancelada") return `<span class="chip bad">● ${estado}</span>`;
      if (estado === "Adiada") return `<span class="chip warn">● ${estado}</span>`;
      return `<span class="chip">● ${estado}</span>`;
    }
    function render(){
      // Cadastradas
      $("#tbCadastradas").innerHTML = state.cadastradas.map(a => `
        <tr>
          <td><strong>${a.num}</strong></td>
          <td>${a.area}</td>
          <td>
            <div style="font-weight:900">${escapeHtml(a.accao)}</div>
            <div class="muted">${escapeHtml(a.indicador || "")}</div>
          </td>
          <td>${fmtPeriodo(a.inicio, a.fim)}</td>
          <td>${fmtMoney(a.orcamento)}</td>
          <td>${a.fonte || "—"}</td>
          <td>${chipEstado(a.estado)}</td>
          <td>
            <button class="btn-sm" onclick="openModal('${a.id}')">Editar / Estado</button>
          </td>
        </tr>
      `).join("");

      // Executadas
      $("#tbExecutadas").innerHTML = state.executadas.map(a => `
        <tr>
          <td><strong>${a.num}</strong></td>
          <td>${a.area}</td>
          <td>
            <div style="font-weight:900">${escapeHtml(a.accao)}</div>
            <div class="muted">${escapeHtml(a.obj || "")}</div>
          </td>
          <td>${fmtPeriodo(a.inicio, a.fim)}</td>
          <td>${escapeHtml(a.resp || "—")}</td>
          <td>
            ${a.evidenciasText
              ? `<a href="${escapeHtml(a.evidenciasText)}" target="_blank" rel="noopener noreferrer">Ver evidência</a>`
              : ((a.evidenciasCount || 0) > 0 ? `<span class="chip ok">📎 ${a.evidenciasCount}</span>` : `<span class="chip">—</span>`)}
          </td>
          <td>${chipEstado("Executada")}</td>
        </tr>
      `).join("");

      // Canceladas
      $("#tbCanceladas").innerHTML = state.canceladas.map(a => `
        <tr>
          <td><strong>${a.num}</strong></td>
          <td>${a.area}</td>
          <td>
            <div style="font-weight:900">${escapeHtml(a.accao)}</div>
            <div class="muted">${escapeHtml(a.indicador || "")}</div>
          </td>
          <td>${fmtPeriodo(a.inicio, a.fim)}</td>
          <td>${escapeHtml(a.motivo || "—")}</td>
          <td>${chipEstado("Cancelada")}</td>
        </tr>
      `).join("");

      // Relatório (executadas)
      $("#tbRelatorio").innerHTML = state.executadas.map(a => `
        <tr>
          <td><strong>${a.num}</strong></td>
          <td>${a.area}</td>
          <td>${escapeHtml(a.accao)}</td>
          <td>${fmtPeriodo(a.inicio, a.fim)}</td>
          <td>${escapeHtml(a.resp || "—")}</td>
          <td>${fmtMoney(a.orcamento)}</td>
          <td>${(a.evidenciasText || "").trim() ? escapeHtml(a.evidenciasText) : ((a.evidenciasCount||0) ? `${a.evidenciasCount} ficheiro(s)` : "—")}</td>
        </tr>
      `).join("");

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
        switchTab(tab);

        try {
          if (tab === "canceladas") {
            await carregarDoBackend("Cancelada");
          } else if (tab === "executadas") {
            await carregarDoBackend("Executada");
          } else if (tab === "cadastradas") {
            await carregarDoBackend();
          } else if (tab === "estatisticas") {
            await carregarDoBackend();
          } else if (tab === "relatorios-enviados") {
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
      $(selector).addEventListener("input", updateMetaAnual);
    });

    ["#benefH", "#benefM"].forEach((selector) => {
      $(selector).addEventListener("input", updateBeneficiariosTotal);
    });

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

    $("#btnGerarRelatorio").addEventListener("click", openRelatorioModal);
    $("#btnFecharRelatorio").addEventListener("click", closeRelatorioModal);
    $("#modalRelatorioBackdrop").addEventListener("click", (e) => {
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
        res = await fetch(API_URL, {
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
  
