import React, { useState } from 'react';
import { Search, Edit3, Power, PowerOff, Bookmark, Package, Briefcase, PlusCircle, LayoutList } from 'lucide-react';
import { formatMoney } from './utils.js';

const TabCatalogo = ({ catalogoCompleto, onEdit, onToggleStatus, onOpenModal, ehAdmin }) => {
    const [termoBusca, setTermoBusca] = useState('');
    const [filtroTipo, setFiltroTipo] = useState('TODOS');
    const [filtroStatus, setFiltroStatus] = useState('ATIVOS'); // ✅ Novo filtro de Status

    const catalogoFiltrado = catalogoCompleto.filter(item => {
        const isAtivo = item.ativo !== false;
        const passStatus = filtroStatus === 'TODOS' || 
                           (filtroStatus === 'ATIVOS' && isAtivo) || 
                           (filtroStatus === 'DESCONTINUADOS' && !isAtivo);

        const passTipo = filtroTipo === 'TODOS' || item.tipo === filtroTipo;
        const passBusca = item.nome?.toLowerCase().includes(termoBusca.toLowerCase());
        
        return passTipo && passBusca && passStatus;
    }).sort((a, b) => a.nome?.localeCompare(b.nome));

    const getTipoMeta = (tipo) => {
        switch (tipo) {
            case 'plano': return { label: 'PLANO', icone: Bookmark, cor: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };
            case 'produto': return { label: 'PRODUTO', icone: Package, cor: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
            case 'servico': return { label: 'SERVIÇO', icone: Briefcase, cor: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' };
            default: return { label: 'OUTRO', icone: LayoutList, cor: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };
        }
    };

    return (
        <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[75vh] animate-[fadeIn_0.3s_ease-out]">
            
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                {ehAdmin ? (
                    <button onClick={onOpenModal} className="w-full xl:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2 shrink-0">
                        <PlusCircle className="w-4 h-4" /> Novo Item
                    </button>
                ) : (
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest shrink-0">Tabela de Preços</div>
                )}

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-end">
                    
                    {/* Filtro por Categoria */}
                    <div className="flex bg-slate-200/50 p-1.5 rounded-xl border border-slate-200 overflow-x-auto custom-scrollbar flex-1 min-w-[250px]">
                        <button onClick={() => setFiltroTipo('TODOS')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filtroTipo === 'TODOS' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                            Todos
                        </button>
                        <button onClick={() => setFiltroTipo('plano')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${filtroTipo === 'plano' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                            <Bookmark className="w-3 h-3" /> Planos
                        </button>
                        <button onClick={() => setFiltroTipo('produto')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${filtroTipo === 'produto' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}>
                            <Package className="w-3 h-3" /> Produtos
                        </button>
                        <button onClick={() => setFiltroTipo('servico')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${filtroTipo === 'servico' ? 'bg-white shadow-sm text-violet-700' : 'text-slate-500 hover:text-slate-700'}`}>
                            <Briefcase className="w-3 h-3" /> Serviços
                        </button>
                    </div>

                    {/* Filtro Status e Busca */}
                    <div className="flex flex-1 sm:flex-none gap-3 w-full sm:w-auto">
                        <select 
                            value={filtroStatus} 
                            onChange={(e) => setFiltroStatus(e.target.value)} 
                            className="bg-white border border-slate-200 text-slate-700 rounded-xl px-3 py-2.5 text-xs font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm w-full sm:w-44"
                        >
                            <option value="ATIVOS">🟢 ATIVOS (OFERTAS)</option>
                            <option value="DESCONTINUADOS">🔴 DESCONTINUADOS</option>
                            <option value="TODOS">TODOS OS ITENS</option>
                        </select>

                        <div className="relative w-full sm:w-56 shrink-0">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="w-4 h-4 text-slate-400" />
                            </div>
                            <input 
                                type="text" 
                                placeholder="Buscar..."
                                value={termoBusca}
                                onChange={(e) => setTermoBusca(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm uppercase placeholder:normal-case"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 p-2">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-white sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Nome Oficial</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Categoria</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-right">Valor Padrão</th>
                            {ehAdmin && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-right">Situação</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {catalogoFiltrado.map(item => {
                            const meta = getTipoMeta(item.tipo);
                            const Icone = meta.icone;
                            const isAtivo = item.ativo !== false;

                            return (
                                <tr key={item.id} className={`group transition-colors ${isAtivo ? 'hover:bg-slate-50' : 'bg-slate-50 opacity-70 hover:opacity-100'}`}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${isAtivo ? `${meta.bg} ${meta.cor} ${meta.border}` : 'bg-slate-200 text-slate-400 border-slate-300'} shrink-0`}>
                                                <Icone className="w-5 h-5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`text-sm font-black uppercase tracking-tight ${isAtivo ? 'text-slate-800' : 'text-slate-500 line-through decoration-slate-300'}`}>
                                                    {item.nome}
                                                </span>
                                                {!isAtivo && <span className="text-[9px] font-black text-rose-500 uppercase mt-0.5 tracking-widest">DESCONTINUADO</span>}
                                            </div>
                                        </div>
                                    </td>
                                    
                                    <td className="px-6 py-4 align-middle">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border shadow-sm ${isAtivo ? `${meta.bg} ${meta.cor} ${meta.border}` : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                            {meta.label}
                                        </span>
                                    </td>

                                    <td className={`px-6 py-4 text-right align-middle text-sm font-black ${isAtivo ? 'text-emerald-700' : 'text-slate-500'}`}>
                                        {formatMoney(item.valor)}
                                    </td>

                                    {ehAdmin && (
                                        <td className="px-6 py-4 text-right align-middle">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => onEdit(item)} className="flex items-center justify-center w-8 h-8 bg-white text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-all shadow-sm" title="Editar Oferta">
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                                
                                                {isAtivo ? (
                                                    <button onClick={() => onToggleStatus(item)} className="flex items-center justify-center w-8 h-8 bg-white text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-all shadow-sm" title="Descontinuar Oferta">
                                                        <PowerOff className="w-3.5 h-3.5" />
                                                    </button>
                                                ) : (
                                                    <button onClick={() => onToggleStatus(item)} className="flex items-center justify-center w-8 h-8 bg-white text-emerald-600 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-all shadow-sm" title="Reativar Oferta">
                                                        <Power className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                        {catalogoFiltrado.length === 0 && (
                            <tr>
                                <td colSpan={ehAdmin ? "4" : "3"} className="text-center py-20 text-slate-400 uppercase tracking-widest text-[10px] font-bold opacity-60">
                                    Nenhum item encontrado no catálogo.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TabCatalogo;