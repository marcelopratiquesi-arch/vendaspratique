import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CalendarDays, ChevronDown, ChevronRight, Check, Search } from 'lucide-react';

// ==========================================
// Datas locais (sem bug de fuso)
// ==========================================
export const isoLocal = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dia}`;
};

const diasAtras = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return isoLocal(d); };

// Converte um atalho em filtro de data no formato que o Histórico já usa (dia / periodo / mes)
export const calcularPreset = (preset) => {
    const hoje = new Date();
    switch (preset) {
        case 'hoje': return { preset, tipo: 'dia', dia: isoLocal(hoje) };
        case 'ontem': return { preset, tipo: 'dia', dia: diasAtras(1) };
        case '3d': return { preset, tipo: 'periodo', inicio: diasAtras(2), fim: isoLocal(hoje) };
        case '7d': return { preset, tipo: 'periodo', inicio: diasAtras(6), fim: isoLocal(hoje) };
        case '30d': return { preset, tipo: 'periodo', inicio: diasAtras(29), fim: isoLocal(hoje) };
        case 'este_mes': return { preset, tipo: 'periodo', inicio: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), fim: isoLocal(hoje) };
        case 'mes_passado': return {
            preset, tipo: 'periodo',
            inicio: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)),
            fim: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 0)),
        };
        case 'todo': return { preset, tipo: 'periodo', inicio: '', fim: '' };
        default: return null;
    }
};

const ATALHOS = [
    ['todo', 'Todo o período'],
    ['hoje', 'Hoje'],
    ['ontem', 'Ontem'],
    ['3d', 'Últimos 3 dias'],
    ['7d', 'Últimos 7 dias'],
    ['30d', 'Últimos 30 dias'],
    ['este_mes', 'Este mês'],
    ['mes_passado', 'Mês passado'],
];
export const ROTULO_ATALHO = Object.fromEntries(ATALHOS);

// Fecha ao clicar fora ou apertar Esc
const useFecharFora = (ref, aberto, fechar) => {
    useEffect(() => {
        if (!aberto) return undefined;
        const aoClicar = (e) => { if (ref.current && !ref.current.contains(e.target)) fechar(); };
        const aoTeclar = (e) => { if (e.key === 'Escape') fechar(); };
        document.addEventListener('mousedown', aoClicar);
        document.addEventListener('keydown', aoTeclar);
        return () => {
            document.removeEventListener('mousedown', aoClicar);
            document.removeEventListener('keydown', aoTeclar);
        };
    }, [ref, aberto, fechar]);
};

const itemMenu = 'w-full h-9 px-3 rounded-lg text-left text-[13px] font-semibold transition-colors flex items-center justify-between gap-2 outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
const campo = 'w-full h-9 bg-white border border-slate-200 rounded-lg px-2.5 text-[13px] font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500';
const rotuloCampo = 'flex flex-col gap-1 text-[11px] font-bold text-slate-500';
const botaoAplicar = 'w-full h-9 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[12px] font-black transition-colors';

// ==========================================
// MENU DE PERÍODO
// ==========================================
export const SeletorPeriodo = ({ rotulo, preset, tipo, dia, inicio, fim, mes, ano, meses = [], anos = [], onAplicar }) => {
    const [aberto, setAberto] = useState(false);
    const [painel, setPainel] = useState(null); // 'mes' | 'dia' | 'personalizado'
    const [rascunho, setRascunho] = useState({ dia, inicio, fim, mes, ano });
    const ref = useRef(null);

    const fechar = () => { setAberto(false); setPainel(null); };
    useFecharFora(ref, aberto, fechar);

    const abrir = () => {
        setRascunho({ dia, inicio, fim, mes, ano });
        setPainel(preset === 'mes' ? 'mes' : preset === 'dia' ? 'dia' : preset === 'personalizado' ? 'personalizado' : null);
        setAberto((a) => !a);
    };

    const escolherAtalho = (id) => { onAplicar(calcularPreset(id)); fechar(); };
    const aplicarPainel = () => {
        if (painel === 'mes') onAplicar({ preset: 'mes', tipo: 'mes', mes: rascunho.mes, ano: rascunho.ano });
        if (painel === 'dia') onAplicar({ preset: 'dia', tipo: 'dia', dia: rascunho.dia });
        if (painel === 'personalizado') onAplicar({ preset: 'personalizado', tipo: 'periodo', inicio: rascunho.inicio, fim: rascunho.fim });
        fechar();
    };

    const classeItem = (ativo) => `${itemMenu} ${ativo ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`;

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={abrir}
                aria-haspopup="menu"
                aria-expanded={aberto}
                className="h-10 min-w-[200px] px-3.5 bg-blue-50 border border-blue-200 hover:border-blue-300 rounded-xl text-[13px] font-bold text-blue-700 flex items-center justify-between gap-3 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
                <span className="flex items-center gap-2 min-w-0">
                    <CalendarDays className="w-4 h-4 shrink-0" />
                    <span className="truncate">{rotulo}</span>
                </span>
                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
            </button>

            {aberto && (
                <div role="menu" className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-[fadeIn_0.12s_ease-out]">
                    <div className="p-1.5">
                        {ATALHOS.map(([id, texto]) => (
                            <button key={id} type="button" role="menuitem" onClick={() => escolherAtalho(id)} className={classeItem(preset === id)}>
                                {texto}
                                {preset === id && <Check className="w-4 h-4" strokeWidth={2.5} />}
                            </button>
                        ))}
                    </div>
                    <div className="h-px bg-slate-100" />
                    <div className="p-1.5">
                        {[['mes', 'Escolher um mês…'], ['dia', 'Escolher um dia…'], ['personalizado', 'Personalizado']].map(([id, texto]) => {
                            const ativo = painel === id || (!painel && preset === id);
                            return (
                                <button key={id} type="button" role="menuitem" aria-expanded={painel === id} onClick={() => setPainel(painel === id ? null : id)} className={classeItem(ativo)}>
                                    {texto}
                                    {preset === id ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${painel === id ? 'rotate-90' : ''}`} />}
                                </button>
                            );
                        })}
                    </div>

                    {painel && (
                        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col gap-2.5">
                            {painel === 'mes' && (
                                <div className="grid grid-cols-2 gap-2">
                                    <label className={rotuloCampo}>Mês
                                        <select value={rascunho.mes} onChange={(e) => setRascunho((r) => ({ ...r, mes: e.target.value }))} className={campo}>
                                            {meses.map((m) => <option key={m.val} value={m.val}>{m.label}</option>)}
                                        </select>
                                    </label>
                                    <label className={rotuloCampo}>Ano
                                        <select value={rascunho.ano} onChange={(e) => setRascunho((r) => ({ ...r, ano: e.target.value }))} className={campo}>
                                            <option value="TODOS">Todos os anos</option>
                                            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
                                        </select>
                                    </label>
                                </div>
                            )}
                            {painel === 'dia' && (
                                <label className={rotuloCampo}>Dia
                                    <input type="date" value={rascunho.dia || ''} onChange={(e) => setRascunho((r) => ({ ...r, dia: e.target.value }))} className={campo} />
                                </label>
                            )}
                            {painel === 'personalizado' && (
                                <div className="grid grid-cols-2 gap-2">
                                    <label className={rotuloCampo}>De
                                        <input type="date" value={rascunho.inicio || ''} onChange={(e) => setRascunho((r) => ({ ...r, inicio: e.target.value }))} className={campo} />
                                    </label>
                                    <label className={rotuloCampo}>Até
                                        <input type="date" value={rascunho.fim || ''} onChange={(e) => setRascunho((r) => ({ ...r, fim: e.target.value }))} className={campo} />
                                    </label>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={aplicarPainel}
                                disabled={(painel === 'dia' && !rascunho.dia) || (painel === 'personalizado' && (!rascunho.inicio || !rascunho.fim))}
                                className={botaoAplicar}
                            >
                                Aplicar
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ==========================================
// FILTRO DE MÚLTIPLA ESCOLHA (mesma lógica de "ocultos" de antes)
// ==========================================
export const FiltroMultiplo = ({ rotulo, icone: Icone, options = [], ocultos = [], setOcultos, alinhar = 'left' }) => {
    const [aberto, setAberto] = useState(false);
    const [busca, setBusca] = useState('');
    const ref = useRef(null);

    const fechar = () => { setAberto(false); setBusca(''); };
    useFecharFora(ref, aberto, fechar);

    const ocultosValidos = ocultos.filter((o) => options.includes(o));
    const visiveis = options.length - ocultosValidos.length;
    const filtrando = ocultosValidos.length > 0;
    const vazio = options.length === 0;

    const lista = useMemo(() => {
        const t = busca.trim().toUpperCase();
        return t ? options.filter((o) => o.toUpperCase().includes(t)) : options;
    }, [busca, options]);

    const alternar = (item) => {
        setOcultos((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));
    };

    return (
        <div className="relative min-w-[150px] flex-1" ref={ref}>
            <button
                type="button"
                onClick={() => !vazio && setAberto((a) => !a)}
                aria-haspopup="listbox"
                aria-expanded={aberto}
                disabled={vazio}
                title={vazio ? `Nenhum item de ${rotulo.toLowerCase()} no período` : rotulo}
                className={`w-full h-[42px] px-3 rounded-xl border text-[13px] flex items-center justify-between gap-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    filtrando
                        ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold'
                        : vazio
                            ? 'bg-slate-50 border-slate-200 text-slate-400 font-semibold cursor-not-allowed'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 font-semibold'
                }`}
            >
                <span className="flex items-center gap-2 min-w-0">
                    {Icone && <Icone className={`w-4 h-4 shrink-0 ${filtrando ? '' : 'text-slate-400'}`} />}
                    <span className="truncate">{rotulo}</span>
                </span>
                {filtrando ? (
                    <span className="shrink-0 h-5 px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center">{visiveis}/{options.length}</span>
                ) : (
                    <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
                )}
            </button>

            {aberto && (
                <div role="listbox" aria-multiselectable="true" className={`absolute top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-[fadeIn_0.12s_ease-out] ${alinhar === 'right' ? 'right-0' : 'left-0'}`}>
                    {options.length > 8 && (
                        <div className="p-2 border-b border-slate-100">
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar em ${rotulo.toLowerCase()}...`} className="w-full h-9 pl-8 pr-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>
                    )}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                        <button type="button" onClick={() => setOcultos([])} className="text-[11px] font-bold text-blue-600 hover:text-blue-700">Marcar todos</button>
                        <button type="button" onClick={() => setOcultos([...options])} className="text-[11px] font-bold text-slate-500 hover:text-slate-700">Desmarcar todos</button>
                    </div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar p-1.5">
                        {lista.map((item) => {
                            const marcado = !ocultos.includes(item);
                            return (
                                <button key={item} type="button" role="option" aria-selected={marcado} onClick={() => alternar(item)} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-[12px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${marcado ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-transparent'}`}>
                                        <Check className="w-3 h-3" strokeWidth={3} />
                                    </span>
                                    <span className="truncate uppercase">{item}</span>
                                </button>
                            );
                        })}
                        {lista.length === 0 && <p className="px-3 py-4 text-center text-[12px] font-medium text-slate-400">Nada encontrado</p>}
                    </div>
                </div>
            )}
        </div>
    );
};