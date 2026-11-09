// Gestão de pedidos: visão do cliente e visão do agente (locadora/banco)
const STATUS_COR = { "Pendente": "warning text-dark", "Em análise": "info text-dark", "Aprovado": "success",
                     "Rejeitado": "danger", "Cancelado": "secondary", "Contratado": "primary" };
const FINAIS = ["Rejeitado", "Cancelado", "Contratado"];
let pedidos = [], pedidoEditando = null, modalEditar = null;

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const brl = v => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = iso => iso ? iso.split("-").reverse().join("/") : "";
const ehAgente = () => usuarioLogado.tipo !== "cliente";

document.addEventListener("DOMContentLoaded", () => {
    if (!usuarioLogado) return;
    if (ehAgente()) document.getElementById("titulo-pagina").textContent = "Pedidos recebidos";
    modalEditar = new bootstrap.Modal(document.getElementById("modal-editar"));
    document.getElementById("edit-inicio").addEventListener("change", atualizarTotal);
    document.getElementById("edit-fim").addEventListener("change", atualizarTotal);
    document.getElementById("form-editar").addEventListener("submit", salvarEdicao);
    document.getElementById("corpo-pedidos").addEventListener("click", onAcao);
    carregar();
});

async function carregar() {
    const filtro = ehAgente() ? "" : `&clienteId=${encodeURIComponent(usuarioLogado.id)}`;
    try {
        const res = await fetch(`${API_URL}/pedidos?_sort=id&_order=desc${filtro}`);
        pedidos = await res.json();
        renderizar();
    } catch (err) {
        console.error(err);
        document.getElementById("corpo-pedidos").innerHTML =
            `<tr><td colspan="8" class="text-center py-4">Não foi possível carregar os pedidos. Verifique o JSON Server.</td></tr>`;
    }
}

function botoes(p) {
    if (FINAIS.includes(p.status)) return "";
    const b = (acao, texto, cls) => `<button type="button" class="btn btn-${cls} btn-acao me-1" data-acao="${acao}" data-id="${esc(p.id)}">${texto}</button>`;
    let h = "";
    if (ehAgente()) {
        if (p.status === "Pendente") h += b("analisar", "Analisar", "info");
        if (p.status === "Em análise") h += b("aprovar", "Aprovar", "success");
        if (p.status === "Aprovado") h += b("contrato", "Executar contrato", "primary");
        if (p.status !== "Aprovado") h += b("editar", "Editar", "outline-secondary");
        h += b("rejeitar", "Rejeitar", "outline-danger");
    } else {
        if (p.status === "Pendente") h += b("editar", "Editar", "outline-secondary");
        h += b("cancelar", "Cancelar", "outline-danger");
    }
    return h;
}

function renderizar() {
    const corpo = document.getElementById("corpo-pedidos");
    if (pedidos.length === 0) {
        corpo.innerHTML = `<tr><td colspan="8" class="text-center py-4">Nenhum pedido por aqui ainda.</td></tr>`;
        return;
    }
    corpo.innerHTML = pedidos.map(p => `
        <tr>
            <td>${esc(p.id)}</td>
            <td>${esc(p.clienteNome)}</td>
            <td>${esc(p.automovelDescricao)}</td>
            <td>${dataBR(p.dataInicio)} → ${dataBR(p.dataFim)}<br><small class="text-secondary">${esc(p.dias)} dia(s)</small></td>
            <td>${brl(p.valorTotal)}</td>
            <td>${p.solicitaCredito ? (p.creditoBancoNome ? "Concedido: " + esc(p.creditoBancoNome) : "Solicitado") : "—"}</td>
            <td><span class="badge text-bg-${(STATUS_COR[p.status] || "secondary").split(" ")[0]}">${esc(p.status)}</span></td>
            <td>${botoes(p)}</td>
        </tr>`).join("");
}

