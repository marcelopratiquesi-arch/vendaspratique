import React, { useMemo, useState } from 'react';
import {
    ShoppingCart, Target, MessagesSquare, Dumbbell, BellRing, ArrowRight, RefreshCw, Loader2, AlertTriangle,
    TrendingUp, TrendingDown, Sun, Moon, CheckCircle2,
} from 'lucide-react';
import { tx, localeAtual } from '../../../i18n/traduzir.js';
import { SeletorPeriodo } from '../../HistoricoVendas/FiltrosCompactos.jsx';
import { usePeriodoPadrao } from '../../../components/periodoPadrao.js';
import { pendenciasAvaliacao } from '../../AvaliacaoFisica/utils.js';
import { mesmoNome, ehMudancaPorCompra } from '../../CrmVisitantes/utils';
import { contarPlanosDoCard } from '../../AnaliseVendas/utils.js';
import { textoMovimentoDia, textoMetaCard, textoUltimoLancamento } from '../../Pendencias/pendencias.js';
import { RelatorioCompacto } from '../../Pendencias/index.jsx';
import { usePanoramaUnidade } from './usePanoramaUnidade.js';
import { abrirCentralColaborador } from '../../../components/centralColaborador.js';
import { mesmoNomeColaborador } from '../colaborador/contasColaborador.js';
import { faixaEmIso, resumoVendas, variacao, placarDoMes, resumoMovimento, resumoAvaliacoes, resumoCrm } from './contasPanorama.js';

// ==========================================
// PANORAMA DA UNIDADE (Central da Unidade → aba Panorama; 09/11/2026, decisão do dono:
// "uma página bonita única para visualizar tudo da unidade"). Só leitura.
// Faixa de resumo (planos, Nutri, produtos, serviços, comissão | faturamento, saídas, ativos, saldo)
// + quadros Vendas · Metas do mês · CRM · Avaliações · Pendências, cada um com "Abrir a tela completa".
// As contas ficam em contasPanorama.js (as mesmas das outras telas) e a leitura em usePanoramaUnidade.js.
// ==========================================

const dinheiro = (v) => (v === null || v === undefined ? '—' : new Intl.NumberFormat(localeAtual(), { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(v) || 0));
const dataCurta = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '');
const horaDe = (valor) => { if (!valor) return ''; const d = new Date(valor); return isNaN(d) ? '' : d.toLocaleTimeString(localeAtual(), { hour: '2-digit', minute: '2-digit' }); };

const COR_STATUS = {
    verde: { bolinha: 'bg-emerald-500', barra: 'bg-emerald-500', texto: 'text-emerald-600 dark:text-emerald-400' },
    amarelo: { bolinha: 'bg-amber-500', barra: 'bg-amber-500', texto: 'text-amber-600 dark:text-amber-400' },
    vermelho: { bolinha: 'bg-rose-500', barra: 'bg-rose-500', texto: 'text-rose-600 dark:text-rose-400' },
    neutro: { bolinha: 'bg-slate-300 dark:bg-slate-600', barra: 'bg-slate-400', texto: 'text-slate-500 dark:text-slate-400' },
};

