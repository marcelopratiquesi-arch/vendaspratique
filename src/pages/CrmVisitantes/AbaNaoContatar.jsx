import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Ban, Search, X, Loader2, Undo2, AlertTriangle } from 'lucide-react';
import { contatoCombinaComBusca, formatarDataHora, papelReal } from './utils';
import { carregarListaNaoContatar, tirarNaoContatar } from './contatosFeitos';
import { avisar } from '../../components/avisar.js';

// ==========================================
// ABA "NÃO CONTATAR"
// Pessoas que pediram para não receber contato. Ficam fora de todas as listas do CRM (rede inteira).
// Só Líder, Mentor e Admin podem tirar da lista (o banco também confere).
// A aba "Geladeira" (contatos Perdidos, 30 dias) é outra coisa e continua igual.
// ==========================================

const AbaNaoContatar = ({ unidade, operador, usuarioLogado, versao = 0, onMudou }) => {
    const [lista, setLista] = useState(null);
    const [carregando, setCarregando] = useState(true);
    const [busca, setBusca] = useState('');
    const [soDaUnidade, setSoDaUnidade] = useState(true);
    const [tirando, setTirando] = useState(null);

    const unidadeChave = String(unidade || '').toUpperCase().trim();
    const podeTirar = ['ADMIN', 'LIDER', 'MENTOR'].includes(papelReal(usuarioLogado));

    const carregar = useCallback(async () => {
        setCarregando(true);
        setLista(await carregarListaNaoContatar());
        setCarregando(false);
    }, []);
    useEffect(() => { carregar(); }, [carregar, versao]);

    const filtradas = useMemo(() => (lista || []).filter(r =>
        (!soDaUnidade || !unidadeChave || String(r.unidade || '').toUpperCase().trim() === unidadeChave)
        && contatoCombinaComBusca(r, busca)
    ), [lista, soDaUnidade, unidadeChave, busca]);

    const tirar = async (registro) => {
        if (!window.confirm(`Tirar ${registro.nome} da lista "Não contatar"?\n\nA pessoa volta a aparecer nas listas de contato do CRM.`)) return;
        setTirando(registro.id);
        try {
            await tirarNaoContatar(registro.id, operador || usuarioLogado?.nome || 'SISTEMA');
            setLista(prev => (prev || []).filter(r => r.id !== registro.id));
            if (onMudou) onMudou();
        } catch (err) {
            avisar(`Não foi possível tirar da lista.\n\n${err?.message || ''}`);
        } finally {
            setTirando(null);
        }
    };

    const th = 'px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap';

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-rose-200 dark:border-rose-500/30 shadow-sm p-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex flex-wrap justify-between items-start gap-4 mb-5 border-b border-slate-100 dark:border-slate-800 pb-5">
                <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                        <Ban className="w-6 h-6 text-rose-500" /> Não contatar
                        {carregando && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">Pediram para não receber contato. Não aparecem na Base, Kanban, Lista, Migração nem em Contatos de hoje.{podeTirar ? '' : ' Só Líder, Mentor e Admin podem tirar alguém da lista.'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou CPF" className="w-56 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/30" />
                        {busca && <button type="button" onClick={() => setBusca('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400"><X className="w-3.5 h-3.5" /></button>}
                    </div>
                    {unidadeChave && (
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 cursor-pointer">
                            <input type="checkbox" checked={soDaUnidade} onChange={(e) => setSoDaUnidade(e.target.checked)} className="accent-blue-600" /> Só desta unidade
                        </label>
                    )}
                </div>
            </div>

            {lista === null && !carregando && (
                <div className="mb-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> A tabela "crm_nao_contatar" não foi encontrada no Supabase.
                </div>
            )}

            <div className="overflow-x-auto custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-slate-50 dark:bg-slate-800/60">
                        <tr>
                            <th className={th}>Nome</th>
                            <th className={th}>Motivo</th>
                            <th className={th}>Desde</th>
                            <th className={th}>Quem colocou</th>
                            <th className={th}>Unidade</th>
                            {podeTirar && <th className={`${th} text-right`}>Ação</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filtradas.length === 0 ? (
                            <tr><td colSpan={podeTirar ? 6 : 5} className="text-center py-12 text-[10px] font-black uppercase tracking-widest text-slate-400">{carregando ? 'Carregando...' : 'Ninguém na lista.'}</td></tr>
                        ) : filtradas.map(r => (
                            <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="px-4 py-3 text-xs font-black text-slate-800 dark:text-white uppercase">{r.nome}</td>
                                <td className="px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-400 max-w-[280px] whitespace-normal">{r.motivo}</td>
                                <td className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatarDataHora(r.criado_em)}</td>
                                <td className="px-4 py-3 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">{r.colocado_por}</td>
                                <td className="px-4 py-3 text-[10px] font-black uppercase text-slate-400">{r.unidade}</td>
                                {podeTirar && (
                                    <td className="px-4 py-3 text-right">
                                        <button type="button" onClick={() => tirar(r)} disabled={tirando === r.id} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-60 inline-flex items-center gap-1">
                                            {tirando === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />} Tirar da lista
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AbaNaoContatar;
