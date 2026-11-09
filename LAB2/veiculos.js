// Catálogo de veículos + criação de pedido de aluguel
let veiculos = [];
let carroSelecionado = null;
let modalPedido = null;

const DONO = { agente: "Locadora", banco: "Banco", cliente: "Cliente" };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const brl = v => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => new Date().toISOString().split("T")[0];
const SEM_IMAGEM = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='240'><rect width='100%' height='100%' fill='%23e2e8f0'/><text x='50%' y='50%' fill='%2364748b' font-family='sans-serif' font-size='18' text-anchor='middle'>Sem imagem</text></svg>";

document.addEventListener("DOMContentLoaded", async () => {
    if (!usuarioLogado) return; // protegerPagina() já redireciona

    modalPedido = new bootstrap.Modal(document.getElementById("modal-pedido"));
    document.getElementById("filtro-busca").addEventListener("input", renderizar);
    document.getElementById("filtro-dono").addEventListener("change", renderizar);
    document.getElementById("data-inicio").addEventListener("change", atualizarTotal);
    document.getElementById("data-fim").addEventListener("change", atualizarTotal);
    document.getElementById("form-pedido").addEventListener("submit", enviarPedido);

    try {
        const res = await fetch(`${API_URL}/automoveis?disponivel=true`);
        veiculos = await res.json();
        renderizar();
    } catch (err) {
        console.error(err);
        document.getElementById("grid-veiculos").innerHTML =
            `<div class="empty-state"><p>Não foi possível carregar os veículos. Verifique o JSON Server.</p></div>`;
    }
});

function renderizar() {
    const busca = document.getElementById("filtro-busca").value.trim().toLowerCase();
    const dono = document.getElementById("filtro-dono").value;
    const grid = document.getElementById("grid-veiculos");

    const lista = veiculos.filter(v =>
        `${v.marca} ${v.modelo}`.toLowerCase().includes(busca) && (!dono || v.proprietarioTipo === dono));

    if (lista.length === 0) {
        grid.innerHTML = `<div class="empty-state"><p>Nenhum veículo encontrado.</p></div>`;
        return;
    }

    const ehCliente = usuarioLogado.tipo === "cliente";
    grid.innerHTML = lista.map(v => `
        <div class="carro-card">
            <img class="carro-img" src="${esc(v.imagem || SEM_IMAGEM)}" alt="${esc(v.marca)} ${esc(v.modelo)}">
            <span class="badge-dono">${esc(DONO[v.proprietarioTipo] || v.proprietarioTipo)}</span>
            <h3>${esc(v.marca)} ${esc(v.modelo)}</h3>
            <p class="meta">Ano ${esc(v.ano)} · Placa ${esc(v.placa)}</p>
            <p class="meta">Matrícula ${esc(v.matricula)}</p>
            <div class="preco">${brl(v.diaria)} <small style="font-size:13px;font-weight:600;color:var(--text-muted)">/ dia</small></div>
            ${ehCliente
                ? `<button type="button" class="btn-submit-cad" style="margin:8px 0 0" data-id="${esc(v.id)}">Alugar</button>`
                : `<p class="meta" style="margin-top:8px">Apenas clientes podem solicitar aluguel.</p>`}
        </div>`).join("");

    grid.querySelectorAll("button[data-id]").forEach(b =>
        b.addEventListener("click", () => abrirModal(b.dataset.id)));
}

function abrirModal(id) {
    carroSelecionado = veiculos.find(v => String(v.id) === String(id));
    if (!carroSelecionado) return;
    document.getElementById("form-pedido").reset();
    document.getElementById("modal-titulo").textContent = `${carroSelecionado.marca} ${carroSelecionado.modelo}`;
    document.getElementById("data-inicio").min = hoje();
    document.getElementById("data-fim").min = hoje();
    document.getElementById("valor-total").textContent = brl(0);
    modalPedido.show();
}

function calcularDias() {
    const ini = document.getElementById("data-inicio").value;
    const fim = document.getElementById("data-fim").value;
    if (!ini || !fim) return 0;
    const dias = Math.round((new Date(fim) - new Date(ini)) / 86400000);
    return dias > 0 ? dias : 0;
}

function atualizarTotal() {
    const ini = document.getElementById("data-inicio").value;
    if (ini) document.getElementById("data-fim").min = ini;
    document.getElementById("valor-total").textContent = brl(calcularDias() * (carroSelecionado?.diaria || 0));
}

async function enviarPedido(e) {
    e.preventDefault();
    const dias = calcularDias();
    if (dias <= 0) { alert("A devolução deve ser depois da retirada."); return; }

    const pedido = {
        clienteId: usuarioLogado.id,
        clienteNome: usuarioLogado.nome,
        automovelId: carroSelecionado.id,
        automovelDescricao: `${carroSelecionado.marca} ${carroSelecionado.modelo}`,
        dataInicio: document.getElementById("data-inicio").value,
        dataFim: document.getElementById("data-fim").value,
        dias,
        valorTotal: dias * carroSelecionado.diaria,
        solicitaCredito: document.getElementById("solicita-credito").checked,
        status: "Pendente",
        criadoEm: new Date().toISOString()
    };

    try {
        const res = await fetch(`${API_URL}/pedidos`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pedido)
        });
        if (!res.ok) throw new Error();
        modalPedido.hide();
        alert("Pedido enviado! Ele ficará como Pendente até ser avaliado por um agente.");
    } catch (err) {
        alert("Não foi possível enviar o pedido. Verifique o JSON Server.");
    }
}