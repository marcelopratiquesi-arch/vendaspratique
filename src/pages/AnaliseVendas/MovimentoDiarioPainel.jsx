// Movimentação da unidade na aba Metas (decisão do dono, 31/10/2026). Regras em movimentoDiario.js.
// MovimentacaoForm = parte de baixo do card verde "Movimentação" (acumulado do mês digitado);
// MovimentoDiarioPainel (padrão) = tabela por dia, com o valor do dia e o acumulado do mês.
import React, { useEffect, useMemo, useState } from 'react';
import { Save, Loader2, Check, Pencil, HelpCircle, AlertTriangle, ArrowDownRight, ArrowUpRight, Wallet, UserPlus, UserMinus } from 'lucide-react';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import { avisar } from '../../components/avisar.js';
import { useMovimentoDiario, salvarMovimentoDia, podeGravarMovimento, entradasAcumuladasAte, lerNumeroBR, numeroParaCampo, hojeIso } from './movimentoDiario.js';

const dinheiro = (v) => new Intl.NumberFormat(localeAtual(), { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const diaCurto = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
    .toLocaleDateString(localeAtual(), { weekday: 'short', day: '2-digit', month: '2-digit' });
const sinal = (n) => (n > 0 ? `+${n}` : `${n}`);

const Dica = ({ texto }) => (
    <span className="group/dica relative inline-flex align-middle">
        <button type="button" aria-label={texto} className="text-slate-400 hover:text-blue-600 focus:text-blue-600 outline-none dark:hover:text-blue-400"><HelpCircle className="w-3.5 h-3.5" /></button>
        <span role="tooltip" className="pointer-events-none absolute top-full mt-2 left-0 z-40 w-[min(280px,70vw)] hidden group-hover/dica:block group-focus-within/dica:block bg-slate-800 text-white text-[11px] font-semibold normal-case tracking-normal text-left leading-snug px-3 py-2 rounded-lg shadow-lg dark:bg-slate-700">{texto}</span>
    </span>
);

const rotulo = 'flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 dark:text-slate-400';

// Um quadradinho por número (mesmo modelo dos campos da Meta Mensal): ícone + nome + detalhe à esquerda, número grande à direita
// Mesmo tamanho dos campos da Meta Start / Meta Mensal (InputFieldWithSave): números text-sm font-black, caixa h-10
const caixaNumero = 'h-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 tabular-nums outline-none focus:bg-white focus:ring-4 focus:ring-emerald-500 disabled:text-slate-500 dark:bg-slate-800/60 dark:border-slate-800 dark:text-white dark:focus:bg-slate-900';
const LinhaMov = ({ icone: Icone, corIcone, rotulo, etiqueta, dica, detalhe, children }) => (
    <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl shadow-sm gap-3 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`p-2 rounded-xl bg-slate-50 border border-slate-100 shrink-0 dark:bg-slate-800/60 dark:border-slate-800 ${corIcone}`}><Icone className="w-5 h-5" /></div>
            <div className="flex flex-col min-w-0">
                <div className="flex flex-wrap items-center gap-1 text-[11px] font-black text-slate-800 uppercase tracking-widest dark:text-white">
                    {rotulo}{dica && <Dica texto={dica} />}
                    {etiqueta && <span className="text-[10px] font-bold text-slate-500 normal-case tracking-normal dark:text-slate-400">· {etiqueta}</span>}
                </div>
                {detalhe && <div>{detalhe}</div>}
            </div>
        </div>
        <div className="shrink-0">{children}</div>
    </div>
);

const AvisoSemTabela = () => (
    <p className="mb-3 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2.5 text-[12px] font-semibold dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        {tx('Falta criar a tabela no banco: rode o arquivo sql/2026-10-31-movimento-diario/1_tabela_movimento_diario.sql no SQL Editor do Supabase.')}
    </p>
);

// ---------- Formulário da movimentação (dentro do card "Movimentação") ----------
// Card de LANÇAR (não de pesquisar), decisão do dono 31/10/2026. Três opções, todas do dia 1º do mês até a data:
// "Este mês" (até hoje, padrão), "Ontem" (até ontem, para quem esqueceu) e "Escolher dia".
// O líder digita o ACUMULADO do mês até a data; o "+X" na frente do número = quanto somou desde o lançamento anterior.
const isoDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const somarDiasIso = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return isoDe(d); };
const centavos = (v) => Math.round(v * 100) / 100;

