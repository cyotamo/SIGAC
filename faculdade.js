    const API_URL = "https://script.google.com/macros/s/AKfycbxh13QZ0OfmMWdZHFCDv7KYrfFUb8xKdjLJN2gdzDx53al7Y56NM8K9y8ttoXLsQatb/exec";

    // ---------------------------
    // DEMO DATA / STATE
    function normalizarParaAPI(a) {
      return {
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

    async function enviarParaBackend(a) {
      const payload = normalizarParaAPI(a);
      console.log("PAYLOAD ->", payload);

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.sucesso !== true) {
        console.log("RESPOSTA API ->", data);
        const detalhes = (data && (data.erros ? data.erros.join(" | ") : data.mensagem)) || `HTTP ${res.status}`;
        throw new Error(detalhes);
      }

      return data;
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
      const url = estado ? `${API_URL}?estado=${encodeURIComponent(estado)}` : API_URL;

      const res = await fetch(url, { method: "GET" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.sucesso !== true || !Array.isArray(data.dados)) {
        console.log("RESPOSTA GET ->", data);
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
          <td>${(a.evidenciasCount || 0) > 0 ? `<span class="chip ok">📎 ${a.evidenciasCount}</span>` : `<span class="chip">—</span>`}</td>
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
          } else if (tab === "relatorio") {
            await carregarDoBackend();
          }
        } catch (err) {
          console.error(err);
        }
      });
    });

    $("#btnRelatorioTopo").addEventListener("click", () => switchTab("relatorio"));

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
      $("#mFicheiros").value = "";
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
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

    // ---------------------------
    // Modal save: move items between tabs
    // ---------------------------
    $("#btnGuardarModal").addEventListener("click", () => {
      const a = state.currentEdit;
      if (!a) return;

      const novoEstado = $("#mEstado").value;
      const ficheiros = $("#mFicheiros").files?.length || 0;

      a.inicio = $("#mInicio").value;
      a.fim = $("#mFim").value;
      a.estado = novoEstado;
      a.motivo = $("#mMotivo").value.trim();
      // Nota: mudança de estado/evidências no modal ainda não persiste no Sheets.
      // O backend actual só faz appendRow; o update por id será feito num próximo endpoint.
      a.evidenciasCount = ficheiros;

      // Remover de qualquer lista e reenfileirar conforme estado
      removeFromAll(a.id);

      if (novoEstado === "Executada") state.executadas.unshift(a);
      else if (novoEstado === "Cancelada") state.canceladas.unshift(a);
      else state.cadastradas.unshift(a); // Planificada/Adiada ficam aqui

      closeModal();
      render();
    });

    function removeFromAll(id){
      state.cadastradas = state.cadastradas.filter(x => x.id !== id);
      state.executadas = state.executadas.filter(x => x.id !== id);
      state.canceladas = state.canceladas.filter(x => x.id !== id);
    }

    // ---------------------------
    // Relatório: imprimir HTML
    // ---------------------------
    $("#btnGerarRelatorio").addEventListener("click", () => gerarRelatorioImprimivel());
    $("#btnRelatorioTopo").addEventListener("dblclick", () => gerarRelatorioImprimivel());

    function gerarRelatorioImprimivel(){
      const rows = state.executadas.map(a => `
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
      w.document.write(`
        <!doctype html>
        <html lang="pt-PT">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Relatório — Actividades Executadas (SIGAC)</title>
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
          <h2>Relatório de Actividades Executadas (SIGAC) • Faculdade: FACEE • Ano lectivo: 2026</h2>
          <div class="meta">Total de actividades executadas: <strong>${state.executadas.length}</strong></div>
          <table>
            <thead>
              <tr>
                <th>Nº</th><th>Área</th><th>Acção</th><th>Período</th><th>Responsável</th><th>Orçamento</th><th>Evidências</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="7">Sem registos de actividades executadas.</td></tr>`}</tbody>
          </table>
          <div class="foot">Gerado pelo SIGAC (demo). Para exportar em PDF, use “Imprimir” do navegador.</div>
          <button onclick="window.print()">Imprimir / Guardar em PDF</button>
        </body>
        </html>
      `);
      w.document.close();
    }

    // ---------------------------
    // Demo
    // ---------------------------
    $("#btnDemo").addEventListener("click", () => {
      state.cadastradas = [];
      state.executadas = [];
      state.canceladas = [];

      state.cadastradas.push({
        id: crypto.randomUUID(),
        num:"1",
        area:"Pesquisa",
        accao:"Seminário sobre Governação Electrónica",
        obj:"Divulgar resultados de pesquisa e promover debate académico.",
        indicador:"1 seminário realizado",
        orcamento:"15000",
        fonte:"OE",
        resp:"Coord. de Pesquisa",
        inicio:"2026-03-12",
        fim:"2026-03-12",
        estado:"Planificada",
        motivo:"",
        evidenciasText:"",
        evidenciasCount:0
      });

      state.executadas.push({
        id: crypto.randomUUID(),
        num:"2",
        area:"Extensão",
        accao:"Campanha de literacia financeira comunitária",
        obj:"Capacitar jovens e microempreendedores em finanças básicas.",
        indicador:"200 beneficiários",
        orcamento:"30000",
        fonte:"Externo",
        resp:"Coord. de Extensão",
        inicio:"2026-05-01",
        fim:"2026-05-30",
        estado:"Executada",
        motivo:"",
        evidenciasText:"https://drive.google.com/..., https://photos.google.com/...",
        evidenciasCount:2
      });

      state.canceladas.push({
        id: crypto.randomUUID(),
        num:"3",
        area:"Publicação",
        accao:"Submissão de artigo a revista indexada",
        obj:"Publicar resultados de investigação.",
        indicador:"1 artigo submetido",
        orcamento:"0",
        fonte:"OE",
        resp:"Equipa de Investigação",
        inicio:"2026-07-01",
        fim:"2026-09-30",
        estado:"Cancelada",
        motivo:"Falta de dados completos para submissão.",
        evidenciasText:"",
        evidenciasCount:0
      });

      render();
    });

    // Start
    carregarDoBackend().catch(console.error);
    render();
  
