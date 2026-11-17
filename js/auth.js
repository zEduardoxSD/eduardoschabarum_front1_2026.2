import { storage } from './storage.js';

export const authManager = {
    async inicializarAdminPadrao() {
        let clientes = storage.get('clientes') || [];
        const existeAdmin = clientes.some(c => c.perfil === 'administrador');

        if (!existeAdmin) {
            const salt = 'admin_salt_seguro';
            const hashSenha = await this.gerarHashSenha('admin123', salt); // Senha padrão
            
            const adminPadrao = {
                id: 'C000',
                nome: 'Administrador do Sistema',
                cpf: '000.000.000-00',
                email: 'admin@schmidt.com',
                telefone: '48999999999',
                hashSenha,
                salt,
                perfil: 'administrador',
                bloqueado: false,
                dataCadastro: new Date().toISOString()
            };

            clientes.push(adminPadrao);
            storage.set('clientes', clientes);
        }
    },

    async gerarHashSenha(senha, salt) {
        const encoder = new TextEncoder();
        const data = encoder.encode(senha + salt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    async login(email, senha) {
        let tentativasData = storage.get(`bloqueio_${email}`) || { count: 0, bloqueadoAte: 0 };
        const agora = Date.now();

        if (tentativasData.bloqueadoAte > agora) {
            const segundosRestantes = Math.ceil((tentativasData.bloqueadoAte - agora) / 1000);
            throw new Error(`Muitas tentativas falhas. Tente novamente em ${segundosRestantes} segundos.`);
        }

        const clientes = storage.get('clientes') || [];
        const cliente = clientes.find(c => c.email.toLowerCase() === email.toLowerCase());

        if (!cliente || cliente.bloqueado) {
            this.registrarFalhaTentativa(email, tentativasData, agora);
            throw new Error("E-mail ou senha inválidos");
        }

        const hashSenha = await this.gerarHashSenha(senha, cliente.salt);
        if (hashSenha !== cliente.hashSenha) {
            this.registrarFalhaTentativa(email, tentativasData, agora);
            throw new Error("E-mail ou senha inválidos");
        }

        storage.remove(`bloqueio_${email}`);
        
        const sessao = {
            id: cliente.id,
            perfil: cliente.perfil,
            inicio: Date.now(),
            expiracao: Date.now() + (30 * 60 * 1000)
        };
        storage.set('sessao', sessao);

        import('./carrinho.js').then(m => {
            m.carrinhoManager.mesclarCarrinhoAoLogar(cliente.id);
        });

        return sessao;
    },

    registrarFalhaTentativa(email, tentativasData, agora) {
        tentativasData.count += 1;
        if (tentativasData.count >= 3) {
            tentativasData.bloqueadoAte = agora + (60 * 1000); 
            tentativasData.count = 0;
        }
        storage.set(`bloqueio_${email}`, tentativasData);
    },

    verificarSessao() {
        const sessao = storage.get('sessao');
        if (!sessao) return null;

        if (Date.now() > sessao.expiracao) {
            storage.remove('sessao');
            return null;
        }

        sessao.expiracao = Date.now() + (30 * 60 * 1000);
        storage.set('sessao', sessao);
        return sessao;
    },

    protegerPagina(perfilRequerido = null) {
        const sessao = this.verificarSessao();
        const paginaAtual = window.location.pathname.split('/').pop();

        if (!sessao) {
            window.location.href = `login.html?redirect=${encodeURIComponent(paginaAtual)}`;
            return false;
        }

        if (perfilRequerido && sessao.perfil !== perfilRequerido) {
            alert("Acesso negado. Você não tem permissão para acessar esta área.");
            window.location.href = 'index.html';
            return false;
        }

        return sessao;
    },

    logout() {
        storage.remove('sessao');
        window.location.href = 'login.html';
    }
};