import { storage } from './storage.js';
import { carrinhoManager } from './carrinho.js';
import { produtosManager } from './produtos.js';
import { utils } from './utils.js';

export const comprasManager = {
    finalizarCompra(dadosPagamento, enderecoEntrega) {
        const sessao = storage.get('sessao');
        if (!sessao) throw new Error("Usuário não autenticado");

        const carrinho = carrinhoManager.obterCarrinho();
        if (carrinho.length === 0) throw new Error("Carrinho vazio");

        const produtos = produtosManager.obterProdutos();
       
        for (let item of carrinho) {
            const prod = produtos.find(p => p.id === item.id);
            if (!prod || prod.estoque < item.quantidade) {
                throw new Error(`Estoque insuficiente para o produto: ${item.nome}`);
            }
        }

        carrinho.forEach(item => {
            const prod = produtos.find(p => p.id === item.id);
            prod.estoque -= item.quantidade;
        });
        storage.set('produtos', produtos);

        const clientes = storage.get('clientes') || [];
        const cliente = clientes.find(c => c.id === sessao.id);

        const contadores = storage.get('contadores') || { compras: 1 };
        const idCompra = `CP${String(contadores.compras).padStart(3, '0')}`;
        contadores.compras += 1;
        storage.set('contadores', contadores);

        const subtotal = carrinho.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
        
        const novaCompra = {
            id: idCompra,
            cliente: { id: cliente.id, nome: cliente.nome, email: cliente.email },
            itens: carrinho,
            subtotal: subtotal,
            frete: 20.00, 
            desconto: 0,
            valorTotal: subtotal + 20.00,
            formaPagamento: dadosPagamento.forma,
            endereco: enderecoEntrega,
            dataHora: new Date().toISOString(),
            status: "Pago"
        };

        const compras = storage.get('compras') || [];
        compras.push(novaCompra);
        storage.set('compras', compras);

     
        carrinhoManager.salvarCarrinho([]);

        return novaCompra;
    }
};