async function patch(id, dados) {
    const res = await fetch(`${API_URL}/pedidos/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados)
    });
    if (!res.ok) throw new Error("Falha ao atualizar");
}

async function onAcao(e) {
    const btn = e.target.closest("button[data-acao]");
    if (!btn) return;
    const p = pedidos.find(x => String(x.id) === btn.dataset.id);
    if (!p) return;
    try {
        switch (btn.dataset.acao) {
            case "editar": return abrirEdicao(p);
            case "analisar": await patch(p.id, { status: "Em análise", avaliadoPor: usuarioLogado.nome }); break;
            case "aprovar": {
                const extra = { status: "Aprovado", avaliadoPor: usuarioLogado.nome };
                // Se o cliente pediu crédito e quem aprova é um banco, o crédito fica concedido por ele
                if (p.solicitaCredito && usuarioLogado.tipo === "banco") {
                    extra.creditoBancoId = usuarioLogado.id;
                    extra.creditoBancoNome = usuarioLogado.nome;
                }
                await patch(p.id, extra); break;
            }
            case "rejeitar":
                if (!confirm("Rejeitar este pedido?")) return;
                await patch(p.id, { status: "Rejeitado", avaliadoPor: usuarioLogado.nome }); break;
            case "cancelar":
                if (!confirm("Cancelar este pedido?")) return;
                await patch(p.id, { status: "Cancelado" }); break;
            case "contrato":
                if (!confirm("Executar o contrato deste pedido?")) return;
                await executarContrato(p); break;
        }
        carregar();
    } catch (err) {
        console.error(err);
        alert("Não foi possível concluir a ação. Verifique o JSON Server.");
    }
}

async function executarContrato(p) {
    const contrato = {
        pedidoId: p.id, clienteId: p.clienteId, clienteNome: p.clienteNome,
        automovelId: p.automovelId, automovelDescricao: p.automovelDescricao,
        dataInicio: p.dataInicio, dataFim: p.dataFim, valorTotal: p.valorTotal,
        agenteId: usuarioLogado.id, agenteNome: usuarioLogado.nome,
        creditoBancoId: p.creditoBancoId || null, criadoEm: new Date().toISOString()
    };
    const res = await fetch(`${API_URL}/contratos`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(contrato)
    });
    if (!res.ok) throw new Error("Falha ao criar contrato");
    await patch(p.id, { status: "Contratado" });
    await fetch(`${API_URL}/automoveis/${p.automovelId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ disponivel: false })
    });
}

// ---- Modificar datas ----
function diasEntre() {
    const ini = document.getElementById("edit-inicio").value, fim = document.getElementById("edit-fim").value;
    if (!ini || !fim) return 0;
    const d = Math.round((new Date(fim) - new Date(ini)) / 86400000);
    return d > 0 ? d : 0;
}
function diaria() { return pedidoEditando.valorTotal / pedidoEditando.dias; }

function abrirEdicao(p) {
    pedidoEditando = p;
    document.getElementById("editar-titulo").textContent = `Pedido #${p.id} · ${p.automovelDescricao}`;
    document.getElementById("edit-inicio").value = p.dataInicio;
    document.getElementById("edit-fim").value = p.dataFim;
    document.getElementById("edit-inicio").min = new Date().toISOString().split("T")[0];
    atualizarTotal();
    modalEditar.show();
}
function atualizarTotal() {
    const ini = document.getElementById("edit-inicio").value;
    if (ini) document.getElementById("edit-fim").min = ini;
    document.getElementById("edit-total").textContent = brl(pedidoEditando ? diasEntre() * diaria() : 0);
}
async function salvarEdicao(e) {
    e.preventDefault();
    const dias = diasEntre();
    if (dias <= 0) { alert("A devolução deve ser depois da retirada."); return; }
    try {
        await patch(pedidoEditando.id, {
            dataInicio: document.getElementById("edit-inicio").value,
            dataFim: document.getElementById("edit-fim").value,
            dias, valorTotal: Math.round(dias * diaria() * 100) / 100
        });
        modalEditar.hide();
        carregar();
    } catch (err) {
        alert("Não foi possível salvar. Verifique o JSON Server.");
    }
}