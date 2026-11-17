import { storage } from './storage.js';
import { produtosData } from './data/produtos.js';
import { utils } from './utils.js';
import { carrinhoManager } from './carrinho.js';
import { uiManager } from './ui.js';

export const produtosManager = {
    inicializarEstoque() {
        if (!storage.get('produtos')) {
            storage.set('produtos', produtosData);
        }
    },

    obterProdutos() {
        return storage.get('produtos') || produtosData;
    },

    inicializarFiltros() {
        const inputBusca = document.getElementById('busca');
        const radiosCategoria = document.querySelectorAll('input[name="categoria"]');
        const selectPreco = document.getElementById('preco');
        const selectOrdenacao = document.getElementById('ordenacao');

        const aplicarFiltros = () => {
            const busca = inputBusca ? inputBusca.value.trim() : '';
            const catSelecionada = document.querySelector('input[name="categoria"]:checked')?.id || 'todos';
            const faixaPreco = selectPreco ? selectPreco.value : 'todos';
            const ordenacao = selectOrdenacao ? selectOrdenacao.value : 'padrao';

            this.renderizarCatalogo('catalogo-produtos', {
                busca,
                categoria: catSelecionada,
                faixaPreco,
                ordenacao
            });
        };

        if (inputBusca) {
            inputBusca.addEventListener('input', utils.debounce(aplicarFiltros, 300));
        }
        radiosCategoria.forEach(radio => radio.addEventListener('change', aplicarFiltros));
        if (selectPreco) selectPreco.addEventListener('change', aplicarFiltros);
        if (selectOrdenacao) selectOrdenacao.addEventListener('change', aplicarFiltros);

        aplicarFiltros();
    },

    renderizarCatalogo(containerId, filtros = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        let produtos = [...this.obterProdutos()];

        if (filtros.categoria && filtros.categoria !== 'todos') {
            produtos = produtos.filter(p => p.categoria.toLowerCase() === filtros.categoria.toLowerCase());
        }

        if (filtros.busca) {
            const termo = filtros.busca.toLowerCase();
            produtos = produtos.filter(p =>
                p.nome.toLowerCase().includes(termo) ||
                p.descricao.toLowerCase().includes(termo)
            );
        }

        if (filtros.faixaPreco === 'ate-50') {
            produtos = produtos.filter(p => p.preco <= 50);
        } else if (filtros.faixaPreco === '50-150') {
            produtos = produtos.filter(p => p.preco > 50 && p.preco <= 150);
        } else if (filtros.faixaPreco === 'acima-150') {
            produtos = produtos.filter(p => p.preco > 150);
        }

        if (filtros.ordenacao === 'menor-preco') {
            produtos.sort((a, b) => a.preco - b.preco);
        } else if (filtros.ordenacao === 'maior-preco') {
            produtos.sort((a, b) => b.preco - a.preco);
        } else if (filtros.ordenacao === 'nome-az') {
            produtos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        }

        if (produtos.length === 0) {
            container.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">Nenhum produto encontrado com os filtros selecionados.</p>';
            return;
        }

        produtos.forEach(produto => {
            const card = document.createElement('div');
            card.className = `produto ${produto.categoria}`;

            const semEstoque = produto.estoque <= 0;

            card.innerHTML = `
                <h3>${utils.escaparHTML(produto.nome)}</h3>
                <img src="${produto.imagem}" alt="${utils.escaparHTML(produto.nome)}" class="pecas" style="cursor: pointer;">
                <p class="preco_produto">${utils.formatarMoeda(produto.preco)}</p>
                <p class="desconto">no Pix com 10% de desconto</p>
                <p style="font-size: 0.85em; color: #555;">Estoque: ${produto.estoque}</p>
                <div style="display: flex; gap: 6px; justify-content: center; margin-top: 8px; width: 100%;">
                    <button type="button" class="btn btn-detalhes" style="flex: 1; padding: 8px 4px; font-size: 0.9em;">Detalhes</button>
                    <button type="button" class="btn btn-comprar" style="flex: 1; padding: 8px 4px; font-size: 0.9em;" ${semEstoque ? 'disabled' : ''}>
                        ${semEstoque ? 'Esgotado' : 'Adicionar'}
                    </button>
                </div>
            `;

            card.querySelector('.pecas').addEventListener('click', () => this.abrirDetalhes(produto.id));
            card.querySelector('.btn-detalhes').addEventListener('click', () => this.abrirDetalhes(produto.id));
            
            if (!semEstoque) {
                card.querySelector('.btn-comprar').addEventListener('click', () => {
                    const adicionou = carrinhoManager.adicionarItem(produto.id, 1);
                    if (adicionou) {
                        uiManager.mostrarToast(`${produto.nome} adicionado ao carrinho!`);
                    }
                });
            }

            container.appendChild(card);
        });
    },
    abrirDetalhes(id) {
        const produto = this.obterProdutos().find(p => p.id === id);
        const modal = document.getElementById('modal-detalhes');
        if (!produto || !modal) return;

        modal.querySelector('.modal-imagem').src = produto.imagem;
        modal.querySelector('.modal-imagem').alt = produto.nome;
        modal.querySelector('.modal-nome').textContent = produto.nome;
        modal.querySelector('.modal-descricao').textContent = produto.descricao;
        modal.querySelector('.modal-preco').textContent = utils.formatarMoeda(produto.preco);
        modal.querySelector('.modal-estoque').textContent = `Estoque disponível: ${produto.estoque} unidades`;

        const inputQtd = modal.querySelector('.modal-qtd');
        inputQtd.max = produto.estoque;
        inputQtd.min = 1;
        inputQtd.value = produto.estoque > 0 ? 1 : 0;

        const btnAdd = modal.querySelector('.modal-add-carrinho');
        btnAdd.disabled = produto.estoque <= 0;
        btnAdd.onclick = () => {
            const qtd = parseInt(inputQtd.value, 10) || 1;
            const adicionou = carrinhoManager.adicionarItem(produto.id, qtd);
            if (adicionou) {
                uiManager.mostrarToast(`${qtd}x ${produto.nome} adicionado(s) ao carrinho!`);
                modal.close();
            }
        };

        modal.showModal();
    }
};