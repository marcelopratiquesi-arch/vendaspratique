// ==========================================
// TURNO DAS RECEPCIONISTAS — janela para o LÍDER (decisão do dono, 05/11/2026)
// Enquanto houver recepcionista ATIVA da unidade dele sem turno (Manhã/Noite) no cadastro da Equipe, toda vez que o
// Líder entra no sistema aparece esta janela com os nomes para ele escolher o turno e salvar ali mesmo (sem ir em
// Cadastros → Equipe). O turno é usado na cobrança do relatório de fechamento (regra 19). "Depois" fecha (volta no próximo login).
// Grava só o campo colaboradores.turno (a regra do banco deixa o Líder editar a equipe da unidade dele; auditado em auditoria_cadastros).
// ==========================================
import React, { useMemo, useState } from 'react';
import { Users, Loader2, X } from 'lucide-react';
import { supabase } from '../../supabaseClient.js';
import { tx } from '../../i18n/traduzir.js';
import { avisar } from '../../components/avisar.js';
import { normalizeString } from '../AnaliseVendas/utils.js';

const ehRecepcao = (c) => normalizeString(String(c?.role || c?.setor || '')).includes('RECEP');

const PopupTurnoRecepcao = ({ usuario, colaboradores = [], setColaboradores }) => {
    const ehLider = String(usuario?.role || '').toUpperCase() === 'LIDER';
    const unidade = normalizeString(String(usuario?.unidade || ''));
    const recepcionistas = useMemo(() => colaboradores
        .filter(c => c && c.ativo !== false && ehRecepcao(c) && normalizeString(String(c.unidade || '')) === unidade)
        .sort((a, b) => String(a.nome).localeCompare(String(b.nome))), [colaboradores, unidade]);
    const faltando = recepcionistas.filter(c => !c.turno);
    const [escolhas, setEscolhas] = useState({}); // id → 'MANHA' | 'NOITE'
    const [fechada, setFechada] = useState(false);
    const [salvando, setSalvando] = useState(false);

    if (!ehLider || fechada || !faltando.length) return null;

    const turnoDe = (c) => escolhas[c.id] ?? c.turno ?? '';
    const prontos = recepcionistas.filter(c => turnoDe(c));

    const salvar = async () => {
        const mudar = recepcionistas.filter(c => escolhas[c.id] && escolhas[c.id] !== c.turno);
        if (!mudar.length) { avisar(tx('Escolha o turno de pelo menos uma recepcionista.'), 'atencao'); return; }
        setSalvando(true);
        const atualizados = [];
        for (const c of mudar) {
            const { data, error } = await supabase.from('colaboradores').update({ turno: escolhas[c.id] }).eq('id', c.id).select();
            if (error) {
                setSalvando(false);
                avisar(tx('Não foi possível salvar o turno: {message}', { message: error.message }), 'erro');
                return;
            }
            if (data?.[0]) atualizados.push(data[0]);
        }
        setSalvando(false);
        if (atualizados.length) setColaboradores?.(lista => lista.map(c => atualizados.find(a => a.id === c.id) || c));
        avisar(tx('Turno salvo para {qtd} recepcionista(s).', { qtd: atualizados.length }), 'sucesso');
        // Fica aberta se ainda faltar alguém (some sozinha quando todas tiverem turno)
    };

    return (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]" role="dialog" aria-modal="true" aria-labelledby="popup-turno-titulo">
            <div className="bg-white rounded-2xl shadow-2xl w-[min(520px,100%)] max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                <div className="px-6 py-5 flex items-start gap-3 bg-blue-600 text-white">
                    <Users className="w-6 h-6 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                        <h2 id="popup-turno-titulo" className="text-base font-black uppercase tracking-widest leading-tight">{tx('Turno das recepcionistas')}</h2>
                        <p className="text-[12px] font-bold uppercase tracking-widest opacity-90 mt-1">{usuario?.unidade}</p>
                    </div>
                    <button type="button" onClick={() => setFechada(true)} aria-label={tx('Fechar')} className="opacity-80 hover:opacity-100"><X className="w-5 h-5" /></button>
                </div>

                <div className="px-6 py-5 overflow-y-auto custom-scrollbar space-y-4">
                    <p className="text-sm font-bold text-slate-700 leading-snug dark:text-slate-200">
                        {tx('Marque o turno de cada recepcionista da sua unidade. Ele é usado para cobrar o relatório de fechamento pelo nome de quem estava no turno.')}
                    </p>
                    <ul className="space-y-2">
                        {recepcionistas.map(c => {
                            const atual = turnoDe(c);
                            return (
                                <li key={c.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${atual ? 'border-slate-200 dark:border-slate-800' : 'border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30'}`}>
                                    <span className="text-[12px] font-black uppercase text-slate-800 dark:text-white">{c.nome}</span>
                                    <div className="flex bg-slate-100 p-1 rounded-lg gap-1 dark:bg-slate-800">
                                        {[['MANHA', tx('Manhã (5h às 14h)')], ['NOITE', tx('Noite (14h às 23h)')]].map(([valor, rotulo]) => (
                                            <button key={valor} type="button" onClick={() => setEscolhas(e => ({ ...e, [c.id]: valor }))}
                                                className={`px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-colors ${atual === valor ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
                                                {rotulo}
                                            </button>
                                        ))}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {tx('{prontos} de {total} com turno. Dá para mudar depois em Cadastros → Equipe.', { prontos: prontos.length, total: recepcionistas.length })}
                    </p>
                </div>

                <div className="px-6 py-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 dark:border-slate-800">
                    <button type="button" onClick={() => setFechada(true)} className="h-11 px-4 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">{tx('Depois')}</button>
                    <button type="button" onClick={salvar} disabled={salvando} className="h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md">
                        {salvando && <Loader2 className="w-4 h-4 animate-spin" />}{tx('Salvar turnos')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PopupTurnoRecepcao;
