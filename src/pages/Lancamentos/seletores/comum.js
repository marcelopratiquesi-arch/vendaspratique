// Peças comuns das listas personalizadas da tela Lançar venda (catálogo e consultor)
import { useEffect, useState } from 'react';
import { normalizeString } from '../../AnaliseVendas/utils.js';

// Busca ignorando acentos e maiúsculas
export const combinaBusca = (texto, busca) => normalizeString(texto).includes(normalizeString(busca));

// Iniciais para o avatar (primeiro e último nome)
export const iniciais = (nome) => {
    const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return '?';
    return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
};

// Fecha a lista ao clicar fora dela
export const useFecharAoClicarFora = (aberto, ref, fechar) => {
    useEffect(() => {
        if (!aberto) return undefined;
        const aoClicar = (e) => { if (ref.current && !ref.current.contains(e.target)) fechar(); };
        document.addEventListener('mousedown', aoClicar);
        return () => document.removeEventListener('mousedown', aoClicar);
    }, [aberto, ref, fechar]);
};

// Teclado: ↑ ↓ andam, Enter escolhe, Esc fecha
export const tratarTeclado = (e, { total, ativo, setAtivo, escolher, fechar }) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo(total ? (ativo + 1) % total : 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo(total ? (ativo - 1 + total) % total : 0); }
    else if (e.key === 'Enter') { e.preventDefault(); if (total) escolher(ativo); }
    else if (e.key === 'Escape') { e.preventDefault(); fechar(); }
};

// Último consultor escolhido NESTE navegador (só uma conveniência; se o navegador não guardar, segue sem)
const CHAVE_ULTIMO = 'pratique_ultimo_consultor';
export const lerUltimoConsultor = () => { try { return localStorage.getItem(CHAVE_ULTIMO) || ''; } catch { return ''; } };
export const guardarUltimoConsultor = (nome) => { try { localStorage.setItem(CHAVE_ULTIMO, nome); } catch { /* sem armazenamento */ } };

// Modo escuro (classe "dark" no <html>), para as cores do avatar por setor
export const useModoEscuro = () => {
    const [escuro, setEscuro] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
    useEffect(() => {
        const obs = new MutationObserver(() => setEscuro(document.documentElement.classList.contains('dark')));
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => obs.disconnect();
    }, []);
    return escuro;
};

// Classes do campo fechado (botão que abre a lista)
export const CLASSE_CAMPO = 'w-full h-11 px-3.5 bg-white border border-[#D6DCE8] rounded-xl flex items-center gap-2.5 text-left text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[#1D4FD8] transition-colors disabled:bg-[#F3F5FA] disabled:cursor-not-allowed dark:bg-slate-900 dark:border-slate-700 dark:disabled:bg-slate-800';
// Painel flutuante: rolagem só vertical
export const CLASSE_PAINEL = 'absolute z-40 left-0 right-0 mt-2 bg-white border border-[#E4E8F0] rounded-2xl shadow-[0_12px_32px_rgba(15,23,42,0.12)] overflow-hidden dark:bg-slate-900 dark:border-slate-700';
