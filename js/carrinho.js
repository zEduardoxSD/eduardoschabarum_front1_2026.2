 import { storage } from './storage.js';
import { produtosManager } from './produtos.js';
import { utils } from './utils.js';
import { uiManager } from './ui.js';

const CUPONS = {
    'SCHMIDT10': { tipo: 'percentual', valor: 0.10, minimo: 100, validade: '2026-12-31', desc: '10% de desconto' },
    'MENOS30':   { tipo: 'fixo', valor: 30.00, minimo: 150, validade: '2026-12-31', desc: 'R$ 30,00 de desconto' },
    'FRETEZERO': { tipo: 'frete', valor: 0, minimo: 80, validade: '2026-12-31', desc: 'Frete grátis' }
};

export const carrinhoManager = {
    cupomAtivo: null,
    valorFrete: 0,

    obterCarrinho() {
        const sessao = storage.get('sessao');
        const chave = sessao ? `carrinho_${sessao.id}` : 'carrinho_visitante';
        return storage.get(chave) || [];
    },

    salvarCarrinho(carrinho) {
        const sessao = storage.get('sessao');
        const chave = sessao ? `carrinho_${sessao.id}` : 'carrinho_visitante';
        storage.set(chave, carrinho);
        this.atualizarBadge();
        this.renderizarCarrinho();
    },

    adicionarItem(produtoId, quantidade = 1) {
        const produtos = produtosManager.obterProdutos();
        const produto = produtos.find(p => p.id === produtoId);
        if (!produto) return false;

        let carrinho = this.obterCarrinho();
        const itemExistente = carrinho.find(i => i.id === produtoId);
        const qtdAtual = itemExistente ? itemExistente.quantidade : 0;

        if (qtdAtual + quantidade > produto.estoque) {
            uiManager.mostrarToast(`Estoque insuficiente. Máximo disponível: ${produto.estoque}.`, 'erro');
            return false;
        }

        if (itemExistente) {
            itemExistente.quantidade += quantidade;
        } else {
            carrinho.push({
                id: produto.id,
                nome: produto.nome,
                preco: produto.preco,
                quantidade,
                imagem: produto.imagem
            });
        }

        this.salvarCarrinho(carrinho);
        return true;
    },

    alterarQuantidade(produtoId, delta) {
        const produtos = produtosManager.obterProdutos();
        const produto = produtos.find(p => p.id === produtoId);
        let carrinho = this.obterCarrinho();
        const item = carrinho.find(i => i.id === produtoId);

        if (!item || !produto) return;

        const novaQtd = item.quantidade + delta;
        if (novaQtd <= 0) {
            this.removerItem(produtoId);
            return;
        }

        if (novaQtd > produto.estoque) {
            uiManager.mostrarToast(`Limite de estoque atingido (${produto.estoque} un.).`, 'erro');
            return;
        }

        item.quantidade = novaQtd;
        this.salvarCarrinho(carrinho);
    },

    removerItem(produtoId) {
        let carrinho = this.obterCarrinho().filter(i => i.id !== produtoId);
        this.salvarCarrinho(carrinho);
    },

    aplicarCupom(codigo) {
        const code = codigo.trim().toUpperCase();
        const cupom = CUPONS[code];
        const subtotal = this.calcularSubtotal();

        if (!cupom) {
            this.cupomAtivo = null;
            this.renderizarCarrinho();
            return { ok: false, msg: 'Cupom inválido ou inexistente.' };
        }
        if (new Date() > new Date(cupom.validade + 'T23:59:59')) {
            this.cupomAtivo = null;
            this.renderizarCarrinho();
            return { ok: false, msg: 'Este cupom está expirado.' };
        }
        if (subtotal < cupom.minimo) {
            this.cupomAtivo = null;
            this.renderizarCarrinho();
            return { ok: false, msg: `Compra mínima de ${utils.formatarMoeda(cupom.minimo)} para este cupom.` };
        }

        this.cupomAtivo = { codigo: code, ...cupom };
        this.renderizarCarrinho();
        return { ok: true, msg: `Cupom ${code} aplicado (${cupom.desc})!` };
    },

    calcularFretePorCEP(cep) {
        const limpo = cep.replace(/\D/g, '');
        if (limpo.length !== 8) {
            return { ok: false, msg: 'Digite um CEP válido com 8 números.' };
        }

        const subtotal = this.calcularSubtotal();
        if (subtotal >= 300 || (this.cupomAtivo && this.cupomAtivo.tipo === 'frete')) {
            this.valorFrete = 0;
            this.renderizarCarrinho();
            return { ok: true, msg: 'Frete Grátis aplicado!' };
        }

        const prefixo = parseInt(limpo.substring(0, 2), 10);
        if (prefixo >= 88 && prefixo <= 89) {
            this.valorFrete = 15.00; 
        } else if (prefixo >= 80 && prefixo <= 99) {
            this.valorFrete = 25.00; 
        } else {
            this.valorFrete = 45.00;
        }

        this.renderizarCarrinho();
        return { ok: true, msg: `Frete calculado: ${utils.formatarMoeda(this.valorFrete)}` };
    },

    calcularSubtotal() {
        return this.obterCarrinho().reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    },

    calcularTotais() {
        const subtotal = this.calcularSubtotal();
        let desconto = 0;
        let frete = subtotal >= 300 ? 0 : this.valorFrete;

        if (this.cupomAtivo && subtotal >= this.cupomAtivo.minimo) {
            if (this.cupomAtivo.tipo === 'percentual') {
                desconto = subtotal * this.cupomAtivo.valor;
            } else if (this.cupomAtivo.tipo === 'fixo') {
                desconto = this.cupomAtivo.valor;
            } else if (this.cupomAtivo.tipo === 'frete') {
                frete = 0;
            }
        }

        const total = Math.max(0, subtotal - desconto + frete);
        return { subtotal, desconto, frete, total };
    },

    renderizarCarrinho() {
        const lista = document.getElementById('lista-carrinho');
        const totalEl = document.getElementById('total');
        if (!lista) return;

        const carrinho = this.obterCarrinho();
        lista.innerHTML = '';

        if (carrinho.length === 0) {
            lista.innerHTML = '<li style="list-style: none; padding: 10px;">Seu carrinho está vazio.</li>';
            if (totalEl) totalEl.textContent = 'Total: R$ 0,00';
            return;
        }

        carrinho.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <h3>${utils.escaparHTML(item.nome)}</h3>
                <img src="${item.imagem}" alt="${utils.escaparHTML(item.nome)}" class="pecas">
                <p class="preco_produto">${utils.formatarMoeda(item.preco)} (un.)</p>
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin: 8px 0;">
                    <button type="button" class="btn btn-menos">−</button>
                    <span><strong>${item.quantidade}</strong></span>
                    <button type="button" class="btn btn-mais">+</button>
                </div>
                <p>Subtotal: <strong>${utils.formatarMoeda(item.preco * item.quantidade)}</strong></p>
                <button type="button" class="btn btn-remover">Remover</button>
            `;

            li.querySelector('.btn-menos').addEventListener('click', () => this.alterarQuantidade(item.id, -1));
            li.querySelector('.btn-mais').addEventListener('click', () => this.alterarQuantidade(item.id, 1));
            li.querySelector('.btn-remover').addEventListener('click', () => this.removerItem(item.id));

            lista.appendChild(li);
        });

        const { subtotal, desconto, frete, total } = this.calcularTotais();
        if (totalEl) {
            totalEl.innerHTML = `
                Subtotal: ${utils.formatarMoeda(subtotal)} | 
                Desconto: -${utils.formatarMoeda(desconto)} | 
                Frete: ${utils.formatarMoeda(frete)} <br>
                <strong>Total: ${utils.formatarMoeda(total)}</strong>
            `;
        }
    },

    atualizarBadge() {
        const totalItens = this.obterCarrinho().reduce((acc, item) => acc + item.quantidade, 0);
        const badge = document.getElementById('carrinho-badge');
        if (badge) badge.textContent = totalItens;
    },

    mesclarCarrinhoAoLogar(userId) {
        const visitante = storage.get('carrinho_visitante') || [];
        if (visitante.length === 0) return;

        const chaveUsuario = `carrinho_${userId}`;
        let usuarioCarrinho = storage.get(chaveUsuario) || [];
        const produtos = produtosManager.obterProdutos();

        visitante.forEach(itemVis => {
            const prod = produtos.find(p => p.id === itemVis.id);
            const estoqueMax = prod ? prod.estoque : itemVis.quantidade;
            const existente = usuarioCarrinho.find(i => i.id === itemVis.id);

            if (existente) {
                existente.quantidade = Math.min(estoqueMax, existente.quantidade + itemVis.quantidade);
            } else {
                usuarioCarrinho.push({ ...itemVis, quantidade: Math.min(estoqueMax, itemVis.quantidade) });
            }
        });

        storage.set(chaveUsuario, usuarioCarrinho);
        storage.remove('carrinho_visitante');
    }
};