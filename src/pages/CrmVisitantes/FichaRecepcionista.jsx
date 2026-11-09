import React, { useEffect, useState } from 'react';
import {
    ArrowLeft, ArrowRight, FileText, Target, Activity, CheckCircle2, Briefcase, MessageCircleOff, BarChart3, History,
    Sun, Moon, Clock, MapPin, MessageCircle, Phone, PenTool,
} from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { LIMITE_CARTEIRA } from './utils';

// ==========================================
// FICHA DA RECEPCIONISTA (CRM → entrada → Painel/Equipe; 09/11/2026, decisão do dono: "igual à ficha do aluno",
// no lugar do painel lateral que cortava o topo com o zoom da tela). Janela grande no meio, com rolagem.
// Mostra os MESMOS números de antes (linha da planilha do Painel), só reorganizados:
// cabeçalho + 5 cartões (meta de hoje, ações, fechou, carteira, sem WhatsApp) + abas Resultado do período e Últimas ações.
// ==========================================

const META_DIA = 150; // pessoas diferentes contatadas no dia (regra 10)

const Cartao = ({ icone: Icone, cor, titulo, valor, sub, alerta, children }) => (
    <div className={`bg-white p-4 rounded-xl border shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-[96px] dark:bg-slate-900 ${alerta ? 'border-rose-300 dark:border-rose-500/40' : 'border-slate-200/80 dark:border-slate-800'}`}>
        <div className="flex items-center gap-2.5 mb-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${cor}`}><Icone className="w-3.5 h-3.5" strokeWidth={2.5} /></div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate dark:text-slate-400">{titulo}</span>
        </div>
        <span className="text-[15px] font-extrabold uppercase tracking-tight text-slate-800 truncate tabular-nums dark:text-white">{valor}</span>
        {children}
        {sub && <span className={`text-[10px] font-semibold mt-0.5 truncate ${alerta ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`} title={sub}>{sub}</span>}
    </div>
);

const Barra = ({ valor, total, cor }) => (
    <span className="block h-1.5 mt-1.5 rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
        <span className={`block h-full rounded-full ${cor}`} style={{ width: `${Math.min(100, total ? (valor / total) * 100 : 0)}%` }} />
    </span>
);

