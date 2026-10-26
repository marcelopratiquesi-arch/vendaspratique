import React, { useState, useRef, useEffect } from 'react';
import { Search, X, RefreshCw, Building2, Bookmark, CalendarDays, UserPlus, ChevronDown, Check, Users } from 'lucide-react';

const getBRDate = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
const formatDateISO = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const FiltrosAlunos = ({
    buscaInput, setBuscaInput,
    filtroPlano, setFiltroPlano,
    filtroUnidade, setFiltroUnidade,
    filtroPeriodo, setFiltroPeriodo,
    dataInicio, setDataInicio,
    dataFim, setDataFim,
    limparFiltros, temVisaoGlobal, unidades = [], planos = [],
    totalFiltrados = 0, loading = false, onNovoAluno,
    ultimaAtualizacao
}) => {
    const [dropdownPeriodoOpen, setDropdownPeriodoOpen] = useState(false);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownPeriodoOpen(false);
            }
        };
        const handleEsc = (e) => { if (e.key === 'Escape') setDropdownPeriodoOpen(false); };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEsc);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEsc);
        };
    }, []);

    const opcoesPeriodo = ['Todo período', 'Hoje', 'Ontem', 'Últimos 3 dias', 'Últimos 7 dias', 'Últimos 30 dias', 'Este mês', 'Mês passado', 'Personalizado'];

    const aplicarFiltroPredefinido = (tipo) => {
        const hoje = getBRDate();
        let start = '';
        let end = '';

        switch (tipo) {
            case 'Hoje':
                start = end = formatDateISO(hoje);
                break;
            case 'Ontem':
                hoje.setDate(hoje.getDate() - 1);
                start = end = formatDateISO(hoje);
                break;
            case 'Últimos 3 dias':
                end = formatDateISO(hoje);
                hoje.setDate(hoje.getDate() - 2);
                start = formatDateISO(hoje);
                break;
            case 'Últimos 7 dias':
                end = formatDateISO(hoje);
                hoje.setDate(hoje.getDate() - 6);
                start = formatDateISO(hoje);
                break;
            case 'Últimos 30 dias':
                end = formatDateISO(hoje);
                hoje.setDate(hoje.getDate() - 29);
                start = formatDateISO(hoje);
                break;
            case 'Este mês':
                end = formatDateISO(hoje);
                start = formatDateISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
                break;
            case 'Mês passado':
                const ultimoDiaMesPassado = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
                const primeiroDiaMesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
                end = formatDateISO(ultimoDiaMesPassado);
                start = formatDateISO(primeiroDiaMesPassado);
                break;
            case 'Todo período':
            default:
                break;
        }

        if (tipo !== 'Personalizado') {
            setDataInicio(start);
            setDataFim(end);
            setFiltroPeriodo(tipo);
            setDropdownPeriodoOpen(false);
        } else {
            setFiltroPeriodo('Personalizado');
            setCustomStart(dataInicio);
            setCustomEnd(dataFim);
        }
    };

    const aplicarPersonalizado = () => {
        setDataInicio(customStart);
        setDataFim(customEnd);
        setDropdownPeriodoOpen(false);
    };

    const formatarLabelPeriodo = () => {
        if (filtroPeriodo === 'Personalizado' && dataInicio && dataFim) {
            return `${dataInicio.split('-').reverse().join('/')} – ${dataFim.split('-').reverse().join('/')}`;
        }
        return filtroPeriodo;
    };

    const temFiltroAtivo = Boolean(buscaInput) || filtroPlano !== 'TODOS' || (temVisaoGlobal && filtroUnidade !== 'TODAS') || filtroPeriodo !== 'Todo período';

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col gap-5">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-800">
                        <Users className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Central de Alunos</h2>
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                            {loading ? '...' : `${totalFiltrados.toLocaleString('pt-BR')} filtrados`}
                        </span>
                        {ultimaAtualizacao && !loading && (
                            <span className="hidden sm:flex text-[9px] font-bold text-emerald-600 dark:text-emerald-400 items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-lg ml-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Atualizado às {formatTime(ultimaAtualizacao)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {temFiltroAtivo && (
                        <button onClick={limparFiltros} className="px-4 py-2.5 rounded-xl text-slate-500 hover:text-slate-700 bg-transparent hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 border border-transparent hover:border-slate-200">
                            <RefreshCw className="w-3 h-3" /> Limpar
                        </button>
                    )}
                    <button onClick={onNovoAluno} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 transition-all">
                        <UserPlus className="w-4 h-4" /> Novo Aluno
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-3 items-center">
                
                <div className="relative flex-1 w-full">
                    <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        value={buscaInput}
                        onChange={(e) => setBuscaInput(e.target.value)}
                        placeholder="Buscar por nome, CPF, e-mail, telefone ou matrícula..."
                        className="w-full pl-12 pr-10 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-inner transition-all"
                    />
                    {buscaInput && (
                        <button onClick={() => setBuscaInput('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap lg:flex-nowrap gap-3 w-full lg:w-auto">
                    <div className="relative min-w-[160px] flex-1 lg:flex-none">
                        <Bookmark className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <select
                            value={filtroPlano}
                            onChange={(e) => setFiltroPlano(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none shadow-sm"
                        >
                            <option value="TODOS">Todos os Planos</option>
                            <option value="SEM_PLANO">Sem Plano (—)</option>
                            {planos.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    <div className="relative min-w-[180px] flex-1 lg:flex-none" ref={dropdownRef}>
                        <button
                            onClick={() => setDropdownPeriodoOpen(!dropdownPeriodoOpen)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none hover:border-slate-300 focus:ring-2 focus:ring-blue-500 flex items-center justify-between shadow-sm transition-all"
                        >
                            <CalendarDays className="w-4 h-4 text-slate-400 absolute left-3" />
                            <span className="truncate pr-2">{formatarLabelPeriodo()}</span>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownPeriodoOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {dropdownPeriodoOpen && (
                            <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden animate-[fadeIn_0.1s_ease-out]">
                                <div className="max-h-64 overflow-y-auto py-2">
                                    {opcoesPeriodo.map(opcao => (
                                        <button
                                            key={opcao}
                                            onClick={() => aplicarFiltroPredefinido(opcao)}
                                            className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors flex items-center gap-2 ${
                                                filtroPeriodo === opcao 
                                                ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400' 
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                            }`}
                                        >
                                            {filtroPeriodo === opcao ? <Check className="w-4 h-4 shrink-0" /> : <div className="w-4 h-4 shrink-0" />}
                                            {opcao}
                                        </button>
                                    ))}
                                </div>
                                
                                {filtroPeriodo === 'Personalizado' && (
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-3">
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">De</label>
                                                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white" />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Até</label>
                                                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white" />
                                            </div>
                                        </div>
                                        <button onClick={aplicarPersonalizado} disabled={!customStart || !customEnd} className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[10px] font-black uppercase rounded-lg transition-colors">
                                            Aplicar
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {temVisaoGlobal && (
                        <div className="relative min-w-[160px] flex-1 lg:flex-none">
                            <Building2 className="w-4 h-4 text-emerald-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <select
                                value={filtroUnidade}
                                onChange={(e) => setFiltroUnidade(e.target.value)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer uppercase appearance-none shadow-sm"
                            >
                                <option value="TODAS">Todas Unidades</option>
                                {unidades.map(u => <option key={u.id} value={u.nome}>{u.nome}</option>)}
                            </select>
                            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FiltrosAlunos;