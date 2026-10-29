import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { Globe, Loader2, AlertTriangle, X } from 'lucide-react';
import { FASES_EM_ATENDIMENTO, formatarDataHora, normalizarNome, normalizarStatus, ehRecepcao } from './utils';

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

const PainelRedeCrm = ({ colaboradores = [], inicioPeriodo, nomePeriodo, versao, unidadeFoco, onFocarUnidade }) => {
    const [unidades, setUnidades] = useState([]);
    const [leadsAbertos, setLeadsAbertos] = useState([]);
    const [historico, setHistorico] = useState([]);
    // Contatos de aniversário e migração (tabela crm_contatos_feitos), que não passam pelo histórico do funil
    const [contatosFeitos, setContatosFeitos] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState(false);
    const [cortado, setCortado] = useState(false);

    const inicioIso = inicioPeriodo ? inicioPeriodo.toISOString() : '';

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
        historico.forEach(h => {
            if (!ACOES_DE_CONTATO.includes(h.tipo_acao)) return;
            const nomeUnidade = unidadeDoConsultor.get(normalizarNome(h.consultor)) || unidadeDoLead.get(String(h.lead_id));
            const l = linhaDa(nomeUnidade);
            if (!l) return;
            if (!l.ultima || new Date(h.data_registro) > new Date(l.ultima)) l.ultima = h.data_registro;
            if (inicio && new Date(h.data_registro) < inicio) return;
            l.acoes++;
            // Cada contato conta uma vez só (ir e voltar de "Fechado" não vira 2 fechamentos)
            if (h.tipo_acao === 'Mudança de Fase' && String(h.observacao || '').includes('para "Fechado"')) l.fechadosIds.add(String(h.lead_id));
        });

        // Contatos de aniversário e migração também mostram que a unidade está usando o CRM
        contatosFeitos.forEach(f => {
            const l = linhaDa(f.unidade);
            if (!l) return;
            if (!l.ultima || new Date(f.criado_em) > new Date(l.ultima)) l.ultima = f.criado_em;
            if (inicio && new Date(f.criado_em) < inicio) return;
            l.acoes++;
        });

        return [...mapa.values()]
            .map(({ fechadosIds, ...l }) => ({ ...l, fechados: fechadosIds.size, situacao: situacaoDeUso(l.ultima) }))
            .sort((a, b) => a.situacao.ordem - b.situacao.ordem || b.acoes - a.acoes || a.unidade.localeCompare(b.unidade, 'pt-BR'));
    }, [unidades, colaboradores, leadsAbertos, historico, contatosFeitos, inicioIso]);

    const resumo = useMemo(() => ({
        usando: linhas.filter(l => l.situacao.rotulo === 'Usando').length,
        parado: linhas.filter(l => l.situacao.rotulo === 'Parado').length,
        semUso: linhas.filter(l => l.situacao.rotulo === 'Sem uso').length
    }), [linhas]);

    const th = 'px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap';
    const td = 'px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 text-center';
    const foco = unidadeFoco || '';

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Painel da Rede — uso do CRM por unidade
                        {carregando && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                    </h3>
                    <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                        Ações e fechados: {nomePeriodo}. Clique numa unidade para ver só a recepção dela aqui embaixo.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30">{resumo.usando} usando</span>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30">{resumo.parado} parado</span>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30">{resumo.semUso} sem uso</span>
                    {foco && (
                        <button type="button" onClick={() => onFocarUnidade(null)} className="ml-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors">
                            <X className="w-3.5 h-3.5" /> Ver todas
                        </button>
                    )}
                </div>
            </div>

            {erro && (
                <div className="mx-5 mt-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> Não foi possível carregar o Painel da Rede. Tente recarregar a página.
                </div>
            )}
            {cortado && (
                <div className="mx-5 mt-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> Muitos registros: os números foram calculados com os primeiros {(PAGINA * MAX_PAGINAS).toLocaleString('pt-BR')} e podem estar abaixo da realidade. Escolha um período menor.
                </div>
            )}

            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-slate-50 dark:bg-slate-800/60">
                        <tr>
                            <th className={th}>Unidade</th>
                            <th className={th}>Situação</th>
                            <th className={`${th} text-center`}>Recepcionistas</th>
                            <th className={`${th} text-center`}>Ações</th>
                            <th className={`${th} text-center`}>Fechados</th>
                            <th className={`${th} text-center`}>Base aguardando</th>
                            <th className={`${th} text-center`}>Em atendimento</th>
                            <th className={`${th} text-center`}>Geladeira</th>
                            <th className={th}>Última ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {linhas.length === 0 ? (
                            <tr><td colSpan="9" className="text-center py-10 text-[10px] font-black uppercase tracking-widest text-slate-400">{carregando ? 'Carregando...' : 'Nenhuma unidade encontrada.'}</td></tr>
                        ) : linhas.map(l => {
                            const ativa = foco === l.chave;
                            const dias = diasDesde(l.ultima);
                            return (
                                <tr key={l.chave} onClick={() => onFocarUnidade(ativa ? null : { chave: l.chave, nome: l.unidade })} title={ativa ? 'Voltar a ver todas as unidades' : 'Ver só a recepção desta unidade'}
                                    className={`cursor-pointer transition-colors ${ativa ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}>
                                    <td className="px-4 py-3">
                                        <p className={`text-xs font-black uppercase ${ativa ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-white'}`}>{l.unidade}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${l.situacao.classe}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${l.situacao.bolinha}`}></span>{l.situacao.rotulo}
                                        </span>
                                    </td>
                                    <td className={td}>
                                        {l.recepcionistas > 0 ? l.recepcionistas : <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">Nenhuma</span>}
                                    </td>
                                    <td className={`${td} font-black text-slate-800 dark:text-white`}>{l.acoes}</td>
                                    <td className={`${td} text-emerald-600 dark:text-emerald-400 font-black`}>{l.fechados}</td>
                                    <td className={td}>{l.base}</td>
                                    <td className={`${td} text-blue-600 dark:text-blue-400`}>{l.emAtendimento}</td>
                                    <td className={`${td} text-cyan-600 dark:text-cyan-400`}>{l.geladeira}</td>
                                    <td className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                        {l.ultima
                                            ? <>{formatarDataHora(l.ultima)}<span className="block text-[10px] text-slate-400">{dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`}</span></>
                                            : `Nada nos últimos ${DIAS_PARA_ULTIMA_ACAO} dias`}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PainelRedeCrm;
