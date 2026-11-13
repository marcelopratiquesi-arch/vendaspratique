import React, { useState } from 'react';
import { MapPin, CheckCircle2, Clock, AlertCircle, Check, ChevronRight, Info, UserCheck, HelpCircle, Send, MessageCircle } from 'lucide-react';
import { formatMoney } from './utils.js';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import ModalTextoWhatsapp from '../AnaliseVendas/Modais.jsx';
import { abrirNoWhatsApp } from '../../components/whatsapp.js';
import { avisar } from '../../components/avisar.js';
import {
    DIAS_ALERTA_VERMELHO, diasDesdeData, diasDesdeMomento, sextaDoPrazo,
    textoPeriodo, mensagemCobrancaRede, mensagemCobrancaLider, lideresDaUnidade,
} from './cobrancaAuditoria.js';

// ==========================================
// AUDITORIA: quanto de cada unidade já foi CONFERIDO no período do filtro.
// "Conferido" = alguém da gestão marcou o lançamento na aba Conferência (só conferidos entram no Fechamento).
// Clicar numa unidade abre a Conferência já filtrada por ela.
// 05/11/2026: prazo de conferência (atrasadas), mais antiga sem conferir, cobrança no WhatsApp
// (rede: Resumo/Detalhado; Líder: botão na linha). Regras e mensagens em cobrancaAuditoria.js.
// ==========================================

