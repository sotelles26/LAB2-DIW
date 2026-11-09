const API_URL = "http://localhost:3000";
const MAX_EMPREGADORES = 3;
const TEXTO_BOTAO = { cliente: "Criar Conta de Cliente", agente: "Criar Conta de Locador", banco: "Criar Conta de Banco" };

let usuarioLogado = JSON.parse(localStorage.getItem("usuario_car")) || null;

// Protege páginas internas: <body data-requer-login> (opcional: data-requer-login="agente,banco")
function protegerPagina() {
    const exigencia = document.body.getAttribute("data-requer-login");
    if (exigencia === null) return;
    if (!usuarioLogado) { window.location.href = "login.html"; return; }
    const tipos = exigencia.split(",").map(t => t.trim()).filter(Boolean);
    if (tipos.length && !tipos.includes(usuarioLogado.tipo)) window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
    // 1. TEMA
    const btnTema = document.getElementById("btn-tema");
    const temaSalvo = localStorage.getItem("tema");
    if (temaSalvo) document.documentElement.setAttribute("data-theme", temaSalvo);
    if (btnTema) {
        btnTema.addEventListener("click", () => {
            const novo = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", novo);
            localStorage.setItem("tema", novo);
        });
    }

    protegerPagina();
    atualizarHeader();

    // 2. LOGIN
    const formLogin = document.getElementById("form-login");
    if (formLogin) {
        formLogin.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("email").value.trim();
            const senha = document.getElementById("password").value;
            try {
                const res = await fetch(`${API_URL}/usuarios?email=${encodeURIComponent(email)}&senha=${encodeURIComponent(senha)}`);
                const dados = await res.json();
                if (dados.length > 0) {
                    usuarioLogado = dados[0];
                    localStorage.setItem("usuario_car", JSON.stringify(usuarioLogado));
                    window.location.href = "veiculos.html";
                } else {
                    alert("E-mail ou senha incorretos.");
                }
            } catch (err) {
                console.error(err);
                alert("Erro ao conectar ao JSON Server. Verifique se ele está rodando na porta 3000.");
            }
        });
    }

    // 3. CADASTRO
    const formCadastro = document.getElementById("form-cadastro");
    if (formCadastro) iniciarCadastro(formCadastro);
});

function iniciarCadastro(form) {
    const toggleBtns = document.querySelectorAll(".btn-toggle");
    const btnSubmit = document.getElementById("btn-submit-cad");
    toggleBtns.forEach(btn => btn.addEventListener("click", () => {
        toggleBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        btnSubmit.textContent = TEXTO_BOTAO[btn.dataset.type] || TEXTO_BOTAO.cliente;
    }));

    // Foto de perfil (guardada como base64, limite 500 KB)
    let fotoBase64 = "";
    const inputFoto = document.getElementById("upload-foto");
    inputFoto.addEventListener("change", () => {
        const arq = inputFoto.files[0];
        if (!arq) return;
        if (arq.size > 500 * 1024) { alert("A imagem deve ter no máximo 500 KB."); inputFoto.value = ""; return; }
        const reader = new FileReader();
        reader.onload = () => {
            fotoBase64 = reader.result;
            const av = document.querySelector(".avatar-placeholder");
            av.innerHTML = `<img src="${fotoBase64}" alt="Foto" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        };
        reader.readAsDataURL(arq);
    });

    // Empregadores (máx. 3)
    const lista = document.getElementById("lista-empregadores");
    const btnAdd = document.getElementById("btn-add-empregador");
    btnAdd.addEventListener("click", () => {
        const n = lista.querySelectorAll(".card-empregador").length;
        if (n >= MAX_EMPREGADORES) { alert(`Máximo de ${MAX_EMPREGADORES} empregadores.`); return; }
        const card = document.createElement("div");
        card.className = "card-empregador";
        card.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <h3>Empregador ${n + 1}</h3>
                <button type="button" class="btn-adicionar btn-remover">Remover</button>
            </div>
            <div class="grid-3">
                <div class="input-group"><label>EMPRESA</label><input type="text" class="emp-empresa" placeholder="Empresa LTDA"></div>
                <div class="input-group"><label>CNPJ</label><input type="text" class="emp-cnpj" placeholder="00.000.000/0001-00"></div>
                <div class="input-group"><label>RENDIMENTO</label><input type="number" step="0.01" min="0" class="emp-rendimento" placeholder="5000.00"></div>
            </div>`;
        card.querySelector(".btn-remover").onclick = () => {
            card.remove();
            lista.querySelectorAll(".card-empregador h3").forEach((h, i) => h.textContent = `Empregador ${i + 1}`);
        };
        lista.appendChild(card);
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const val = id => document.getElementById(id)?.value.trim() || "";
        const senha = document.getElementById("password").value;
        if (senha !== document.getElementById("confirm-password").value) { alert("As senhas não coincidem!"); return; }

        const email = val("email");
        try {
            const dup = await (await fetch(`${API_URL}/usuarios?email=${encodeURIComponent(email)}`)).json();
            if (dup.length > 0) { alert("Já existe uma conta com este e-mail."); return; }

            const tipo = document.querySelector(".btn-toggle.active")?.dataset.type || "cliente";
            const empregadores = [...lista.querySelectorAll(".card-empregador")].map(c => ({
                empresa: c.querySelector(".emp-empresa").value.trim(),
                cnpj: c.querySelector(".emp-cnpj").value.trim(),
                rendimento: parseFloat(c.querySelector(".emp-rendimento").value) || 0
            })).filter(emp => emp.empresa);

            const novoUsuario = {
                nome: val("nome"), email, senha, tipo, foto: fotoBase64,
                cpfCnpj: val("cpf-cnpj"), rg: val("rg"), profissao: val("profissao"),
                endereco: {
                    cep: val("cep"), logradouro: val("logradouro"), estado: val("estado"), numero: val("numero"),
                    complemento: val("complemento"), bairro: val("bairro"), cidade: val("cidade")
                },
                empregadores: tipo === "cliente" ? empregadores : []
            };

            const res = await fetch(`${API_URL}/usuarios`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(novoUsuario)
            });
            if (res.ok) { alert("Conta criada com sucesso! Faça login."); window.location.href = "login.html"; }
            else alert("Erro ao realizar o cadastro.");
        } catch (err) {
            console.error(err);
            alert("Não foi possível conectar ao JSON Server.");
        }
    });
}

// 4. HEADER / SESSÃO
function atualizarHeader() {
    const nav = document.querySelector("nav");
    if (!nav || !usuarioLogado) return;
    nav.querySelectorAll(".btn-entrar, .btn-cadastrar").forEach(b => b.style.display = "none");
    const area = document.getElementById("area-botoes-auth");
    if (area) area.style.display = "none";
    if (document.getElementById("area-usuario")) return;

    const div = document.createElement("div");
    div.id = "area-usuario";
    div.style.cssText = "display:flex;gap:12px;align-items:center;";
    const span = document.createElement("a");
    span.href = "perfil.html"; span.title = "Meu perfil";
    span.style.cssText = "font-weight:700;font-size:14px;color:var(--text-color);";
    span.textContent = `Olá, ${usuarioLogado.nome}`; // textContent evita injeção de HTML
    const btn = document.createElement("button");
    btn.type = "button"; btn.id = "btn-logout"; btn.className = "btn-entrar";
    btn.innerHTML = "<p>Sair</p>";
    btn.onclick = () => { localStorage.removeItem("usuario_car"); usuarioLogado = null; window.location.href = "index.html"; };
    div.append(span, btn);
    nav.appendChild(div);
}