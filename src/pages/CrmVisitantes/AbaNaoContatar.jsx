import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Ban, Search, X, Loader2, Undo2, AlertTriangle } from 'lucide-react';
import { contatoCombinaComBusca, formatarDataHora, podeTirarNaoContatar } from './utils';
import { carregarListaNaoContatar, tirarNaoContatar } from './contatosFeitos';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';
import { CartaoCelular } from '../../components/celular/Cartao.jsx';

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
    const podeTirar = podeTirarNaoContatar(usuarioLogado);

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
        if (!window.confirm(tx("Tirar {nome} da lista \"Não contatar\"?\n\nO contato volta para o Banco Bruto (nunca para a Geladeira).", { nome: registro.nome }))) return;
        setTirando(registro.id);
        try {
            await tirarNaoContatar(registro.id, operador || usuarioLogado?.nome || 'SISTEMA');
            setLista(prev => (prev || []).filter(r => r.id !== registro.id));
            if (onMudou) onMudou();
        } catch (err) {
            avisar(tx("Não foi possível tirar da lista.\n\n{v1}", { v1: err?.message || '' }));
        } finally {
            setTirando(null);
        }
    };

    const th = 'px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap';

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-rose-200 dark:border-rose-500/30 shadow-sm p-3 md:p-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex flex-wrap justify-between items-start gap-4 mb-5 border-b border-slate-100 dark:border-slate-800 pb-5">
                <div>
                    <h3 className="text-lg md:text-xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                        <Ban className="w-6 h-6 text-rose-500" />{' '}{tx("Não contatar")}
                        {carregando && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">{tx("Pediram para não receber contato. Não aparecem na Base, Kanban, Lista, Migração nem em Contatos de hoje.")}{podeTirar ? '' : " " + tx("Só Líder, Mentor e Admin podem tirar alguém da lista.") + ""}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 max-md:w-full">
                    <div className="relative max-md:w-full">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={tx("Buscar por nome ou CPF")} className="w-full sm:w-56 max-md:h-11 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/30" />
                        {busca && <button type="button" onClick={() => setBusca('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 max-md:right-0 max-md:p-3.5 text-slate-400"><X className="w-3.5 h-3.5" /></button>}
                    </div>
                    {unidadeChave && (
                        <label className="flex items-center gap-2 max-md:min-h-10 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 cursor-pointer">
                            <input type="checkbox" checked={soDaUnidade} onChange={(e) => setSoDaUnidade(e.target.checked)} className="accent-blue-600" />{' '}{tx("Só desta unidade")}
                        </label>
                    )}
                </div>
            </div>

            {lista === null && !carregando && (
                <div className="mb-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{' '}{tx("A tabela \"crm_nao_contatar\" não foi encontrada no Supabase.")}
                </div>
            )}

            <div className="md:hidden space-y-2">
                {filtradas.length === 0 ? (
                    <p className="text-center py-12 text-[10px] font-black uppercase tracking-widest text-slate-400">{carregando ? tx("Carregando...") : tx("Ninguém na lista.")}</p>
                ) : filtradas.map(r => (
                    <CartaoCelular key={r.id} titulo={<span className="uppercase">{r.nome}</span>}>
                        <p className="text-[12px] font-bold text-rose-600 dark:text-rose-400 break-words">{r.motivo}</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 break-words">{tx("Desde")}: {formatarDataHora(r.criado_em)} · {tx("Quem colocou")}: {r.colocado_por} · {r.unidade}</p>
                        {podeTirar && (
                            <button type="button" onClick={() => tirar(r)} disabled={tirando === r.id} className="mt-2 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 disabled:opacity-60 flex items-center justify-center gap-1.5">
                                {tirando === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}{tx("Tirar da lista")}
                            </button>
                        )}
                    </CartaoCelular>
                ))}
            </div>

            <div className="hidden md:block overflow-x-auto custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-slate-50 dark:bg-slate-800/60">
                        <tr>
                            <th className={th}>{tx("Nome")}</th>
                            <th className={th}>{tx("Motivo")}</th>
                            <th className={th}>{tx("Desde")}</th>
                            <th className={th}>{tx("Quem colocou")}</th>
                            <th className={th}>{tx("Unidade")}</th>
                            {podeTirar && <th className={`${th} text-right`}>{tx("Ação")}</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filtradas.length === 0 ? (
                            <tr><td colSpan={podeTirar ? 6 : 5} className="text-center py-12 text-[10px] font-black uppercase tracking-widest text-slate-400">{carregando ? tx("Carregando...") : tx("Ninguém na lista.")}</td></tr>
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
                                            {tirando === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}{' '}{tx("Tirar da lista")}
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
