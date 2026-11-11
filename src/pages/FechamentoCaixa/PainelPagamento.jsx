import React, { useState } from 'react';
import { Lock, CheckCircle2, AlertTriangle, Loader2, Unlock, X, Info } from 'lucide-react';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import { avisar } from '../../components/avisar.js';
import { formatMoney } from './utils.js';
import { mesJaTerminou } from './pagamentosComissao.js';

// ==========================================
// PAINEL "PAGAMENTO DAS COMISSÕES" (aba Comissões do Fechamento; 11/11/2026, decisão do dono)
// Substituiu a etiqueta "Pagamento Aprovado" que aparecia SEMPRE (era só enfeite).
// Mostra a situação do mês escolhido na unidade escolhida: aprovado (com data, quem e total; Admin pode reabrir com
// motivo) · falta conferir · pronto para aprovar (Mentor/Admin) · como escolher unidade e mês.
// Quem grava é o banco (pagamentosComissao.js); o banco também confere quem pode e se está tudo conferido.
// ==========================================

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const rotuloDoMes = (mes) => (mes ? `${tx(MESES[Number(mes.slice(5, 7)) - 1])}/${mes.slice(0, 4)}` : '');
const quando = (valor) => { if (!valor) return ''; const d = new Date(valor); return isNaN(d) ? '' : `${d.toLocaleDateString(localeAtual())} ${d.toLocaleTimeString(localeAtual(), { hour: '2-digit', minute: '2-digit' })}`; };