// "+X" na frente do número (mesmo tamanho do número, cor da linha)
const Mais = ({ valor, cor, formatar = (v) => v }) => (valor === null || valor === undefined || Number.isNaN(valor) ? null
    : <span className={`text-sm font-black tabular-nums whitespace-nowrap ${cor}`}>{valor >= 0 ? '+' : ''}{formatar(valor)}</span>);

export const MovimentacaoForm = ({ unidade, diaPedido, entradas, usuarioLogado, aoGravar }) => {
    const podeGravar = podeGravarMovimento(usuarioLogado);
    const hoje = hojeIso();
    const ontem = somarDiasIso(hoje, -1);
    const [modo, setModo] = useState('mes'); // 'mes' | 'ontem' | 'dia'
    const [diaEscolhido, setDiaEscolhido] = useState(ontem);
    // Lápis da tabela: abre o card naquele dia
    useEffect(() => { if (diaPedido?.dia) { setModo('dia'); setDiaEscolhido(diaPedido.dia); } }, [diaPedido]);
    const ate = modo === 'mes' ? hoje : modo === 'ontem' ? ontem : diaEscolhido;
    const inicioMes = `${ate.slice(0, 8)}01`;

    // Lê o mês até a data (para o já gravado e o lançamento anterior)
    const faixaMes = useMemo(() => ({ inicio: inicioMes, fim: ate }), [inicioMes, ate]);
    const { derivados, carregando, semTabela, recarregar } = useMovimentoDiario({ unidade, faixa: faixaMes });
    const doMes = derivados.filter(l => l.data >= inicioMes && l.data <= ate);
    const gravado = doMes.find(l => l.data === ate);
    const anterior = [...doMes].reverse().find(l => l.data < ate);

    const gravadoCanc = gravado && gravado.cancelamentosAcum !== null ? gravado.cancelamentosAcum : null;
    const gravadoFat = gravado && gravado.faturamentoAcum !== null ? centavos(gravado.faturamentoAcum) : null;
    const [cancelamentos, setCancelamentos] = useState('');
    const [faturamento, setFaturamento] = useState('');
    const [salvando, setSalvando] = useState(false);
    const [salvo, setSalvo] = useState(false);
    useEffect(() => {
        setCancelamentos(gravadoCanc ?? '');
        setFaturamento(numeroParaCampo(gravadoFat));
    }, [ate, gravadoCanc, gravadoFat]);

    const cancNum = lerNumeroBR(cancelamentos);
    const fatNum = lerNumeroBR(faturamento);
    const mudou = (cancNum ?? null) !== gravadoCanc || (fatNum ?? null) !== gravadoFat;
    const invalido = Number.isNaN(cancNum) || Number.isNaN(fatNum) || cancNum < 0 || fatNum < 0 || (cancNum !== null && !Number.isInteger(cancNum));

    const entradasMes = entradasAcumuladasAte(entradas, ate);
    const maisEntradas = entradas.get(ate) || 0;
    const maisCanc = cancNum === null || Number.isNaN(cancNum) ? null : cancNum - (anterior?.cancelamentosAcum ?? 0);
    const maisFat = fatNum === null || Number.isNaN(fatNum) ? null : centavos(fatNum - (anterior?.faturamentoAcum ?? 0));

    const salvar = async (e) => {
        e.preventDefault();
        if (!podeGravar || salvando || !mudou) return;
        if (invalido) return avisar(tx('Digite um número válido.'), 'erro');
        setSalvando(true);
        const erro = await salvarMovimentoDia({ unidade, data: ate, faturamento: fatNum, cancelamentos: cancNum, usuario: usuarioLogado });
        setSalvando(false);
        if (erro) {
            console.error('Movimentação: erro ao gravar', erro);
            avisar(tx('Não foi possível gravar a movimentação: {erro}', { erro: erro.message || erro.code || '' }), 'erro');
            return;
        }
        setSalvo(true); setTimeout(() => setSalvo(false), 1800);
        recarregar();
        aoGravar?.();
    };

    const botaoModo = (ativo) => `h-10 px-3 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-colors ${ativo ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'}`;

    return (
        <form id="movimentacao-form" onSubmit={salvar} className="space-y-3">
            {semTabela && <AvisoSemTabela />}
            <div>
                <p className={rotulo}>
                    {tx('Acumulado do mês até')}
                    <Dica texto={tx('Digite os números do dia 1º do mês até a data. "Este mês" = até hoje; "Ontem" = até ontem (para quem esqueceu de lançar); "Escolher dia" = até o dia escolhido. Pode gravar de novo: o número é trocado. O "+" na frente mostra quanto somou desde o lançamento anterior.')} />
                    {carregando && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setModo('mes')} className={botaoModo(modo === 'mes')}>{tx('Este mês')}</button>
                    <button type="button" onClick={() => setModo('ontem')} className={botaoModo(modo === 'ontem')}>{tx('Ontem')}</button>
                    {modo === 'dia' ? (
                        <input type="date" value={diaEscolhido} max={hoje} onChange={(e) => e.target.value && setDiaEscolhido(e.target.value)} aria-label={tx('Escolher dia')}
                            className="h-10 flex-1 min-w-[140px] px-3 rounded-xl border border-blue-600 bg-white text-[13px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white" />
                    ) : (
                        <button type="button" onClick={() => setModo('dia')} className={botaoModo(false)}>{tx('Escolher dia')}</button>
                    )}
                </div>
            </div>

            <LinhaMov icone={UserPlus} corIcone="text-emerald-600 dark:text-emerald-400" rotulo={tx('Entradas')} etiqueta={tx('automático')}
                dica={tx('Planos vendidos (igual ao Dashboard; o PRATIQUE NUTRI é adicional e não entra).')}>
                <div className="flex items-center gap-2">
                    <Mais valor={maisEntradas} cor="text-emerald-600 dark:text-emerald-400" />
                    <span className={`${caixaNumero} inline-flex items-center justify-center w-[72px] !text-emerald-700 dark:!text-emerald-400`}>{entradasMes}</span>
                </div>
            </LinhaMov>
            <LinhaMov icone={UserMinus} corIcone="text-rose-600 dark:text-rose-400" rotulo={tx('Cancelamentos')}>
                <div className="flex items-center gap-2">
                    <Mais valor={maisCanc} cor="text-rose-600 dark:text-rose-400" />
                    <input type="text" inputMode="numeric" aria-label={tx('Cancelamentos')} value={cancelamentos} onChange={(e) => setCancelamentos(e.target.value)} disabled={!podeGravar} placeholder="0" className={`${caixaNumero} w-[72px] text-center`} />
                </div>
            </LinhaMov>
            <LinhaMov icone={Wallet} corIcone="text-blue-600 dark:text-blue-400" rotulo={tx('Faturamento (R$)')}>
                <div className="flex items-center gap-2">
                    <Mais valor={maisFat} cor="text-blue-600 dark:text-blue-400" formatar={(v) => numeroParaCampo(v)} />
                    <input type="text" inputMode="decimal" aria-label={tx('Faturamento (R$)')} value={faturamento} onChange={(e) => setFaturamento(e.target.value)} disabled={!podeGravar} placeholder="0,00" className={`${caixaNumero} w-[120px] text-right px-3`} />
                </div>
            </LinhaMov>

            {podeGravar ? (
                <button type="submit" disabled={!mudou || salvando}
                    className={`w-full h-10 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${salvo ? 'bg-emerald-600 text-white' : mudou ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500'}`}>
                    {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : salvo ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {salvo ? tx('Gravado') : tx('Gravar movimentação')}
                </button>
            ) : <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tx('Só Líder, Mentor e Admin lançam a movimentação.')}</p>}
            {gravado?.atualizado_por && <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{tx('Última gravação: {nome}', { nome: gravado.atualizado_por })}</p>}
        </form>
    );
};

