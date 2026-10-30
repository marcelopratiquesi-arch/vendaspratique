// src/pages/AnaliseVendas/painel/PainelVendasTab.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../supabaseClient.js';
import { HelpCircle, TrendingUp, TrendingDown, Minus, ChevronRight, Clock, UserCheck, UserX, Zap } from 'lucide-react';
import { tx, localeAtual } from '../../../i18n/traduzir.js';
import { decomporPlano, getCategoriaItem } from '../utils.js';
import { diaDaVenda, infoDoMes, contarVendasDoMes, montarPlacar } from './calculosPainel.js';

// ==========================================
// DASHBOARD NOVO — MOVIMENTO DAS VENDAS (decisão do dono, 30/10/2026: "os dois juntos")
// Não repete a aba Metas: mostra o que está acontecendo com as vendas (hoje, 7 dias, mês) e quem está vendendo.
// As metas aparecem numa célula só ("X de Y atrás"), que leva para a aba "Metas da unidade".
// Vendas = QUANTIDADE de itens; comissão é informação extra (regra 5). Unidade = seletor do topo (regra 6).
// Respeita os filtros de Consultores/Planos/Produtos/Serviços do topo. Só LÊ o banco.
// Entrega 1: faixa de cima + bloco "Hoje". Entrega 2: mês dia a dia, o que vendemos, quem vende, atenção e rede.
// ==========================================

const FUSO = 'America/Sao_Paulo';
// Equipe esperada no "Ainda não venderam": Recepção/Saver ativos + quem vendeu nesta unidade nos últimos 30 dias
const DIAS_EQUIPE_RECENTE = 30;
// Sem venda há este número de dias (ou mais) = vermelho
const DIAS_PARADO_ALERTA = 3;

const paraIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const paraData = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
const somarDias = (iso, n) => { const d = paraData(iso); d.setDate(d.getDate() + n); return paraIso(d); };
const diasEntre = (a, b) => Math.round((paraData(b) - paraData(a)) / 86400000);
const numero = (v) => Number(v || 0).toLocaleString(localeAtual());
const formatarComissao = (v) => new Intl.NumberFormat(localeAtual(), { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const nomeCurto = (nome) => String(nome || '').split(' ')[0];

// Hora da venda no horário de Brasília (created_at vem em UTC)
const horaDaVenda = (v, hoje) => {
    if (!v.created_at) return '';
    const d = new Date(v.created_at);
    if (isNaN(d)) return '';
    const hora = d.toLocaleTimeString(localeAtual(), { hour: '2-digit', minute: '2-digit', timeZone: FUSO });
    const dia = diaDaVenda(v);
    return dia === hoje ? hora : `${d.toLocaleDateString(localeAtual(), { day: '2-digit', month: '2-digit', timeZone: FUSO })} ${hora}`;
};

const vendasEntre = (comDia, ini, fim) => comDia.filter(x => x.dia >= ini && x.dia <= fim).map(x => x.v);

const somar = (lista) => lista.reduce((acc, v) => {
    acc.qtd += parseInt(v.quantidade) || 1;
    acc.comissao += Number(v.comissao ?? v.valor) || 0;
    return acc;
}, { qtd: 0, comissao: 0 });

const textoUltimaVenda = (dias) => {
    if (dias === null) return tx('sem venda em 90 dias');
    if (dias === 0) return tx('vendeu hoje');
    if (dias === 1) return tx('última venda ontem');
    return tx('última venda há {dias} dias', { dias });
};

// ---------- pedaços visuais ----------
const Dica = ({ texto, alinhar = 'right' }) => (
    <span className="group/dica relative inline-flex align-middle">
        <button type="button" aria-label={texto} onClick={(e) => e.stopPropagation()} className="text-slate-400 hover:text-blue-600 focus:text-blue-600 outline-none dark:hover:text-blue-400 dark:focus:text-blue-400">
            <HelpCircle className="w-3.5 h-3.5" />
        </button>
        <span role="tooltip" className={`pointer-events-none absolute top-full mt-2 z-40 w-[min(260px,70vw)] hidden group-hover/dica:block group-focus-within/dica:block bg-slate-800 text-white text-[11px] font-semibold normal-case tracking-normal text-left leading-snug px-3 py-2 rounded-lg shadow-lg dark:bg-slate-700 ${alinhar === 'left' ? 'left-0' : 'right-0'}`}>
            {texto}
        </span>
    </span>
);

// Setinha ▲▼ com a diferença (em % ou em quantidade)
const Variacao = ({ atual, antes, emQuantidade = false, legenda }) => {
    let texto, sentido;
    if (emQuantidade) {
        const dif = atual - antes;
        sentido = dif > 0 ? 1 : dif < 0 ? -1 : 0;
        texto = `${dif > 0 ? '+' : ''}${numero(dif)}`;
    } else if (antes > 0) {
        const v = (atual - antes) / antes;
        sentido = v > 0.005 ? 1 : v < -0.005 ? -1 : 0;
        texto = `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
    } else {
        sentido = atual > 0 ? 1 : 0;
        texto = atual > 0 ? tx('novo') : '—';
    }
    const Icone = sentido > 0 ? TrendingUp : sentido < 0 ? TrendingDown : Minus;
    const cor = sentido > 0 ? 'text-emerald-700 dark:text-emerald-400' : sentido < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400';
    return (
        <span className={`inline-flex items-center gap-1 text-[11px] font-black tabular-nums ${cor}`}>
            <Icone className="w-3.5 h-3.5" />{texto}
            {legenda && <span className="font-semibold text-slate-400">{legenda}</span>}
        </span>
    );
};

const CelulaFaixa = ({ rotulo, dica, valor, comissao, children }) => (
    <div className="px-4 py-3 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1 dark:text-slate-400">{rotulo}{dica && <Dica texto={dica} alinhar="left" />}</p>
        <p className="mt-0.5 flex items-baseline flex-wrap gap-x-2">
            <span className="text-lg font-black text-slate-800 tabular-nums dark:text-white">{valor}</span>
            {children}
        </p>
        {comissao !== undefined && <p className="text-[11px] font-semibold text-slate-400 tabular-nums">{tx('Comissão')}: {formatarComissao(comissao)}</p>}
    </div>
);

const Bloco = ({ titulo, dica, direita, children }) => (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 dark:border-slate-800">
            <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5 dark:text-white">{titulo}{dica && <Dica texto={dica} alinhar="left" />}</h3>
            {direita}
        </div>
        <div className="p-4">{children}</div>
    </div>
);

const SubTitulo = ({ icone: Icone, texto, qtd, cor = 'text-slate-500 dark:text-slate-400' }) => (
    <h4 className={`text-[11px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5 ${cor}`}>
        <Icone className="w-3.5 h-3.5" />{texto}{qtd !== undefined && <span className="tabular-nums">({qtd})</span>}
    </h4>
);

const Vazio = ({ texto }) => <p className="text-[12px] font-semibold text-slate-400 py-4 text-center">{texto}</p>;

// ==========================================
const PainelVendasTab = ({
    vendas = [], planos = [], produtos = [], colaboradores = [], unidadeAtual,
    vendedoresOcultos = [], planosOcultos = [], produtosOcultos = [], servicosOcultos = [],
    onAbrirMetas,
}) => {
    const visaoRede = !unidadeAtual || unidadeAtual === 'TODOS';
    const unidadeUpper = String(unidadeAtual || '').toUpperCase();
    const hoje = paraIso(new Date());

    // Vendas da unidade do topo + filtros de itens/consultores (sem período: as janelas abaixo são fixas)
    const base = useMemo(() => vendas.filter(v => {
        if (!visaoRede && String(v.unidade || '').toUpperCase() !== unidadeUpper) return false;
        const prod = (v.produto || '').toUpperCase();
        if (vendedoresOcultos.includes((v.vendedor || '').toUpperCase())) return false;
        if (planosOcultos.includes(prod) || produtosOcultos.includes(prod) || servicosOcultos.includes(prod)) return false;
        return true;
    }), [vendas, visaoRede, unidadeUpper, vendedoresOcultos, planosOcultos, produtosOcultos, servicosOcultos]);

    // Dia de cada venda calculado uma vez só
    const comDia = useMemo(() => base.map(v => ({ v, dia: diaDaVenda(v) })).filter(x => x.dia), [base]);

    // ---------- faixa de cima ----------
    const faixa = useMemo(() => {
        const entre = (ini, fim) => vendasEntre(comDia, ini, fim);
        const hojeTot = somar(entre(hoje, hoje));
        const mesmoDiaSemanaPassada = somarDias(hoje, -7);
        const semanaPassadaTot = somar(entre(mesmoDiaSemanaPassada, mesmoDiaSemanaPassada));
        const seteDias = somar(entre(somarDias(hoje, -6), hoje));
        const seteAntes = somar(entre(somarDias(hoje, -13), somarDias(hoje, -7)));
        const d = paraData(hoje);
        const inicioMes = paraIso(new Date(d.getFullYear(), d.getMonth(), 1));
        const inicioMesAnt = paraIso(new Date(d.getFullYear(), d.getMonth() - 1, 1));
        const ultimoDiaAnt = new Date(d.getFullYear(), d.getMonth(), 0).getDate();
        const fimMesAnt = paraIso(new Date(d.getFullYear(), d.getMonth() - 1, Math.min(d.getDate(), ultimoDiaAnt)));
        const mes = somar(entre(inicioMes, hoje));
        const mesAnt = somar(entre(inicioMesAnt, fimMesAnt));
        const diaSemana = paraData(mesmoDiaSemanaPassada).toLocaleDateString(localeAtual(), { weekday: 'short' }).replace('.', '');
        return { hojeTot, semanaPassadaTot, seteDias, seteAntes, mes, mesAnt, diaSemana, diaMes: d.getDate(), fimMesAnt };
    }, [comDia, hoje]);

    // ---------- metas do mês atual: só para a célula "X de Y atrás" ----------
    const mesAtual = useMemo(() => { const d = new Date(); return { ano: String(d.getFullYear()), mes: String(d.getMonth() + 1).padStart(2, '0') }; }, []);
    const [metas, setMetas] = useState(null);
    useEffect(() => {
        let ativo = true;
        supabase.from('metas_unidades').select('*').eq('mes', mesAtual.mes).eq('ano', mesAtual.ano).then(({ data, error }) => {
            if (!ativo) return;
            if (error) console.error('Dashboard: erro ao buscar metas', error);
            const dic = {};
            (data || []).forEach(l => { if (l.unidade) dic[l.unidade.toUpperCase()] = l; });
            setMetas(dic);
        });
        return () => { ativo = false; };
    }, [mesAtual]);

    const resumoMetas = useMemo(() => {
        if (!metas) return null;
        const info = infoDoMes(mesAtual.ano, mesAtual.mes);
        const vendasMes = comDia.filter(x => x.dia >= info.inicio && x.dia <= info.fim).map(x => x.v);
        const avaliarUnidade = (u, lista) => {
            const p = montarPlacar({ metaLinha: metas[u], contagem: contarVendasDoMes(lista, planos, produtos), mes: info });
            const itens = [...p.start, ...p.mensal].filter(i => i.resultado && !i.manual);
            const atras = itens.filter(i => i.resultado.status === 'amarelo' || i.resultado.status === 'vermelho');
            return { total: itens.length, atras: atras.length, vermelho: atras.some(i => i.resultado.status === 'vermelho') };
        };
        if (!visaoRede) return { tipo: 'unidade', ...avaliarUnidade(unidadeUpper, vendasMes) };
        // Rede: quantas unidades têm alguma meta atrás
        const porUnidade = {};
        vendasMes.forEach(v => { const u = String(v.unidade || '').toUpperCase(); (porUnidade[u] = porUnidade[u] || []).push(v); });
        const unidades = Object.keys(porUnidade).filter(u => metas[u]);
        const avaliadas = unidades.map(u => avaliarUnidade(u, porUnidade[u])).filter(r => r.total > 0);
        return { tipo: 'rede', total: avaliadas.length, atras: avaliadas.filter(r => r.atras > 0).length, vermelho: avaliadas.some(r => r.vermelho) };
    }, [metas, comDia, mesAtual, visaoRede, unidadeUpper, planos, produtos]);

    // ---------- bloco Hoje ----------
    const hojeDados = useMemo(() => {
        const vendasHoje = comDia.filter(x => x.dia === hoje).map(x => x.v);
        const jaVenderam = {};
        vendasHoje.forEach(v => {
            const nome = (v.vendedor || '').toUpperCase().trim() || tx('SEM CONSULTOR');
            const r = jaVenderam[nome] || (jaVenderam[nome] = { nome, qtd: 0, nutri: 0, comissao: 0, unidades: new Set() });
            const q = parseInt(v.quantidade) || 1;
            r.qtd += q;
            r.comissao += Number(v.comissao ?? v.valor) || 0;
            if (getCategoriaItem(v.produto, planos, produtos) === 'PLANO' && decomporPlano(v.produto).nutri) r.nutri += q;
            if (v.unidade) r.unidades.add(v.unidade);
        });
        const listaJa = Object.values(jaVenderam).sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome));

        // Última venda de cada consultor (nos 90 dias carregados), só da unidade escolhida
        const ultimaVenda = {};
        comDia.forEach(({ v, dia }) => {
            const nome = (v.vendedor || '').toUpperCase().trim();
            if (nome && (!ultimaVenda[nome] || dia > ultimaVenda[nome])) ultimaVenda[nome] = dia;
        });

        // "Ainda não venderam": só com uma unidade escolhida (na rede a lista ficaria enorme)
        let listaNao = [];
        if (!visaoRede) {
            const equipe = new Set();
            colaboradores.forEach(c => {
                if (String(c.unidade || '').toUpperCase() !== unidadeUpper || c.ativo === false || !c.nome) return;
                const cargo = String(c.cargo || c.setor || c.role || '').toUpperCase();
                if (cargo.includes('SAVER') || cargo.includes('RECEP')) equipe.add(c.nome.toUpperCase().trim());
            });
            // Quem vendeu nos últimos 30 dias, menos quem está desligado no cadastro
            const desligados = new Set(colaboradores.filter(c => c.ativo === false && c.nome).map(c => c.nome.toUpperCase().trim()));
            const corte = somarDias(hoje, -DIAS_EQUIPE_RECENTE);
            Object.entries(ultimaVenda).forEach(([nome, dia]) => { if (dia >= corte && !desligados.has(nome)) equipe.add(nome); });
            listaNao = [...equipe].filter(n => !jaVenderam[n]).map(nome => ({
                nome, dias: ultimaVenda[nome] ? diasEntre(ultimaVenda[nome], hoje) : null,
            })).sort((a, b) => (b.dias ?? 9999) - (a.dias ?? 9999) || a.nome.localeCompare(b.nome));
        }

        const ultimas = [...base].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || (b.id || 0) - (a.id || 0)).slice(0, 10);
        return { listaJa, listaNao, ultimas };
    }, [comDia, base, hoje, visaoRede, unidadeUpper, colaboradores, planos, produtos]);

    // ---------- célula de metas ----------
    const celulaMetas = (() => {
        if (!resumoMetas) return { valor: '…', cor: 'text-slate-400', sub: '' };
        if (resumoMetas.total === 0) return { valor: tx('Sem meta'), cor: 'text-slate-500 dark:text-slate-400', sub: tx('Cadastre na aba Metas') };
        const cor = resumoMetas.atras === 0 ? 'text-emerald-700 dark:text-emerald-400' : resumoMetas.vermelho ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400';
        const sub = resumoMetas.tipo === 'rede'
            ? tx('{atras} de {total} unidades com meta atrás', resumoMetas)
            : tx('{atras} de {total} atrás do ritmo', resumoMetas);
        return { valor: resumoMetas.atras === 0 ? tx('No ritmo') : `${resumoMetas.atras}/${resumoMetas.total}`, cor, sub };
    })();

    return (
        <div className="space-y-4 animate-[fadeIn_0.2s_ease-out]">
            {/* ===== FAIXA DE CIMA ===== */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:divide-slate-800">
                <CelulaFaixa
                    rotulo={tx('Hoje')}
                    dica={tx('Itens vendidos hoje, comparados com o mesmo dia da semana passada (ex.: quinta com quinta).')}
                    valor={numero(faixa.hojeTot.qtd)}
                    comissao={faixa.hojeTot.comissao}
                >
                    <Variacao atual={faixa.hojeTot.qtd} antes={faixa.semanaPassadaTot.qtd} emQuantidade legenda={tx('vs {dia} passada', { dia: faixa.diaSemana })} />
                </CelulaFaixa>
                <CelulaFaixa
                    rotulo={tx('Últimos 7 dias')}
                    dica={tx('Itens vendidos de 6 dias atrás até hoje, comparados com os 7 dias anteriores.')}
                    valor={numero(faixa.seteDias.qtd)}
                    comissao={faixa.seteDias.comissao}
                >
                    <Variacao atual={faixa.seteDias.qtd} antes={faixa.seteAntes.qtd} legenda={tx('vs 7 dias antes')} />
                </CelulaFaixa>
                <CelulaFaixa
                    rotulo={tx('Mês até hoje')}
                    dica={tx('Itens vendidos do dia 1 até hoje, comparados com o mesmo trecho do mês passado (do dia 1 ao mesmo dia).')}
                    valor={numero(faixa.mes.qtd)}
                    comissao={faixa.mes.comissao}
                >
                    <Variacao atual={faixa.mes.qtd} antes={faixa.mesAnt.qtd} legenda={tx('vs mês passado')} />
                </CelulaFaixa>
                <button
                    type="button"
                    onClick={onAbrirMetas}
                    className="text-left px-4 py-3 min-w-0 hover:bg-slate-50 transition-colors rounded-r-2xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800/60"
                    title={tx('Abrir a aba Metas da unidade')}
                >
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1 dark:text-slate-400">
                        {tx('Metas do mês')}<Dica texto={tx('Quantas metas do mês estão atrás do ritmo (amarelo ou vermelho na aba Metas). Clique para ver o detalhe.')} alinhar="right" />
                    </p>
                    <p className={`mt-0.5 text-lg font-black tabular-nums ${celulaMetas.cor}`}>{celulaMetas.valor}</p>
                    <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-0.5">{celulaMetas.sub}<ChevronRight className="w-3.5 h-3.5 text-blue-500" /></p>
                </button>
            </div>

            {/* ===== HOJE ===== */}
            <Bloco
                titulo={tx('Hoje')}
                dica={tx('"Ainda não venderam": Recepção e Saver ativos da unidade, mais quem vendeu nela nos últimos 30 dias. Em vermelho, quem está há 3 dias ou mais sem vender.')}
                direita={<span className="text-[11px] font-semibold text-slate-400">{paraData(hoje).toLocaleDateString(localeAtual(), { weekday: 'long', day: '2-digit', month: '2-digit' })}</span>}
            >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Já venderam */}
                    <div>
                        <SubTitulo icone={UserCheck} texto={tx('Já venderam hoje')} qtd={hojeDados.listaJa.length} cor="text-emerald-700 dark:text-emerald-400" />
                        {hojeDados.listaJa.length === 0 ? <Vazio texto={tx('Nenhuma venda hoje ainda.')} /> : (
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {hojeDados.listaJa.map(r => (
                                    <li key={r.nome} className="py-1.5 flex items-center justify-between gap-2">
                                        <span className="min-w-0">
                                            <span className="text-[12px] font-black text-slate-800 dark:text-white">{nomeCurto(r.nome)}</span>
                                            {visaoRede && <span className="ml-1.5 text-[10px] font-bold text-slate-400">{[...r.unidades].join(', ')}</span>}
                                        </span>
                                        <span className="text-[12px] font-bold text-slate-600 tabular-nums whitespace-nowrap dark:text-slate-300">
                                            {numero(r.qtd)} {tx('itens')}{r.nutri > 0 && <span className="text-emerald-700 dark:text-emerald-400"> · {numero(r.nutri)} Nutri</span>}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Ainda não venderam */}
                    <div>
                        <SubTitulo icone={UserX} texto={tx('Ainda não venderam')} qtd={visaoRede ? undefined : hojeDados.listaNao.length} cor="text-rose-700 dark:text-rose-400" />
                        {visaoRede ? <Vazio texto={tx('Escolha uma unidade no seletor do topo para ver quem ainda não vendeu.')} />
                            : hojeDados.listaNao.length === 0 ? <Vazio texto={tx('Todos da equipe já venderam hoje.')} /> : (
                                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {hojeDados.listaNao.map(r => {
                                        const alerta = r.dias === null || r.dias >= DIAS_PARADO_ALERTA;
                                        return (
                                            <li key={r.nome} className="py-1.5 flex items-center justify-between gap-2">
                                                <span className="text-[12px] font-black text-slate-800 dark:text-white">{nomeCurto(r.nome)}</span>
                                                <span className={`text-[11px] font-bold whitespace-nowrap ${alerta ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>{textoUltimaVenda(r.dias)}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                    </div>

                    {/* Entrando agora */}
                    <div>
                        <SubTitulo icone={Zap} texto={tx('Últimas vendas')} cor="text-blue-700 dark:text-blue-400" />
                        {hojeDados.ultimas.length === 0 ? <Vazio texto={tx('Nenhuma venda nos últimos 90 dias.')} /> : (
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {hojeDados.ultimas.map((v, i) => (
                                    <li key={v.id || i} className="py-1.5">
                                        <p className="flex items-center justify-between gap-2">
                                            <span className="text-[11px] font-bold text-slate-400 tabular-nums inline-flex items-center gap-1 whitespace-nowrap"><Clock className="w-3 h-3" />{horaDaVenda(v, hoje)}</span>
                                            <span className="text-[11px] font-black text-emerald-700 tabular-nums dark:text-emerald-400">{formatarComissao(v.comissao ?? v.valor)}</span>
                                        </p>
                                        <p className="text-[12px] font-black text-slate-800 truncate dark:text-white" title={v.nome_aluno}>{v.nome_aluno || '—'}</p>
                                        <p className="text-[11px] font-semibold text-slate-500 truncate dark:text-slate-400">
                                            {v.produto}{(parseInt(v.quantidade) || 1) > 1 ? ` ×${v.quantidade}` : ''} · {nomeCurto(v.vendedor)}{visaoRede && v.unidade ? ` · ${v.unidade}` : ''}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </Bloco>
        </div>
    );
};

export default PainelVendasTab;
