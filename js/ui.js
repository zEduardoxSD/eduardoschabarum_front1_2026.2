import { storage } from './storage.js';
import { authManager } from './auth.js';
import { utils } from './utils.js';

export const uiManager = {
    inicializarTema() {
        const temaSalvo = storage.get('tema') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.documentElement.setAttribute('data-tema', temaSalvo);
    },

    alternarTema() {
        const atual = document.documentElement.getAttribute('data-tema');
        const novo = atual === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-tema', novo);
        storage.set('tema', novo);
    },

    mostrarToast(mensagem, tipo = 'sucesso') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${tipo}`;
        toast.textContent = mensagem;
        toast.setAttribute('aria-live', 'polite');
        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    },

    atualizarMenuDinamico() {
        const sessao = authManager.verificarSessao();
        const menuContainer = document.getElementById('menu-dinamico');
        if (!menuContainer) return;

        if (!sessao) {
            menuContainer.innerHTML = `
                <a href="login.html">Entrar</a>
                <a href="cadastro.html">Cadastrar</a>
            `;
        } else {
            const clientes = storage.get('clientes') || [];
            const cliente = clientes.find(c => c.id === sessao.id);
            const nome = cliente ? cliente.nome.split(' ')[0] : 'Usuário';

            let html = `
                <span>Olá, ${utils.escaparHTML(nome)}</span>
                <a href="perfil.html">Meu perfil</a>
            `;
            if (sessao.perfil === 'administrador') {
                html += `<a href="relatorios.html">Relatórios</a>`;
            }
            html += `<button id="btn-sair">Sair</button>`;
            menuContainer.innerHTML = html;

            document.getElementById('btn-sair').addEventListener('click', () => {
                authManager.logout();
            });
        }
    }
};