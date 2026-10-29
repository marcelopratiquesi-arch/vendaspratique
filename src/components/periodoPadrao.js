import { useState, useMemo, useCallback } from 'react';
import { calcularPreset, ROTULO_ATALHO, isoLocal } from '../pages/HistoricoVendas/FiltrosCompactos.jsx';

// ==========================================
// FILTRO DE PERÍODO PADRÃO DO SISTEMA (decisão do dono, 29/10/2026)
// O mesmo do Histórico e do Dashboard: Todo o período, Hoje, Ontem, Últimos 3/7/30 dias, Este mês,
// Mês passado, Escolher um mês, Escolher um dia e Personalizado.
// Uso: const periodo = usePeriodoPadrao('hoje');
//      <SeletorPeriodo {...periodo.propsSeletor} />   e   periodo.faixa = { inicio, fim }
// "inicio" entra e "fim" NÃO entra (fim = dia seguinte ao último dia). null = sem limite daquele lado.
// ==========================================

export const MESES_FILTRO = [
    { val: 'TODOS', label: 'Todos os Meses' },
    { val: '01', label: '01 - Janeiro' }, { val: '02', label: '02 - Fevereiro' }, { val: '03', label: '03 - Março' },
    { val: '04', label: '04 - Abril' }, { val: '05', label: '05 - Maio' }, { val: '06', label: '06 - Junho' },
    { val: '07', label: '07 - Julho' }, { val: '08', label: '08 - Agosto' }, { val: '09', label: '09 - Setembro' },
    { val: '10', label: '10 - Outubro' }, { val: '11', label: '11 - Novembro' }, { val: '12', label: '12 - Dezembro' }
];

const paraData = (iso, somarDias = 0) => {
    if (!iso) return null;
    const [a, m, d] = String(iso).split('-').map(Number);
    if (!a || !m || !d) return null;
    return new Date(a, m - 1, d + somarDias);
};
const dataBR = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');

// Converte o que o SeletorPeriodo devolve em { inicio, fim }
export const faixaDoFiltro = (p) => {
    if (!p) return { inicio: null, fim: null };
    if (p.tipo === 'dia') return { inicio: paraData(p.dia), fim: paraData(p.dia, 1) };
    if (p.tipo === 'mes') {
        if (!p.ano || p.ano === 'TODOS') return { inicio: null, fim: null };
        const ano = Number(p.ano);
        if (!p.mes || p.mes === 'TODOS') return { inicio: new Date(ano, 0, 1), fim: new Date(ano + 1, 0, 1) };
        const mes = Number(p.mes) - 1;
        return { inicio: new Date(ano, mes, 1), fim: new Date(ano, mes + 1, 1) };
    }
    return { inicio: paraData(p.inicio), fim: paraData(p.fim, 1) };
};

// Texto do botão do filtro (ex.: "Hoje", "Outubro 2026", "01/10/2026 – 15/10/2026")
export const rotuloDoFiltro = (p) => {
    if (!p) return 'Período';
    if (p.preset === 'dia') return dataBR(p.dia) || 'Escolher dia';
    if (p.preset === 'mes') {
        const mes = MESES_FILTRO.find(m => m.val === p.mes);
        if (!p.ano || p.ano === 'TODOS') return 'Todo o período';
        return mes && p.mes !== 'TODOS' ? `${mes.label.split(' - ')[1]} ${p.ano}` : `${p.ano}`;
    }
    if (p.preset === 'personalizado') return `${dataBR(p.inicio)} – ${dataBR(p.fim)}`;
    return ROTULO_ATALHO[p.preset] || 'Período';
};

export const usePeriodoPadrao = (presetInicial = 'hoje') => {
    const hoje = new Date();
    const [filtro, setFiltro] = useState(() => ({
        mes: String(hoje.getMonth() + 1).padStart(2, '0'),
        ano: String(hoje.getFullYear()),
        dia: isoLocal(hoje),
        ...calcularPreset(presetInicial)
    }));
    const aplicar = useCallback((novo) => { if (novo) setFiltro(atual => ({ ...atual, ...novo })); }, []);
    const faixa = useMemo(() => faixaDoFiltro(filtro), [filtro]);
    const rotulo = rotuloDoFiltro(filtro);
    const anos = useMemo(() => { const a = new Date().getFullYear(); return [String(a), String(a - 1), String(a - 2)]; }, []);
    return {
        filtro,
        faixa,
        rotulo,
        // Chave simples para usar em useEffect (muda quando o período muda)
        chave: `${faixa.inicio ? faixa.inicio.getTime() : ''}|${faixa.fim ? faixa.fim.getTime() : ''}`,
        propsSeletor: {
            rotulo, preset: filtro.preset, tipo: filtro.tipo, dia: filtro.dia || '', inicio: filtro.inicio || '', fim: filtro.fim || '',
            mes: filtro.mes, ano: filtro.ano, meses: MESES_FILTRO, anos, onAplicar: aplicar
        }
    };
};

// Data está dentro da faixa? (inicio entra, fim não entra)
export const dentroDaFaixa = (valor, faixa) => {
    if (!valor) return false;
    const d = new Date(valor);
    if (faixa?.inicio && d < faixa.inicio) return false;
    if (faixa?.fim && d >= faixa.fim) return false;
    return true;
};
