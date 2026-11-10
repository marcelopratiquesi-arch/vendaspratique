import React, { useMemo, useState } from 'react';
import { Search, Edit3, Trash2, PlusCircle, Users } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { normalizeString } from '../AnaliseVendas/utils.js';
import { setorDoColaborador } from '../Lancamentos/seletores/setoresEquipe.js';
import { ORDEM_NORMAL, proximaOrdem, ordenarLinhas } from '../../components/ordenacao.js';
import TituloOrdenavel from '../../components/TituloOrdenavel.jsx';

// ==========================================
// CADASTROS → SETORES — revisão 360 de 09/11/2026 (decisão do dono)
// - Coluna "Pessoas na equipe" (ativas e desligadas, da Equipe que a pessoa vê) e a cor do setor (a mesma da Nova Venda).
// - Botões sempre visíveis. Renomear troca o nome nas pessoas e excluir só setor vazio (regras no index.jsx).
// ==========================================

const TabSetores = ({ listaSetores = [], onEdit, onDelete, onOpenModal, ehAdmin, colaboradores = [] }) => {
    const [termoBusca, setTermoBusca] = useState('');
    const [ordem, setOrdem] = useState(ORDEM_NORMAL);
    const ordenar = (coluna, texto) => setOrdem(atual => proximaOrdem(atual, coluna, texto));

    // Pessoas por setor (pelo nome gravado em colaboradores.role)
    const contagem = useMemo(() => {
        const mapa = new Map();
        colaboradores.forEach(c => {
            const k = normalizeString(c.role);
            const atual = mapa.get(k) || { ativos: 0, desligados: 0 };
            if (c.ativo === false) atual.desligados += 1; else atual.ativos += 1;
            mapa.set(k, atual);
        });
        return mapa;
    }, [colaboradores]);
    const pessoasDe = (s) => contagem.get(normalizeString(s.nome)) || { ativos: 0, desligados: 0 };

    const lista = useMemo(() => {
        const termo = normalizeString(termoBusca);
        const filtrados = listaSetores.filter(s => !termo || normalizeString(s.nome).includes(termo));
        const normal = [...filtrados].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
        return ordenarLinhas(normal, ordem, { nome: s => s.nome || null, pessoas: s => pessoasDe(s).ativos }, s => s.nome);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pessoasDe depende só de "contagem"
    }, [listaSetores, termoBusca, ordem, contagem]);

    const th = 'px-4 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap dark:text-slate-400';
    const totalAtivos = colaboradores.filter(c => c.ativo !== false).length;

    return (
        <div className="space-y-3 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex flex-wrap items-center gap-2">
                <div className="bg-white rounded-xl border border-slate-200 h-10 px-4 inline-flex items-center gap-3 text-[12px] font-black text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200">
                    <span><span className="text-base">{listaSetores.length}</span> {tx('setores')}</span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-400" /><span className="text-base">{totalAtivos}</span> {tx('pessoas ativas')}</span>
                </div>
                <label className="flex-1 min-w-[min(220px,100%)] h-10 px-3 bg-white border border-slate-200 rounded-xl flex items-center gap-2 focus-within:ring-2 focus-within:ring-blue-500 dark:bg-slate-900 dark:border-slate-800">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input type="text" value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} placeholder={tx('Buscar setor...')} aria-label={tx('Buscar setor...')}
                        className="flex-1 min-w-0 bg-transparent outline-none text-[13px] font-bold text-slate-800 placeholder-slate-400 uppercase dark:text-white" />
                </label>
                {ehAdmin && (
                    <button type="button" onClick={onOpenModal} className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-sm">
                        <PlusCircle className="w-4 h-4" />{tx('Novo Setor / Cargo')}
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full min-w-[520px]">
                        <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-800">
                            <tr>
                                <TituloOrdenavel coluna="nome" texto ordem={ordem} onOrdenar={ordenar} className={th}>{tx('Setor / Cargo Oficial')}</TituloOrdenavel>
                                <TituloOrdenavel coluna="pessoas" ordem={ordem} onOrdenar={ordenar} className={`${th} text-center`} alinhar="center" dica={tx('Pessoas ativas no cadastro da Equipe com este setor (entre parênteses, as desligadas). Conta a Equipe da unidade escolhida no topo.')}>{tx('Pessoas na equipe')}</TituloOrdenavel>
                                {ehAdmin && <th className={`${th} text-right`}>{tx('Ações')}</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {lista.map(s => {
                                const p = pessoasDe(s);
                                const cor = setorDoColaborador({ role: s.nome }).cor;
                                const vazio = p.ativos + p.desligados === 0;
                                return (
                                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors dark:hover:bg-slate-800/40">
                                        <td className="px-4 py-2.5">
                                            <span className="inline-flex items-center gap-2.5 text-[13px] font-black text-slate-800 uppercase tracking-tight dark:text-white">
                                                <span className="w-3 h-3 rounded-[4px] shrink-0" style={{ background: cor }} aria-hidden="true" />{s.nome}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-[13px] font-black tabular-nums text-slate-700 dark:text-slate-200">
                                            {p.ativos || <span className="text-slate-300 dark:text-slate-600">0</span>}
                                            {p.desligados > 0 && <span className="text-[11px] font-bold text-slate-400"> ({p.desligados})</span>}
                                        </td>
                                        {ehAdmin && (
                                            <td className="px-4 py-2.5 text-right">
                                                <div className="flex justify-end gap-1.5">
                                                    <button type="button" onClick={() => onEdit(s)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white text-blue-600 hover:bg-blue-50 text-[10px] font-black uppercase tracking-widest transition-colors dark:bg-slate-900 dark:text-blue-400 dark:border-blue-500/30 dark:hover:bg-blue-500/10">
                                                        <Edit3 className="w-3.5 h-3.5" />{tx('Editar')}
                                                    </button>
                                                    <button type="button" onClick={() => onDelete(s.id, s.nome)}
                                                        title={vazio ? tx('Excluir') : tx('Só dá para excluir setor sem ninguém na Equipe')}
                                                        className={`h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-colors ${vazio ? 'border-rose-200 bg-white text-rose-600 hover:bg-rose-50 dark:bg-slate-900 dark:text-rose-400 dark:border-rose-500/30 dark:hover:bg-rose-500/10' : 'border-slate-200 bg-white text-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-600'}`}>
                                                        <Trash2 className="w-3.5 h-3.5" />{tx('Excluir')}
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            {lista.length === 0 && (
                                <tr><td colSpan={ehAdmin ? 3 : 2} className="text-center py-16 text-slate-400 uppercase tracking-widest text-[10px] font-bold">{tx('Nenhum setor encontrado.')}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TabSetores;
