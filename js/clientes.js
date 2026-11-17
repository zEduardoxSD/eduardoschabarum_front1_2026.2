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
    inicializarPerfil() {
        const sessao = authManager.protegerPagina();
        if (!sessao) return;

        const clientes = storage.get('clientes') || [];
        const cliente = clientes.find(c => c.id === sessao.id);
        if (!cliente) return;

        document.getElementById('id-cliente').value = cliente.id;
        document.getElementById('nome').value = cliente.nome;
        document.getElementById('cpf').value = cliente.cpf;
        document.getElementById('email').value = cliente.email;
        document.getElementById('telefone').value = cliente.telefone || '';

        document.getElementById('cpf')?.addEventListener('input', (e) => {
            e.target.value = utils.mascaraCPF(e.target.value);
        });

        document.getElementById('telefone')?.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });

        document.getElementById('form-perfil')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.salvarEdicaoPerfil(cliente);
        });

        const btnAbrirExcluir = document.getElementById('btn-abrir-excluir');
        const modalExcluir = document.getElementById('modal-excluir-conta');
        const btnConfirmarExcluir = document.getElementById('btn-confirmar-exclusao');

        btnAbrirExcluir?.addEventListener('click', () => modalExcluir?.showModal());
        btnConfirmarExcluir?.addEventListener('click', () => {
            const listaAtualizada = (storage.get('clientes') || []).filter(c => c.id !== cliente.id);
            storage.set('clientes', listaAtualizada);
            uiManager.mostrarToast('Conta excluída com sucesso.');
            setTimeout(() => authManager.logout(), 1200);
        });

        this.renderizarMeusPedidos(cliente.id);
    },

    async salvarEdicaoPerfil(clienteOriginal) {
        const nome = document.getElementById('nome').value.trim();
        const cpf = document.getElementById('cpf').value.trim();
        const email = document.getElementById('email').value.trim();
        const telefone = document.getElementById('telefone').value.trim();
        const senhaAtual = document.getElementById('senha-atual').value;
        const novaSenha = document.getElementById('senha').value;
        const confirmarSenha = document.getElementById('confirmar-senha').value;
        const erroEl = document.getElementById('perfil-erro');
        if (erroEl) erroEl.textContent = '';

        const clientes = storage.get('clientes') || [];

        if (nome.length < 3 || nome.split(/\s+/).length < 2) {
            if (erroEl) erroEl.textContent = 'Informe nome e sobrenome (mínimo 3 caracteres).';
            return;
        }
        if (!utils.validarCPF(cpf)) {
            if (erroEl) erroEl.textContent = 'CPF inválido.';
            return;
        }
        if (clientes.some(c => c.id !== clienteOriginal.id && c.cpf === cpf)) {
            if (erroEl) erroEl.textContent = 'Este CPF já pertence a outro cliente.';
            return;
        }
        if (!utils.validarEmail(email)) {
            if (erroEl) erroEl.textContent = 'E-mail inválido.';
            return;
        }
        if (clientes.some(c => c.id !== clienteOriginal.id && c.email.toLowerCase() === email.toLowerCase())) {
            if (erroEl) erroEl.textContent = 'Este e-mail já pertence a outro cliente.';
            return;
        }
        if (!utils.validarTelefone(telefone)) {
            if (erroEl) erroEl.textContent = 'Telefone inválido (10 ou 11 números).';
            return;
        }

        let houveAlteracao =
            nome !== clienteOriginal.nome ||
            cpf !== clienteOriginal.cpf ||
            email !== clienteOriginal.email ||
            telefone !== (clienteOriginal.telefone || '');

        let novoHash = clienteOriginal.hashSenha;
        let novoSalt = clienteOriginal.salt;

        if (novaSenha || confirmarSenha) {
            if (!senhaAtual) {
                if (erroEl) erroEl.textContent = 'Informe a senha atual para alterar a senha.';
                return;
            }
            const hashAtualConferencia = await authManager.gerarHashSenha(senhaAtual, clienteOriginal.salt);
            if (hashAtualConferencia !== clienteOriginal.hashSenha) {
                if (erroEl) erroEl.textContent = 'Senha atual incorreta.';
                return;
            }
            if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(novaSenha)) {
                if (erroEl) erroEl.textContent = 'A nova senha deve ter no mínimo 8 caracteres, com letras e números.';
                return;
            }
            if (novaSenha !== confirmarSenha) {
                if (erroEl) erroEl.textContent = 'A confirmação da nova senha não confere.';
                return;
            }
            novoSalt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
                .map(b => b.toString(16).padStart(2, '0')).join('');
            novoHash = await authManager.gerarHashSenha(novaSenha, novoSalt);
            houveAlteracao = true;
        }

        if (!houveAlteracao) {
            uiManager.mostrarToast('Nenhuma alteração foi feita.');
            return;
        }

        const idx = clientes.findIndex(c => c.id === clienteOriginal.id);
        clientes[idx] = {
            ...clienteOriginal,
            nome,
            cpf,
            email,
            telefone,
            hashSenha: novoHash,
            salt: novoSalt
        };
        storage.set('clientes', clientes);

        document.getElementById('senha-atual').value = '';
        document.getElementById('senha').value = '';
        document.getElementById('confirmar-senha').value = '';
        uiManager.atualizarMenuDinamico();
        uiManager.mostrarToast('Perfil atualizado com sucesso!');
    },

    renderizarMeusPedidos(clienteId) {
        const container = document.getElementById('lista-meus-pedidos');
        if (!container) return;

        const compras = (storage.get('compras') || []).filter(c => c.cliente.id === clienteId);

        if (compras.length === 0) {
            container.innerHTML = '<p>Você ainda não realizou nenhum pedido.</p>';
            return;
        }

        container.innerHTML = compras.reverse().map(pedido => `
            <details style="border: 1px solid #ccc; border-radius: 6px; padding: 10px; margin-bottom: 10px;">
                <summary style="cursor: pointer; font-weight: bold;">
                    Pedido #${utils.escaparHTML(pedido.id)} — ${utils.formatarData(pedido.dataHora)} — 
                    ${utils.formatarMoeda(pedido.valorTotal)} (${utils.escaparHTML(pedido.status)})
                </summary>
                <div style="margin-top: 10px; padding-left: 10px;">
                    <p><strong>Pagamento:</strong> ${utils.escaparHTML(pedido.formaPagamento)} (${utils.escaparHTML(pedido.detalhesPagamento || '')})</p>
                    <p><strong>Entrega:</strong> ${utils.escaparHTML(pedido.endereco.rua)}, ${utils.escaparHTML(pedido.endereco.numero)} - ${utils.escaparHTML(pedido.endereco.cidade)} (CEP: ${utils.escaparHTML(pedido.endereco.cep)})</p>
                    <ul>
                        ${pedido.itens.map(item => `
                            <li>${item.quantidade}x ${utils.escaparHTML(item.nome)} — ${utils.formatarMoeda(item.precoUnitario * item.quantidade)}</li>
                        `).join('')}
                    </ul>
                    <p>Subtotal: ${utils.formatarMoeda(pedido.subtotal)} | Desconto: -${utils.formatarMoeda(pedido.desconto)} | Frete: ${utils.formatarMoeda(pedido.frete)}</p>
                </div>
            </details>
        `).join('');
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