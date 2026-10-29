import React, { useState } from 'react';
import { Trash2, RotateCcw, Loader2, Info, FilterX } from 'lucide-react';
import { supabase } from '../../../supabaseClient.js';
import { formatMoney, formatarCPF, formatDataBR, toTitleCase } from '../utils.js';
import { avisar } from '../../../components/avisar.js';
import { tx, localeAtual } from '../../../i18n/traduzir.js';

// ==========================================
// ABA "LIXEIRA" DO HISTÓRICO
// Vendas excluídas (pela função segura excluir_venda) que ainda não foram restauradas.
// A lista chega pronta do index.jsx: vem da consulta segura vendas_lixeira_listar (que limita por perfil:
// Admin todas as unidades; Mentor as unidades dele em mentor_unidades, ou todas se não tiver nenhuma;
// Líder e Recepção só a própria) e já passou pelos MESMOS filtros do Histórico (período pela data da
// exclusão, unidade, busca e itens escondidos). Esta aba não tem filtro próprio.
// Restaurar = função restaurar_venda (Admin; Mentor só nas unidades dele), mesmo número de antes.
// Venda na lixeira não está na tabela de vendas: não soma comissão, relatório, fechamento nem duplicidade.
// ==========================================

const dataHoraBR = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(localeAtual(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const AbaLixeira = ({ linhas = [], erro = '', carregando = false, unidade, temVisaoGlobal, descricaoPeriodo, podeRestaurar, onRestaurada }) => {
    const [restaurandoId, setRestaurandoId] = useState(null);
    // Venda já restaurada some na hora, antes de a lista recarregar
    const [restauradas, setRestauradas] = useState([]);

    const unidadeFiltro = unidade && unidade !== 'TODOS' && unidade !== 'TODAS' ? unidade : null;
    const visiveis = linhas.filter(l => !restauradas.includes(l.venda_id));
    const totalComissao = visiveis.reduce((soma, l) => soma + (Number(l.comissao ?? l.valor) || 0), 0);

    const restaurar = async (linha) => {
        if (!podeRestaurar || restaurandoId) return;
        const ok = window.confirm(tx("Restaurar a venda Nº {venda_id} ({v2} · {v3})?\n\nEla volta para o Histórico com o mesmo número e volta a contar nas comissões.", { venda_id: linha.venda_id, v2: linha.aluno || 'aluno', v3: linha.produto || '' }));
        if (!ok) return;
        setRestaurandoId(linha.venda_id);
        const { error } = await supabase.rpc('restaurar_venda', { p_venda_id: Number(linha.venda_id) });
        setRestaurandoId(null);
        if (error) {
            avisar(tx("Não foi possível restaurar a venda.\n\n{v1}", { v1: error.message || '' }));
            return;
        }
        // As vendas voltam sozinhas (tempo real do App); a lixeira recarrega para os contadores
        setRestauradas(atual => [...atual, linha.venda_id]);
        if (onRestaurada) onRestaurada();
    };

    const th = "px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 whitespace-nowrap text-left";

    return (
        <div className="p-6 md:p-8 bg-slate-50/50 dark:bg-slate-950/40 min-h-[50vh]">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6 pb-6 border-b border-slate-200 dark:border-slate-800">
                <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
                        <Trash2 className="w-6 h-6 text-rose-500" />
                        {tx("Lixeira de vendas")}
                    </h3>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-2 max-w-2xl leading-relaxed">
                        {tx("Vendas excluídas, com quem lançou, quem excluiu e o motivo. Elas")}{' '}<strong>{tx("não contam")}</strong>{' '}{tx("em comissões, relatórios, fechamento nem duplicidades.")}
                        {podeRestaurar ? " " + tx("Você pode restaurar uma venda excluída por engano.") + "" : " " + tx("Só o Admin e o Mentor restauram.") + ""}
                    </p>
                    <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                        <Info className="w-3 h-3" />{' '}{tx("Filtros do Histórico ·")}{' '}{descricaoPeriodo ? `${descricaoPeriodo} · ` : ''}{unidadeFiltro ? tx("Unidade {unidadeFiltro}", { unidadeFiltro: unidadeFiltro }) : (temVisaoGlobal ? tx("Todas as unidades") : tx("Sua unidade"))}{' '}{tx("· período pela data da exclusão")}
                    </p>
                </div>
                <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl px-4 py-2 text-right self-start lg:self-auto">
                    <p className="text-lg font-black text-rose-600 dark:text-rose-300 leading-none">{visiveis.length} {visiveis.length === 1 ? tx("venda") : tx("vendas")}</p>
                    <p className="text-[10px] font-black text-rose-500 dark:text-rose-300/80 uppercase tracking-widest mt-1">{formatMoney(totalComissao)}{' '}{tx("em comissão excluída")}</p>
                </div>
            </div>

            {erro ? (
                <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-2xl p-5 text-xs font-bold">
                    {tx("Não foi possível carregar a lixeira:")}{' '}{erro}
                </div>
            ) : carregando && visiveis.length === 0 ? (
                <div className="flex items-center justify-center py-20 text-slate-400 gap-2 text-xs font-black uppercase tracking-widest">
                    <Loader2 className="w-4 h-4 animate-spin" />{' '}{tx("Carregando...")}
                </div>
            ) : visiveis.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-80">
                    <FilterX className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                    <p className="text-sm font-bold text-slate-400">{tx("Nenhuma venda excluída no período.")}</p>
                </div>
            ) : (
                <div className="overflow-x-auto custom-scrollbar bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <table className="w-full min-w-max border-collapse">
                        <thead className="bg-slate-50/80 dark:bg-slate-800/60">
                            <tr>
                                <th className={th}>Nº</th>
                                <th className={th}>{tx("Aluno")}</th>
                                <th className={th}>{tx("Produto")}</th>
                                <th className={th}>{tx("Valor")}</th>
                                <th className={th}>{tx("Comissão")}</th>
                                <th className={th}>{tx("Lançou")}</th>
                                <th className={th}>{tx("Excluiu")}</th>
                                <th className={th}>{tx("Motivo")}</th>
                                {podeRestaurar && <th className={th}></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {visiveis.map(l => (
                                <tr key={`${l.venda_id}-${l.excluido_em}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 align-top">
                                    <td className="px-4 py-3 text-xs font-black text-slate-500 dark:text-slate-400 font-mono">{l.venda_id}</td>
                                    <td className="px-4 py-3">
                                        <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase max-w-[220px] truncate" title={l.aluno}>{toTitleCase(l.aluno || '—')}</p>
                                        <p className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">{formatarCPF(l.cpf)}{l.matricula ? " " + tx("· MAT {matricula}", { matricula: l.matricula }) + "" : ''}</p>
                                        {temVisaoGlobal && !unidadeFiltro && <p className="text-[10px] font-black text-rose-500 uppercase mt-1">{l.unidade}</p>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-xs font-bold text-blue-600 dark:text-blue-300 uppercase">{l.quantidade ? `${l.quantidade}x ` : ''}{l.produto}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tx("Venda de")}{' '}{formatDataBR(l.data_venda)} · {toTitleCase(l.vendedor || '')}</p>
                                    </td>
                                    <td className="px-4 py-3 text-xs font-black text-slate-700 dark:text-slate-200 whitespace-nowrap">{formatMoney(l.valor)}</td>
                                    <td className="px-4 py-3 text-xs font-black text-emerald-600 dark:text-emerald-300 whitespace-nowrap">{formatMoney(l.comissao ?? l.valor)}</td>
                                    <td className="px-4 py-3">
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{toTitleCase(l.lancado_por || 'Sistema')}</p>
                                        <p className="text-[10px] font-bold text-slate-400 font-mono">{dataHoraBR(l.lancado_em)}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-xs font-bold text-rose-600 dark:text-rose-300">{toTitleCase(l.excluido_por || l.excluido_email || '—')}</p>
                                        <p className="text-[10px] font-bold text-slate-400 font-mono">{dataHoraBR(l.excluido_em)}</p>
                                    </td>
                                    <td className="px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-300 max-w-[260px] whitespace-normal">{l.motivo || <span className="text-slate-400 italic">{tx("sem motivo (exclusão antiga)")}</span>}</td>
                                    {podeRestaurar && (
                                        <td className="px-4 py-3">
                                            <button type="button" onClick={() => restaurar(l)} disabled={Boolean(restaurandoId)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-50 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm whitespace-nowrap">
                                                {restaurandoId === l.venda_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}{' '}{tx("Restaurar")}
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AbaLixeira;
