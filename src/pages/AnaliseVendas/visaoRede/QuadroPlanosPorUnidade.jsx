import React, { useMemo, useState } from 'react';
import { Building2, Send, HelpCircle, ArrowRight, Loader2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { tx, localeAtual } from '../../../i18n/traduzir.js';
import { estiloDaUnidade, DIAS_SEM_PLANO_ALERTA, faixaProdutividade, PRODUTIVIDADE_ATENCAO, PRODUTIVIDADE_BOA } from './calculosRede.js';
import BotaoCentralUnidade from '../../../components/BotaoCentralUnidade.jsx';

// ==========================================
// QUADRO "PLANOS POR UNIDADE" — só na Visão da Rede (Admin/Mentor com o topo em "Todas"; decisão do dono, 06/11/2026)
// Uma linha por unidade, quem vendeu mais em cima e quem não vendeu em vermelho no fim.
// Clicar na unidade passa o seletor do topo para ela (abre o Dashboard normal da unidade).
// Ajustes do dono (06/11/2026): colunas Plus / Fit / Personal Class separadas (bolinha da cor = legenda da barra),
// o "vs mês passado" foi para baixo do número de planos, produtividade com cor (vermelho/amarelo/verde)
// e todas as colunas ordenam ao clicar no título (1º clique: maior primeiro / A→Z; 2º: inverte; 3º: volta ao normal).
// ==========================================

const ddmm = (iso) => (iso ? iso.split('-').reverse().slice(0, 2).join('/') : '');
const dois = (n) => String(n).padStart(2, '0');
const moeda = (v) => new Intl.NumberFormat(localeAtual(), { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
// "R$ 21,1 mil" (modo Resumido; o valor exato fica no passar do mouse)
const moedaCurta = (v) => new Intl.NumberFormat(localeAtual(), { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v);

// Modo do quadro (Resumido / Detalhado), lembrado neste computador (decisão do dono, 06/11/2026)
const CHAVE_MODO = 'quadroPlanosRede.modo';
const lerModo = () => { try { return localStorage.getItem(CHAVE_MODO) === 'detalhado' ? 'detalhado' : 'resumido'; } catch { return 'resumido'; } };
const gravarModo = (m) => { try { localStorage.setItem(CHAVE_MODO, m); } catch { /* sem armazenamento: só não lembra */ } };
// Colunas que só existem no Detalhado (e o Saldo, que só existe no Resumido)
const SO_DETALHADO = ['fit', 'personal', 'outros', 'servicos'];
const SO_RESUMIDO = ['saldo'];

const COR_PRODUTIVIDADE = {
    boa: 'bg-emerald-50 text-[#0B7A52] border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
    atencao: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
    ruim: 'bg-rose-50 text-[#B42318] border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
};

const SeloProdutividade = ({ valor }) => {
    if (valor === null || valor === undefined) return '—';
    const arred = Math.round(valor);
    return (
        <span className={`h-6 px-2 rounded-md border text-[12px] font-extrabold tabular-nums inline-flex items-center ${COR_PRODUTIVIDADE[faixaProdutividade(arred)]}`}>{arred}%</span>
    );
};

const Dica = ({ texto }) => (
    <span className="group/dica relative inline-flex align-middle normal-case tracking-normal">
        <button type="button" aria-label={texto} onClick={(e) => e.stopPropagation()} className="text-slate-400 hover:text-blue-600 focus:text-blue-600 outline-none dark:hover:text-blue-400"><HelpCircle className="w-3.5 h-3.5" /></button>
        <span role="tooltip" className="pointer-events-none absolute top-full mt-2 right-0 z-40 w-[min(240px,70vw)] hidden group-hover/dica:block group-focus-within/dica:block bg-slate-800 text-white text-[11px] font-semibold text-left leading-snug px-3 py-2 rounded-lg shadow-lg dark:bg-slate-700">{texto}</span>
    </span>
);

const Variacao = ({ atual, antes, titulo }) => {
    const dif = atual - antes;
    if (dif === 0) return <span className="text-[11px] font-bold text-[#5B6478] dark:text-slate-400" title={titulo}>= {tx('igual')}</span>;
    const sobe = dif > 0;
    return (
        <span title={titulo} className={`text-[11px] font-bold tabular-nums whitespace-nowrap ${sobe ? 'text-[#0B7A52] dark:text-emerald-400' : 'text-[#B42318] dark:text-rose-300'}`}>
            {sobe ? '▲' : '▼'} {Math.abs(dif)}
            {antes > 0 && <span className="font-semibold opacity-80"> · {sobe ? '+' : '−'}{Math.abs(Math.round((dif / antes) * 100))}%</span>}
        </span>
    );
};

// Valor de cada coluna para ordenar (null = sem dado, vai sempre para o fim)
const VALOR_ORDEM = {
    unidade: (l) => l.nome,
    planos: (l) => l.planos,
    plus: (l) => l.grupos.PLUS,
    fit: (l) => l.grupos.FIT,
    personal: (l) => l.grupos['PERSONAL CLASS'],
    outros: (l) => l.grupos['OUTROS PLANOS'],
    nutri: (l) => l.nutri,
    produtividade: (l) => l.produtividade,
    produtos: (l) => l.produtos,
    servicos: (l) => l.servicos,
    cancelamentos: (l) => l.cancelamentos,
    saldo: (l) => (l.cancelamentos === null || l.cancelamentos === undefined ? null : l.planos - l.cancelamentos),
    faturamento: (l) => l.faturamento,
    ativos: (l) => l.ativos,
};

const QuadroPlanosPorUnidade = ({
    linhas, gruposBase, escuro, temComparativo, carregandoAnterior, nomeMesAnterior, textoPeriodo,
    totalPlanos, totalNutri, semMovimento, onAbrirUnidade, onWhatsApp, usuario = null,
}) => {
    const [ordem, setOrdem] = useState({ coluna: null, direcao: 'desc' });
    const [modo, setModo] = useState(lerModo);
    const resumido = modo === 'resumido';
    const trocarModo = (m) => {
        setModo(m);
        gravarModo(m);
        // Ordenado por uma coluna que some no outro modo: volta para a ordem normal
        setOrdem(atual => ((m === 'resumido' ? SO_DETALHADO : SO_RESUMIDO).includes(atual.coluna) ? { coluna: null, direcao: 'desc' } : atual));
    };
    const venderam = linhas.filter(l => l.planos > 0).length;
    const maior = Math.max(1, ...linhas.map(l => l.planos));
    const corGrupo = (g) => (escuro ? g.clara : g.cor);
    const soma = (campo) => linhas.reduce((s, l) => s + (l[campo] || 0), 0);
    const somaGrupo = (chave) => linhas.reduce((s, l) => s + (l.grupos[chave] || 0), 0);
    const algum = (campo) => linhas.some(l => l[campo] !== null && l[campo] !== undefined);
    const ativosLancados = linhas.filter(l => l.ativos !== null).length;
    const grupo = (chave) => gruposBase.find(g => g.chave === chave);
    // "Outros planos" só aparece como coluna se alguma unidade vendeu (senão fica só na barra)
    const temOutros = somaGrupo('OUTROS PLANOS') > 0;
    const tituloVariacao = tx('Diferença para as mesmas datas do mês passado ({mes}).', { mes: nomeMesAnterior || '—' });

    const linhasOrdenadas = useMemo(() => {
        if (!ordem.coluna) return linhas; // ordem normal: quem vendeu mais em cima, zerados no fim
        const pegar = VALOR_ORDEM[ordem.coluna];
        const sinal = ordem.direcao === 'asc' ? 1 : -1;
        return [...linhas].sort((a, b) => {
            const va = pegar(a); const vb = pegar(b);
            const nulaA = va === null || va === undefined; const nulaB = vb === null || vb === undefined;
            if (nulaA !== nulaB) return nulaA ? 1 : -1;
            if (nulaA && nulaB) return a.nome.localeCompare(b.nome, 'pt-BR');
            const dif = typeof va === 'string' ? va.localeCompare(vb, 'pt-BR') : va - vb;
            return dif * sinal || a.nome.localeCompare(b.nome, 'pt-BR');
        });
    }, [linhas, ordem]);

    const clicarColuna = (coluna) => setOrdem(atual => {
        const primeira = coluna === 'unidade' ? 'asc' : 'desc';
        if (atual.coluna !== coluna) return { coluna, direcao: primeira };
        if (atual.direcao === primeira) return { coluna, direcao: primeira === 'asc' ? 'desc' : 'asc' };
        return { coluna: null, direcao: 'desc' }; // 3º clique: volta para a ordem normal
    });

    const px = resumido ? 'px-2' : 'px-3';
    const py = resumido ? 'py-1.5' : 'py-2.5';
    const th = `${px} py-2.5 border-b border-[#EEF1F6] text-[11px] font-bold uppercase tracking-[0.07em] text-[#5B6478] whitespace-nowrap dark:border-slate-800 dark:text-slate-400`;
    const td = `${px} ${py} text-[13px] font-semibold text-[#3B4458] tabular-nums whitespace-nowrap dark:text-slate-300`;
    const somaSaldo = linhas.reduce((s, l) => (l.cancelamentos === null || l.cancelamentos === undefined ? s : s + (l.planos - l.cancelamentos)), 0);
    const celSaldo = (v) => {
        if (semMovimento || v === null) return <td className={td}>—</td>;
        const cls = v > 0 ? 'text-[#0B7A52] dark:text-emerald-400' : v < 0 ? 'text-[#B42318] dark:text-rose-300' : 'text-[#5B6478] dark:text-slate-400';
        return <td className={td}><span className={`font-extrabold ${cls}`}>{v > 0 ? '+' : v < 0 ? '−' : ''}{Math.abs(v)}</span></td>;
    };
    const celFaturamento = (v) => (semMovimento || v === null
        ? '—'
        : resumido ? <span title={moeda(v)}>{moedaCurta(v)}</span> : moeda(v));
    const tdNum = (v) => <td className={td}>{v > 0 ? <span className="font-bold text-[#0F172A] dark:text-white">{dois(v)}</span> : <span className="text-slate-300 dark:text-slate-600">00</span>}</td>;

    // Título de coluna que ordena ao clicar (a "?" fica ao lado, fora do botão)
    const Titulo = ({ coluna, children, dica, bolinha }) => {
        const ativa = ordem.coluna === coluna;
        const Icone = !ativa ? ArrowUpDown : ordem.direcao === 'asc' ? ArrowUp : ArrowDown;
        const proxima = !ativa
            ? (coluna === 'unidade' ? tx('Clique para ordenar de A a Z') : tx('Clique para ordenar do maior para o menor'))
            : tx('Clique de novo para inverter (3º clique volta à ordem normal)');
        return (
            <th className={th} aria-sort={ativa ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <span className="inline-flex items-center gap-1">
                    <button type="button" onClick={() => clicarColuna(coluna)} title={proxima}
                        className={`inline-flex items-center gap-1 uppercase tracking-[0.07em] font-bold outline-none rounded focus-visible:ring-2 focus-visible:ring-blue-500 hover:text-blue-600 dark:hover:text-blue-400 ${ativa ? 'text-blue-700 dark:text-blue-400' : ''}`}>
                        {bolinha && <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: bolinha }} aria-hidden="true" />}
                        {children}
                        <Icone className={`w-3 h-3 ${ativa ? '' : 'opacity-40'}`} aria-hidden="true" />
                    </button>
                    {dica && <Dica texto={dica} />}
                </span>
            </th>
        );
    };

    const gPlus = grupo('PLUS'); const gFit = grupo('FIT'); const gPersonal = grupo('PERSONAL CLASS'); const gOutros = grupo('OUTROS PLANOS');
    const produtividadeRede = totalPlanos > 0 ? Math.max(100 - (somaGrupo('FIT') / totalPlanos) * 100, 0) : null;

    return (
        <section className="bg-white border border-[#E4E8F0] rounded-[20px] dark:bg-slate-900 dark:border-slate-800">
            <div className="px-4 md:px-6 pt-5 pb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[12px] font-bold uppercase tracking-[0.07em] text-[#3B4458] flex items-center gap-2 dark:text-slate-300">
                        <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />{tx('Planos por unidade')}
                    </p>
                    <p className="mt-1 text-[14px] text-[#3B4458] dark:text-slate-300">
                        <strong className="font-extrabold text-[#0F172A] dark:text-white">{tx('{qtd} planos', { qtd: totalPlanos })}</strong>
                        {' · '}
                        <strong className={`font-extrabold ${venderam < linhas.length ? 'text-[#B42318] dark:text-rose-300' : 'text-[#0B7A52] dark:text-emerald-400'}`}>{tx('{x} de {y} unidades venderam', { x: venderam, y: linhas.length })}</strong>
                        {textoPeriodo && <span className="text-[#5B6478] dark:text-slate-400"> · {textoPeriodo}</span>}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {ordem.coluna && (
                        <button type="button" onClick={() => setOrdem({ coluna: null, direcao: 'desc' })}
                            className="text-[12px] font-bold text-blue-700 hover:underline dark:text-blue-400">{tx('Voltar à ordem normal')}</button>
                    )}
                    <div className="h-10 p-1 rounded-xl bg-[#EEF1F6] inline-flex dark:bg-slate-800" role="group" aria-label={tx('Modo do quadro')}>
                        {[{ m: 'resumido', rotulo: tx('Resumido') }, { m: 'detalhado', rotulo: tx('Detalhado') }].map(({ m, rotulo }) => (
                            <button key={m} type="button" aria-pressed={modo === m} onClick={() => trocarModo(m)}
                                className={`px-3 rounded-lg text-[12px] font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${modo === m ? 'bg-blue-600 text-white shadow-sm' : 'text-[#3B4458] hover:text-[#0F172A] dark:text-slate-300 dark:hover:text-white'}`}>
                                {rotulo}
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={onWhatsApp} disabled={linhas.length === 0}
                        className="h-10 px-4 rounded-xl bg-[#0F7A3E] text-white text-[13px] font-bold inline-flex items-center gap-2 hover:bg-[#0C6533] transition-colors disabled:opacity-50">
                        <Send className="w-4 h-4" />{tx('Enviar por WhatsApp')}
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
                <table className={`w-full ${resumido ? 'min-w-[820px]' : 'min-w-[1100px]'} text-left border-collapse`}>
                    <thead>
                        <tr>
                            <Titulo coluna="unidade">{tx('Unidade')}</Titulo>
                            <Titulo coluna="planos" dica={tx('Total de planos vendidos (Nutri não entra, é adicional). Embaixo: diferença para as mesmas datas do mês passado ({mes}).', { mes: nomeMesAnterior || '—' })}>{tx('Planos')}</Titulo>
                            <Titulo coluna="plus" bolinha={gPlus && corGrupo(gPlus)}>{tx('Plus')}</Titulo>
                            {!resumido && <Titulo coluna="fit" bolinha={gFit && corGrupo(gFit)} dica={tx('Planos Fit, inclusive Fit + Nutri. É o que puxa a produtividade para baixo.')}>{tx('Fit')}</Titulo>}
                            {!resumido && <Titulo coluna="personal" bolinha={gPersonal && corGrupo(gPersonal)}>{tx('Personal Class')}</Titulo>}
                            {!resumido && temOutros && <Titulo coluna="outros" bolinha={gOutros && corGrupo(gOutros)}>{tx('Outros')}</Titulo>}
                            <Titulo coluna="nutri" dica={tx('Adicional Nutri vendido (não soma no total de planos).')}>{tx('Nutri')}</Titulo>
                            <Titulo coluna="produtividade" dica={tx('100% menos a parte de planos Fit. Verde a partir de {boa}%, amarelo de {atencao}% a {boaMenos}%, vermelho abaixo de {atencao}%.', { boa: PRODUTIVIDADE_BOA, atencao: PRODUTIVIDADE_ATENCAO, boaMenos: PRODUTIVIDADE_BOA - 1 })}>{tx('Produtividade')}</Titulo>
                            <Titulo coluna="produtos" dica={tx('Produtos vendidos. A caixinha amarela mostra as doses únicas acima do limite, que não contam para a meta.')}>{tx('Produtos')}</Titulo>
                            {!resumido && <Titulo coluna="servicos">{tx('Serviços')}</Titulo>}
                            <Titulo coluna="cancelamentos" dica={tx('Cancelamentos lançados na aba Metas (Movimentação) no período. "—" = não lançou.')}>{tx('Saídas')}</Titulo>
                            {resumido && <Titulo coluna="saldo" dica={tx('Planos vendidos menos saídas no período. Verde = a unidade ganhou alunos; vermelho = perdeu. "—" = não lançou as saídas.')}>{tx('Saldo')}</Titulo>}
                            <Titulo coluna="faturamento" dica={tx('Dinheiro que entrou, digitado na Movimentação. Não é comissão. "—" = não lançou.')}>{tx('Faturamento')}</Titulo>
                            <Titulo coluna="ativos" dica={tx('Último número de ativos lançado pela unidade até o fim do período. "—" = nunca lançou.')}>{tx('Ativos')}</Titulo>
                            <th className={th} aria-label={tx('Abrir')} />
                        </tr>
                    </thead>
                    <tbody>
                        {linhasOrdenadas.map(l => {
                            const { cor } = estiloDaUnidade(l.indice, escuro);
                            const zerado = l.planos === 0;
                            return (
                                <tr key={l.chave} onClick={() => onAbrirUnidade(l.nome)}
                                    className={`border-b border-[#F1F3F8] last:border-0 cursor-pointer transition-colors hover:bg-[#F8FAFD] dark:border-slate-800 dark:hover:bg-slate-800/60 ${zerado ? 'bg-rose-50/60 dark:bg-rose-500/5' : ''}`}>
                                    <td className={`${px} ${py}`}>
                                        <span className="flex items-center gap-2 min-w-0">
                                            <span className="w-3 h-3 rounded-[3px] shrink-0" style={{ background: cor }} aria-hidden="true" />
                                            <span className="text-[14px] font-bold text-[#0F172A] truncate max-w-[200px] dark:text-white" title={l.nome}>{l.nome}</span>
                                            {/* Central da Unidade (09/11/2026); clicar na linha continua trocando o topo */}
                                            <BotaoCentralUnidade unidade={l.nome} usuario={usuario} />
                                        </span>
                                        {(zerado || l.parouDeVender) && (
                                            <span className="mt-1 ml-5 flex flex-wrap gap-1">
                                                {zerado && <span className="h-5 px-2 rounded-md bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-black uppercase tracking-wide inline-flex items-center dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30">{tx('Não vendeu no período')}</span>}
                                                {l.parouDeVender && (
                                                    <span className="h-5 px-2 rounded-md bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black uppercase tracking-wide inline-flex items-center dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"
                                                        title={tx('Último plano em {dia}. O selo aparece com {dias} dias ou mais sem plano.', { dia: ddmm(l.ultimoPlano), dias: DIAS_SEM_PLANO_ALERTA })}>
                                                        {tx('Sem plano há {dias} dias', { dias: l.diasSemPlano })}
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </td>
                                    <td className={`${px} ${resumido ? 'py-1.5' : 'py-2'}`}>
                                        <span className="flex items-center gap-3">
                                            <span className={`w-8 text-[15px] font-extrabold tabular-nums ${zerado ? 'text-[#B42318] dark:text-rose-300' : 'text-[#0F172A] dark:text-white'}`}>{dois(l.planos)}</span>
                                            {/* Mini barra: tamanho = planos da unidade ÷ maior unidade; cores = grupos (as bolinhas dos títulos Plus/Fit/Personal) */}
                                            <span className={`${resumido ? 'w-[64px]' : 'w-[120px]'} h-2 rounded-full bg-[#EEF1F6] overflow-hidden flex gap-px shrink-0 dark:bg-slate-800`} aria-hidden="true">
                                                <span className="h-full flex gap-px" style={{ width: `${(l.planos / maior) * 100}%` }}>
                                                    {gruposBase.filter(g => l.grupos[g.chave] > 0).map(g => (
                                                        <span key={g.chave} className="h-full" style={{ flex: l.grupos[g.chave], background: corGrupo(g) }}
                                                            title={`${g.rotulo}: ${l.grupos[g.chave]}`} />
                                                    ))}
                                                </span>
                                            </span>
                                            {/* Resumido: o "vs mês passado" fica ao lado (linha mais baixa) */}
                                            {resumido && (
                                                <span className="min-w-[88px]">
                                                    {carregandoAnterior ? <Loader2 className="w-3 h-3 animate-spin text-slate-400" /> : temComparativo ? <Variacao atual={l.planos} antes={l.anterior} titulo={tituloVariacao} /> : null}
                                                </span>
                                            )}
                                        </span>
                                        {!resumido && (
                                            <span className="block mt-0.5 min-h-[16px]">
                                                {carregandoAnterior ? <Loader2 className="w-3 h-3 animate-spin text-slate-400" /> : temComparativo ? <Variacao atual={l.planos} antes={l.anterior} titulo={tituloVariacao} /> : null}
                                            </span>
                                        )}
                                    </td>
                                    {tdNum(l.grupos.PLUS)}
                                    {!resumido && tdNum(l.grupos.FIT)}
                                    {!resumido && tdNum(l.grupos['PERSONAL CLASS'])}
                                    {!resumido && temOutros && tdNum(l.grupos['OUTROS PLANOS'])}
                                    <td className={td}>{l.nutri > 0 ? <span className="font-extrabold text-[#0B7A52] dark:text-emerald-400">{dois(l.nutri)}</span> : '—'}</td>
                                    <td className={td}><SeloProdutividade valor={l.produtividade} /></td>
                                    <td className={td}>
                                        <span className="inline-flex items-center gap-1.5">
                                            {dois(l.produtos)}
                                            {l.produtos > l.produtosValidos && (
                                                <span className="h-5 px-1.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black inline-flex items-center dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30">
                                                    {tx('{qtd} fora da meta', { qtd: l.produtos - l.produtosValidos })}
                                                </span>
                                            )}
                                        </span>
                                    </td>
                                    {!resumido && <td className={td}>{dois(l.servicos)}</td>}
                                    <td className={td}>{semMovimento || l.cancelamentos === null ? '—' : dois(l.cancelamentos)}</td>
                                    {resumido && celSaldo(VALOR_ORDEM.saldo(l))}
                                    <td className={td}>{celFaturamento(l.faturamento)}</td>
                                    <td className={td}>{l.ativos === null ? '—' : Number(l.ativos).toLocaleString(localeAtual())}</td>
                                    <td className={`${px} ${py} text-right`}>
                                        <span className="inline-flex w-8 h-8 rounded-lg border border-[#D6DCE8] items-center justify-center text-[#0F172A] dark:border-slate-700 dark:text-white" title={tx('Abrir o Dashboard da unidade')}>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    {linhas.length > 1 && (
                        <tfoot>
                            <tr className="bg-[#F8FAFD] border-t border-[#E4E8F0] dark:bg-slate-800/60 dark:border-slate-700">
                                <td className={`${px} py-2.5 text-[12px] font-black uppercase tracking-[0.07em] text-[#0F172A] dark:text-white`}>{tx('Rede')}</td>
                                <td className={`${px} py-2`}>
                                    <span className={resumido ? 'flex items-center gap-3' : 'block'}>
                                        <span className="text-[15px] font-extrabold text-[#0F172A] tabular-nums dark:text-white">{dois(totalPlanos)}</span>
                                        {temComparativo && !carregandoAnterior && <Variacao atual={totalPlanos} antes={soma('anterior')} titulo={tituloVariacao} />}
                                    </span>
                                </td>
                                {tdNum(somaGrupo('PLUS'))}
                                {!resumido && tdNum(somaGrupo('FIT'))}
                                {!resumido && tdNum(somaGrupo('PERSONAL CLASS'))}
                                {!resumido && temOutros && tdNum(somaGrupo('OUTROS PLANOS'))}
                                <td className={td}>{totalNutri > 0 ? dois(totalNutri) : '—'}</td>
                                <td className={td}><SeloProdutividade valor={produtividadeRede} /></td>
                                <td className={td}>{dois(soma('produtos'))}</td>
                                {!resumido && <td className={td}>{dois(soma('servicos'))}</td>}
                                <td className={td}>{semMovimento || !algum('cancelamentos') ? '—' : dois(soma('cancelamentos'))}</td>
                                {resumido && celSaldo(algum('cancelamentos') ? somaSaldo : null)}
                                <td className={td}>{!algum('faturamento') ? '—' : celFaturamento(soma('faturamento'))}</td>
                                <td className={td}>
                                    {ativosLancados === 0 ? '—' : (
                                        <span title={tx('{x} de {y} unidades lançaram', { x: ativosLancados, y: linhas.length })}>
                                            {soma('ativos').toLocaleString(localeAtual())}
                                            <span className="text-[11px] font-semibold text-[#5B6478] dark:text-slate-400"> · {ativosLancados}/{linhas.length}</span>
                                        </span>
                                    )}
                                </td>
                                <td />
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
            <p className="px-4 md:px-6 py-3 text-[11px] text-[#5B6478] dark:text-slate-400">
                {tx('Clique numa unidade para abrir o Dashboard dela. Clique no título de uma coluna para ordenar. As cores das unidades são as mesmas do Ritmo do mês.')}
            </p>
        </section>
    );
};

export default QuadroPlanosPorUnidade;
