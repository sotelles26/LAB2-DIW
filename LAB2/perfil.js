// CRUD do usuário: consultar (GET), atualizar (PATCH) e excluir (DELETE) a própria conta
const CAMPOS = ["nome", "email", "cpf-cnpj", "rg", "profissao"];
const END = ["cep", "logradouro", "estado", "numero", "complemento", "bairro", "cidade"];
const $ = id => document.getElementById(id);
const lista = () => $("lista-empregadores");

document.addEventListener("DOMContentLoaded", async () => {
    if (!usuarioLogado) return;
    $("form-perfil").addEventListener("submit", salvar);
    $("btn-excluir").addEventListener("click", excluir);
    $("btn-add-empregador").addEventListener("click", () => addEmpregador());

    try {
        const u = await (await fetch(`${API_URL}/usuarios/${usuarioLogado.id}`)).json();
        preencher(u);
    } catch (err) {
        alert("Não foi possível carregar o perfil. Verifique o JSON Server.");
    }
});

function preencher(u) {
    $("tipo-conta").textContent = `(${u.tipo})`;
    $("nome").value = u.nome || ""; $("email").value = u.email || "";
    $("cpf-cnpj").value = u.cpfCnpj || ""; $("rg").value = u.rg || ""; $("profissao").value = u.profissao || "";
    END.forEach(k => $(k).value = (u.endereco || {})[k] || "");
    if (u.foto) { $("foto-perfil").src = u.foto; $("box-foto").style.display = "flex"; }
    if (u.tipo !== "cliente") $("secao-empregadores").style.display = "none";
    lista().innerHTML = "";
    (u.empregadores || []).forEach(e => addEmpregador(e));
}

function renumerar() {
    lista().querySelectorAll(".card-empregador h3").forEach((h, i) => h.textContent = `Empregador ${i + 1}`);
}

function addEmpregador(e = {}) {
    if (lista().children.length >= 3) { alert("Máximo de 3 empregadores."); return; }
    const card = document.createElement("div");
    card.className = "card-empregador";
    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <h3></h3><button type="button" class="btn-adicionar btn-remover">Remover</button>
        </div>
        <div class="grid-3">
            <div class="input-group"><label>EMPRESA</label><input type="text" class="emp-empresa"></div>
            <div class="input-group"><label>CNPJ</label><input type="text" class="emp-cnpj"></div>
            <div class="input-group"><label>RENDIMENTO</label><input type="number" step="0.01" min="0" class="emp-rendimento"></div>
        </div>`;
    card.querySelector(".emp-empresa").value = e.empresa || "";
    card.querySelector(".emp-cnpj").value = e.cnpj || "";
    card.querySelector(".emp-rendimento").value = e.rendimento ?? "";
    card.querySelector(".btn-remover").onclick = () => { card.remove(); renumerar(); };
    lista().appendChild(card);
    renumerar();
}

async function salvar(e) {
    e.preventDefault();
    const senha = $("password").value;
    if (senha && senha !== $("confirm-password").value) { alert("As senhas não coincidem!"); return; }
    const email = $("email").value.trim();
    try {
        const dup = await (await fetch(`${API_URL}/usuarios?email=${encodeURIComponent(email)}`)).json();
        if (dup.some(u => String(u.id) !== String(usuarioLogado.id))) { alert("Este e-mail já está em uso."); return; }

        const dados = {
            nome: $("nome").value.trim(), email,
            cpfCnpj: $("cpf-cnpj").value.trim(), rg: $("rg").value.trim(), profissao: $("profissao").value.trim(),
            endereco: Object.fromEntries(END.map(k => [k, $(k).value.trim()])),
            empregadores: [...lista().querySelectorAll(".card-empregador")].map(c => ({
                empresa: c.querySelector(".emp-empresa").value.trim(),
                cnpj: c.querySelector(".emp-cnpj").value.trim(),
                rendimento: parseFloat(c.querySelector(".emp-rendimento").value) || 0
            })).filter(x => x.empresa)
        };
        if (senha) dados.senha = senha;

        const res = await fetch(`${API_URL}/usuarios/${usuarioLogado.id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados)
        });
        if (!res.ok) throw new Error();
        localStorage.setItem("usuario_car", JSON.stringify(await res.json()));
        alert("Perfil atualizado!");
        location.reload();
    } catch (err) {
        alert("Não foi possível salvar. Verifique o JSON Server.");
    }
}

async function excluir() {
    try {
        const ativos = await (await fetch(`${API_URL}/pedidos?clienteId=${encodeURIComponent(usuarioLogado.id)}`)).json();
        if (ativos.some(p => ["Pendente", "Em análise", "Aprovado"].includes(p.status))) {
            alert("Você tem pedidos em andamento. Cancele-os antes de excluir a conta."); return;
        }
        if (!confirm("Excluir sua conta definitivamente? Esta ação não pode ser desfeita.")) return;
        const res = await fetch(`${API_URL}/usuarios/${usuarioLogado.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        localStorage.removeItem("usuario_car");
        window.location.href = "index.html";
    } catch (err) {
        alert("Não foi possível excluir a conta. Verifique o JSON Server.");
    }
}