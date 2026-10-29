import React, { useState } from 'react';
import { Search, Edit3, Trash2, LayoutGrid, PlusCircle } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';

const TabSetores = ({ listaSetores, onEdit, onDelete, onOpenModal, ehAdmin }) => {
    const [termoBusca, setTermoBusca] = useState('');

    const setoresFiltrados = listaSetores.filter(item => 
        item.nome?.toLowerCase().includes(termoBusca.toLowerCase())
    ).sort((a, b) => a.nome?.localeCompare(b.nome));

    return (
        <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[70vh] animate-[fadeIn_0.3s_ease-out] dark:bg-slate-900 dark:border-slate-800">
            
            {/* Action Bar */}
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 dark:border-slate-800 dark:bg-slate-800/60">
                {ehAdmin ? (
                    <button onClick={onOpenModal} className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2">
                        <PlusCircle className="w-4 h-4" />{' '}{tx("Novo Setor / Cargo")}
                    </button>
                ) : (
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{tx("Visualização de Setores da Empresa")}</div>
                )}

                <div className="relative w-full sm:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="w-4 h-4 text-slate-400" />
                    </div>
                    <input 
                        type="text" 
                        placeholder={tx("Buscar setor...")}
                        value={termoBusca}
                        onChange={(e) => setTermoBusca(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm uppercase placeholder:normal-case dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200"
                    />
                </div>
            </div>

            {/* Tabela de Setores */}
            <div className="overflow-y-auto custom-scrollbar flex-1 p-2">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-white sticky top-0 z-10 shadow-sm dark:bg-slate-900">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">{tx("Setor / Cargo Oficial")}</th>
                            {ehAdmin && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-right dark:border-slate-800">{tx("Ações")}</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {setoresFiltrados.map(s => (
                            <tr key={s.id} className="hover:bg-slate-50 group transition-colors border-b border-slate-50 dark:hover:bg-slate-800/60 dark:border-slate-800">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-blue-50 border-blue-200 text-blue-700 shrink-0 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400">
                                            <LayoutGrid className="w-5 h-5" />
                                        </div>
                                        <span className="text-sm font-black text-slate-800 uppercase tracking-tight dark:text-white">{s.nome}</span>
                                    </div>
                                </td>

                                {ehAdmin && (
                                    <td className="px-6 py-4 text-right align-middle">
                                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => onEdit(s)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30">
                                                <Edit3 className="w-3.5 h-3.5" />{' '}{tx("Editar")}
                                            </button>
                                            <button onClick={() => onDelete(s.id, s.nome)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30">
                                                <Trash2 className="w-3.5 h-3.5" />{' '}{tx("Excluir")}
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {setoresFiltrados.length === 0 && (
                            <tr>
                                <td colSpan={ehAdmin ? "2" : "1"} className="text-center py-20 text-slate-400 uppercase tracking-widest text-[10px] font-bold opacity-60">
                                    {tx("Nenhum setor encontrado.")}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TabSetores;