import { storage } from './storage.js';
import { authManager } from './auth.js';
import { utils } from './utils.js';
import { uiManager } from './ui.js';

export const relatoriosManager = {
    paginaClientes: 1,
    itensPorPagina: 10,
    ordenacaoClientes: { coluna: 'id', asc: true },
    clientesFiltrados: [],
    comprasFiltradas: [],

    inicializar() {
        const sessao = authManager.protegerPagina('administrador');
        if (!sessao) return;

        const clientes = storage.get('clientes') || [];
        const admin = clientes.find(c => c.id === sessao.id);
        const emissaoData = document.getElementById('emissao-data');
        const emissaoAdmin = document.getElementById('emissao-admin');
        if (emissaoData) emissaoData.textContent = utils.formatarData(new Date());
        if (emissaoAdmin) emissaoAdmin.textContent = admin ? `${admin.nome} (${admin.id})` : 'Administrador';

        this.renderizarIndicadores();
        this.inicializarEventosClientes();
        this.inicializarEventosCompras();
        this.renderizarMensagensContato();
    },

    renderizarIndicadores() {
        const clientes = storage.get('clientes') || [];
        const compras = storage.get('compras') || [];
        const comprasValidas = compras.filter(c => c.status !== 'Cancelado');

        const totalClientes = clientes.length;
        const totalCompras = comprasValidas.length;
        const faturamento = comprasValidas.reduce((acc, c) => acc + c.valorTotal, 0);
        const ticketMedio = totalCompras > 0 ? faturamento / totalCompras : 0;

        document.getElementById('ind-clientes').textContent = totalClientes;
        document.getElementById('ind-compras').textContent = totalCompras;
        document.getElementById('ind-faturamento').textContent = utils.formatarMoeda(faturamento);
        document.getElementById('ind-ticket').textContent = utils.formatarMoeda(ticketMedio);

        const contagemProdutos = {};
        comprasValidas.forEach(compra => {
            compra.itens.forEach(item => {
                contagemProdutos[item.nome] = (contagemProdutos[item.nome] || 0) + item.quantidade;
            });
        });

        const top5 = Object.entries(contagemProdutos)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const listaTop5 = document.getElementById('top-produtos');
        if (listaTop5) {
            listaTop5.innerHTML = top5.length
                ? top5.map(([nome, qtd]) => `<li>${utils.escaparHTML(nome)} — <strong>${qtd} un.</strong></li>`).join('')
                : '<li>Nenhuma venda registrada ainda.</li>';
        }

        const vendasPorDia = {};
        comprasValidas.forEach(c => {
            const dia = new Date(c.dataHora).toLocaleDateString('pt-BR');
            vendasPorDia[dia] = (vendasPorDia[dia] || 0) + c.valorTotal;
        });

        const graficoEl = document.getElementById('grafico-vendas');
        if (graficoEl) {
            const entradas = Object.entries(vendasPorDia);
            if (entradas.length === 0) {
                graficoEl.innerHTML = '<p>Sem dados de faturamento para exibir no gráfico.</p>';
            } else {
                const maxValor = Math.max(...entradas.map(e => e[1]));
                graficoEl.innerHTML = entradas.map(([dia, valor]) => {
                    const largura = Math.round((valor / maxValor) * 100);
                    return `
                        <div style="margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.9em;">
                                <span>${dia}</span>
                                <strong>${utils.formatarMoeda(valor)}</strong>
                            </div>
                            <div style="background: #e0e0e0; height: 18px; border-radius: 4px; overflow: hidden;">
                                <div style="background: #1b4965; width: ${largura}%; height: 100%;"></div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    },


    inicializarEventosClientes() {
        const inputBusca = document.getElementById('busca-cliente');
        const selectCriterio = document.getElementById('criterio-cliente');
        const formBusca = document.getElementById('form-busca-cliente');

        const atualizar = () => {
            this.paginaClientes = 1;
            this.filtrarERenderizarClientes();
        };

        formBusca?.addEventListener('submit', (e) => { e.preventDefault(); atualizar(); });
        inputBusca?.addEventListener('input', atualizar);
        selectCriterio?.addEventListener('change', atualizar);

        document.querySelectorAll('#tabela-clientes th[data-sort]').forEach(th => {
            th.style.cursor = 'pointer';
            th.addEventListener('click', () => {
                const col = th.getAttribute('data-sort');
                if (this.ordenacaoClientes.coluna === col) {
                    this.ordenacaoClientes.asc = !this.ordenacaoClientes.asc;
                } else {
                    this.ordenacaoClientes = { coluna: col, asc: true };
                }
                this.filtrarERenderizarClientes();
            });
        });

        document.getElementById('btn-pag-anterior')?.addEventListener('click', () => {
            if (this.paginaClientes > 1) {
                this.paginaClientes--;
                this.filtrarERenderizarClientes();
            }
        });

        document.getElementById('btn-pag-proxima')?.addEventListener('click', () => {
            const totalPaginas = Math.ceil(this.clientesFiltrados.length / this.itensPorPagina);
            if (this.paginaClientes < totalPaginas) {
                this.paginaClientes++;
                this.filtrarERenderizarClientes();
            }
        });

        document.getElementById('btn-csv-clientes')?.addEventListener('click', () => {
            const dadosLimpos = this.clientesFiltrados.map(c => ({
                ID: c.id,
                Nome: c.nome,
                Email: c.email,
                CPF: c.cpf,
                Telefone: c.telefone || '',
                Perfil: c.perfil,
                Status: c.bloqueado ? 'Bloqueado' : 'Ativo'
            }));
            this.exportarCSV(dadosLimpos, 'relatorio_clientes.csv');
        });

        this.filtrarERenderizarClientes();
    },

    normalizarTexto(str) {
        return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    },

    destacarTermo(texto, termo) {
        const seguro = utils.escaparHTML(texto);
        if (!termo) return seguro;
        const regex = new RegExp(`(${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return seguro.replace(regex, '<mark>$1</mark>');
    },

    filtrarERenderizarClientes() {
        const clientes = storage.get('clientes') || [];
        const termoRaw = document.getElementById('busca-cliente')?.value.trim() || '';
        const criterio = document.getElementById('criterio-cliente')?.value || 'todos';
        const termoNorm = this.normalizarTexto(termoRaw);
        const termoNumeros = termoRaw.replace(/\D/g, '');

        this.clientesFiltrados = clientes.filter(c => {
            if (!termoRaw) return true;
            const matchNome = this.normalizarTexto(c.nome).includes(termoNorm);
            const matchId = this.normalizarTexto(c.id).includes(termoNorm);
            const matchEmail = this.normalizarTexto(c.email).includes(termoNorm);
            const cpfLimpo = (c.cpf || '').replace(/\D/g, '');
            const matchCpf = this.normalizarTexto(c.cpf).includes(termoNorm) || (termoNumeros && cpfLimpo.includes(termoNumeros));

            if (criterio === 'nome') return matchNome;
            if (criterio === 'id') return matchId;
            if (criterio === 'email') return matchEmail;
            if (criterio === 'cpf') return matchCpf;
            return matchNome || matchId || matchEmail || matchCpf;
        });

        const { coluna, asc } = this.ordenacaoClientes;
        this.clientesFiltrados.sort((a, b) => {
            const valA = String(a[coluna] || '');
            const valB = String(b[coluna] || '');
            return asc ? valA.localeCompare(valB, 'pt-BR') : valB.localeCompare(valA, 'pt-BR');
        });

        const totalRegistros = this.clientesFiltrados.length;
        const totalPaginas = Math.max(1, Math.ceil(totalRegistros / this.itensPorPagina));
        if (this.paginaClientes > totalPaginas) this.paginaClientes = totalPaginas;

        const inicio = (this.paginaClientes - 1) * this.itensPorPagina;
        const paginados = this.clientesFiltrados.slice(inicio, inicio + this.itensPorPagina);

        const tbody = document.getElementById('tbody-clientes');
        if (tbody) {
            tbody.innerHTML = paginados.length ? paginados.map(c => `
                <tr>
                    <td>${this.destacarTermo(c.id, termoRaw)}</td>
                    <td>${this.destacarTermo(c.nome, termoRaw)}</td>
                    <td>${this.destacarTermo(c.email, termoRaw)}</td>
                    <td>${this.destacarTermo(c.cpf, termoRaw)}</td>
                    <td>${c.bloqueado ? '<strong style="color:red;">Bloqueado</strong>' : 'Ativo'}</td>
                    <td>
                        ${c.perfil !== 'administrador' ? `
                            <button type="button" class="btn-toggle-bloqueio" data-id="${c.id}">
                                ${c.bloqueado ? 'Desbloquear' : 'Bloquear'}
                            </button>
                        ` : '<em>Admin</em>'}
                    </td>
                </tr>
            `).join('') : '<tr><td colspan="6">Nenhum cliente encontrado.</td></tr>';

            tbody.querySelectorAll('.btn-toggle-bloqueio').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.alternarBloqueioCliente(btn.getAttribute('data-id'));
                });
            });
        }

        const totalEl = document.getElementById('total-clientes-rodape');
        if (totalEl) totalEl.textContent = `Total de clientes encontrados: ${totalRegistros}`;

        const infoPag = document.getElementById('info-paginacao-clientes');
        if (infoPag) infoPag.textContent = `Página ${this.paginaClientes} de ${totalPaginas}`;
    },

    alternarBloqueioCliente(clienteId) {
        const clientes = storage.get('clientes') || [];
        const idx = clientes.findIndex(c => c.id === clienteId);
        if (idx === -1) return;

        clientes[idx].bloqueado = !clientes[idx].bloqueado;
        storage.set('clientes', clientes);
        uiManager.mostrarToast(`Cliente ${clientes[idx].nome} ${clientes[idx].bloqueado ? 'bloqueado' : 'desbloqueado'}.`);
        this.filtrarERenderizarClientes();
    },


    inicializarEventosCompras() {
        const form = document.getElementById('form-busca-compra');
        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.filtrarERenderizarCompras();
        });

        document.getElementById('btn-limpar-filtros-compra')?.addEventListener('click', () => {
            form?.reset();
            this.filtrarERenderizarCompras();
        });

        document.getElementById('btn-csv-compras')?.addEventListener('click', () => {
            const dadosLimpos = this.comprasFiltradas.map(c => ({
                ID: c.id,
                Cliente: c.cliente.nome,
                EmailCliente: c.cliente.email,
                Produtos: c.itens.map(i => `${i.quantidade}x ${i.nome}`).join(' | '),
                Total: c.valorTotal.toFixed(2).replace('.', ','),
                Pagamento: c.formaPagamento,
                Data: utils.formatarData(c.dataHora),
                Status: c.status
            }));
            this.exportarCSV(dadosLimpos, 'relatorio_compras.csv');
        });

        this.filtrarERenderizarCompras();
    },

    filtrarERenderizarCompras() {
        const compras = storage.get('compras') || [];
        const termo = this.normalizarTexto(document.getElementById('busca-compra')?.value.trim() || '');
        const dataInicio = document.getElementById('filtro-data-inicio')?.value;
        const dataFim = document.getElementById('filtro-data-fim')?.value;
        const valorMin = parseFloat(document.getElementById('filtro-valor-min')?.value);
        const valorMax = parseFloat(document.getElementById('filtro-valor-max')?.value);

        this.comprasFiltradas = compras.filter(c => {
            if (termo) {
                const matchId = this.normalizarTexto(c.id).includes(termo);
                const matchCliente = this.normalizarTexto(c.cliente.nome).includes(termo);
                const matchProd = c.itens.some(i => this.normalizarTexto(i.nome).includes(termo));
                if (!matchId && !matchCliente && !matchProd) return false;
            }
            const dataCompra = c.dataHora.slice(0, 10);
            if (dataInicio && dataCompra < dataInicio) return false;
            if (dataFim && dataCompra > dataFim) return false;
            if (!isNaN(valorMin) && c.valorTotal < valorMin) return false;
            if (!isNaN(valorMax) && c.valorTotal > valorMax) return false;

            return true;
        });

        const tbody = document.getElementById('tbody-compras');
        if (tbody) {
            tbody.innerHTML = this.comprasFiltradas.length ? this.comprasFiltradas.map(c => {
                const resumoProdutos = c.itens.map(i => `${i.quantidade}x ${i.nome}`).join(', ');
                const qtdTotal = c.itens.reduce((acc, i) => acc + i.quantidade, 0);
                return `
                    <tr>
                        <td>${utils.escaparHTML(c.id)}</td>
                        <td>${utils.escaparHTML(c.cliente.nome)}</td>
                        <td>${utils.escaparHTML(resumoProdutos)}</td>
                        <td>${qtdTotal}</td>
                        <td>${utils.formatarMoeda(c.valorTotal)}</td>
                        <td>${utils.formatarData(c.dataHora)}</td>
                        <td><strong>${utils.escaparHTML(c.status)}</strong></td>
                        <td>
                            <button type="button" class="btn-gerenciar-compra" data-id="${c.id}">Gerenciar</button>
                        </td>
                    </tr>
                `;
            }).join('') : '<tr><td colspan="8">Nenhuma compra encontrada.</td></tr>';

            tbody.querySelectorAll('.btn-gerenciar-compra').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.abrirModalCompra(btn.getAttribute('data-id'));
                });
            });
        }

        const somaTotal = this.comprasFiltradas.reduce((acc, c) => acc + c.valorTotal, 0);
        const rodapeCompras = document.getElementById('total-compras-rodape');
        if (rodapeCompras) {
            rodapeCompras.innerHTML = `Total de compras filtradas: <strong>${this.comprasFiltradas.length}</strong> | Somatório dos valores: <strong>${utils.formatarMoeda(somaTotal)}</strong>`;
        }
    },

    abrirModalCompra(compraId) {
        const compras = storage.get('compras') || [];
        const compra = compras.find(c => c.id === compraId);
        const modal = document.getElementById('modal-detalhes-compra');
        if (!compra || !modal) return;

        document.getElementById('modal-compra-conteudo').innerHTML = `
            <h3>Pedido #${utils.escaparHTML(compra.id)}</h3>
            <p><strong>Cliente:</strong> ${utils.escaparHTML(compra.cliente.nome)} (${utils.escaparHTML(compra.cliente.email)})</p>
            <p><strong>Data:</strong> ${utils.formatarData(compra.dataHora)}</p>
            <p><strong>Pagamento:</strong> ${utils.escaparHTML(compra.formaPagamento)} (${utils.escaparHTML(compra.detalhesPagamento || '')})</p>
            <p><strong>Endereço:</strong> ${utils.escaparHTML(compra.endereco.rua)}, ${utils.escaparHTML(compra.endereco.numero)} - ${utils.escaparHTML(compra.endereco.cidade)} (CEP: ${utils.escaparHTML(compra.endereco.cep)})</p>
            <ul>
                ${compra.itens.map(i => `<li>${i.quantidade}x ${utils.escaparHTML(i.nome)} — ${utils.formatarMoeda(i.precoUnitario * i.quantidade)}</li>`).join('')}
            </ul>
            <p><strong>Total: ${utils.formatarMoeda(compra.valorTotal)}</strong></p>
        `;

        const selectStatus = document.getElementById('select-status-compra');
        selectStatus.value = compra.status;
        selectStatus.disabled = compra.status === 'Cancelado';

        const btnSalvarStatus = document.getElementById('btn-salvar-status-compra');
        btnSalvarStatus.disabled = compra.status === 'Cancelado';
        btnSalvarStatus.onclick = () => {
            const novoStatus = selectStatus.value;
            if (novoStatus === compra.status) {
                modal.close();
                return;
            }

            if (novoStatus === 'Cancelado' && compra.status !== 'Cancelado') {
                const produtos = storage.get('produtos') || [];
                compra.itens.forEach(item => {
                    const prod = produtos.find(p => p.id === item.id);
                    if (prod) prod.estoque += item.quantidade;
                });
                storage.set('produtos', produtos);
            }

            compra.status = novoStatus;
            storage.set('compras', compras);
            uiManager.mostrarToast(`Status do pedido ${compra.id} atualizado para ${novoStatus}.`);
            modal.close();
            this.renderizarIndicadores();
            this.filtrarERenderizarCompras();
        };

        modal.showModal();
    },
    renderizarMensagensContato() {
        const container = document.getElementById('lista-mensagens-contato');
        if (!container) return;

        const mensagens = storage.get('mensagens') || [];
        if (mensagens.length === 0) {
            container.innerHTML = '<p>Nenhuma mensagem de contato recebida.</p>';
            return;
        }

        container.innerHTML = mensagens.map((m, idx) => `
            <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 8px; border-radius: 6px; background: ${m.lida ? 'transparent' : 'rgba(27, 73, 101, 0.08)'};">
                <p><strong>${utils.escaparHTML(m.nome)}</strong> (${utils.escaparHTML(m.email)}) — <small>${utils.formatarData(m.dataHora)}</small></p>
                <p>${utils.escaparHTML(m.mensagem)}</p>
                ${m.lida
                    ? '<small style="color: green;">✔ Lida</small>'
                    : `<button type="button" class="btn-marcar-lida" data-idx="${idx}">Marcar como lida</button>`}
            </div>
        `).join('');

        container.querySelectorAll('.btn-marcar-lida').forEach(btn => {
            btn.addEventListener('click', () => {
                const i = parseInt(btn.getAttribute('data-idx'), 10);
                mensagens[i].lida = true;
                storage.set('mensagens', mensagens);
                this.renderizarMensagensContato();
            });
        });
    },

    exportarCSV(dados, nomeArquivo) {
        if (!dados || dados.length === 0) {
            uiManager.mostrarToast('Não há dados filtrados para exportar.', 'erro');
            return;
        }
        const colunas = Object.keys(dados[0]);
        let csvContent = "\uFEFF" + colunas.join(";") + "\n";

        dados.forEach(obj => {
            const linha = colunas.map(col => {
                const valor = obj[col] !== undefined && obj[col] !== null ? String(obj[col]) : '';
                return `"${valor.replace(/"/g, '""')}"`;
            }).join(";");
            csvContent += linha + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = nomeArquivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};