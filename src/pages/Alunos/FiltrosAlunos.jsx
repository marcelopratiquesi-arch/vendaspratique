import React, { useState } from 'react';
import { Search, X, RefreshCw, Building2, Bookmark, UserPlus, ChevronDown, Users } from 'lucide-react';
import { SeletorPeriodo, isoLocal } from '../HistoricoVendas/FiltrosCompactos.jsx';
import { MESES_FILTRO, faixaDoFiltro, rotuloDoFiltro } from '../../components/periodoPadrao.js';
import { tx, localeAtual } from '../../i18n/traduzir.js';

const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString(localeAtual(), { hour: '2-digit', minute: '2-digit' });
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
    // Filtro de período padrão do sistema. "filtroPeriodo" guarda o atalho (hoje, 7d, mes, personalizado...);
    // a busca continua recebendo dataInicio/dataFim (AAAA-MM-DD, fim incluído), como antes.
    const LEGADO = { 'Todo período': 'todo', 'Hoje': 'hoje' };
    const preset = LEGADO[filtroPeriodo] || filtroPeriodo || 'hoje';
    const hoje = new Date();
    const [mesAno, setMesAno] = useState({ mes: String(hoje.getMonth() + 1).padStart(2, '0'), ano: String(hoje.getFullYear()) });
    const filtroAtual = { preset, tipo: preset === 'mes' ? 'mes' : 'periodo', dia: dataInicio, inicio: dataInicio, fim: dataFim, ...mesAno };
    const anos = [String(hoje.getFullYear()), String(hoje.getFullYear() - 1), String(hoje.getFullYear() - 2)];

    const aplicarPeriodo = (p) => {
        if (!p) return;
        const { inicio, fim } = faixaDoFiltro(p);
        const ultimoDia = fim ? new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() - 1) : null;
        setDataInicio(inicio ? isoLocal(inicio) : '');
        setDataFim(ultimoDia ? isoLocal(ultimoDia) : '');
        if (p.tipo === 'mes') setMesAno({ mes: p.mes, ano: p.ano });
        setFiltroPeriodo(p.preset);
    };

    const temFiltroAtivo = Boolean(buscaInput) || filtroPlano !== 'TODOS' || (temVisaoGlobal && filtroUnidade !== 'TODAS') || preset !== 'todo';

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col gap-5">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-800">
                        <Users className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">{tx("Central de Alunos")}</h2>
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 dark:text-slate-400">
                            {loading ? '...' : tx("{v1} filtrados", { v1: totalFiltrados.toLocaleString(localeAtual()) })}
                        </span>
                        {ultimaAtualizacao && !loading && (
                            <span className="hidden sm:flex text-[10px] font-bold text-emerald-600 dark:text-emerald-400 items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-lg ml-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                {tx("Atualizado às")}{' '}{formatTime(ultimaAtualizacao)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {temFiltroAtivo && (
                        <button onClick={limparFiltros} className="px-4 py-2.5 rounded-xl text-slate-500 hover:text-slate-700 bg-transparent hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 border border-transparent hover:border-slate-200 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60 dark:hover:border-slate-800">
                            <RefreshCw className="w-3 h-3" />{' '}{tx("Limpar")}
                        </button>
                    )}
                    <button onClick={onNovoAluno} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 transition-all">
                        <UserPlus className="w-4 h-4" />{' '}{tx("Novo Aluno")}
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
                        placeholder={tx("Buscar por nome, CPF, e-mail, telefone ou matrícula...")}
                        className="w-full pl-12 pr-10 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-inner transition-all dark:focus:bg-slate-900"
                    />
                    {buscaInput && (
                        <button onClick={() => setBuscaInput('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors dark:hover:text-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700">
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
                            <option value="TODOS">{tx("Todos os Planos")}</option>
                            <option value="SEM_PLANO">{tx("Sem Plano (—)")}</option>
                            {planos.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    <SeletorPeriodo
                        rotulo={rotuloDoFiltro(filtroAtual)}
                        preset={preset}
                        tipo={filtroAtual.tipo}
                        dia={dataInicio}
                        inicio={dataInicio}
                        fim={dataFim}
                        mes={mesAno.mes}
                        ano={mesAno.ano}
                        meses={MESES_FILTRO}
                        anos={anos}
                        onAplicar={aplicarPeriodo}
                    />

                    {temVisaoGlobal && (
                        <div className="relative min-w-[160px] flex-1 lg:flex-none">
                            <Building2 className="w-4 h-4 text-emerald-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <select
                                value={filtroUnidade}
                                onChange={(e) => setFiltroUnidade(e.target.value)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer uppercase appearance-none shadow-sm"
                            >
                                <option value="TODAS">{tx("Todas Unidades")}</option>
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