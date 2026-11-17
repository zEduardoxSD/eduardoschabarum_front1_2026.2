import { storage } from './storage.js';
import { produtosData } from '../data/produtos.js';
import { utils } from './utils.js';

export const produtosManager = {
    inicializarEstoque() {
        if (!storage.get('produtos')) {
            storage.set('produtos', produtosData);
        }
    },

    obterProdutos() {
        return storage.get('produtos') || produtosData;
    },

    renderizarCatalogo(containerId, filtroCategoria = '', busca = '') {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        let produtos = this.obterProdutos();

        if (filtroCategoria) {
            produtos = produtos.filter(p => p.categoria.toLowerCase() === filtroCategoria.toLowerCase());
        }

        if (busca) {
            const termo = busca.toLowerCase();
            produtos = produtos.filter(p => p.nome.toLowerCase().includes(termo) || p.descricao.toLowerCase().includes(termo));
        }

        if (produtos.length === 0) {
            container.innerHTML = '<p>Nenhum produto encontrado.</p>';
            return;
        }

        const template = document.getElementById('produto-template');

        produtos.forEach(produto => {
            if (template) {
                const clone = template.content.cloneNode(true);
                clone.querySelector('.produto-img').src = produto.imagem;
                clone.querySelector('.produto-nome').textContent = produto.nome;
                clone.querySelector('.produto-preco').textContent = utils.formatarMoeda(produto.preco);
                clone.querySelector('.btn-detalhes').addEventListener('click', () => this.abrirDetalhes(produto.id));
                container.appendChild(clone);
            } else {
                const card = document.createElement('div');
                card.className = 'produto-card';
                card.innerHTML = `
                    <img src="${produto.imagem}" alt="${utils.escaparHTML(produto.nome)}" width="150">
                    <h3>${utils.escaparHTML(produto.nome)}</h3>
                    <p>${utils.formatarMoeda(produto.preco)}</p>
                    <button data-id="${produto.id}" class="btn-detalhes">Detalhes</button>
                `;
                card.querySelector('.btn-detalhes').addEventListener('click', () => this.abrirDetalhes(produto.id));
                container.appendChild(card);
            }
        });
    },

    abrirDetalhes(id) {
        const produto = this.obterProdutos().find(p => p.id === id);
        if (!produto) return;

        const modal = document.getElementById('modal-detalhes');
        if (!modal) return;

        modal.querySelector('.modal-imagem').src = produto.imagem;
        modal.querySelector('.modal-nome').textContent = produto.nome;
        modal.querySelector('.modal-descricao').textContent = produto.descricao;
        modal.querySelector('.modal-preco').textContent = utils.formatarMoeda(produto.preco);
        modal.querySelector('.modal-estoque').textContent = `Estoque: ${produto.estoque}`;
        
        const inputQtd = modal.querySelector('.modal-qtd');
        if(inputQtd) {
            inputQtd.max = produto.estoque;
            inputQtd.value = 1;
        }

        const btnAdd = modal.querySelector('.modal-add-carrinho');
        if(btnAdd) {
            btnAdd.onclick = () => {
                import('./carrinho.js').then(m => {
                    m.carrinhoManager.adicionarItem(produto.id, parseInt(inputQtd.value));
                    modal.close();
                });
            };
        }

        modal.showModal();
    }
};