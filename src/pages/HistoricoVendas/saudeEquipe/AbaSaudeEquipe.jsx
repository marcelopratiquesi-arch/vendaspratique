// src/pages/HistoricoVendas/saudeEquipe/AbaSaudeEquipe.jsx
import React, { useMemo } from 'react';
import { HelpCircle, TrendingUp, TrendingDown, Minus, UserCheck, UserX, Clock, Loader2 } from 'lucide-react';
import { tx, localeAtual } from '../../../i18n/traduzir.js';
import { getCategoriaItem, decomporPlano, safeIsoDate } from '../../AnaliseVendas/utils.js';
import { contarPlanosDoCard, useVendasDaFaixa, paraIso } from '../../AnaliseVendas/comparativoMesAnterior.js';

// ==========================================
// HISTÓRICO → ABA "SAÚDE DA EQUIPE" (decisão do dono, 30/10/2026)
// Conteúdo que estava no Dashboard novo (PainelVendasTab), agora obedecendo a TODOS os filtros do Histórico:
// período, unidade, busca, Consultores, Planos, Produtos e Serviços.
// - Resumo do período × período anterior do mesmo tamanho (ex.: 7 dias × os 7 dias antes).
// - Desempenho da equipe (planos com a regra do card do Dashboard: repetido no mesmo dia conta 1 vez).
// - Ainda não venderam no período: Recepção/Saver ativos + quem vendeu na unidade nos últimos 30 dias.
// - Últimos planos vendidos (hora de Brasília). Vendas = quantidade de itens; comissão é extra (regra 5).
// ==========================================

const FUSO = 'America/Sao_Paulo';
const DIAS_EQUIPE_RECENTE = 30;
const DIAS_PARADO_ALERTA = 3;

