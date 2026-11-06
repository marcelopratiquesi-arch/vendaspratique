import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader2, History, Search } from 'lucide-react';
import { supabase } from '../supabaseClient.js';
import { tx, localeAtual } from '../i18n/traduzir.js';
import { PERMISSAO_POR_CODIGO, NOME_PAPEL } from './catalogoPermissoes.js';

// ==========================================
// HISTÓRICO DAS PERMISSÕES (Configurações → Permissões → botão "Histórico"; decisão do dono, 06/11/2026)
// Lê a tabela permissoes_log (gravada pelo gatilho do banco; só o Admin lê): quem mudou, quando, o quê,
// para quem (nível ou login) e como estava antes → como ficou. Só leitura.
// ==========================================

const LIMITE = 300;

const Estado = ({ valor }) => {
    if (valor === null || valor === undefined) {
        return <span className="h-5 px-2 rounded-md bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-wide inline-flex items-center dark:bg-slate-800 dark:text-slate-400">{tx('Padrão')}</span>;
    }
    return valor
        ? <span className="h-5 px-2 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wide inline-flex items-center dark:bg-emerald-500/10 dark:text-emerald-300">{tx('Ligada')}</span>
        : <span className="h-5 px-2 rounded-md bg-rose-50 text-rose-700 text-[10px] font-black uppercase tracking-wide inline-flex items-center dark:bg-rose-500/10 dark:text-rose-300">{tx('Desligada')}</span>;
};

const HistoricoPermissoes = ({ usuarios = [], fechar }) => {
    const [linhas, setLinhas] = useState(null);
    const [erro, setErro] = useState('');
    const [busca, setBusca] = useState('');

    useEffect(() => {
        let ativo = true;
        supabase.from('permissoes_log').select('*').order('quando', { ascending: false }).limit(LIMITE).then(({ data, error }) => {
            if (!ativo) return;
            if (error) { console.warn('Permissões: histórico indisponível', error); setErro(error.message || String(error)); setLinhas([]); return; }
            setLinhas(data || []);
        });
        return () => { ativo = false; };
    }, []);

    useEffect(() => {
        const aoTeclar = (e) => { if (e.key === 'Escape') fechar(); };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [fechar]);

    const nomePorEmail = useMemo(() => new Map(usuarios.map(u => [String(u.email || '').toLowerCase().trim(), u.nome || u.email])), [usuarios]);
    const nomeDe = (email) => nomePorEmail.get(String(email || '').toLowerCase().trim()) || email || '—';
    const paraQuem = (l) => (l.tipo === 'PAPEL'
        ? `${tx('Nível')}: ${tx(NOME_PAPEL[l.alvo] || l.alvo)}`
        : `${tx('Login')}: ${nomeDe(l.alvo)}`);
    const quando = (iso) => new Date(iso).toLocaleString(localeAtual(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const termo = busca.trim().toLowerCase();
    const filtradas = (linhas || []).filter(l => {
        if (!termo) return true;
        const p = PERMISSAO_POR_CODIGO.get(l.codigo);
        return [l.codigo, p?.nome, p ? tx(p.nome) : '', nomeDe(l.quem), paraQuem(l)].some(t => String(t || '').toLowerCase().includes(termo));
    });

    const th = 'px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap dark:text-slate-400';

    return (
        <div className="fixed inset-0 z-[80] bg-slate-900/50 flex items-center justify-center p-4" onClick={fechar}>
            <div role="dialog" aria-modal="true" aria-label={tx('Histórico das permissões')} onClick={(e) => e.stopPropagation()}
                className="w-[min(960px,100%)] max-h-[85vh] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xl dark:bg-slate-900 dark:border-slate-800">
                <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 dark:border-slate-800">
                    <h3 className="text-[13px] font-black uppercase tracking-widest text-slate-800 flex items-center gap-2 dark:text-white">
                        <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />{tx('Histórico das permissões')}
                    </h3>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={tx('Buscar por número, nome ou pessoa...')}
                                className="h-9 w-[min(260px,60vw)] pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-[12px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800/60 dark:border-slate-700 dark:text-white" />
                        </div>
                        <button type="button" onClick={fechar} aria-label={tx('Fechar')} className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="overflow-auto custom-scrollbar">
                    {linhas === null ? (
                        <div className="py-16 flex items-center justify-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
                    ) : erro ? (
                        <p className="p-6 text-[12px] font-bold text-rose-600 dark:text-rose-300">{tx('Não foi possível ler o histórico: {erro}', { erro })}</p>
                    ) : filtradas.length === 0 ? (
                        <p className="py-12 text-center text-[11px] font-black uppercase tracking-widest text-slate-400">{tx('Nenhuma mudança registrada.')}</p>
                    ) : (
                        <table className="w-full min-w-[720px] text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 dark:bg-slate-800 dark:border-slate-800">
                                <tr>
                                    <th className={th}>{tx('Quando')}</th>
                                    <th className={th}>{tx('Quem mudou')}</th>
                                    <th className={th}>{tx('Permissão')}</th>
                                    <th className={th}>{tx('Para quem')}</th>
                                    <th className={th}>{tx('Antes → Depois')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtradas.map(l => {
                                    const p = PERMISSAO_POR_CODIGO.get(l.codigo);
                                    return (
                                        <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800">
                                            <td className="px-3 py-2 text-[12px] font-bold text-slate-600 whitespace-nowrap dark:text-slate-300">{quando(l.quando)}</td>
                                            <td className="px-3 py-2 text-[12px] font-bold text-slate-800 dark:text-white">{nomeDe(l.quem)}</td>
                                            <td className="px-3 py-2 text-[12px] font-bold text-slate-800 dark:text-white">
                                                <span className="font-mono font-black text-slate-500 dark:text-slate-400">{l.codigo}</span>{' '}{p ? tx(p.nome) : ''}
                                            </td>
                                            <td className="px-3 py-2 text-[12px] font-semibold text-slate-600 dark:text-slate-300">{paraQuem(l)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap"><Estado valor={l.antes} />{' '}<span className="text-slate-400">→</span>{' '}<Estado valor={l.depois} /></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
                {linhas && linhas.length >= LIMITE && (
                    <p className="px-5 py-2 border-t border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">{tx('Mostrando as {qtd} mudanças mais recentes.', { qtd: LIMITE })}</p>
                )}
            </div>
        </div>
    );
};

export default HistoricoPermissoes;