const Caixa = ({ cor, icone: Icone, children }) => {
    const cores = {
        verde: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-200',
        amarelo: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200',
        azul: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-200',
        cinza: 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800/60 dark:border-slate-800 dark:text-slate-300',
    };
    return (
        <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[12px] font-semibold ${cores[cor]}`}>
            <Icone className="w-4 h-4 shrink-0 mt-0.5" /><div className="min-w-0 flex-1">{children}</div>
        </div>
    );
};

const PainelPagamento = ({ unidade, mes, pagamento, semTabela, pendentes = 0, totalComissao = 0, pessoas = [], podeAprovar = false, podeReabrir = false, onAprovar, onReabrir }) => {
    const [confirmando, setConfirmando] = useState(false);
    const [gravando, setGravando] = useState(false);
    const terminou = mesJaTerminou(mes);

    const aprovar = async () => {
        setGravando(true);
        const r = await onAprovar(unidade, mes);
        setGravando(false);
        if (r?.error) { avisar(r.error.message || tx('Não foi possível aprovar o pagamento.'), 'erro'); return; }
        setConfirmando(false);
        avisar(tx('Pagamento de {unidade} · {mes} aprovado. A conferência desse mês está travada.', { unidade, mes: rotuloDoMes(mes) }), 'sucesso');
    };

    const reabrir = async () => {
        const motivo = window.prompt(tx('Motivo para reabrir o pagamento de {unidade} · {mes} (fica registrado):', { unidade, mes: rotuloDoMes(mes) }));
        if (motivo === null) return;
        if (motivo.trim().length < 5) { avisar(tx('Reabertura cancelada: o motivo precisa ter pelo menos 5 letras.'), 'atencao'); return; }
        const r = await onReabrir(pagamento.id, motivo.trim());
        if (r?.error) { avisar(r.error.message || tx('Não foi possível reabrir.'), 'erro'); return; }
        avisar(tx('Pagamento reaberto: a conferência desse mês voltou a poder ser mexida.'), 'sucesso');
    };

    let conteudo;
    if (semTabela) {
        conteudo = <Caixa cor="amarelo" icone={AlertTriangle}>{tx('Para aprovar pagamentos e travar a conferência, rode no Supabase os passos 0, 1 e 2 de sql/2026-11-11-equipe-cpf-pagamento.')}</Caixa>;
    } else if (!unidade) {
        conteudo = <Caixa cor="cinza" icone={Info}>{tx('Para aprovar o pagamento, escolha UMA unidade no filtro.')}</Caixa>;
    } else if (!mes) {
        conteudo = <Caixa cor="cinza" icone={Info}>{tx('Para aprovar o pagamento, escolha um mês inteiro no período (Mês passado ou Escolher um mês).')}</Caixa>;
    } else if (pagamento) {
        conteudo = (
            <Caixa cor="verde" icone={Lock}>
                <p className="font-black uppercase tracking-wide">{tx('Pagamento aprovado · {unidade} · {mes}', { unidade, mes: rotuloDoMes(mes) })}</p>
                <p className="mt-0.5">{tx('Aprovado em {quando} por {nome} · {total} · {qtd} vendas. A conferência deste mês está travada: ninguém altera, apaga ou desconfere.', { quando: quando(pagamento.aprovado_em), nome: pagamento.aprovado_por || '—', total: formatMoney(Number(pagamento.total) || 0), qtd: pagamento.qtd_vendas || 0 })}</p>
                {podeReabrir && (
                    <button type="button" onClick={reabrir} className="mt-2 h-8 px-3 rounded-lg border border-emerald-300 bg-white text-emerald-800 text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 hover:bg-emerald-100 dark:bg-slate-900 dark:border-emerald-500/30 dark:text-emerald-300">
                        <Unlock className="w-3.5 h-3.5" />{tx('Reabrir (só Admin)')}
                    </button>
                )}
            </Caixa>
        );
    } else if (!terminou) {
        conteudo = <Caixa cor="cinza" icone={Info}>{tx('{mes} ainda não terminou. O pagamento é aprovado depois que o mês fecha e tudo estiver conferido.', { mes: rotuloDoMes(mes) })}</Caixa>;
    } else if (pendentes > 0) {
        conteudo = <Caixa cor="amarelo" icone={AlertTriangle}>{pendentes === 1 ? tx('Falta conferir 1 venda de {unidade} em {mes}. O pagamento só é aprovado com o mês todo conferido.', { unidade, mes: rotuloDoMes(mes) }) : tx('Faltam conferir {qtd} vendas de {unidade} em {mes}. O pagamento só é aprovado com o mês todo conferido.', { qtd: pendentes, unidade, mes: rotuloDoMes(mes) })}</Caixa>;
    } else {
        conteudo = (
            <Caixa cor="azul" icone={CheckCircle2}>
                <p className="font-black uppercase tracking-wide">{tx('Pronto para aprovar · {unidade} · {mes}', { unidade, mes: rotuloDoMes(mes) })}</p>
                <p className="mt-0.5">{tx('Tudo conferido: {total} para {qtd} pessoas. Depois de aprovar, a conferência deste mês fica travada.', { total: formatMoney(totalComissao), qtd: pessoas.length })}</p>
                {podeAprovar
                    ? <button type="button" onClick={() => setConfirmando(true)} className="mt-2 h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" />{tx('Aprovar pagamento')}</button>
                    : <p className="mt-1 text-[11px] font-bold opacity-80">{tx('Só o Mentor ou o Admin aprova o pagamento.')}</p>}
            </Caixa>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center gap-4 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex-1 min-w-0">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 dark:text-slate-400">{tx('Pagamento das comissões')}</h3>
                {conteudo}
            </div>
            <div className="md:text-right shrink-0">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">{tx('Comissão conferida no período')}</p>
                <p className="text-2xl font-black text-emerald-700 tracking-tight tabular-nums dark:text-emerald-400">{formatMoney(totalComissao)}</p>
            </div>

            {confirmando && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-aprovar-pagamento">
                    <div className="bg-white rounded-2xl shadow-2xl w-[min(560px,100%)] max-h-[90vh] overflow-hidden flex flex-col dark:bg-slate-900">
                        <div className="px-6 py-4 bg-blue-600 text-white flex items-start gap-3">
                            <Lock className="w-5 h-5 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <h2 id="titulo-aprovar-pagamento" className="text-sm font-black uppercase tracking-widest">{tx('Aprovar pagamento')}</h2>
                                <p className="text-[12px] font-bold opacity-90 uppercase tracking-widest">{unidade} · {rotuloDoMes(mes)}</p>
                            </div>
                            <button type="button" onClick={() => setConfirmando(false)} disabled={gravando} aria-label={tx('Fechar')}><X className="w-5 h-5" /></button>
                        </div>
                        <div className="px-6 py-4 overflow-y-auto custom-scrollbar">
                            <p className="text-[12px] font-bold text-slate-700 mb-3 dark:text-slate-200">{tx('Confira quanto vai para cada pessoa. Depois de aprovar, NINGUÉM consegue alterar, apagar ou desconferir as vendas deste mês (só o Admin reabre, com motivo).')}</p>
                            <table className="w-full">
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {pessoas.map(p => (
                                        <tr key={p.chave || p.vendedor}>
                                            <td className="py-2 text-[12px] font-bold uppercase text-slate-700 dark:text-slate-200">{p.vendedor}</td>
                                            <td className="py-2 text-[11px] text-slate-500 dark:text-slate-400">{p.tipo_conta === 'INTER' ? tx('Banco Inter') : p.tipo_conta === 'PIX_CPF' ? tx('PIX (chave CPF)') : <span className="text-rose-600 font-bold dark:text-rose-400">{tx('sem conta')}</span>}</td>
                                            <td className="py-2 text-right text-[12px] font-black tabular-nums text-slate-800 dark:text-white">{formatMoney(p.totalComissao)}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-50 dark:bg-slate-800/60">
                                        <td className="py-2 px-1 text-[12px] font-black uppercase text-slate-800 dark:text-white" colSpan={2}>{tx('Total')}</td>
                                        <td className="py-2 text-right text-[13px] font-black tabular-nums text-emerald-700 dark:text-emerald-400">{formatMoney(totalComissao)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-200 grid grid-cols-2 gap-3 dark:border-slate-800">
                            <button type="button" onClick={() => setConfirmando(false)} disabled={gravando} className="h-11 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">{tx('Cancelar')}</button>
                            <button type="button" onClick={aprovar} disabled={gravando} className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-widest inline-flex items-center justify-center gap-2">
                                {gravando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}{tx('Aprovar e travar')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PainelPagamento;