const FichaRecepcionista = ({ recepcionista, linha, acoes = [], leadPorId, periodoRotulo, tempoRelativo, formatarDataHora, onAbrirCrm, onVerRelatorio, onAbrirContato, onFechar, bloquearEsc = false }) => {
    const [aba, setAba] = useState('resultado');
    const [limite, setLimite] = useState(30);

    useEffect(() => {
        // Com a ficha do aluno aberta por cima, o Esc fecha só ela
        const aoTeclar = (e) => { if (e.key === 'Escape' && !bloquearEsc) onFechar(); };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [onFechar, bloquearEsc]);

    const turno = String(recepcionista.turno || '').toUpperCase();
    const l = linha;
    const prazos = l?.prazos || { noPrazo24: 0, atrasado24: 0, noPrazo48: 0, atrasado48: 0 };
    const bv = l?.boasVindas || { total: 0, enviadas: 0 };

    // Resultado do período: rótulo, valor, cor (os mesmos números do antigo resumo lateral)
    const resultado = l ? [
        ['Visitantes 24h', prazos.noPrazo24, prazos.atrasado24 ? tx('{qtd} atrasados', { qtd: prazos.atrasado24 }) : tx('no prazo'), prazos.atrasado24 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'],
        ['Visitantes 48h', prazos.noPrazo48, prazos.atrasado48 ? tx('{qtd} atrasados', { qtd: prazos.atrasado48 }) : tx('no prazo'), prazos.atrasado48 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'],
        ['Boas-vindas', bv.total ? `${bv.enviadas} / ${bv.total}` : '—', tx('enviadas / visitantes cadastrados'), bv.total && bv.enviadas < bv.total ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'],
        ['Migração', l.migracao?.total || 0, tx('contatos de migração'), 'text-blue-600 dark:text-blue-400'],
        ['WhatsApp', l.whatsapp, tx('mensagens no funil'), 'text-emerald-600 dark:text-emerald-400'],
        ['Ligações', l.ligacoes, tx('ligações no funil'), 'text-blue-600 dark:text-blue-400'],
        ['Notas', l.notas, tx('notas internas'), 'text-slate-700 dark:text-slate-200'],
        ['Puxados', l.puxados, tx('contatos recebidos no período'), 'text-slate-700 dark:text-slate-200'],
        ['Visitantes trabalhados', l.visitantes, tx('pessoas diferentes'), 'text-slate-700 dark:text-slate-200'],
        ['Cancelados/Inativos trabalhados', l.cancelados, tx('pessoas diferentes'), 'text-slate-700 dark:text-slate-200'],
        ['Sem contato', l.semContato, tx('na carteira, sem ação no período'), l.semContato ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'],
        ['Perdidos', l.perdidos, tx('foram para Perdido'), l.perdidos ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'],
    ] : [];

    const iconeAcao = (tipo) => (tipo === 'WhatsApp' ? MessageCircle : tipo === 'Ligação' ? Phone : tipo === 'Observação' ? PenTool : Activity);
    const th = 'px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap dark:text-slate-400';
    const ABAS = [['resultado', tx('Resultado do período'), BarChart3], ['acoes', tx('Últimas ações'), History]];

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-3 md:p-8 overflow-y-auto animate-[fadeIn_0.15s_ease-out]" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
            <div className="w-full min-w-0 max-w-6xl my-auto bg-[#F8FAFC] dark:bg-slate-950 rounded-[20px] p-5 md:p-6 flex flex-col shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="titulo-ficha-recepcionista">

                <div className="mb-5 flex items-center">
                    <button type="button" onClick={onFechar}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-colors shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/60">
                        <ArrowLeft className="w-3.5 h-3.5" />{tx('Voltar para o CRM')}
                    </button>
                </div>

                {/* CABEÇALHO */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 pb-5 mb-5 border-b border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-black shadow-sm shrink-0">{String(recepcionista.nome || '?').charAt(0)}</div>
                        <div className="min-w-0">
                            <h2 id="titulo-ficha-recepcionista" className="text-[19px] font-extrabold text-slate-800 uppercase tracking-tight mb-1.5 dark:text-white">{recepcionista.nome}</h2>
                            <div className="flex flex-wrap items-center gap-y-2 gap-x-3 text-[12px] font-medium text-slate-500 dark:text-slate-400">
                                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-blue-500" />{recepcionista.unidade || '—'}</span>
                                <span className="hidden sm:block w-px h-3 bg-slate-300 dark:bg-slate-700" />
                                {turno === 'MANHA' && <span className="flex items-center gap-1.5"><Sun className="w-3.5 h-3.5 text-amber-500" />{tx('Turno da manhã')}</span>}
                                {turno === 'NOITE' && <span className="flex items-center gap-1.5"><Moon className="w-3.5 h-3.5 text-blue-500" />{tx('Turno da noite')}</span>}
                                {turno !== 'MANHA' && turno !== 'NOITE' && <span className="flex items-center gap-1.5 text-slate-400">{tx('Sem turno marcado')}</span>}
                                <span className="hidden sm:block w-px h-3 bg-slate-300 dark:bg-slate-700" />
                                <span className="flex items-center gap-1.5" title={l?.ultima ? formatarDataHora(l.ultima) : undefined}><Clock className="w-3.5 h-3.5 text-slate-400" />{l?.ultima ? tx('Última ação {quando}', { quando: tempoRelativo(l.ultima) }) : tx('Sem ação no período')}</span>
                                <span className="hidden sm:block w-px h-3 bg-slate-300 dark:bg-slate-700" />
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{tx(periodoRotulo)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
                        <button type="button" onClick={onVerRelatorio} className="flex-1 sm:flex-none px-4 py-2 rounded-lg border border-slate-200 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 shadow-sm flex items-center justify-center gap-1.5 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60">
                            <FileText className="w-3.5 h-3.5" />{tx('Ver relatório')}
                        </button>
                        <button type="button" onClick={onAbrirCrm} className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5">
                            {tx('Abrir o CRM dela')}<ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* 5 CARTÕES */}
                {l && (
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
                        <Cartao icone={Target} cor="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" titulo={tx('Meta de hoje')} valor={`${l.pessoasHoje} / ${META_DIA}`}
                            sub={l.pessoasHoje >= META_DIA ? tx('meta batida') : tx('faltam {qtd} pessoas', { qtd: META_DIA - l.pessoasHoje })}>
                            <Barra valor={l.pessoasHoje} total={META_DIA} cor={l.pessoasHoje >= META_DIA ? 'bg-emerald-500' : 'bg-orange-500'} />
                        </Cartao>
                        <Cartao icone={Activity} cor="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" titulo={tx('Ações')} valor={l.acoes}
                            sub={tx('{w} WhatsApp · {lg} ligações', { w: l.whatsapp, lg: l.ligacoes })} />
                        <Cartao icone={CheckCircle2} cor="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" titulo={tx('Fechou')} valor={l.fechados}
                            sub={tx('{qtd} perdidos', { qtd: l.perdidos })} />
                        <Cartao icone={Briefcase} cor="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" titulo={tx('Carteira')} valor={`${l.emAtendimento} / ${LIMITE_CARTEIRA}`}
                            sub={[l.paraHoje ? tx('{qtd} para hoje', { qtd: l.paraHoje }) : null, l.emEspera ? tx('{qtd} em espera', { qtd: l.emEspera }) : null].filter(Boolean).join(' · ') || tx('em atendimento')}
                            alerta={l.emAtendimento > LIMITE_CARTEIRA}>
                            <Barra valor={l.emAtendimento} total={LIMITE_CARTEIRA} cor={l.emAtendimento > LIMITE_CARTEIRA ? 'bg-rose-500' : 'bg-amber-500'} />
                        </Cartao>
                        <Cartao icone={MessageCircleOff} cor="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400" titulo={tx('Sem WhatsApp')} valor={l.semWhatsApp}
                            sub={tx('feitos sem WhatsApp')} alerta={l.semWhatsApp > 0} />
                    </div>
                )}

                {/* ABAS */}
                <div className="flex bg-white p-1.5 rounded-xl border border-slate-200/80 overflow-x-auto custom-scrollbar mb-5 shadow-sm dark:bg-slate-900 dark:border-slate-800" role="tablist">
                    {ABAS.map(([id, rotulo, Icone]) => {
                        const ativo = aba === id;
                        return (
                            <button key={id} type="button" role="tab" aria-selected={ativo} onClick={() => setAba(id)}
                                className={`flex-1 min-w-[140px] px-3 py-2.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 whitespace-nowrap outline-none ${ativo ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'}`}>
                                <Icone className="w-3.5 h-3.5" strokeWidth={ativo ? 2.5 : 2} />{rotulo}
                                {id === 'acoes' && <span className="text-slate-400">({acoes.length})</span>}
                            </button>
                        );
                    })}
                </div>

                <div className="min-h-[240px]">
                    {aba === 'resultado' && (!l ? (
                        <p className="py-10 text-center text-[12px] font-bold text-slate-400">{tx('Sem ação no período')}</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {resultado.map(([rotulo, valor, sub, cor]) => (
                                <div key={rotulo} className="bg-white rounded-xl border border-slate-200/80 px-4 py-3 flex items-center justify-between gap-3 dark:bg-slate-900 dark:border-slate-800">
                                    <span className="min-w-0">
                                        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 truncate dark:text-slate-300">{tx(rotulo)}</span>
                                        <span className="block text-[10px] font-semibold text-slate-400 truncate">{sub}</span>
                                    </span>
                                    <span className={`text-lg font-extrabold tabular-nums shrink-0 ${cor}`}>{valor}</span>
                                </div>
                            ))}
                        </div>
                    ))}

                    {aba === 'acoes' && (
                        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                            {acoes.length === 0 ? <p className="py-10 text-center text-[12px] font-bold text-slate-400">{tx('Sem ação no período')}</p> : (
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full min-w-[620px]">
                                        <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-800">
                                            <tr><th className={th}>{tx('Quando')}</th><th className={th}>{tx('Ação')}</th><th className={th}>{tx('Contato')}</th><th className={th}>{tx('Detalhe')}</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {acoes.slice(0, limite).map(h => {
                                                const lead = leadPorId.get(String(h.lead_id));
                                                const Icone = iconeAcao(h.tipo_acao);
                                                return (
                                                    <tr key={h.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                                                        <td className="px-4 py-2.5 text-[11px] font-bold text-slate-500 whitespace-nowrap dark:text-slate-400" title={formatarDataHora(h.data_registro || h.created_at)}>{tempoRelativo(h.data_registro || h.created_at)}</td>
                                                        <td className="px-4 py-2.5 text-[11px] font-bold uppercase text-slate-700 whitespace-nowrap dark:text-slate-200"><span className="inline-flex items-center gap-1.5"><Icone className="w-3.5 h-3.5 text-slate-400" />{tx(h.tipo_acao)}</span></td>
                                                        <td className="px-4 py-2.5 text-[12px] font-bold uppercase text-slate-700 dark:text-slate-200">
                                                            {lead
                                                                ? <button type="button" onClick={() => onAbrirContato(lead)} className="text-left hover:text-blue-700 hover:underline dark:hover:text-blue-400">{lead.nome}</button>
                                                                : <span className="text-slate-400 normal-case font-semibold">{tx('Contato fora da lista atual')}</span>}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 max-w-[360px] truncate dark:text-slate-400" title={h.observacao || ''}>{h.observacao || '—'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {acoes.length > limite && (
                                <button type="button" onClick={() => setLimite(n => n + 30)} className="w-full py-3 border-t border-slate-100 text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:bg-blue-50 dark:border-slate-800 dark:text-blue-400 dark:hover:bg-blue-500/10">
                                    {tx('Ver mais ({qtd} restantes)', { qtd: acoes.length - limite })}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FichaRecepcionista;
