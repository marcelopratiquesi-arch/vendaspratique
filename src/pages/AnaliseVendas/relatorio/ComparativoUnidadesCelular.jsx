import React, { useState } from 'react';
import { tx } from '../../../i18n/traduzir.js';
import TituloOrdenavel from '../../../components/TituloOrdenavel.jsx';
import { ORDEM_NORMAL, proximaOrdem, ordenarLinhas } from '../../../components/ordenacao.js';

// ==========================================
// RELATÓRIOS NO CELULAR, VISÃO DE ADMIN/MENTOR COM VÁRIAS UNIDADES (proposta 3, aprovada pelo dono em 27/11/2026)
// 1) Total da rede em quadro colorido · 2) tabela para comparar e ordenar as unidades (nome parado).
// Só aparece até 767px; os cartões por unidade continuam embaixo (RelatorioTab). Só mostra números que o
// relatório já calculou: `unidades` = [{ nome, itens: resumoDaUnidade(dados) }].
// ==========================================

const COR = {
    'Planos': '#2563EB', 'Nutri (adicional)': '#0E9F6E', 'Produtos': '#EA580C',
    'Serviços': '#7C3AED', 'Visitantes': '#0284C7', 'Avaliações': '#DB2777',
};
const rotuloCurto = (r) => (r === 'Nutri (adicional)' ? 'Nutri' : r);
const somar = (unidades) => (unidades[0]?.itens || []).map((item, i) => ({ rotulo: item.rotulo, valor: unidades.reduce((s, u) => s + (u.itens[i]?.valor || 0), 0) }));

export const TotalRedeCelular = ({ unidades, periodo }) => {
    const [vendas, ...resto] = somar(unidades);
    if (!vendas) return null;
    const venderam = unidades.filter(u => u.itens[0].valor > 0).length;
    return (
        <section className="md:hidden rounded-[20px] p-3 text-white bg-gradient-to-br from-[#0B1F4B] to-[#1D4FD8]">
            <p className="text-[13px] font-black uppercase tracking-widest">{tx('Total da rede')}</p>
            <p className="text-[11px] font-semibold text-blue-200">
                {periodo ? `${tx(periodo)} · ` : ''}{tx('{x} de {y} unidades venderam', { x: venderam, y: unidades.length })}
            </p>
            <div className="mt-2 flex items-baseline gap-2 rounded-2xl bg-white/15 px-3 py-2">
                <span className="text-4xl font-black tabular-nums">{vendas.valor}</span>
                <span className="text-[11px] font-black uppercase tracking-widest text-blue-100">{tx(vendas.rotulo)}</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
                {resto.map(item => (
                    <div key={item.rotulo} className="min-w-0 rounded-2xl bg-white px-2.5 py-2 border-b-[5px]" style={{ borderBottomColor: COR[item.rotulo] }}>
                        <span className="block text-2xl font-black leading-tight tabular-nums" style={{ color: COR[item.rotulo] }}>{item.valor}</span>
                        <span className="block truncate text-[10px] font-black uppercase tracking-wide text-slate-500">{tx(rotuloCurto(item.rotulo))}</span>
                    </div>
                ))}
            </div>
        </section>
    );
};

export const TabelaUnidadesCelular = ({ unidades, onIr }) => {
    const [ordem, setOrdem] = useState(ORDEM_NORMAL);
    const totais = somar(unidades);
    if (totais.length === 0) return null;
    const valores = { unidade: (u) => u.nome };
    totais.forEach((t, i) => { valores[t.rotulo] = (u) => u.itens[i].valor; });
    const linhas = ordenarLinhas(unidades, ordem, valores, (u) => u.nome);
    const ordenar = (coluna, texto) => setOrdem(o => proximaOrdem(o, coluna, texto));
    const th = 'px-2.5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap dark:text-slate-400';
    return (
        <section className="md:hidden bg-white border border-slate-200 rounded-2xl overflow-hidden dark:bg-slate-900 dark:border-slate-800">
            <p className="px-3 py-2.5 text-[12px] font-black uppercase tracking-widest text-slate-800 dark:text-white">{tx('Comparar unidades')}</p>
            <div className="tc-rolar">
                <table className="tc-tabela w-full">
                    <thead>
                        <tr>
                            <TituloOrdenavel coluna="unidade" texto ordem={ordem} onOrdenar={ordenar} className={th}>{tx('Unidade')}</TituloOrdenavel>
                            {totais.map(t => (
                                <TituloOrdenavel key={t.rotulo} coluna={t.rotulo} ordem={ordem} onOrdenar={ordenar} alinhar="right" className={th}>{tx(rotuloCurto(t.rotulo))}</TituloOrdenavel>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {linhas.map(u => (
                            <tr key={u.nome} className={u.itens[0].valor === 0 ? 'tc-zero' : ''}>
                                <td>
                                    <button type="button" onClick={() => onIr(u.nome)} className="w-full min-h-10 text-left text-[12px] font-black uppercase text-blue-700 dark:text-blue-400">{u.nome}</button>
                                </td>
                                {u.itens.map(item => (
                                    <td key={item.rotulo} className="px-2.5 text-right text-[13px] font-black tabular-nums" style={{ color: item.valor > 0 ? COR[item.rotulo] : undefined }}>
                                        {item.valor > 0 ? <span className={item.rotulo === 'Vendas' ? 'text-slate-800 dark:text-white' : ''}>{item.valor}</span> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td className="py-2.5 text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-white">{tx('Rede')}</td>
                            {totais.map(t => <td key={t.rotulo} className="px-2.5 py-2.5 text-right text-[13px] font-black tabular-nums text-slate-800 dark:text-white">{t.valor}</td>)}
                        </tr>
                    </tfoot>
                </table>
            </div>
            <p className="px-3 py-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tx('Toque no nome de uma unidade para ir até o relatório dela.')}</p>
        </section>
    );
};
