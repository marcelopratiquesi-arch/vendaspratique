import React, { useState } from 'react';
import { Check, X, Loader2, ArrowRightLeft, AlertTriangle, UserPlus } from 'lucide-react';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import { avisar } from '../avisar.js';
import CopyButton from '../../pages/HistoricoVendas/CopyButton.jsx';
import { aprovarPedido, rejeitarPedido } from './acessoBanco.js';
import { telefoneBonito } from './regrasAcesso.js';

// ==========================================
// PEDIDOS DE ACESSO PARA APROVAR (12/11/2026) — usada na janela ao entrar (Admin/Mentor) e na aba Pendências.
// Aprovar (o Admin pode corrigir papel e unidade antes) · Rejeitar (motivo obrigatório, a pessoa vê ao entrar).
// TROCA DE LÍDER: líder atual × novo lado a lado; ao aprovar, o atual fica INATIVO (nada é apagado).
// O banco confere quem pode aprovar (Mentor: só Líder das unidades dele; Mentor novo: só o Admin).
// ==========================================

const quando = (v) => { if (!v) return '—'; const d = new Date(v); return isNaN(d) ? '—' : d.toLocaleString(localeAtual(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
const ha = (v) => { if (!v) return tx('nunca entrou'); const dias = Math.floor((Date.now() - new Date(v)) / 86400000); return dias <= 0 ? tx('hoje') : dias === 1 ? tx('ontem') : tx('há {qtd} dias', { qtd: dias }); };

const Pessoa = ({ titulo, cor, nome, email, telefone, extra }) => (
    <div className={`rounded-xl border p-3 ${cor}`}>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{titulo}</p>
        <p className="text-[13px] font-black uppercase text-slate-800 dark:text-white">{nome}</p>
        <p className="text-[12px] font-semibold text-slate-600 flex items-center gap-1 dark:text-slate-300">{email}<CopyButton textToCopy={email} label={tx('Copiar e-mail')} /></p>
        {telefone && <p className="text-[12px] font-semibold text-slate-600 flex items-center gap-1 dark:text-slate-300">{telefoneBonito(telefone)}<CopyButton textToCopy={String(telefone).replace(/\D/g, '')} label={tx('Copiar telefone')} /></p>}
        {extra && <p className="text-[11px] font-bold text-slate-500 mt-0.5 dark:text-slate-400">{extra}</p>}
    </div>
);

const CartaoPedido = ({ p, ehAdmin, unidades, onDecidido }) => {
    const [papel, setPapel] = useState(p.papel);
    const [unidade, setUnidade] = useState((p.unidades || [])[0] || '');
    const [posto, setPosto] = useState(p.posto === 'ASPIRA' ? 'ASPIRA' : 'TITULAR'); // Líder ou Aspira (13/11/2026)
    const [gravando, setGravando] = useState(false);
    const troca = p.tipo === 'TROCA_LIDER';
    const atual = (p.lider_atual || [])[0] || null;
    const nomePosto = posto === 'ASPIRA' ? tx('Aspira') : tx('Líder');

    const aprovar = async () => {
        const unidadesFinais = papel === 'LIDER' ? [unidade] : p.unidades;
        const texto = troca && papel === 'LIDER'
            ? tx('Aprovar a TROCA em {unidade}? {atual} fica INATIVO e {novo} passa a ser o {posto}. O outro posto não muda.', { unidade, atual: atual?.nome || tx('o líder atual'), novo: p.nome, posto: nomePosto })
            : tx('Aprovar o acesso de {nome}?', { nome: p.nome });
        if (!window.confirm(texto)) return;
        setGravando(true);
        try {
            await aprovarPedido(p.id, papel, unidadesFinais, papel === 'LIDER' ? posto : null);
            avisar(tx('Acesso aprovado: {nome}.', { nome: p.nome }), 'sucesso');
            onDecidido?.();
        } catch (e) { avisar(e.message || tx('Não foi possível aprovar.'), 'erro'); } finally { setGravando(false); }
    };
    const rejeitar = async () => {
        const motivo = window.prompt(tx('Motivo da rejeição (a pessoa vê ao tentar entrar):'));
        if (motivo === null) return;
        if (motivo.trim().length < 5) { avisar(tx('Rejeição cancelada: o motivo precisa ter pelo menos 5 letras.'), 'atencao'); return; }
        setGravando(true);
        try { await rejeitarPedido(p.id, motivo.trim()); avisar(tx('Pedido rejeitado.'), 'sucesso'); onDecidido?.(); }
        catch (e) { avisar(e.message || tx('Não foi possível rejeitar.'), 'erro'); } finally { setGravando(false); }
    };

    return (
        <li className={`rounded-2xl border p-4 bg-white dark:bg-slate-900 ${troca ? 'border-amber-300 dark:border-amber-500/40' : 'border-slate-200 dark:border-slate-800'}`}>
            <div className="flex flex-wrap items-center gap-2 mb-3">
                {troca
                    ? <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest"><ArrowRightLeft className="w-3.5 h-3.5" />{posto === 'ASPIRA' ? tx('Troca de aspira — {unidade}', { unidade: (p.unidades || [])[0] }) : tx('Troca de líder — {unidade}', { unidade: (p.unidades || [])[0] })}</span>
                    : <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest"><UserPlus className="w-3.5 h-3.5" />{p.papel === 'LIDER' ? (posto === 'ASPIRA' ? tx('Novo aspira') : tx('Novo líder')) : tx('Novo mentor')}</span>}
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{tx('pedido em {quando}', { quando: quando(p.criado_em) })}</span>
            </div>
            {troca ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Pessoa titulo={tx('{posto} atual', { posto: nomePosto })} cor="border-slate-200 bg-slate-50 dark:bg-slate-800/60 dark:border-slate-700" nome={atual?.nome || '—'} email={atual?.email || '—'} telefone={atual?.telefone} extra={tx('Último login: {quando}', { quando: ha(atual?.ultimo_login) })} />
                    <Pessoa titulo={tx('Novo {posto}', { posto: nomePosto })} cor="border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30" nome={p.nome} email={p.email} telefone={p.telefone} />
                </div>
            ) : (
                <Pessoa titulo={p.papel === 'LIDER' ? nomePosto : tx('Mentor')} cor="border-slate-200 bg-slate-50 dark:bg-slate-800/60 dark:border-slate-700" nome={p.nome} email={p.email} telefone={p.telefone}
                    extra={(p.unidades || []).join(' · ')} />
            )}
            {p.telefone_repetido_de && (
                <p className="mt-2 text-[12px] font-bold text-amber-700 flex items-start gap-1.5 dark:text-amber-300"><AlertTriangle className="w-4 h-4 shrink-0" />{tx('Este telefone já está no cadastro de: {quem}', { quem: p.telefone_repetido_de })}</p>
            )}
            {ehAdmin && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="block">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 dark:text-slate-400">{tx('Papel')}</span>
                        <select value={papel === 'LIDER' ? `LIDER|${posto}` : papel} onChange={e => { const [pp, ps] = e.target.value.split('|'); setPapel(pp); if (ps) setPosto(ps); }}
                            className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-[12px] font-bold dark:bg-slate-900 dark:border-slate-700 dark:text-white">
                            <option value="LIDER|TITULAR">{tx('Líder')}</option><option value="LIDER|ASPIRA">{tx('Aspira')}</option><option value="MENTOR">{tx('Mentor')}</option>
                        </select>
                    </label>
                    {papel === 'LIDER' && (
                        <label className="block">
                            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 dark:text-slate-400">{tx('Unidade')}</span>
                            <select value={unidade} onChange={e => setUnidade(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-[12px] font-bold uppercase dark:bg-slate-900 dark:border-slate-700 dark:text-white">
                                {[...new Set([unidade, ...unidades].filter(Boolean))].map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </label>
                    )}
                </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={aprovar} disabled={gravando} className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-1.5">
                    {gravando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}{troca ? tx('Aprovar troca') : tx('Aprovar')}
                </button>
                <button type="button" onClick={rejeitar} disabled={gravando} className="h-9 px-4 rounded-xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 dark:bg-slate-900 dark:border-rose-500/30 dark:text-rose-400">
                    <X className="w-3.5 h-3.5" />{tx('Rejeitar')}
                </button>
            </div>
        </li>
    );
};

const PedidosAcesso = ({ pedidos = [], ehAdmin = false, unidades = [], onDecidido }) => {
    if (!pedidos.length) return <p className="text-[12px] font-semibold text-slate-400 py-2">{tx('Nenhum pedido aguardando.')}</p>;
    return (
        <ul className="space-y-3">
            {pedidos.map(p => <CartaoPedido key={p.id} p={p} ehAdmin={ehAdmin} unidades={unidades} onDecidido={onDecidido} />)}
        </ul>
    );
};

export default PedidosAcesso;
