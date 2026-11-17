import { storage } from './storage.js';
import { utils } from './utils.js';

export const relatoriosManager = {
    renderizarIndicadores() {
        const clientes = storage.get('clientes') || [];
        const compras = storage.get('compras') || [];

        const totalClientes = clientes.length;
        const totalCompras = compras.length;
        const faturamento = compras.reduce((acc, c) => acc + c.valorTotal, 0);
        const ticketMedio = totalCompras > 0 ? faturamento / totalCompras : 0;

        document.getElementById('ind-clientes').textContent = totalClientes;
        document.getElementById('ind-compras').textContent = totalCompras;
        document.getElementById('ind-faturamento').textContent = utils.formatarMoeda(faturamento);
        document.getElementById('ind-ticket').textContent = utils.formatarMoeda(ticketMedio);
    },

    exportarCSV(dados, nomeArquivo) {
        if (!dados || dados.length === 0) return;
        const colunas = Object.keys(dados[0]);
        let csvContent = "\uFEFF" + colunas.join(";") + "\n";

        dados.forEach(obj => {
            const linha = colunas.map(col => {
                let valor = obj[col] !== undefined ? obj[col] : '';
                if (typeof valor === 'object') valor = JSON.stringify(valor);
                return `"${String(valor).replace(/"/g, '""')}"`;
            }).join(";");
            csvContent += linha + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", nomeArquivo);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};