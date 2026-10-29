import React, { useState, useMemo } from 'react';
import { Search, Edit3, Power, PowerOff, UserPlus, ChevronsUpDown, ChevronUp, ChevronDown, Building, Zap } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';

const TabEquipe = ({ colaboradores, onEdit, onToggleStatus, temVisaoGlobal, unidades, onOpenModal }) => {
    const [termoBusca, setTermoBusca] = useState('');
    const [filtroUnidade, setFiltroUnidade] = useState('TODOS');
    const [filtroSetor, setFiltroSetor] = useState('TODOS');
    const [filtroStatus, setFiltroStatus] = useState('ATIVOS'); // ✅ Novo Filtro
    const [ordenacao, setOrdenacao] = useState({ coluna: 'nome', direcao: 'asc' });

    const setoresUnicos = useMemo(() => {
        return ['TODOS', ...new Set(colaboradores.map(c => c.role))].filter(Boolean).sort();
    }, [colaboradores]);

    const dadosProcessados = useMemo(() => {
        let filtrados = colaboradores.filter(c => {
            const isAtivo = c.ativo !== false; // Lida com nulos como true
            
            const passStatus = filtroStatus === 'TODOS' || 
                               (filtroStatus === 'ATIVOS' && isAtivo) || 
                               (filtroStatus === 'INATIVOS' && !isAtivo);

            const passUnid = filtroUnidade === 'TODOS' || c.unidade?.toUpperCase() === filtroUnidade.toUpperCase();
            const passSetor = filtroSetor === 'TODOS' || c.role?.toUpperCase() === filtroSetor.toUpperCase();
            
            const busca = termoBusca.toLowerCase();
            const passBusca = c.nome?.toLowerCase().includes(busca) || 
                              c.cpf?.replace(/\D/g, '').includes(busca.replace(/\D/g, '')) || 
                              c.telefone?.replace(/\D/g, '').includes(busca.replace(/\D/g, ''));
                              
            return passStatus && passUnid && passSetor && passBusca;
        });

        return filtrados.sort((a, b) => {
            let valA = a[ordenacao.coluna] || '';
            let valB = b[ordenacao.coluna] || '';

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return ordenacao.direcao === 'asc' ? -1 : 1;
            if (valA > valB) return ordenacao.direcao === 'asc' ? 1 : -1;
            return 0;
        });
    }, [colaboradores, filtroUnidade, filtroSetor, filtroStatus, termoBusca, ordenacao]);

    const requestSort = (coluna) => {
        let direcao = 'asc';
        if (ordenacao.coluna === coluna && ordenacao.direcao === 'asc') direcao = 'desc';
        setOrdenacao({ coluna, direcao });
    };

    const getSortIcon = (coluna) => {
        if (ordenacao.coluna !== coluna) return <ChevronsUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60 transition-opacity" />;
        return ordenacao.direcao === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600 dark:text-blue-400" /> : <ChevronDown className="w-3 h-3 text-blue-600 dark:text-blue-400" />;
    };

    const thClass = "px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors select-none whitespace-nowrap group dark:text-slate-400 dark:border-slate-800 dark:hover:bg-slate-800";

    return (
        <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[75vh] animate-[fadeIn_0.3s_ease-out] dark:bg-slate-900 dark:border-slate-800">
            
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 dark:border-slate-800 dark:bg-slate-800/60">
                <button onClick={onOpenModal} className="w-full xl:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2 shrink-0">
                    <UserPlus className="w-4 h-4" />{' '}{tx("Novo Colaborador")}
                </button>

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    <div className="relative flex-1 min-w-[200px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="w-4 h-4 text-slate-400" />
                        </div>
                        <input 
                            type="text" 
                            placeholder={tx("Buscar CPF, Nome...")}
                            value={termoBusca}
                            onChange={(e) => setTermoBusca(e.target.value)}
                            className="w-full bg-white border border-slate-200 text-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm uppercase placeholder:normal-case dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200"
                        />
                    </div>

                    {/* ✅ NOVO FILTRO DE STATUS */}
                    <div className="flex-1 min-w-[120px]">
                        <select 
                            value={filtroStatus} 
                            onChange={(e) => setFiltroStatus(e.target.value)} 
                            className="w-full bg-white border border-slate-200 text-slate-700 rounded-xl px-3 py-2.5 text-xs font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200"
                        >
                            <option value="ATIVOS">{tx("🟢 ATIVOS")}</option>
                            <option value="INATIVOS">{tx("🔴 DESLIGADOS")}</option>
                            <option value="TODOS">{tx("TODOS")}</option>
                        </select>
                    </div>

                    <div className="flex-1 min-w-[140px]">
                        <select 
                            value={filtroSetor} 
                            onChange={(e) => setFiltroSetor(e.target.value)} 
                            className="w-full bg-white border border-slate-200 text-slate-700 rounded-xl px-3 py-2.5 text-xs font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200"
                        >
                            {setoresUnicos.map(s => <option key={s} value={s}>{s === 'TODOS' ? tx("TODOS OS SETORES") : s}</option>)}
                        </select>
                    </div>

                    {temVisaoGlobal && (
                        <div className="flex-1 min-w-[150px]">
                            <select 
                                value={filtroUnidade} 
                                onChange={(e) => setFiltroUnidade(e.target.value)} 
                                className="w-full bg-white border border-rose-200 text-rose-700 rounded-xl px-3 py-2.5 text-xs font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer shadow-sm dark:bg-slate-900 dark:border-rose-500/30 dark:text-rose-400"
                            >
                                <option value="TODOS">{tx("TODAS UNIDADES")}</option>
                                {unidades.map(u => <option key={u.id || u.nome} value={u.nome}>{u.nome}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1 p-2">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-white sticky top-0 z-10 shadow-sm dark:bg-slate-900">
                        <tr>
                            <th onClick={() => requestSort('cpf')} className={thClass}>
                                <div className="flex items-center gap-2">{tx("CPF (Chave)")}{' '}{getSortIcon('cpf')}</div>
                            </th>
                            <th onClick={() => requestSort('nome')} className={thClass}>
                                <div className="flex items-center gap-2">{tx("Nome Completo")}{' '}{getSortIcon('nome')}</div>
                            </th>
                            <th onClick={() => requestSort('role')} className={thClass}>
                                <div className="flex items-center gap-2">{tx("Setor / Cargo")}{' '}{getSortIcon('role')}</div>
                            </th>
                            {temVisaoGlobal && (
                                <th onClick={() => requestSort('unidade')} className={thClass}>
                                    <div className="flex items-center gap-2">{tx("Unidade")}{' '}{getSortIcon('unidade')}</div>
                                </th>
                            )}
                            <th onClick={() => requestSort('telefone')} className={thClass}>
                                <div className="flex items-center gap-2">{tx("Telefone")}{' '}{getSortIcon('telefone')}</div>
                            </th>
                            <th onClick={() => requestSort('tipo_conta')} className={thClass}>
                                <div className="flex items-center gap-2">{tx("Dados Bancários")}{' '}{getSortIcon('tipo_conta')}</div>
                            </th>
                            <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 text-right dark:text-slate-400 dark:border-slate-800">{tx("Situação")}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dadosProcessados.map(c => {
                            const isAtivo = c.ativo !== false;
                            
                            return (
                                <tr key={c.id} className={`group transition-colors ${isAtivo ? 'hover:bg-blue-50/30 dark:hover:bg-blue-500/10' : 'bg-slate-50 opacity-70 hover:opacity-100 dark:bg-slate-800/60'}`}>
                                    <td className="px-4 py-3 align-middle">
                                        <span className="text-sm font-mono font-black text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200 tracking-wider dark:text-slate-200 dark:bg-slate-800 dark:border-slate-800">
                                            {c.cpf || tx("PENDENTE")}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 align-middle flex flex-col justify-center">
                                        <span className={`text-xs font-black uppercase tracking-tight ${isAtivo ? 'text-slate-800 dark:text-white' : 'text-slate-500 line-through decoration-slate-300 dark:text-slate-400'}`}>
                                            {c.nome}
                                        </span>
                                        {!isAtivo && <span className="text-[10px] font-black text-rose-500 uppercase mt-0.5 tracking-widest">{tx("DESLIGADO")}</span>}
                                    </td>
                                    <td className="px-4 py-3 align-middle text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-slate-400">
                                        {c.role}
                                    </td>
                                    {temVisaoGlobal && (
                                        <td className="px-4 py-3 align-middle">
                                            <span className="text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-100 px-2 py-1 rounded uppercase tracking-widest dark:text-rose-400 dark:bg-rose-500/10 dark:border-rose-500/30">
                                                {c.unidade || tx("MATRIZ")}
                                            </span>
                                        </td>
                                    )}
                                    <td className="px-4 py-3 align-middle text-xs font-semibold text-slate-600 dark:text-slate-300">
                                        {c.telefone || '-'}
                                    </td>
                                    <td className="px-4 py-3 align-middle">
                                        {c.tipo_conta === 'PIX_CPF' ? (
                                            <div className="flex items-center gap-2 w-max">
                                                <div className="w-6 h-6 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 dark:bg-emerald-500/20 dark:text-emerald-400">
                                                    <Zap className="w-3.5 h-3.5" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest dark:text-emerald-400">{tx("PIX (Chave CPF)")}</p>
                                                    <p className="text-[10px] font-mono font-bold text-emerald-800 dark:text-emerald-300">{c.cpf}</p>
                                                </div>
                                            </div>
                                        ) : c.tipo_conta === 'INTER' ? (
                                            <div className="flex items-center gap-2 w-max">
                                                <div className="w-6 h-6 rounded bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 dark:bg-orange-500/20 dark:text-orange-400">
                                                    <Building className="w-3.5 h-3.5" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest dark:text-orange-400">{tx("Banco Inter")}</p>
                                                    <p className="text-[11px] font-mono font-black text-orange-900 dark:text-orange-300">{c.conta_inter || tx("Não informada")}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">{tx("Não Definido")}</span>
                                        )}
                                    </td>
                                    
                                    {/* ✅ BOTÕES DE AÇÃO COM SOFT DELETE */}
                                    <td className="px-4 py-3 text-right align-middle">
                                        <div className="flex justify-end gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => onEdit(c)} className="flex items-center justify-center w-8 h-8 bg-white text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-all shadow-sm dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-blue-500/10 dark:border-blue-500/30" title={tx("Editar Cadastro")}>
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                            
                                            {isAtivo ? (
                                                <button onClick={() => onToggleStatus(c)} className="flex items-center justify-center w-8 h-8 bg-white text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-all shadow-sm dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-500/10 dark:border-rose-500/30" title={tx("Desligar/Inativar Colaborador")}>
                                                    <PowerOff className="w-3.5 h-3.5" />
                                                </button>
                                            ) : (
                                                <button onClick={() => onToggleStatus(c)} className="flex items-center justify-center w-8 h-8 bg-white text-emerald-600 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-all shadow-sm dark:bg-slate-900 dark:text-emerald-400 dark:hover:bg-emerald-500/10 dark:border-emerald-500/30" title={tx("Reativar Acesso")}>
                                                    <Power className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {dadosProcessados.length === 0 && (
                            <tr>
                                <td colSpan={temVisaoGlobal ? "7" : "6"} className="text-center py-20 text-slate-400 uppercase tracking-widest text-[10px] font-bold opacity-60">
                                    {tx("Nenhum colaborador encontrado nos filtros.")}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TabEquipe;