import { authManager } from './auth.js';
import { uiManager } from './ui.js';
import { storage } from './storage.js';

export const loginController = {
    async inicializar() {
        await authManager.inicializarAdminPadrao();

        const form = document.getElementById('form-login');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim();
            const senha = document.getElementById('senha').value;
            const erroEl = document.getElementById('login-erro');

            if (erroEl) erroEl.textContent = '';

            try {
                await authManager.login(email, senha);
                uiManager.mostrarToast('Login realizado com sucesso!');

                const urlParams = new URLSearchParams(window.URLSearchParams ? window.location.search : '');
                const redirect = urlParams.get('redirect') || 'index.html';

                setTimeout(() => {
                    window.location.href = redirect;
                }, 1000);

            } catch (error) {
                if (erroEl) {
                    erroEl.textContent = error.message;
                } else {    
                    uiManager.mostrarToast(error.message, 'erro');
                }
            }
        });
    }
};