const paraData = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
const somarDias = (iso, n) => { const d = paraData(iso); d.setDate(d.getDate() + n); return paraIso(d); };
const diasEntre = (a, b) => Math.round((paraData(b) - paraData(a)) / 86400000);
const numero = (v) => Number(v || 0).toLocaleString(localeAtual());
const formatarComissao = (v) => new Intl.NumberFormat(localeAtual(), { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const nomeCurto = (nome) => String(nome || '').split(' ')[0];
const nomeVendedor = (v) => (v.vendedor || '').toUpperCase().trim();
const comissaoDe = (v) => Number(v.comissao ?? v.valor) || 0;

const horaDaVenda = (v) => {
    if (!v.created_at) return safeIsoDate(v.data).split('-').reverse().join('/');
    const d = new Date(v.created_at);
    if (isNaN(d)) return '';
    return d.toLocaleString(localeAtual(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: FUSO });
};

const textoUltimaVenda = (dias) => {
    if (dias === null) return tx('sem venda em 90 dias');
    if (dias === 0) return tx('vendeu hoje');
    if (dias === 1) return tx('última venda ontem');
    return tx('última venda há {dias} dias', { dias });
};

// Período anterior do mesmo tamanho, logo antes do escolhido (fim cortado em hoje)
const faixaAnteriorMesmoTamanho = (faixa, hoje) => {
    if (!faixa?.inicio || !faixa?.fim || faixa.inicio > hoje) return null;
    const fim = faixa.fim > hoje ? hoje : faixa.fim;
    const n = diasEntre(faixa.inicio, fim) + 1;
    return { inicio: somarDias(faixa.inicio, -n), fim: somarDias(faixa.inicio, -1) };
};

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

const Variacao = ({ atual, antes }) => {
    let texto, sentido;
    if (antes > 0) {
        const v = (atual - antes) / antes;
        sentido = v > 0.005 ? 1 : v < -0.005 ? -1 : 0;
        texto = `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
    } else {
        sentido = atual > 0 ? 1 : 0;
        texto = atual > 0 ? tx('novo') : '—';
    }
    const Icone = sentido > 0 ? TrendingUp : sentido < 0 ? TrendingDown : Minus;
    const cor = sentido > 0 ? 'text-emerald-700 dark:text-emerald-400' : sentido < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400';
    return <span className={`inline-flex items-center gap-1 text-[11px] font-black tabular-nums ${cor}`}><Icone className="w-3.5 h-3.5" />{texto}</span>;
};

const Celula = ({ rotulo, dica, valor, children }) => (
    <div className="px-4 py-3 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1 dark:text-slate-400">{rotulo}{dica && <Dica texto={dica} alinhar="left" />}</p>
        <p className="mt-0.5 flex items-baseline flex-wrap gap-x-2">
            <span className="text-lg font-black text-slate-800 tabular-nums dark:text-white">{valor}</span>
            {children}
        </p>
    </div>
);

const Bloco = ({ titulo, icone: Icone, cor = 'text-slate-800 dark:text-white', dica, direita, children }) => (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 dark:border-slate-800">
            <h3 className={`text-[12px] font-black uppercase tracking-widest flex items-center gap-1.5 ${cor}`}>{Icone && <Icone className="w-4 h-4" />}{titulo}{dica && <Dica texto={dica} alinhar="left" />}</h3>
            {direita}
        </div>
        <div className="p-4">{children}</div>
    </div>
);

const Vazio = ({ texto }) => <p className="text-[12px] font-semibold text-slate-400 py-6 text-center">{texto}</p>;

const AbaSaudeEquipe = ({
    vendasFiltradas = [], data = [], faixa = null, unidade, colaboradores = [], catalogoGeral = [],
    passaNosFiltrosSemPeriodo, vendedoresOcultos = [], descricaoPeriodo,
}) => {
    const hoje = paraIso(new Date());
    const visaoRede = !unidade || unidade === 'TODOS';
    const unidadeUpper = String(unidade || '').toUpperCase();

    // Catálogo do Histórico → listas usadas pelas regras do Dashboard
    const { planos, produtos } = useMemo(() => ({
        planos: catalogoGeral.filter(c => String(c.tipo || '').toLowerCase() === 'plano'),
        produtos: catalogoGeral.filter(c => String(c.tipo || '').toLowerCase() !== 'plano'),
    }), [catalogoGeral]);

    // ---------- período anterior (mesmos filtros, menos o período) ----------
    const faixaAnterior = useMemo(() => faixaAnteriorMesmoTamanho(faixa, hoje), [faixa, hoje]);
    const { vendas: anterioresBrutas, carregando: carregandoAnterior } = useVendasDaFaixa(faixaAnterior, data, visaoRede ? 'TODOS' : unidade);
    const anteriores = useMemo(
        () => (passaNosFiltrosSemPeriodo ? anterioresBrutas.filter(passaNosFiltrosSemPeriodo) : anterioresBrutas),
        [anterioresBrutas, passaNosFiltrosSemPeriodo]
    );

    const dados = useMemo(() => {
        const resumo = (lista) => ({
            itens: lista.reduce((s, v) => s + (parseInt(v.quantidade) || 1), 0),
            comissao: lista.reduce((s, v) => s + comissaoDe(v), 0),
            consultores: new Set(lista.map(nomeVendedor).filter(Boolean)).size,
            planos: contarPlanosDoCard(lista, planos, produtos).total,
        });

        // Desempenho por consultor
        const porConsultor = {};
        const linha = (nome) => porConsultor[nome] || (porConsultor[nome] = { nome, itens: 0, planos: 0, nutri: 0, produtos: 0, servicos: 0, comissao: 0, unidades: new Set() });
        vendasFiltradas.forEach(v => {
            const r = linha(nomeVendedor(v) || tx('SEM CONSULTOR'));
            const q = parseInt(v.quantidade) || 1;
            r.itens += q;
            r.comissao += comissaoDe(v);
            if (v.unidade) r.unidades.add(v.unidade);
            const cat = getCategoriaItem((v.produto || '').toUpperCase(), planos, produtos);
            if (cat === 'PRODUTO') r.produtos += q;
            else if (cat === 'SERVICO') r.servicos += q;
        });
        const contagemPlanos = contarPlanosDoCard(vendasFiltradas, planos, produtos);
        contagemPlanos.contados.forEach(({ venda, qtd }) => {
            const r = linha(nomeVendedor(venda) || tx('SEM CONSULTOR'));
            r.planos += qtd;
            if (decomporPlano(venda.produto).nutri) r.nutri += qtd;
        });

        // Última venda de cada consultor (90 dias carregados, unidade do filtro)
        const ultimaVenda = {};
        data.forEach(v => {
            if (!visaoRede && String(v.unidade || '').toUpperCase() !== unidadeUpper) return;
            const nome = nomeVendedor(v);
            const dia = safeIsoDate(v.data || v.created_at);
            if (nome && dia && (!ultimaVenda[nome] || dia > ultimaVenda[nome])) ultimaVenda[nome] = dia;
        });
        const diasDesde = (nome) => (ultimaVenda[nome] ? diasEntre(ultimaVenda[nome], hoje) : null);

        const equipeLista = Object.values(porConsultor)
            .map(r => ({ ...r, dias: diasDesde(r.nome) }))
            .sort((a, b) => b.itens - a.itens || a.nome.localeCompare(b.nome));

        // Ainda não venderam no período (só com uma unidade escolhida)
        let naoVenderam = [];
        if (!visaoRede) {
            const ocultos = new Set(vendedoresOcultos);
            const equipe = new Set();
            colaboradores.forEach(c => {
                if (String(c.unidade || '').toUpperCase() !== unidadeUpper || c.ativo === false || !c.nome) return;
                const setor = String(c.role || c.setor || c.cargo || '').toUpperCase();
                if (setor.includes('SAVER') || setor.includes('RECEP')) equipe.add(c.nome.toUpperCase().trim());
            });
            const desligados = new Set(colaboradores.filter(c => c.ativo === false && c.nome).map(c => c.nome.toUpperCase().trim()));
            const corte = somarDias(hoje, -DIAS_EQUIPE_RECENTE);
            Object.entries(ultimaVenda).forEach(([nome, dia]) => { if (dia >= corte && !desligados.has(nome)) equipe.add(nome); });
            naoVenderam = [...equipe]
                .filter(n => !porConsultor[n] && !ocultos.has(n))
                .map(nome => ({ nome, dias: diasDesde(nome) }))
                .sort((a, b) => (b.dias ?? 9999) - (a.dias ?? 9999) || a.nome.localeCompare(b.nome));
        }

        const ultimosPlanos = [...contagemPlanos.contados]
            .sort((a, b) => String(b.venda.created_at || '').localeCompare(String(a.venda.created_at || '')) || (b.venda.id || 0) - (a.venda.id || 0))
            .slice(0, 10);

        return { atual: resumo(vendasFiltradas), antes: resumo(anteriores), equipeLista, naoVenderam, ultimosPlanos };
    }, [vendasFiltradas, anteriores, data, planos, produtos, visaoRede, unidadeUpper, colaboradores, vendedoresOcultos, hoje]);

    const comparar = !!faixaAnterior && !carregandoAnterior;
    const dataCurta = (iso) => iso.split('-').reverse().slice(0, 2).join('/');
    const legendaAnterior = faixaAnterior ? tx('Comparando com {ini} a {fim} (período anterior do mesmo tamanho).', { ini: dataCurta(faixaAnterior.inicio), fim: dataCurta(faixaAnterior.fim) }) : tx('Escolha um período com começo e fim para comparar com o período anterior.');
    const totalEquipe = dados.equipeLista.length + dados.naoVenderam.length;

    return (
        <div className="p-4 sm:p-6 space-y-4 bg-slate-50/50 dark:bg-slate-800/30">
            {/* ===== RESUMO DO PERÍODO ===== */}
            <div>
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:divide-slate-800">
                    <Celula rotulo={tx('Itens vendidos')} dica={tx('Quantidade de itens lançados no período e filtros escolhidos.')} valor={numero(dados.atual.itens)}>
                        {comparar && <Variacao atual={dados.atual.itens} antes={dados.antes.itens} />}
                    </Celula>
                    <Celula rotulo={tx('Planos')} dica={tx('Planos vendidos, com a regra do card do Dashboard: plano repetido no mesmo dia para a mesma matrícula conta uma vez só.')} valor={numero(dados.atual.planos)}>
                        {comparar && <Variacao atual={dados.atual.planos} antes={dados.antes.planos} />}
                    </Celula>
                    <Celula rotulo={tx('Comissão')} dica={tx('Soma das comissões do período (não é o preço dos planos).')} valor={formatarComissao(dados.atual.comissao)}>
                        {comparar && <Variacao atual={dados.atual.comissao} antes={dados.antes.comissao} />}
                    </Celula>
                    <Celula rotulo={tx('Consultores que venderam')} valor={visaoRede ? numero(dados.atual.consultores) : `${numero(dados.equipeLista.length)} / ${numero(totalEquipe)}`}>
                        {visaoRede && comparar && <Variacao atual={dados.atual.consultores} antes={dados.antes.consultores} />}
                    </Celula>
                </div>
                <p className="mt-1.5 px-1 text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                    {carregandoAnterior && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {descricaoPeriodo ? `${tx(descricaoPeriodo)} · ` : ''}{legendaAnterior}
                </p>
            </div>

            {/* ===== DESEMPENHO DA EQUIPE ===== */}
            <Bloco titulo={tx('Desempenho da equipe')} icone={UserCheck} cor="text-emerald-700 dark:text-emerald-400" dica={tx('Quem vendeu no período e filtros escolhidos. "Última venda" olha os últimos 90 dias, na unidade do filtro.')}>
                {dados.equipeLista.length === 0 ? <Vazio texto={tx('Nenhuma venda no período e filtros escolhidos.')} /> : (
                    <>
                        {/* Computador: tabela */}
                        <div className="hidden md:block overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-800/60">
                                    <tr>
                                        {[['Consultor', 'left'], ['Itens', 'right'], ['Planos', 'right'], ['Nutri', 'right'], ['Produtos', 'right'], ['Serviços', 'right'], ['Comissão', 'right'], ['Última venda', 'right']].map(([c, al]) => (
                                            <th key={c} className={`px-3 py-2.5 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap dark:border-slate-800 dark:text-slate-400 text-${al}`}>{tx(c)}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {dados.equipeLista.map(r => (
                                        <tr key={r.nome} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60">
                                            <td className="px-3 py-2.5 text-[12px] font-black text-slate-800 dark:text-white">
                                                {r.nome}
                                                {visaoRede && r.unidades.size > 0 && <span className="ml-1.5 text-[10px] font-bold text-slate-400">{[...r.unidades].join(', ')}</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-[12px] font-black text-slate-800 text-right tabular-nums dark:text-white">{numero(r.itens)}</td>
                                            <td className="px-3 py-2.5 text-[12px] font-bold text-slate-700 text-right tabular-nums dark:text-slate-200">{numero(r.planos)}</td>
                                            <td className="px-3 py-2.5 text-[12px] font-bold text-emerald-700 text-right tabular-nums dark:text-emerald-400">{numero(r.nutri)}</td>
                                            <td className="px-3 py-2.5 text-[12px] font-bold text-slate-700 text-right tabular-nums dark:text-slate-200">{numero(r.produtos)}</td>
                                            <td className="px-3 py-2.5 text-[12px] font-bold text-slate-700 text-right tabular-nums dark:text-slate-200">{numero(r.servicos)}</td>
                                            <td className="px-3 py-2.5 text-[12px] font-black text-emerald-700 text-right tabular-nums whitespace-nowrap dark:text-emerald-400">{formatarComissao(r.comissao)}</td>
                                            <td className="px-3 py-2.5 text-[11px] font-semibold text-slate-500 text-right whitespace-nowrap dark:text-slate-400">{textoUltimaVenda(r.dias)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Celular: um cartão por consultor */}
                        <ul className="md:hidden space-y-2">
                            {dados.equipeLista.map(r => (
                                <li key={r.nome} className="border border-slate-200 rounded-xl p-3 dark:border-slate-800">
                                    <p className="flex items-center justify-between gap-2">
                                        <span className="text-[12px] font-black text-slate-800 truncate dark:text-white">{r.nome}</span>
                                        <span className="text-[12px] font-black text-emerald-700 tabular-nums whitespace-nowrap dark:text-emerald-400">{formatarComissao(r.comissao)}</span>
                                    </p>
                                    <p className="mt-1 text-[11px] font-bold text-slate-600 tabular-nums dark:text-slate-300">
                                        {numero(r.itens)} {tx('itens')} · {numero(r.planos)} {tx('planos')} · {numero(r.nutri)} Nutri · {numero(r.produtos)} {tx('produtos')} · {numero(r.servicos)} {tx('serviços')}
                                    </p>
                                    <p className="mt-0.5 text-[11px] font-semibold text-slate-400">{textoUltimaVenda(r.dias)}{visaoRede && r.unidades.size > 0 ? ` · ${[...r.unidades].join(', ')}` : ''}</p>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </Bloco>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* ===== AINDA NÃO VENDERAM ===== */}
                <Bloco titulo={tx('Ainda não venderam no período')} icone={UserX} cor="text-rose-700 dark:text-rose-400" dica={tx('Recepção e Saver ativos da unidade, mais quem vendeu nela nos últimos 30 dias. Em vermelho, quem está há 3 dias ou mais sem vender.')}>
                    {visaoRede ? <Vazio texto={tx('Escolha uma unidade para ver quem ainda não vendeu.')} />
                        : dados.naoVenderam.length === 0 ? <Vazio texto={tx('Todos da equipe venderam no período.')} /> : (
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {dados.naoVenderam.map(r => {
                                    const alerta = r.dias === null || r.dias >= DIAS_PARADO_ALERTA;
                                    return (
                                        <li key={r.nome} className="py-2 flex items-center justify-between gap-2">
                                            <span className="text-[12px] font-black text-slate-800 truncate dark:text-white">{r.nome}</span>
                                            <span className={`text-[11px] font-bold whitespace-nowrap ${alerta ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>{textoUltimaVenda(r.dias)}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                </Bloco>

                {/* ===== ÚLTIMOS PLANOS ===== */}
                <Bloco titulo={tx('Últimos planos vendidos')} icone={Clock} cor="text-blue-700 dark:text-blue-400" dica={tx('Os 10 planos mais recentes do período e filtros escolhidos. Hora de Brasília.')}>
                    {dados.ultimosPlanos.length === 0 ? <Vazio texto={tx('Nenhum plano registrado neste filtro.')} /> : (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {dados.ultimosPlanos.map(({ venda, qtd }, i) => (
                                <li key={venda.id || i} className="py-2">
                                    <p className="flex items-center justify-between gap-2">
                                        <span className="text-[12px] font-black text-slate-800 truncate dark:text-white" title={venda.nome_aluno}>{venda.nome_aluno || '—'}</span>
                                        <span className="text-[11px] font-bold text-slate-400 tabular-nums whitespace-nowrap">{horaDaVenda(venda)}</span>
                                    </p>
                                    <p className="text-[11px] font-semibold text-slate-500 truncate dark:text-slate-400">
                                        {venda.produto}{qtd > 1 ? ` ×${qtd}` : ''} · {nomeCurto(venda.vendedor)}{visaoRede && venda.unidade ? ` · ${venda.unidade}` : ''}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                </Bloco>
            </div>
        </div>
    );
};

export default AbaSaudeEquipe;
