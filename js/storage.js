const STORAGE_PREFIX = 'loja:';

export const storage = {
    get(key) {
        try {
            const data = localStorage.getItem(STORAGE_PREFIX + key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`Erro ao ler ${key} do localStorage:`, error);
            return null;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Erro ao salvar ${key} no localStorage:`, error);
            return false;
        }
    },
    remove(key) {
        try {
            localStorage.removeItem(STORAGE_PREFIX + key);
        } catch (error) {
            console.error(`Erro ao remover ${key} do localStorage:`, error);
        }
    }
};