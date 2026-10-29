import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { Globe, Loader2, AlertTriangle } from 'lucide-react';
import { FASES_EM_ATENDIMENTO, formatarDataHora, normalizarNome, normalizarStatus, ehRecepcao } from './utils';
import { tx, localeAtual } from '../../i18n/traduzir.js';

// ==========================================
// PAINEL DA REDE (só na Visão Global do seletor do topo)
// Uma linha por unidade: quem está usando o CRM e quem não está
// ==========================================

// Ações que contam como "uso de verdade" do CRM
const ACOES_DE_CONTATO = ['WhatsApp', 'Ligação', 'Observação', 'Mudança de Fase'];
const PAGINA = 1000;
const MAX_PAGINAS = 30;
const DIAS_PARA_ULTIMA_ACAO = 60;

const diasDesde = (data) => {
    if (!data) return null;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dia = new Date(data); dia.setHours(0, 0, 0, 0);
    return Math.round((hoje - dia) / 86400000);
};

// Usando: ação hoje ou ontem · Parado: 2 a 6 dias · Sem uso: 7 dias ou mais, ou nunca
const situacaoDeUso = (ultima) => {
    const dias = diasDesde(ultima);
    if (dias === null || dias >= 7) return { rotulo: 'Sem uso', ordem: 2, classe: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30', bolinha: 'bg-rose-500' };
    if (dias >= 2) return { rotulo: 'Parado', ordem: 1, classe: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30', bolinha: 'bg-amber-500' };
    return { rotulo: 'Usando', ordem: 0, classe: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30', bolinha: 'bg-emerald-500' };
};

// Busca em páginas de 1000 (limite do Supabase). Devolve também se bateu no teto.
const buscarPaginado = async (montarQuery) => {
    const todos = [];
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
        const { data, error } = await montarQuery().range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1);
        if (error) throw error;
        todos.push(...(data || []));
        if (!data || data.length < PAGINA) return { dados: todos, cortado: false };
    }
    return { dados: todos, cortado: true };
};

// O período vem do filtro padrão do topo do CRM: faixa = { inicio, fim } (fim não entra)
const PainelRedeCrm = ({ colaboradores = [], faixa = { inicio: null, fim: null }, rotuloPeriodo = '', versao, unidadeFoco, onFocarUnidade }) => {
    const [unidades, setUnidades] = useState([]);
    const [leadsAbertos, setLeadsAbertos] = useState([]);
    const [historico, setHistorico] = useState([]);
    // Contatos de aniversário e migração (tabela crm_contatos_feitos), que não passam pelo histórico do funil
    const [contatosFeitos, setContatosFeitos] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState(false);
    const [cortado, setCortado] = useState(false);

    const inicioIso = faixa.inicio ? faixa.inicio.toISOString() : '';
    const fimIso = faixa.fim ? faixa.fim.toISOString() : '';

    useEffect(() => {
        let cancelado = false;
        const buscar = async () => {
            setCarregando(true);
            setErro(false);
            try {
                // Desde quando buscar o histórico: o início do período, mas no mínimo 60 dias (para saber a última ação)
                const limiteUltima = new Date();
                limiteUltima.setDate(limiteUltima.getDate() - DIAS_PARA_ULTIMA_ACAO);
                const desde = inicioIso ? new Date(Math.min(new Date(inicioIso).getTime(), limiteUltima.getTime())) : null;

                const [resUnidades, resLeads, resHist] = await Promise.all([
                    supabase.from('unidades').select('*').order('nome', { ascending: true }),
                    // Só os contatos em aberto e só 4 colunas: leve e sem o limite de 90 dias do App
                    buscarPaginado(() => supabase.from('leads').select('id, unidade, status, puxado_em')
                        .not('status', 'in', '("Fechado","Arquivado")').order('id', { ascending: true })),
                    buscarPaginado(() => {
                        let q = supabase.from('historico_leads').select('id, lead_id, consultor, tipo_acao, observacao, data_registro')
                            .order('data_registro', { ascending: false });
                        if (desde) q = q.gte('data_registro', desde.toISOString());
                        return q;
                    })
                ]);
                // Busca à parte: se a tabela ainda não existir, o resto do painel continua funcionando
                let feitos = [];
                try {
                    const resFeitos = await buscarPaginado(() => {
                        let q = supabase.from('crm_contatos_feitos').select('id, unidade, criado_em').is('lead_id', null)
                            .order('criado_em', { ascending: false });
                        if (desde) q = q.gte('criado_em', desde.toISOString());
                        return q;
                    });
                    feitos = resFeitos.dados;
                } catch (erroFeitos) {
                    console.warn('Contatos feitos indisponíveis no Painel da Rede:', erroFeitos?.message || erroFeitos);
                }
                if (cancelado) return;
                setContatosFeitos(feitos);
                if (resUnidades.error) console.error('Erro ao buscar unidades:', resUnidades.error);
                setUnidades(resUnidades.data || []);
                setLeadsAbertos(resLeads.dados);
                setHistorico(resHist.dados);
                setCortado(resLeads.cortado || resHist.cortado);
            } catch (e) {
                if (cancelado) return;
                console.error('Erro ao montar o Painel da Rede do CRM:', e);
                setErro(true);
            }
            if (!cancelado) setCarregando(false);
        };
        // "versao" sobe no máximo 1 vez por minuto (ou no botão Atualizar), para não pesar o banco
        buscar();
        return () => { cancelado = true; };
    }, [inicioIso, versao]);

    const linhas = useMemo(() => {
        // Unidade de cada consultor (pelo cadastro da equipe) e de cada contato em aberto
        const unidadeDoConsultor = new Map();
        colaboradores.forEach(c => {
            const chave = normalizarNome(c.nome);
            if (chave && c.unidade && !unidadeDoConsultor.has(chave)) unidadeDoConsultor.set(chave, c.unidade);
        });
        const unidadeDoLead = new Map(leadsAbertos.map(l => [String(l.id), l.unidade]));

        const mapa = new Map();
        // A chave ignora acentos e maiúsculas: "SANTA INÊS" e "Santa Ines" viram a mesma linha.
        // O nome mostrado é o primeiro que aparecer (o do cadastro de unidades vem antes).
        const linhaDa = (nome) => {
            const chave = normalizarNome(nome);
            if (!chave) return null;
            if (!mapa.has(chave)) mapa.set(chave, { chave, unidade: String(nome).toUpperCase().trim(), recepcionistas: 0, base: 0, emAtendimento: 0, geladeira: 0, acoes: 0, fechadosIds: new Set(), ultima: null });
            return mapa.get(chave);
        };

        unidades.forEach(u => linhaDa(u.nome));
        colaboradores.filter(ehRecepcao).forEach(c => { const l = linhaDa(c.unidade); if (l) l.recepcionistas++; });

        leadsAbertos.forEach(lead => {
            const l = linhaDa(lead.unidade);
            if (!l) return;
            const status = normalizarStatus(lead.status);
            if (!lead.puxado_em) l.base++;
            else if (FASES_EM_ATENDIMENTO.includes(status)) l.emAtendimento++;
            if (status === 'Perdido') l.geladeira++;
        });

        const inicio = inicioIso ? new Date(inicioIso) : null;
        const fim = fimIso ? new Date(fimIso) : null;
        const noPeriodo = (data) => (!inicio || new Date(data) >= inicio) && (!fim || new Date(data) < fim);
        historico.forEach(h => {
            if (!ACOES_DE_CONTATO.includes(h.tipo_acao)) return;
            const nomeUnidade = unidadeDoConsultor.get(normalizarNome(h.consultor)) || unidadeDoLead.get(String(h.lead_id));
            const l = linhaDa(nomeUnidade);
            if (!l) return;
            if (!l.ultima || new Date(h.data_registro) > new Date(l.ultima)) l.ultima = h.data_registro;
            if (!noPeriodo(h.data_registro)) return;
            l.acoes++;
            // Cada contato conta uma vez só (ir e voltar de "Fechado" não vira 2 fechamentos)
            if (h.tipo_acao === 'Mudança de Fase' && String(h.observacao || '').includes('para "Fechado"')) l.fechadosIds.add(String(h.lead_id));
        });

        // Contatos de aniversário e migração também mostram que a unidade está usando o CRM
        contatosFeitos.forEach(f => {
            const l = linhaDa(f.unidade);
            if (!l) return;
            if (!l.ultima || new Date(f.criado_em) > new Date(l.ultima)) l.ultima = f.criado_em;
            if (!noPeriodo(f.criado_em)) return;
            l.acoes++;
        });

        return [...mapa.values()]
            .map(({ fechadosIds, ...l }) => ({ ...l, fechados: fechadosIds.size, situacao: situacaoDeUso(l.ultima) }))
            .sort((a, b) => a.situacao.ordem - b.situacao.ordem || b.acoes - a.acoes || a.unidade.localeCompare(b.unidade, 'pt-BR'));
    }, [unidades, colaboradores, leadsAbertos, historico, contatosFeitos, inicioIso, fimIso]);

    const resumo = useMemo(() => ({
        usando: linhas.filter(l => l.situacao.rotulo === 'Usando').length,
        parado: linhas.filter(l => l.situacao.rotulo === 'Parado').length,
        semUso: linhas.filter(l => l.situacao.rotulo === 'Sem uso').length
    }), [linhas]);

    const foco = unidadeFoco || '';
    const faixaCor = { 0: 'bg-emerald-500', 1: 'bg-amber-500', 2: 'bg-rose-500' };
    const ultimaTexto = (l) => {
        if (!l.ultima) return tx("Nada nos últimos {DIAS_PARA_ULTIMA_ACAO} dias", { DIAS_PARA_ULTIMA_ACAO: DIAS_PARA_ULTIMA_ACAO });
        const dias = diasDesde(l.ultima);
        return dias === 0 ? tx("hoje") : dias === 1 ? tx("ontem") : tx("há {dias} dias", { dias: dias });
    };

    return (
        <div className="space-y-4">
            {/* Resumo: quantas unidades usando, paradas e sem uso */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    {tx("Ações e fechados:")}{' '}<strong className="text-slate-700 dark:text-slate-200">{tx(rotuloPeriodo)}</strong>
                    {carregando && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30">{resumo.usando}{' '}{tx("usando")}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30">{resumo.parado}{' '}{tx("parado")}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30">{resumo.semUso}{' '}{tx("sem uso")}</span>
                </div>
            </div>

            {erro && (
                <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{' '}{tx("Não foi possível carregar o Painel da Rede. Tente recarregar a página.")}
                </div>
            )}
            {cortado && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{' '}{tx("Muitos registros: os números foram calculados com os primeiros")}{' '}{(PAGINA * MAX_PAGINAS).toLocaleString(localeAtual())}{' '}{tx("e podem estar abaixo da realidade. Escolha um período menor.")}
                </div>
            )}

            {/* Uma unidade por cartão: faixa colorida = situação de uso */}
            {linhas.length === 0 ? (
                <p className="text-center py-10 text-[10px] font-black uppercase tracking-widest text-slate-400">{carregando ? tx("Carregando...") : tx("Nenhuma unidade encontrada.")}</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {linhas.map(l => {
                        const ativa = foco === l.chave;
                        return (
                            <button
                                key={l.chave}
                                type="button"
                                onClick={() => onFocarUnidade(ativa ? null : { chave: l.chave, nome: l.unidade })}
                                title={ativa ? tx("Voltar a ver todas as unidades") : tx("Ver só a recepção desta unidade")}
                                className={`relative overflow-hidden text-left bg-white dark:bg-slate-900 border rounded-2xl pl-5 pr-4 py-4 shadow-sm hover:shadow-md transition-all ${ativa ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500/40'}`}
                            >
                                <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${faixaCor[l.situacao.ordem]}`} />
                                <div className="flex items-start justify-between gap-2">
                                    <p className={`text-sm font-black uppercase truncate ${ativa ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-white'}`}>{l.unidade}</p>
                                    <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${l.situacao.classe}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${l.situacao.bolinha}`}></span>{tx(l.situacao.rotulo)}
                                    </span>
                                </div>
                                <div className="flex items-end gap-4 mt-3">
                                    <div>
                                        <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">{l.acoes}</p>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{tx("Ações")}</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none">{l.fechados}</p>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{tx("Fechados")}</p>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-1 text-center">
                                    <div title={tx("Base aguardando")}><p className="text-xs font-black text-slate-600 dark:text-slate-300">{l.base}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide truncate">{tx("Base")}</p></div>
                                    <div title={tx("Em atendimento")}><p className="text-xs font-black text-blue-600 dark:text-blue-400">{l.emAtendimento}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide truncate">{tx("Atendimento")}</p></div>
                                    <div title={tx("Na Geladeira")}><p className="text-xs font-black text-cyan-600 dark:text-cyan-400">{l.geladeira}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide truncate">{tx("Geladeira")}</p></div>
                                </div>
                                <p className="mt-3 text-[10px] font-bold text-slate-400 flex items-center justify-between gap-2">
                                    <span>{l.recepcionistas > 0 ? tx("{qtd} recepcionista(s)", { qtd: l.recepcionistas }) : <span className="text-rose-500">{tx("Nenhuma recepcionista")}</span>}</span>
                                    <span title={l.ultima ? formatarDataHora(l.ultima) : ''}>{ultimaTexto(l)}</span>
                                </p>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default PainelRedeCrm;
