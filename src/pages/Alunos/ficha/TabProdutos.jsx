import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { formatarDataBR } from '../utils.js';

const formatMoney = (val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
};

const TabProdutos = ({ produtos, temVisaoGlobal }) => {
    if (!produtos || produtos.length === 0) {
        return (
            <div className="py-16 flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <ShoppingBag className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                <h4 className="text-sm font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Nenhuma compra avulsa</h4>
                <p className="text-xs font-medium text-slate-400 mt-1">Este aluno não possui histórico de compra de produtos ou serviços.</p>
            </div>
        );
    }

    return (
        <div className="animate-[fadeIn_0.2s_ease-out] overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
            <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                    <tr>
                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Qtd</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Item</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Data</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Consultor</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Valor</th>
                        {temVisaoGlobal && <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Unidade</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {produtos.map((p, idx) => (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-5 py-4 text-xs font-black text-amber-600 dark:text-amber-400">{String(p.quantidade || 1).padStart(2, '0')}x</td>
                            <td className="px-5 py-4">
                                <div className="flex items-center gap-2">
                                    {idx === 0 && <span className="bg-amber-500 w-2 h-2 rounded-full"></span>}
                                    <span className={`text-xs font-black uppercase tracking-tight ${idx === 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>{p.produto}</span>
                                </div>
                            </td>
                            <td className="px-5 py-4 text-xs font-bold text-slate-600 dark:text-slate-400">{formatarDataBR(p.data || p.created_at)}</td>
                            <td className="px-5 py-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">{p.vendedor || 'Sistema'}</td>
                            <td className="px-5 py-4 text-xs font-black text-slate-800 dark:text-slate-200 text-right">{formatMoney(p.valor)}</td>
                            {temVisaoGlobal && <td className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{p.unidade}</td>}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
export default TabProdutos;