// Cache em memória (LRU básico)
const cache = new Map();
const CACHE_TTL = 60000; // 60 segundos

export const getCachedSearch = (key) => {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
    if (cached) cache.delete(key);
    return null;
};

export const setCachedSearch = (key, data) => {
    if (cache.size > 20) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
    }
    cache.set(key, { data, timestamp: Date.now() });
};

// Destacador de texto (Retorna um Array de Objetos em JS puro, sem JSX)
export const highlightText = (text, query) => {
    if (!query || !text) return [{ text: String(text || ''), highlight: false }];
    
    // Fuga segura de caracteres especiais do Regex (ex: parênteses)
    const escapedQuery = query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const parts = String(text).split(new RegExp(`(${escapedQuery})`, 'gi'));
    
    return parts.map(part => ({
        text: part,
        highlight: part.toLowerCase() === query.toLowerCase()
    }));
};

// Máscara LGPD para exibição
export const mascararCpfExibicao = (cpf) => {
    if (!cpf) return '';
    const apenasNumeros = String(cpf).replace(/\D/g, '');
    if (apenasNumeros.length !== 11) return '***.***.***-**';
    return `***.${apenasNumeros.substring(3, 6)}.${apenasNumeros.substring(6, 9)}-**`;
};