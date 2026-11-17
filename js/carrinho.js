import { storage } from './storage.js';
import { produtosManager } from './produtos.js';
import { utils } from './utils.js';

export const carrinhoManager = {
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
    },

    adicionarItem(produtoId, quantidade = 1) {
        const produtos = produtosManager.obterProdutos();
        const produto = produtos.find(p => p.id === produtoId);
        if (!produto) return;

        let carrinho = this.obterCarrinho();
        const itemExistente = carrinho.find(i => i.id === produtoId);

        const qtdAtual = itemExistente ? itemExistente.quantidade : 0;
        if (qtdAtual + quantidade > produto.estoque) {
            alert("Estoque insuficiente.");
            return;
        }

        if (itemExistente) {
            itemExistente.quantidade += quantidade;
        } else {
            carrinho.push({
                id: produto.id,
                nome: produto.nome,
                preco: produto.preco,
                quantidade: quantidade,
                imagem: produto.imagem
            });
        }

        this.salvarCarrinho(carrinho);
    },

    removerItem(produtoId) {
        let carrinho = this.obterCarrinho();
        carrinho = carrinho.filter(i => i.id !== produtoId);
        this.salvarCarrinho(carrinho);
    },

    atualizarBadge() {
        const carrinho = this.obterCarrinho();
        const totalItens = carrinho.reduce((acc, item) => acc + item.quantidade, 0);
        const badge = document.getElementById('carrinho-badge');
        if (badge) {
            badge.textContent = totalItens;
        }
    },

    mesclarCarrinhoAoLogar(userId) {
        const visitanteCarrinho = storage.get('carrinho_visitante') || [];
        if (visitanteCarrinho.length === 0) return;

        const chaveUsuario = `carrinho_${userId}`;
        let usuarioCarrinho = storage.get(chaveUsuario) || [];

        visitanteCarrinho.forEach(itemVisitante => {
            const itemExistente = usuarioCarrinho.find(i => i.id === itemVisitante.id);
            if (itemExistente) {
                itemExistente.quantidade += itemVisitante.quantidade;
            } else {
                usuarioCarrinho.push(itemVisitante);
            }
        });

        storage.set(chaveUsuario, usuarioCarrinho);
        storage.remove('carrinho_visitante');
    }
};