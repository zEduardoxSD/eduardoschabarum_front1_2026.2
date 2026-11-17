import { storage } from './storage.js';
import { utils } from './utils.js';
import { authManager } from './auth.js';
import { uiManager } from './ui.js';

export const clientesManager = {
    inicializarCadastro() {
        const form = document.getElementById('form-cadastro');
        if (!form) return;

        const contadores = storage.get('contadores') || { clientes: 1 };
        const inputId = document.getElementById('id-cliente');
        if (inputId) {
            inputId.value = `C${String(contadores.clientes).padStart(3, '0')}`;
        }

        const inputCpf = document.getElementById('cpf');
        if (inputCpf) {
            inputCpf.addEventListener('input', (e) => {
                e.target.value = utils.mascaraCPF(e.target.value);
                limparErro('cpf');
            });
        }

        const inputTel = document.getElementById('telefone');
        if (inputTel) {
            inputTel.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '');
                limparErro('telefone');
            });
        }

        const inputSenha = document.getElementById('senha');
        if (inputSenha) {
            inputSenha.addEventListener('input', (e) => {
                this.atualizarForcaSenha(e.target.value);
                limparErro('senha');
            });
        }

        ['nome', 'email', 'confirmar-senha'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => limparErro(id));
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await processarCadastro();
        });
    },

    atualizarForcaSenha(senha) {
        const span = document.querySelector('#forca-senha span');
        if (!span) return;

        let pontos = 0;
        if (senha.length >= 8) pontos++;
        if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++;
        if (/\d/.test(senha)) pontos++;
        if (/[^A-Za-z0-9]/.test(senha)) pontos++;

        if (!senha) {
            span.textContent = '-';
            span.style.color = 'inherit';
        } else if (pontos <= 2) {
            span.textContent = 'Fraca';
            span.style.color = 'red';
        } else if (pontos === 3) {
            span.textContent = 'Média';
            span.style.color = 'orange';
        } else {
            span.textContent = 'Forte';
            span.style.color = 'green';
        }
    }
};

function exibirErro(campoId, mensagem) {
    const el = document.querySelector(`[data-erro="${campoId}"]`);
    if (el) el.textContent = mensagem;
}

function limparErro(campoId) {
    const el = document.querySelector(`[data-erro="${campoId}"]`);
    if (el) el.textContent = '';
}

async function processarCadastro() {
    const nome = document.getElementById('nome').value.trim();
    const cpf = document.getElementById('cpf').value.trim();
    const email = document.getElementById('email').value.trim();
    const telefone = document.getElementById('telefone').value.trim();
    const senha = document.getElementById('senha').value;
    const confirmarSenha = document.getElementById('confirmar-senha').value;

    document.querySelectorAll('.erro-msg').forEach(el => el.textContent = '');
    const clientes = storage.get('clientes') || [];
    let primeiroCampoInvalido = null;

    const marcarErro = (id, msg) => {
        exibirErro(id, msg);
        if (!primeiroCampoInvalido) primeiroCampoInvalido = document.getElementById(id);
    };

    if (nome.length < 3 || nome.split(/\s+/).length < 2) {
        marcarErro('nome', 'Informe nome e sobrenome (mínimo 3 caracteres).');
    }

    if (!utils.validarCPF(cpf)) {
        marcarErro('cpf', 'CPF inválido.');
    } else if (clientes.some(c => c.cpf === cpf)) {
        marcarErro('cpf', 'Este CPF já está cadastrado.');
    }

    if (!utils.validarEmail(email)) {
        marcarErro('email', 'E-mail inválido.');
    } else if (clientes.some(c => c.email.toLowerCase() === email.toLowerCase())) {
        marcarErro('email', 'Este e-mail já está cadastrado.');
    }

    if (!utils.validarTelefone(telefone)) {
        marcarErro('telefone', 'Informe um telefone válido com DDD (10 ou 11 números).');
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(senha)) {
        marcarErro('senha', 'A senha deve ter no mínimo 8 caracteres, com letras e números.');
    } else if (senha !== confirmarSenha) {
        marcarErro('confirmar-senha', 'As senhas não coincidem.');
    }

    if (primeiroCampoInvalido) {
        primeiroCampoInvalido.focus();
        return;
    }

    const contadores = storage.get('contadores') || { clientes: 1, compras: 1 };
    const idCliente = `C${String(contadores.clientes).padStart(3, '0')}`;
    contadores.clientes += 1;
    storage.set('contadores', contadores);

    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    const hashSenha = await authManager.gerarHashSenha(senha, salt);

    clientes.push({
        id: idCliente,
        nome,
        cpf,
        email,
        telefone,
        hashSenha,
        salt,
        perfil: 'cliente',
        bloqueado: false,
        dataCadastro: new Date().toISOString()
    });

    storage.set('clientes', clientes);
    uiManager.mostrarToast('Cadastro realizado com sucesso! Redirecionando...');
    
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1500);
}