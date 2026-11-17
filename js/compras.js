import { storage } from './storage.js';
import { carrinhoManager } from './carrinho.js';
import { produtosManager } from './produtos.js';
import { authManager } from './auth.js';
import { utils } from './utils.js';
import { uiManager } from './ui.js';

export const comprasManager = {
    inicializarCheckout() {
        const btnFinalizar = document.getElementById('finalizar-compra');
        const modalCheckout = document.getElementById('modal-checkout');
        if (!btnFinalizar || !modalCheckout) return;

        btnFinalizar.addEventListener('click', () => {
            const carrinho = carrinhoManager.obterCarrinho();
            if (carrinho.length === 0) {
                uiManager.mostrarToast('Seu carrinho está vazio.', 'erro');
                return;
            }

            const sessao = authManager.verificarSessao();
            if (!sessao) {
                uiManager.mostrarToast('Faça login para finalizar sua compra.', 'erro');
                setTimeout(() => {
                    window.location.href = 'login.html?redirect=loja.html';
                }, 1200);
                return;
            }

            this.abrirModalCheckout();
        });

        document.getElementById('btn-etapa-1-proximo')?.addEventListener('click', () => {
            this.mostrarEtapa(2);
        });

        document.getElementById('btn-etapa-2-voltar')?.addEventListener('click', () => {
            this.mostrarEtapa(1);
        });

        document.getElementById('btn-etapa-2-proximo')?.addEventListener('click', () => {
            if (this.validarEndereco()) {
                this.mostrarEtapa(3);
            }
        });

        document.getElementById('btn-etapa-3-voltar')?.addEventListener('click', () => {
            this.mostrarEtapa(2);
        });

        document.querySelectorAll('input[name="forma-pagamento"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const boxCartao = document.getElementById('dados-cartao');
                if (boxCartao) {
                    boxCartao.style.display = e.target.value === 'Cartão de Crédito' ? 'block' : 'none';
                }
            });
        });

        document.getElementById('form-checkout')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.processarPedido();
        });
    },

    abrirModalCheckout() {
        const modal = document.getElementById('modal-checkout');
        const resumoContainer = document.getElementById('checkout-resumo-itens');
        const totaisContainer = document.getElementById('checkout-resumo-totais');
        
        const carrinho = carrinhoManager.obterCarrinho();
        const { subtotal, desconto, frete, total } = carrinhoManager.calcularTotais();

        resumoContainer.innerHTML = carrinho.map(item => `
            <p>${item.quantidade}x ${utils.escaparHTML(item.nome)} — <strong>${utils.formatarMoeda(item.preco * item.quantidade)}</strong></p>
        `).join('');

        totaisContainer.innerHTML = `
            <hr>
            <p>Subtotal: ${utils.formatarMoeda(subtotal)}</p>
            <p>Desconto: -${utils.formatarMoeda(desconto)}</p>
            <p>Frete: ${utils.formatarMoeda(frete)}</p>
            <p style="font-size: 1.1em;"><strong>Total a pagar: ${utils.formatarMoeda(total)}</strong></p>
        `;

        this.mostrarEtapa(1);
        modal.showModal();
    },

    mostrarEtapa(numero) {
        [1, 2, 3].forEach(n => {
            const div = document.getElementById(`checkout-etapa-${n}`);
            if (div) div.style.display = n === numero ? 'block' : 'none';
        });
    },

    validarEndereco() {
        const cep = document.getElementById('chk-cep').value.replace(/\D/g, '');
        const rua = document.getElementById('chk-rua').value.trim();
        const numero = document.getElementById('chk-numero').value.trim();
        const cidade = document.getElementById('chk-cidade').value.trim();
        const erroEl = document.getElementById('erro-endereco');

        if (cep.length !== 8 || !rua || !numero || !cidade) {
            if (erroEl) erroEl.textContent = 'Preencha todos os campos obrigatórios do endereço e um CEP válido (8 dígitos).';
            return false;
        }
        if (erroEl) erroEl.textContent = '';
        return true;
    },

    validarPagamento() {
        const forma = document.querySelector('input[name="forma-pagamento"]:checked')?.value;
        const erroEl = document.getElementById('erro-pagamento');
        if (erroEl) erroEl.textContent = '';

        if (!forma) {
            if (erroEl) erroEl.textContent = 'Selecione uma forma de pagamento.';
            return null;
        }

        if (forma === 'Cartão de Crédito') {
            const numCartao = document.getElementById('chk-cartao-numero').value.replace(/\D/g, '');
            const nomeTitular = document.getElementById('chk-cartao-nome').value.trim();
            const validade = document.getElementById('chk-cartao-validade').value.trim();
            const cvv = document.getElementById('chk-cartao-cvv').value.replace(/\D/g, '');

            if (numCartao.length < 13 || !utils.validarLuhn(numCartao)) {
                if (erroEl) erroEl.textContent = 'Número de cartão inválido (falha na verificação de Luhn).';
                return null;
            }
            if (!nomeTitular) {
                if (erroEl) erroEl.textContent = 'Informe o nome impresso no cartão.';
                return null;
            }
            if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(validade)) {
                if (erroEl) erroEl.textContent = 'Validade inválida. Use o formato MM/AA.';
                return null;
            }
            if (cvv.length < 3 || cvv.length > 4) {
                if (erroEl) erroEl.textContent = 'CVV inválido (3 ou 4 dígitos).';
                return null;
            }

            return {
                forma,
                detalhes: `Final ${numCartao.slice(-4)}`
            };
        }

        return { forma, detalhes: forma };
    },

    processarPedido() {
        const dadosPagamento = this.validarPagamento();
        if (!dadosPagamento) return;

        const sessao = authManager.verificarSessao();
        if (!sessao) return;

        const carrinho = carrinhoManager.obterCarrinho();
        const produtos = produtosManager.obterProdutos();

        for (const item of carrinho) {
            const prodAtual = produtos.find(p => p.id === item.id);
            if (!prodAtual || prodAtual.estoque < item.quantidade) {
                uiManager.mostrarToast(`Estoque insuficiente para "${item.nome}". Disponível: ${prodAtual ? prodAtual.estoque : 0}.`, 'erro');
                return;
            }
        }

        carrinho.forEach(item => {
            const prodAtual = produtos.find(p => p.id === item.id);
            prodAtual.estoque -= item.quantidade;
        });
        storage.set('produtos', produtos);

        const contadores = storage.get('contadores') || { clientes: 1, compras: 1 };
        if (!contadores.compras) contadores.compras = 1;
        const idCompra = `CP${String(contadores.compras).padStart(3, '0')}`;
        contadores.compras += 1;
        storage.set('contadores', contadores);

        const clientes = storage.get('clientes') || [];
        const cliente = clientes.find(c => c.id === sessao.id);
        const { subtotal, desconto, frete, total } = carrinhoManager.calcularTotais();

        const novaCompra = {
            id: idCompra,
            cliente: {
                id: cliente.id,
                nome: cliente.nome,
                email: cliente.email
            },
            itens: carrinho.map(i => ({
                id: i.id,
                nome: i.nome,
                precoUnitario: i.preco,
                quantidade: i.quantidade
            })),
            subtotal,
            desconto,
            frete,
            valorTotal: total,
            formaPagamento: dadosPagamento.forma,
            detalhesPagamento: dadosPagamento.detalhes,
            endereco: {
                cep: document.getElementById('chk-cep').value.trim(),
                rua: document.getElementById('chk-rua').value.trim(),
                numero: document.getElementById('chk-numero').value.trim(),
                cidade: document.getElementById('chk-cidade').value.trim()
            },
            dataHora: new Date().toISOString(),
            status: 'Pago'
        };

        const compras = storage.get('compras') || [];
        compras.push(novaCompra);
        storage.set('compras', compras);

        carrinhoManager.cupomAtivo = null;
        carrinhoManager.salvarCarrinho([]);

        document.getElementById('modal-checkout').close();
        produtosManager.inicializarFiltros();

        const boxConfirmacao = document.querySelector('.confirmacao-compra');
        if (boxConfirmacao) {
            boxConfirmacao.querySelector('.numero-pedido').textContent = idCompra;
            boxConfirmacao.hidden = false;
            boxConfirmacao.scrollIntoView({ behavior: 'smooth' });
        }

        uiManager.mostrarToast(`Pedido ${idCompra} finalizado com sucesso!`);
    }
};