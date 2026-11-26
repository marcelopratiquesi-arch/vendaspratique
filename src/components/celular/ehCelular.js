import { useEffect, useState } from 'react';

// ==========================================
// CELULAR OU COMPUTADOR? (26/11/2026, projeto "todas as telas no celular", decisão do dono)
// Celular = tela com até 767px de largura (abaixo do `md:` do Tailwind).
// Regra do projeto: no celular o desenho muda; no computador NADA muda.
// Use classes `md:` sempre que der (não precisa deste arquivo). Use o hook só quando o comportamento muda
// (ex.: Ligar pelo discador do celular, Conversa em tela cheia, Kanban por abas).
// ==========================================
export const CONSULTA_CELULAR = '(max-width: 767px)';

export const ehCelularAgora = () => {
    try { return Boolean(window.matchMedia?.(CONSULTA_CELULAR).matches); } catch { return false; }
};

export const useEhCelular = () => {
    const [celular, setCelular] = useState(ehCelularAgora);
    useEffect(() => {
        const mql = window.matchMedia?.(CONSULTA_CELULAR);
        if (!mql) return undefined;
        const mudar = () => setCelular(mql.matches);
        mudar();
        mql.addEventListener?.('change', mudar);
        return () => mql.removeEventListener?.('change', mudar);
    }, []);
    return celular;
};