// Faixa de situação: menos de 50% crítico, até 99% em andamento, 100% concluído
const situacao = (pct, registrados) => {
    if (registrados === 0 || pct === 100) return { rotulo: 'CONCLUÍDO', Icone: CheckCircle2, barra: 'bg-emerald-500', texto: 'text-emerald-700 dark:text-emerald-400', etiqueta: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30' };
    if (pct >= 50) return { rotulo: 'EM ANDAMENTO', Icone: Clock, barra: 'bg-amber-500', texto: 'text-amber-700 dark:text-amber-400', etiqueta: 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30' };
    return { rotulo: 'CRÍTICO', Icone: AlertCircle, barra: 'bg-rose-500', texto: 'text-rose-700 dark:text-rose-400', etiqueta: 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30' };
};

const pctDe = (conferidos, registrados) => (registrados === 0 ? 100 : Math.floor((conferidos / registrados) * 100));

// Sempre "hoje", "ontem" ou "há X dias" (a data completa aparece ao passar o mouse)
const textoDias = (dias) => {
    if (dias === null || dias === undefined) return '';
    if (dias <= 0) return tx('hoje');
    if (dias === 1) return tx('ontem');
    return tx('há {qtd} dias', { qtd: dias });
};
const quando = (iso) => {
    if (!iso) return null;
    const dias = diasDesdeMomento(iso);
    if (dias <= 0) return tx('hoje às {hora}', { hora: new Date(iso).toLocaleTimeString(localeAtual(), { hour: '2-digit', minute: '2-digit' }) });
    return textoDias(dias);
};
const dataHoraCompleta = (iso) => (iso ? new Date(iso).toLocaleString(localeAtual(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const dataCurta = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

// "?" ao lado do título: explica a coluna ao passar o mouse ou tocar (mesmo modelo da Visão Geral)
const Dica = ({ texto, alinhar = 'right' }) => (
    <span className="group/dica relative inline-flex align-middle">
        <button type="button" aria-label={texto} onClick={(e) => e.stopPropagation()} className="text-slate-400 hover:text-blue-600 focus:text-blue-600 outline-none dark:hover:text-blue-400 dark:focus:text-blue-400">
            <HelpCircle className="w-3.5 h-3.5" />
        </button>
        <span role="tooltip" className={`pointer-events-none absolute top-full mt-2 z-40 w-[min(240px,70vw)] hidden group-hover/dica:block group-focus-within/dica:block bg-slate-800 text-white text-[11px] font-semibold normal-case tracking-normal text-left leading-snug px-3 py-2 rounded-lg shadow-lg dark:bg-slate-700 ${alinhar === 'left' ? 'left-0' : 'right-0'}`}>
            {texto}
        </span>
    </span>
);

// Um número da faixa de resumo: valor forte + legenda pequena
const Item = ({ valor, rotulo, cor = 'text-slate-800 dark:text-white', children }) => (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className={`text-base font-black tabular-nums ${cor}`}>{valor}</span>
        <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{rotulo}</span>
        {children}
    </div>
);

const AuditoriaTab = ({ dadosTabelaAuditoria = [], totais, rotuloPeriodo, inicioIso = '', fimIso = '', colaboradores = [], onAbrirUnidade }) => {
    const t = totais || { registrados: 0, conferidos: 0, pendentes: 0, valorPendente: 0, atrasadas: 0, valorAtrasado: 0 };
    const pctGeral = pctDe(t.conferidos, t.registrados);
    const sitGeral = situacao(pctGeral, t.registrados);
    const unidadesPendentes = dadosTabelaAuditoria.filter(l => l.pendentes > 0).length;
    const periodoTexto = textoPeriodo(inicioIso, fimIso);
    const agora = new Date();
    const hojeIsoLocal = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;

    // Janela da mensagem (mesma do Dashboard/Metas): texto editável, Copiar e Enviar
    const [modal, setModal] = useState(null); // { titulo, texto, telefone }
    const [copiado, setCopiado] = useState(false);
    const abrirMensagem = (titulo, texto, telefone = '') => { setCopiado(false); setModal({ titulo, texto, telefone }); };
    const copiar = () => {
        navigator.clipboard.writeText(modal?.texto || '').then(() => {
            setCopiado(true);
            setTimeout(() => { setCopiado(false); setModal(null); }, 2000);
        }).catch(() => avisar(tx('Não foi possível copiar. Selecione o texto e copie manualmente.'), 'erro'));
    };
    const enviar = () => { abrirNoWhatsApp(modal?.telefone || '', modal?.texto || ''); };

    const cobrarRede = (tipo) => {
        if (!dadosTabelaAuditoria.length) { avisar(tx('Nenhum lançamento no período para cobrar.'), 'atencao'); return; }
        abrirMensagem(tipo === 'resumo' ? tx('Conferência – resumo') : tx('Conferência – detalhado'), mensagemCobrancaRede(dadosTabelaAuditoria, t, periodoTexto, tipo));
    };
    // Líder e Aspira (13/11/2026): um botão para cada um
    const cobrarLider = (row, lider = lideresDaUnidade(colaboradores, row.unidade)[0]) => {
        // (lider vem do botão)
        const telefone = String(lider?.telefone || '').replace(/\D/g, '');
        if (!lider) avisar(tx('Nenhum Líder ativo cadastrado na Equipe de {unidade}. Escolha o contato no WhatsApp.', { unidade: row.unidade }), 'atencao');
        else if (telefone.length < 10) avisar(tx('O Líder {nome} está sem telefone no cadastro da Equipe. Escolha o contato no WhatsApp.', { nome: lider.nome }), 'atencao');
        abrirMensagem(`${tx('Cobrar Líder')} – ${row.unidade}`, mensagemCobrancaLider(row, lider?.nome, periodoTexto), telefone.length >= 10 ? telefone : '');
    };

    const th = 'px-4 py-3 border-b border-slate-200 dark:border-slate-800';

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">

            {/* RESUMO EM UMA FAIXA */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center gap-3 min-w-[min(260px,100%)]">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap dark:text-slate-400">{tx('Progresso da rede')}</span>
                    <div className="flex-1 min-w-[80px] h-2 bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800" role="progressbar" aria-valuenow={pctGeral} aria-valuemin={0} aria-valuemax={100}>
                        <div className={`h-full rounded-full ${sitGeral.barra} transition-all duration-700`} style={{ width: `${pctGeral}%` }} />
                    </div>
                    <span className={`text-base font-black tabular-nums ${sitGeral.texto}`}>{pctGeral}%</span>
                </div>
                <span className={`inline-flex items-center gap-1 border px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${sitGeral.etiqueta} ${sitGeral.texto}`}>
                    <sitGeral.Icone className="w-3 h-3" />{tx(sitGeral.rotulo)}
                </span>
                <div className="h-5 w-px bg-slate-200 hidden md:block dark:bg-slate-700" />
                <Item valor={t.registrados} rotulo={tx('registrados')} />
                <Item valor={t.conferidos} rotulo={tx('conferidos')} cor="text-emerald-600 dark:text-emerald-400" />
                <Item valor={t.pendentes} rotulo={tx('pendentes')} cor={t.pendentes > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}>
                    {t.pendentes > 0 && <span className="text-[12px] font-semibold text-slate-400">({tx('{valor} em comissão · {qtd} unidade(s)', { valor: formatMoney(t.valorPendente), qtd: unidadesPendentes })})</span>}
                </Item>
                <Item valor={t.atrasadas || 0} rotulo={tx('atrasadas (prazo de sexta vencido)')} cor={t.atrasadas > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'} />
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 cursor-help" title={tx('Conferido = lançamento marcado na aba Conferência. Só os conferidos entram nas comissões do Fechamento.')}>
                    <Info className="w-3.5 h-3.5" />{rotuloPeriodo ? tx(rotuloPeriodo) : ''}
                </span>
            </div>

            {/* TABELA POR UNIDADE */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 dark:border-slate-800">
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest dark:text-white">{tx('Desempenho de Conferência por Unidade')}</h3>
                        <p className="text-[11px] font-bold text-slate-400 mt-0.5">{tx('Mais atrasadas primeiro. Clique numa unidade para conferir.')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400"><Send className="w-3.5 h-3.5" />{tx('Cobrar no WhatsApp')}</span>
                        <button type="button" onClick={() => cobrarRede('resumo')} className="h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest">{tx('Resumo')}</button>
                        <button type="button" onClick={() => cobrarRede('detalhado')} className="h-9 px-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-black uppercase tracking-widest dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-300">{tx('Detalhado')}</button>
                    </div>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1080px]">
                        <thead className="bg-slate-50 dark:bg-slate-800/60">
                            <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">
                                <th className={th}>{tx('Unidade Operacional')}</th>
                                <th className={`${th} w-56`}>{tx('Progresso de Auditoria')}</th>
                                <th className={`${th} text-right`}>{tx('Registros')}</th>
                                <th className={`${th} text-right`}>{tx('Conferidos (OK)')}</th>
                                <th className={`${th} text-right`}>{tx('Pendentes')}</th>
                                <th className={`${th} text-right`}><span className="inline-flex items-center gap-1">{tx('Atrasadas')}<Dica texto={tx('Vendas sem conferir cuja sexta-feira de prazo já passou. A semana vai de sábado a sexta e as vendas dela devem ser conferidas até a sexta. São as que precisam ser cobradas primeiro.')} /></span></th>
                                <th className={th}><span className="inline-flex items-center gap-1">{tx('Mais antiga sem conferir')}<Dica alinhar="left" texto={tx('Data da venda mais antiga do período que ainda não foi conferida. Vermelho quando a sexta-feira de prazo dela já passou.')} /></span></th>
                                <th className={th}><span className="inline-flex items-center gap-1">{tx('Última conferência')}<Dica alinhar="left" texto={tx('Quando alguém conferiu uma venda desta unidade pela última vez (olha os últimos 90 dias, não só o período) e quem foi. Embaixo: quantas conferências foram feitas dentro do período. Vermelho a partir de {dias} dias sem conferir.', { dias: DIAS_ALERTA_VERMELHO })} /></span></th>
                                <th className={`${th} text-center`}>{tx('Líder')}</th>
                                <th className="px-3 py-3 border-b border-slate-200 w-10 dark:border-slate-800"><span className="sr-only">{tx('Abrir')}</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {dadosTabelaAuditoria.length > 0 ? dadosTabelaAuditoria.map(row => {
                                const pct = pctDe(row.conferidos, row.registrados);
                                const sit = situacao(pct, row.registrados);
                                const concluido = row.pendentes === 0;
                                const diasAntiga = diasDesdeData(row.maisAntiga);
                                const diasUltima = row.ultimaEm ? diasDesdeMomento(row.ultimaEm) : null;
                                const corAntiga = row.maisAntiga && sextaDoPrazo(row.maisAntiga) < hojeIsoLocal ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200';
                                const corUltima = diasUltima !== null && diasUltima >= DIAS_ALERTA_VERMELHO ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200';
                                return (
                                    <tr key={row.unidade} onClick={() => onAbrirUnidade?.(row.unidade)} title={tx('Abrir a Conferência desta unidade')}
                                        className="group cursor-pointer hover:bg-blue-50/50 transition-colors dark:hover:bg-blue-500/10">
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${concluido ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-800'}`}>
                                                    {concluido ? <Check className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-800 uppercase tracking-tight dark:text-white">{row.unidade}</span>
                                                    <span className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${concluido ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                                        {concluido ? tx('Auditoria Finalizada') : tx('Auditoria Pendente')}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${sit.texto}`}><sit.Icone className="w-3 h-3" />{tx(sit.rotulo)}</span>
                                                <span className={`text-sm font-black tabular-nums ${sit.texto}`}>{pct}%</span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800">
                                                <div className={`h-full rounded-full ${sit.barra}`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 text-right text-sm font-black text-slate-700 tabular-nums dark:text-slate-200">{row.registrados}</td>
                                        <td className="px-4 py-3.5 text-right text-sm font-black text-emerald-600 tabular-nums dark:text-emerald-400">{row.conferidos}</td>
                                        <td className="px-4 py-3.5 text-right">
                                            {row.pendentes > 0 ? (
                                                <div className="flex flex-col items-end">
                                                    <span className="text-sm font-black text-amber-600 tabular-nums dark:text-amber-400">{row.pendentes}</span>
                                                    <span className="text-[11px] font-bold text-slate-400 tabular-nums">{formatMoney(row.valorPendente)}</span>
                                                </div>
                                            ) : <span className="text-[11px] font-bold text-slate-400">—</span>}
                                        </td>
                                        <td className="px-4 py-3.5 text-right">
                                            {row.atrasadas > 0 ? (
                                                <div className="flex flex-col items-end">
                                                    <span className="text-sm font-black text-rose-600 tabular-nums dark:text-rose-400">{row.atrasadas}</span>
                                                    <span className="text-[11px] font-bold text-slate-400 tabular-nums">{formatMoney(row.valorAtrasado)}</span>
                                                </div>
                                            ) : row.pendentes > 0
                                                ? <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{tx('no prazo')}</span>
                                                : <span className="text-[11px] font-bold text-slate-400">—</span>}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            {row.maisAntiga ? (
                                                <div className="flex flex-col">
                                                    <span className={`text-xs font-black ${corAntiga}`}>{textoDias(diasAntiga)}</span>
                                                    <span className="text-[11px] font-bold text-slate-400 tabular-nums">{tx('venda de {data}', { data: dataCurta(row.maisAntiga) })}</span>
                                                </div>
                                            ) : <span className="text-[11px] font-bold text-slate-400">—</span>}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            {row.ultimaEm ? (
                                                <div className="flex flex-col" title={dataHoraCompleta(row.ultimaEm)}>
                                                    <span className={`text-xs font-black ${corUltima}`}>{quando(row.ultimaEm)}</span>
                                                    {row.ultimaPor && <span className="text-[11px] font-bold text-slate-400 inline-flex items-center gap-1"><UserCheck className="w-3 h-3" />{row.ultimaPor}</span>}
                                                    <span className={`text-[11px] font-bold ${row.conferidasNoPeriodo > 0 ? 'text-slate-500 dark:text-slate-400' : 'text-rose-500 dark:text-rose-400'}`}>{tx('{qtd} conferidas no período', { qtd: row.conferidasNoPeriodo || 0 })}</span>
                                                </div>
                                            ) : <span className="text-[11px] font-bold text-rose-500 dark:text-rose-400">{tx('Nenhuma ainda')}</span>}
                                        </td>
                                        <td className="px-4 py-3.5 text-center">
                                            {row.pendentes > 0 ? (() => {
                                                const lideres = lideresDaUnidade(colaboradores, row.unidade);
                                                return (
                                                    <div className="inline-flex gap-1">
                                                        {(lideres.length ? lideres : [null]).map((lider, j) => (
                                                            <button key={j} type="button" onClick={(e) => { e.stopPropagation(); cobrarLider(row, lider); }}
                                                                title={lider ? tx('Cobrar {nome} no WhatsApp', { nome: lider.nome }) : tx('Cobrar o Líder desta unidade no WhatsApp')} aria-label={lider ? tx('Cobrar {nome} no WhatsApp', { nome: lider.nome }) : tx('Cobrar o Líder desta unidade no WhatsApp')}
                                                                className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-500/20">
                                                                <MessageCircle className="w-4 h-4" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                );
                                            })() : <span className="text-[11px] font-bold text-slate-400">—</span>}
                                        </td>
                                        <td className="px-3 py-3.5 text-slate-300 group-hover:text-blue-600 dark:text-slate-600 dark:group-hover:text-blue-400"><ChevronRight className="w-4 h-4" /></td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="10" className="py-20">
                                        <div className="flex flex-col items-center justify-center text-center">
                                            <div className="w-14 h-14 bg-slate-50 border border-slate-200 border-dashed rounded-full flex items-center justify-center mb-4 dark:bg-slate-800/60 dark:border-slate-800">
                                                <AlertCircle className="w-6 h-6 text-slate-300" />
                                            </div>
                                            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest dark:text-slate-200">{tx('Sem Auditorias Pendentes')}</h4>
                                            <p className="text-xs font-bold text-slate-400 mt-1 max-w-sm">{tx('Nenhum lançamento encontrado para auditar nas unidades no período selecionado.')}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {dadosTabelaAuditoria.length > 1 && (
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200 dark:bg-slate-800/60 dark:border-slate-700">
                                <tr>
                                    <td className="px-4 py-3.5 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">{tx('Total')}</td>
                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden dark:bg-slate-700"><div className={`h-full rounded-full ${sitGeral.barra}`} style={{ width: `${pctGeral}%` }} /></div>
                                            <span className={`text-sm font-black tabular-nums ${sitGeral.texto}`}>{pctGeral}%</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5 text-right text-sm font-black text-slate-800 tabular-nums dark:text-white">{t.registrados}</td>
                                    <td className="px-4 py-3.5 text-right text-sm font-black text-emerald-600 tabular-nums dark:text-emerald-400">{t.conferidos}</td>
                                    <td className="px-4 py-3.5 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-black text-amber-600 tabular-nums dark:text-amber-400">{t.pendentes}</span>
                                            {t.pendentes > 0 && <span className="text-[11px] font-bold text-slate-400 tabular-nums">{formatMoney(t.valorPendente)}</span>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-black text-rose-600 tabular-nums dark:text-rose-400">{t.atrasadas || 0}</span>
                                            {t.atrasadas > 0 && <span className="text-[11px] font-bold text-slate-400 tabular-nums">{formatMoney(t.valorAtrasado)}</span>}
                                        </div>
                                    </td>
                                    <td colSpan="4" />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            <ModalTextoWhatsapp
                isOpen={!!modal}
                titulo={modal?.titulo}
                icone="send"
                corIcone="blue"
                texto={modal?.texto || ''}
                setTexto={(texto) => setModal(m => (m ? { ...m, texto } : m))}
                copiado={copiado}
                onFechar={() => setModal(null)}
                onCopiar={copiar}
                onEnviar={enviar}
            />
        </div>
    );
};

export default AuditoriaTab;