// ---------- Tabela por dia (obedece ao período do topo) ----------
const Celula = ({ dia, acum, cor, formatar = (v) => v }) => (
    <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
        <span className={`block text-[13px] font-bold ${cor}`}>{dia === null ? <span className="text-slate-400">—</span> : formatar(dia)}</span>
        {acum !== null && acum !== undefined && <span className="block text-[10px] font-semibold text-slate-400">{tx('acum. {valor}', { valor: formatar(acum) })}</span>}
    </td>
);

const MovimentoDiarioPainel = ({ unidade, faixa, movimento, entradas, podeEditar, aoEditarDia }) => {
    const { derivados, carregando, semTabela } = movimento;

    // Uma linha por dia do período (na visão de todas as unidades, soma as unidades)
    const porDia = useMemo(() => {
        const dentro = (d) => (!faixa?.inicio || d >= faixa.inicio) && (!faixa?.fim || d <= faixa.fim);
        const mapa = new Map();
        const linhaDe = (d) => mapa.get(d) || mapa.set(d, { dia: d, entradas: 0, cancDia: null, cancAcum: null, fatDia: null, fatAcum: null, diasCobertos: 1 }).get(d);
        entradas.forEach((qtd, d) => { if (dentro(d)) linhaDe(d).entradas += qtd; });
        derivados.forEach(l => {
            if (!dentro(l.data)) return;
            const r = linhaDe(l.data);
            const somar = (a, b) => (b === null ? a : (a || 0) + b);
            r.cancDia = somar(r.cancDia, l.cancelamentosDia); r.cancAcum = somar(r.cancAcum, l.cancelamentosAcum);
            r.fatDia = somar(r.fatDia, l.faturamentoDia); r.fatAcum = somar(r.fatAcum, l.faturamentoAcum);
            r.diasCobertos = Math.max(r.diasCobertos, l.diasCobertos || 1);
        });
        return [...mapa.values()].map(r => ({ ...r, entradasAcum: entradasAcumuladasAte(entradas, r.dia) })).sort((a, b) => b.dia.localeCompare(a.dia));
    }, [entradas, derivados, faixa]);
    const total = porDia.reduce((t, r) => ({ entradas: t.entradas + r.entradas, cancelamentos: t.cancelamentos + (r.cancDia || 0), faturamento: t.faturamento + (r.fatDia || 0) }), { entradas: 0, cancelamentos: 0, faturamento: 0 });

    return (
        <section className="bg-white rounded-[20px] border border-slate-200 p-5 md:p-6 mb-8 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3 className="text-[13px] font-black uppercase tracking-widest text-slate-800 flex items-center gap-1.5 dark:text-white">
                    {tx('Movimentação por dia')}
                    <Dica texto={tx('Valor de cada dia = acumulado do mês daquele dia menos o acumulado do lançamento anterior. Embaixo, em cinza, o acumulado do mês. Faturamento é o dinheiro que entrou — não é a comissão.')} />
                </h3>
                {carregando && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            </div>
            {semTabela && <AvisoSemTabela />}
            {!(unidade && unidade !== 'TODOS') && <p className="mb-3 text-[12px] font-semibold text-slate-500 dark:text-slate-400">{tx('Escolha uma unidade no seletor do topo para lançar a movimentação.')}</p>}

            <div className="min-w-0 overflow-auto custom-scrollbar max-h-[460px] border border-slate-100 rounded-xl dark:border-slate-800">
                {porDia.length === 0 ? (
                    <p className="text-center text-[13px] font-semibold text-slate-500 py-10 dark:text-slate-400">{tx('Nenhum movimento no período escolhido.')}</p>
                ) : (
                    <table className="w-full min-w-[560px] text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                            <tr>
                                {[['Dia', 'left'], ['Entradas', 'right'], ['Cancelamentos', 'right'], ['Saldo', 'right'], ['Faturamento', 'right'], ['', 'right']].map(([c, al], i) => (
                                    <th key={i} className={`px-2 py-2.5 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:text-slate-400 text-${al}`}>
                                        {c ? tx(c) : <span className="sr-only">{tx('Editar')}</span>}
                                        {c === 'Saldo' && <Dica texto={tx('Saldo = entradas − cancelamentos do dia.')} />}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {porDia.map(r => {
                                const saldo = r.entradas - (r.cancDia || 0);
                                return (
                                    <tr key={r.dia} className="border-b border-slate-50 dark:border-slate-800">
                                        <td className="px-2 py-2 whitespace-nowrap">
                                            <span className="block text-[13px] font-bold text-slate-800 capitalize dark:text-white">{diaCurto(r.dia)}</span>
                                            {r.diasCobertos > 1 && r.cancDia !== null && <span className="block text-[10px] font-semibold text-amber-600 dark:text-amber-400">{tx('soma de {qtd} dias', { qtd: r.diasCobertos })}</span>}
                                        </td>
                                        <Celula dia={r.entradas} acum={r.entradasAcum} cor="text-emerald-700 dark:text-emerald-400" />
                                        <Celula dia={r.cancDia} acum={r.cancAcum} cor="text-rose-700 dark:text-rose-300" />
                                        <td className={`px-2 py-2 text-[13px] font-black text-right tabular-nums ${saldo > 0 ? 'text-emerald-700 dark:text-emerald-400' : saldo < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-600 dark:text-slate-300'}`}>{sinal(saldo)}</td>
                                        <Celula dia={r.fatDia} acum={r.fatAcum} cor="text-slate-800 dark:text-white" formatar={dinheiro} />
                                        <td className="px-2 py-1.5 text-right">
                                            {podeEditar && (
                                                <button type="button" onClick={() => aoEditarDia(r.dia)} aria-label={tx('Editar o dia {dia}', { dia: diaCurto(r.dia) })}
                                                    className="w-9 h-9 rounded-lg border border-slate-200 text-slate-600 inline-flex items-center justify-center hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="sticky bottom-0 bg-slate-50 dark:bg-slate-800">
                                <td className="px-2 py-2.5 text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-white">{tx('Total do período')}</td>
                                <td className="px-2 py-2.5 text-[13px] font-black text-emerald-700 text-right tabular-nums dark:text-emerald-400"><ArrowUpRight className="w-3.5 h-3.5 inline mr-0.5" />{total.entradas}</td>
                                <td className="px-2 py-2.5 text-[13px] font-black text-rose-700 text-right tabular-nums dark:text-rose-300"><ArrowDownRight className="w-3.5 h-3.5 inline mr-0.5" />{total.cancelamentos}</td>
                                <td className="px-2 py-2.5 text-[13px] font-black text-slate-800 text-right tabular-nums dark:text-white">{sinal(total.entradas - total.cancelamentos)}</td>
                                <td className="px-2 py-2.5 text-[13px] font-black text-slate-800 text-right tabular-nums whitespace-nowrap dark:text-white"><Wallet className="w-3.5 h-3.5 inline mr-1 text-slate-500" />{dinheiro(total.faturamento)}</td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>
        </section>
    );
};

export default MovimentoDiarioPainel;