const Quadro = ({ icone: Icone, cor, titulo, sub, abrir, rotuloAbrir, erro, children, className = '' }) => (
    <section className={`bg-white rounded-xl border border-slate-200/80 flex flex-col dark:bg-slate-900 dark:border-slate-800 ${className}`}>
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${cor}`}><Icone className="w-3.5 h-3.5" strokeWidth={2.5} /></span>
                <div className="min-w-0">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">{titulo}</h4>
                    {sub && <p className="text-[10px] font-semibold text-slate-400 truncate">{sub}</p>}
                </div>
            </div>
            {abrir && (
                <button type="button" onClick={abrir} className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 dark:text-blue-400 dark:hover:text-blue-300">
                    {rotuloAbrir}<ArrowRight className="w-3 h-3" />
                </button>
            )}
        </header>
        <div className="p-4 flex-1">
            {erro ? <p className="text-[12px] font-bold text-amber-600 flex items-center gap-1.5 dark:text-amber-400"><AlertTriangle className="w-3.5 h-3.5" />{erro}</p> : children}
        </div>
    </section>
);

const Barra = ({ valor, total, cor = 'bg-blue-500' }) => (
    <span className="block h-1.5 rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
        <span className={`block h-full rounded-full ${cor}`} style={{ width: `${Math.max(0, Math.min(100, total ? (valor / total) * 100 : 0))}%` }} />
    </span>
);

// Um número da faixa de resumo
const Numero = ({ rotulo, valor, sub, cor = 'text-slate-800 dark:text-white', titulo }) => (
    <div className="min-w-[96px] px-3 py-2" title={titulo}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{rotulo}</p>
        <p className={`text-lg font-extrabold tabular-nums leading-tight ${cor}`}>{valor}</p>
        {sub && <p className="text-[10px] font-semibold text-slate-400 truncate">{sub}</p>}
    </div>
);

const AbaPanorama = ({ unidade, recepcionistas = [], colaboradores = [], semPersonal = false, pendencia, planos = [], produtos = [], abrirTela }) => {
    // Clicar no nome de um consultor abre a Central do Colaborador POR CIMA da unidade (11/11/2026, decisão do dono);
    // Esc ou Fechar volta para a unidade. A pessoa é achada pelo nome na Equipe (senão abre só com o nome).
    const nomeConsultor = (nome, conteudo = null) => {
        const pessoa = colaboradores.find(c => mesmoNomeColaborador(c.nome, nome)) || { nome, unidade: unidade.nome };
        return (
            <button type="button" onClick={() => abrirCentralColaborador(pessoa)} title={tx('Abrir a Central do Colaborador')}
                className="text-left text-[12px] font-bold uppercase text-slate-700 truncate flex items-center gap-1.5 min-w-0 hover:text-blue-700 hover:underline dark:text-slate-200 dark:hover:text-blue-400">
                {conteudo || <span className="truncate">{nome}</span>}
            </button>
        );
    };
    const periodo = usePeriodoPadrao('este_mes');
    const faixa = useMemo(() => faixaEmIso(periodo.faixa), [periodo.faixa]);
    const [versao, setVersao] = useState(0);
    const { dados, carregando } = usePanoramaUnidade({ unidade: unidade.nome, faixa, recepcionistas, versao });

    const contas = useMemo(() => {
        if (!dados) return null;
        const vendas = dados.vendas || [];
        const v = resumoVendas({ vendas, faixa, planos, produtos });
        const planosAntes = dados.vendasAnterior ? contarPlanosDoCard(dados.vendasAnterior, planos, produtos).total : null;
        return {
            vendas: v,
            varPlanos: variacao(v.planos, planosAntes),
            placar: dados.metas === undefined ? null : placarDoMes({ vendas, metaLinha: dados.metas, semPersonal, planos, produtos }),
            movimento: dados.movimento ? resumoMovimento({ linhas: dados.movimento, faixa }) : null,
            avaliacoes: dados.avaliacoes ? resumoAvaliacoes({ avaliacoes: dados.avaliacoes, faixa, pendenciasAvaliacao }) : null,
            crm: dados.historico ? resumoCrm({ historico: dados.historico, feitosHoje: dados.feitosHoje || [], recepcionistas, hojeIso: dados.hoje, faixa, mesmoNome, ehMudancaPorCompra }) : null,
        };
    }, [dados, faixa, planos, produtos, semPersonal, recepcionistas]);

    const ir = (tela, opcoes) => abrirTela && (() => abrirTela(tela, opcoes));
    const erroDe = (parte) => (dados?.erros?.includes(parte) ? tx('Não foi possível ler {parte}. Tente "Atualizar".', { parte: tx(parte) }) : null);
    const rotuloAbrir = tx('Abrir a tela completa');

    const v = contas?.vendas;
    const m = contas?.movimento;
    const saldo = v && m && m.lancamentos ? v.planos - m.cancelamentos : null;
    const foraDaMeta = v ? v.produtosVendidos - v.produtosNaMeta : 0;

    return (
        <div className="space-y-4">
            {/* Topo: título + período */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-[15px] font-extrabold uppercase tracking-tight text-slate-800 dark:text-white">{tx('Panorama')} · {unidade.nome}</h3>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {tx(periodo.rotulo)} · {tx('só leitura')}{dados?.lidoEm && ` · ${tx('atualizado às {hora}', { hora: horaDe(dados.lidoEm) })}`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setVersao(n => n + 1)} disabled={carregando}
                        className="h-10 px-3 rounded-xl text-[12px] font-bold text-slate-500 hover:text-slate-800 hover:bg-white inline-flex items-center gap-1.5 disabled:opacity-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800">
                        <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />{tx('Atualizar')}
                    </button>
                    <SeletorPeriodo {...periodo.propsSeletor} />
                </div>
            </div>

            {!contas ? (
                <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800">
                    <Loader2 className="w-7 h-7 text-blue-500 animate-spin mb-3" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{tx('Juntando os dados da unidade...')}</p>
                </div>
            ) : (
                <div className={`space-y-4 transition-opacity ${carregando ? 'opacity-60' : ''}`}>
                    {/* FAIXA DE RESUMO (vendas | movimentação) */}
                    <div className="bg-white rounded-xl border border-slate-200/80 flex flex-wrap divide-x divide-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:divide-slate-800">
                        <Numero rotulo={tx('Planos')} valor={v.planos}
                            sub={contas.varPlanos ? (contas.varPlanos.perc === null ? tx('+{qtd} × mês passado', { qtd: contas.varPlanos.dif }) : `${contas.varPlanos.dif >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(contas.varPlanos.perc * 100))}% × ${tx('mês passado')}`) : tx('planos base')}
                            titulo={dados.faixaAnterior ? tx('Comparado com as mesmas datas do mês passado ({de} a {ate}).', { de: dataCurta(dados.faixaAnterior.inicio), ate: dataCurta(dados.faixaAnterior.fim) }) : undefined} />
                        <Numero rotulo={tx('Nutri')} valor={v.nutri} sub={tx('adicional')} cor="text-emerald-600 dark:text-emerald-400" />
                        <Numero rotulo={tx('Produtos')} valor={v.produtosVendidos} sub={foraDaMeta > 0 ? tx('{qtd} fora da meta', { qtd: foraDaMeta }) : tx('vendidos')} />
                        <Numero rotulo={tx('Serviços')} valor={v.servicos} />
                        <Numero rotulo={tx('Comissão')} valor={dinheiro(v.comissao)} sub={tx('soma das vendas')} cor="text-emerald-600 dark:text-emerald-400" />
                        <Numero rotulo={tx('Faturamento')} valor={m ? dinheiro(m.faturamento) : '—'} sub={m?.lancamentos ? tx('digitado na Movimentação') : tx('sem lançamento')}
                            titulo={tx('Dinheiro que entrou, digitado pelo Líder na Movimentação. Não é comissão.')} />
                        <Numero rotulo={tx('Saídas')} valor={m && m.lancamentos ? m.cancelamentos : '—'} sub={tx('cancelamentos')} cor="text-rose-600 dark:text-rose-400" />
                        <Numero rotulo={tx('Saldo')} valor={saldo === null ? '—' : `${saldo > 0 ? '+' : ''}${saldo}`} sub={tx('planos − saídas')}
                            cor={saldo === null ? 'text-slate-400' : saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} />
                        <Numero rotulo={tx('Ativos')} valor={m?.ativos ?? '—'} sub={m?.ativosEm ? tx('lançado em {dia}', { dia: dataCurta(m.ativosEm) }) : tx('sem lançamento')} />
                    </div>
                    {erroDe('a movimentação') && <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">⚠️ {erroDe('a movimentação')}</p>}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* VENDAS */}
                        <Quadro icone={ShoppingCart} cor="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" titulo={tx('Vendas')}
                            sub={tx('{qtd} lançamentos · {conf} conferidos', { qtd: v.lancamentos, conf: v.percConferidas === null ? '—' : `${Math.round(v.percConferidas * 100)}%` })}
                            abrir={ir('assinaturas')} rotuloAbrir={rotuloAbrir} erro={erroDe('as vendas')}>
                            {v.lancamentos === 0 ? <p className="text-[12px] font-bold text-slate-400">{tx('Nenhuma venda no período.')}</p> : (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{tx('Por consultor (itens · comissão)')}</p>
                                        {v.consultores.slice(0, 8).map(c => (
                                            <div key={c.nome} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_80px] items-center gap-3">
                                                {nomeConsultor(c.nome)}
                                                <span className="flex items-center gap-2"><span className="flex-1 min-w-0"><Barra valor={c.itens} total={v.consultores[0].itens} /></span><span className="text-[12px] font-extrabold tabular-nums text-slate-700 w-6 text-right dark:text-slate-200">{c.itens}</span></span>
                                                <span className="text-[11px] font-bold tabular-nums text-emerald-600 text-right dark:text-emerald-400">{dinheiro(c.comissao)}</span>
                                            </div>
                                        ))}
                                        {v.consultores.length > 8 && <p className="text-[10px] font-semibold text-slate-400">{tx('+{qtd} outros consultores', { qtd: v.consultores.length - 8 })}</p>}
                                    </div>
                                    <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{tx('Últimas vendas')}</p>
                                        {v.ultimas.map(u => (
                                            <div key={u.id} className="flex items-center justify-between gap-3 text-[11px]">
                                                <span className="min-w-0 truncate"><b className="font-bold uppercase text-slate-700 dark:text-slate-200">{u.produto}</b><span className="text-slate-400"> · {u.nome_aluno || u.nome || '—'}</span></span>
                                                <span className="shrink-0 font-semibold text-slate-400">{dataCurta(u.data)} {horaDe(u.created_at)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Quadro>

                        {/* METAS DO MÊS */}
                        <Quadro icone={Target} cor="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400" titulo={tx('Metas do mês')}
                            sub={contas.placar ? tx('mês atual · dia {dia} de {dias}', { dia: contas.placar.mes.diasPassados, dias: contas.placar.mes.diasMes }) : ''}
                            abrir={ir('analise', { aba: 'visaoGeral' })} rotuloAbrir={rotuloAbrir} erro={erroDe('as metas')}>
                            {!contas.placar || !contas.placar.temMeta ? <p className="text-[12px] font-bold text-amber-600 dark:text-amber-400">{tx('As metas deste mês ainda não foram preenchidas.')}</p> : (
                                <div className="space-y-4">
                                    {[['Meta Start', contas.placar.start], ['Meta Mensal', contas.placar.mensal]].map(([titulo, itens]) => (
                                        <div key={titulo} className="space-y-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{tx(titulo)}</p>
                                            {itens.map(i => {
                                                const r = i.resultado;
                                                const cor = COR_STATUS[r?.status || 'neutro'];
                                                return (
                                                    <div key={i.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_70px] items-center gap-3">
                                                        <span className="text-[12px] font-bold text-slate-700 flex items-center gap-2 dark:text-slate-200"><span className={`w-2 h-2 rounded-full shrink-0 ${cor.bolinha}`} />{tx(i.rotulo)}</span>
                                                        {r ? <Barra valor={r.vendido} total={r.meta} cor={cor.barra} /> : <span className="text-[10px] font-semibold text-slate-400">{tx('sem meta')}</span>}
                                                        <span className={`text-[12px] font-extrabold tabular-nums text-right ${cor.texto}`}>{r ? `${r.vendido} / ${r.meta}` : i.vendidoSemMeta}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                    <p className="text-[10px] font-semibold text-slate-400">{tx('Produtos contam com o limite de 10 doses únicas por mês. Verde = no ritmo, amarelo = um pouco abaixo, vermelho = abaixo.')}</p>
                                </div>
                            )}
                        </Quadro>

                        {/* CRM */}
                        <Quadro icone={MessagesSquare} cor="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" titulo={tx('CRM')}
                            sub={tx('meta de hoje e ações do período')} abrir={ir('crm')} rotuloAbrir={rotuloAbrir} erro={erroDe('o CRM')}>
                            {!contas.crm ? null : (
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex items-end justify-between gap-3 mb-1.5">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{tx('Pessoas contatadas hoje')}</span>
                                            <span className="text-lg font-extrabold tabular-nums text-slate-800 dark:text-white">{contas.crm.pessoasHoje}<span className="text-[12px] text-slate-400"> / {contas.crm.metaHoje}</span></span>
                                        </div>
                                        <Barra valor={contas.crm.pessoasHoje} total={contas.crm.metaHoje} cor={contas.crm.metaHoje && contas.crm.pessoasHoje >= contas.crm.metaHoje ? 'bg-emerald-500' : 'bg-orange-500'} />
                                    </div>
                                    {contas.crm.porPessoa.length === 0 ? <p className="text-[12px] font-bold text-slate-400">{tx('Nenhuma recepcionista ativa na Equipe.')}</p> : (
                                        <div className="space-y-2">
                                            {contas.crm.porPessoa.map(p => (
                                                <div key={p.nome} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_64px] items-center gap-3">
                                                    {nomeConsultor(p.nome, <>
                                                        {String(p.turno).toUpperCase() === 'MANHA' && <Sun className="w-3 h-3 text-amber-500 shrink-0" />}
                                                        {String(p.turno).toUpperCase() === 'NOITE' && <Moon className="w-3 h-3 text-blue-500 shrink-0" />}
                                                        <span className="truncate">{p.nome}</span>
                                                    </>)}
                                                    <Barra valor={p.pessoasHoje} total={150} cor={p.pessoasHoje >= 150 ? 'bg-emerald-500' : 'bg-orange-500'} />
                                                    <span className="text-[12px] font-extrabold tabular-nums text-right text-slate-700 dark:text-slate-200">{p.pessoasHoje}/150</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                        {[
                                            ['Ações', contas.crm.acoes],
                                            ['WhatsApp', contas.crm.whatsapp],
                                            ['Ligações', contas.crm.ligacoes],
                                            ['Fechou', contas.crm.fechados],
                                            ['Visitantes', dados.visitantes ?? '—'],
                                            ['Carteira', dados.carteira ?? '—'],
                                        ].map(([r, n]) => (
                                            <div key={r} className="text-center">
                                                <p className="text-[15px] font-extrabold tabular-nums text-slate-800 dark:text-white">{n}</p>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{tx(r)}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] font-semibold text-slate-400">
                                        {tx('Visitantes = cadastrados no período. Carteira = contatos em Novo/Em Contato com dona.')}{dados.bancoBruto !== null && ` ${tx('Banco Bruto: {qtd} esperando.', { qtd: dados.bancoBruto })}`}
                                    </p>
                                </div>
                            )}
                        </Quadro>

                        {/* AVALIAÇÕES */}
                        <Quadro icone={Dumbbell} cor="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400" titulo={tx('Avaliações')}
                            sub={contas.avaliacoes ? tx('{qtd} no período', { qtd: contas.avaliacoes.total }) : ''} abrir={ir('avaliacao')} rotuloAbrir={rotuloAbrir} erro={erroDe('as avaliações')}>
                            {!contas.avaliacoes ? null : contas.avaliacoes.total === 0 ? <p className="text-[12px] font-bold text-slate-400">{tx('Nenhuma avaliação no período.')}</p> : (
                                <div className="space-y-3">
                                    {contas.avaliacoes.incompletas > 0 && (
                                        <p className="text-[11px] font-bold text-amber-600 flex items-center gap-1.5 dark:text-amber-400"><AlertTriangle className="w-3.5 h-3.5" />{contas.avaliacoes.incompletas === 1 ? tx('1 incompleta (sem bioimpedância ou anamnese)') : tx('{qtd} incompletas (sem bioimpedância ou anamnese)', { qtd: contas.avaliacoes.incompletas })}</p>
                                    )}
                                    {contas.avaliacoes.avaliadores.map(a => (
                                        <div key={a.nome} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] items-center gap-3">
                                            {nomeConsultor(a.nome)}
                                            <Barra valor={a.qtd} total={contas.avaliacoes.avaliadores[0].qtd} cor="bg-purple-500" />
                                            <span className="text-[12px] font-extrabold tabular-nums text-right text-slate-700 dark:text-slate-200">{a.qtd}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Quadro>
                    </div>

                    {/* PENDÊNCIAS (as mesmas da aba Pendências) */}
                    <Quadro icone={BellRing} cor="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" titulo={tx('Pendências')}
                        sub={tx('as mesmas da aba Pendências (hoje)')} abrir={ir('pendencias')} rotuloAbrir={rotuloAbrir}>
                        {pendencia === undefined ? <p className="text-[12px] font-bold text-slate-400">{tx('Carregando as pendências...')}</p> : !pendencia ? <p className="text-[12px] font-bold text-slate-400">{tx('Nenhuma pendência registrada para esta unidade.')}</p> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{tx('Conferência')}</p>
                                    {pendencia.conferencia?.atrasado
                                        ? <p className="text-[12px] font-bold text-rose-600 dark:text-rose-400">{pendencia.conferencia.qtd === 1 ? tx('1 venda atrasada') : tx('{qtd} vendas atrasadas', { qtd: pendencia.conferencia.qtd })}</p>
                                        : <p className="text-[12px] font-bold text-emerald-600 flex items-center gap-1 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />{tx('OK')}</p>}
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{tx('Movimentação')}</p>
                                    {pendencia.movimentoDia?.length
                                        ? pendencia.movimentoDia.map(d => <p key={d.data} className="text-[12px] font-bold text-rose-600 dark:text-rose-400">{tx(textoMovimentoDia(d))}</p>)
                                        : <p className="text-[12px] font-bold text-emerald-600 flex items-center gap-1 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />{tx('OK')}</p>}
                                    {pendencia.movimentoDia?.length > 0 && pendencia.ultimoLancamento && <p className="text-[10px] font-semibold text-slate-400">{tx(textoUltimoLancamento(pendencia.ultimoLancamento))}</p>}
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{tx('Metas')}</p>
                                    {pendencia.metas
                                        ? <>
                                            {pendencia.metas.start && <p className={`text-[12px] font-bold ${pendencia.metas.atrasado ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>{tx('Start')}: {tx(textoMetaCard(pendencia.metas.start))}</p>}
                                            {pendencia.metas.mensal && <p className={`text-[12px] font-bold ${pendencia.metas.atrasado ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>{tx('Mensal')}: {tx(textoMetaCard(pendencia.metas.mensal))}</p>}
                                        </>
                                        : <p className="text-[12px] font-bold text-emerald-600 flex items-center gap-1 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />{tx('OK')}</p>}
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{tx('Relatório da recepção')}</p>
                                    {pendencia.relatorioDias?.length ? <RelatorioCompacto lista={pendencia.relatorioDias} /> : <p className="text-[12px] font-bold text-slate-400">—</p>}
                                </div>
                            </div>
                        )}
                    </Quadro>

                    <p className="text-[10px] font-semibold text-slate-400 flex items-center gap-1.5">
                        {(contas.varPlanos?.dif ?? 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {tx('Os números usam as mesmas contas do Dashboard, das Metas, do CRM e das Pendências. "Abrir a tela completa" troca a unidade do topo para esta e abre a tela.')}
                    </p>
                </div>
            )}
        </div>
    );
};

export default AbaPanorama;
