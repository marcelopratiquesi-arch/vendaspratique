import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { Users, Database, PhoneForwarded, PhoneOff, Snowflake, CheckCircle2, Activity, Loader2, AlertTriangle, Clock, ChevronDown, RefreshCw } from 'lucide-react';
import { STATUS_TOKENS, FASES_EM_ATENDIMENTO, formatarDataHora, mesmoNome, normalizarNome } from './utils';
import PainelRedeCrm from './PainelRedeCrm';

// ==========================================
// TELA DE ENTRADA DO CRM
// Cartões só da recepção + planilha de acompanhamento para Líder/Admin/Mentor
// ==========================================

const PERIODOS = [
    { val: 'hoje', label: 'Hoje' },
    { val: '7d', label: 'Últimos 7 dias' },
    { val: 'mes', label: 'Este mês' },
    { val: 'todo', label: 'Todo período' }
];

const inicioDoPeriodo = (periodo) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (periodo === 'hoje') return d;
    if (periodo === '7d') { d.setDate(d.getDate() - 6); return d; }
    if (periodo === 'mes') { d.setDate(1); return d; }
    return null;
};

// Ações que contam como "contato de verdade" (puxar fila e importar não contam)
const ACOES_DE_CONTATO = ['WhatsApp', 'Ligação', 'Observação', 'Mudança de Fase'];

// Teto de registros do histórico lidos de uma vez na planilha
const LIMITE_HISTORICO = 3000;

const moveuPara = (h, fase) => h.tipo_acao === 'Mudança de Fase' && String(h.observacao || '').includes(`para "${fase}"`);

const Kpi = ({ icone: Icone, titulo, valor, cor }) => (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${cor}`}>
            <Icone className="w-4 h-4" />
        </div>
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{titulo}</p>
        <p className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{valor}</p>
    </div>
);

const PainelInicialCrm = ({ usuarioLogado, recepcionistas: recepcionistasTodas = [], leads: leadsTodos = [], colaboradores = [], versao = 0, onAtualizar, onEscolher }) => {
    const [periodo, setPeriodo] = useState('hoje');
    const [historico, setHistorico] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [erroHistorico, setErroHistorico] = useState(false);
    const [filtroPessoa, setFiltroPessoa] = useState('');
    const [limiteLista, setLimiteLista] = useState(30);
    // Unidade clicada no Painel da Rede (só na Visão Global): cartões e planilha mostram só ela.
    // Guarda { chave, nome }: a chave ignora acentos e maiúsculas ("SANTA INÊS" = "Santa Ines").
    const [unidadeFoco, setUnidadeFoco] = useState(null);
    const chaveFoco = unidadeFoco?.chave || '';

    const visaoGlobal = !usuarioLogado?.unidade || usuarioLogado.unidade === 'TODAS';
    const ehRecepcaoLogada = String(usuarioLogado?.role || '').toUpperCase() === 'RECEPCAO';
    // Todos os perfis veem o andamento da recepção (decisão do dono). A Recepção vê sempre só a própria unidade.
    const mostrarPainel = true;
    // O Painel da Rede (uso por unidade) é só para Admin/Mentor na Visão Global
    const mostrarPainelRede = visaoGlobal && !ehRecepcaoLogada;

    const recepcionistas = useMemo(() => (
        chaveFoco ? recepcionistasTodas.filter(r => normalizarNome(r.unidade) === chaveFoco) : recepcionistasTodas
    ), [recepcionistasTodas, chaveFoco]);
    const leads = useMemo(() => (
        chaveFoco ? leadsTodos.filter(l => normalizarNome(l.unidade) === chaveFoco) : leadsTodos
    ), [leadsTodos, chaveFoco]);
    const nomesChave = recepcionistas.map(r => r.nome).sort().join('|');

    // Histórico real gravado no banco (mesmo número em qualquer computador)
    useEffect(() => {
        if (!mostrarPainel) return;
        const nomes = nomesChave ? nomesChave.split('|') : [];
        if (nomes.length === 0) { setHistorico([]); return; }
        let cancelado = false;
        const buscar = async () => {
            setCarregando(true);
            setErroHistorico(false);
            let query = supabase.from('historico_leads').select('*').in('consultor', nomes).order('data_registro', { ascending: false }).limit(LIMITE_HISTORICO);
            const inicio = inicioDoPeriodo(periodo);
            if (inicio) query = query.gte('data_registro', inicio.toISOString());
            const { data, error } = await query;
            if (cancelado) return;
            if (error) { console.error('Erro ao buscar histórico do CRM:', error); setErroHistorico(true); setHistorico([]); }
            else setHistorico(data || []);
            setCarregando(false);
        };
        buscar();
        return () => { cancelado = true; };
    }, [periodo, nomesChave, mostrarPainel, versao]);

    useEffect(() => { setLimiteLista(30); }, [periodo, filtroPessoa]);
    useEffect(() => { setFiltroPessoa(''); }, [chaveFoco]);

    const leadPorId = useMemo(() => {
        const m = new Map();
        leads.forEach(l => m.set(String(l.id), l));
        return m;
    }, [leads]);

    // Linha da planilha de cada recepcionista
    const linhas = useMemo(() => {
        const inicio = inicioDoPeriodo(periodo);
        return recepcionistas.map(r => {
            const acoes = historico.filter(h => mesmoNome(h.consultor, r.nome));
            const contatos = acoes.filter(h => ACOES_DE_CONTATO.includes(h.tipo_acao));
            const idsTrabalhados = new Set(contatos.map(h => String(h.lead_id)));

            let visitantes = 0, cancelados = 0;
            idsTrabalhados.forEach(id => {
                const lead = leadPorId.get(id);
                if (lead?.tipo_lead === 'VISITANTE') visitantes++;
                else if (lead?.tipo_lead === 'CANCELADO/INATIVO') cancelados++;
            });

            const daPessoa = leads.filter(l => mesmoNome(l.puxado_por, r.nome));
            const carteira = daPessoa.filter(l => FASES_EM_ATENDIMENTO.includes(l.status));
            const puxados = daPessoa.filter(l => l.puxado_em && (!inicio || new Date(l.puxado_em) >= inicio)).length;

            return {
                colaborador: r,
                puxados,
                visitantes,
                cancelados,
                whatsapp: acoes.filter(h => h.tipo_acao === 'WhatsApp').length,
                ligacoes: acoes.filter(h => h.tipo_acao === 'Ligação').length,
                notas: acoes.filter(h => h.tipo_acao === 'Observação').length,
                // Conta cada contato uma vez só (ir e voltar de "Fechado" não vira 2 fechamentos)
                fechados: new Set(acoes.filter(h => moveuPara(h, 'Fechado')).map(h => String(h.lead_id))).size,
                perdidos: new Set(acoes.filter(h => moveuPara(h, 'Perdido')).map(h => String(h.lead_id))).size,
                acoes: contatos.length,
                emAtendimento: carteira.length,
                semContato: carteira.filter(l => !idsTrabalhados.has(String(l.id))).length,
                ultima: acoes[0]?.data_registro || null
            };
        });
    }, [recepcionistas, historico, leads, leadPorId, periodo]);

    const linhaDe = (r) => linhas.find(l => l.colaborador.id === r.id);

    const kpis = useMemo(() => ({
        base: leads.filter(v => !v.puxado_em && v.status !== 'Arquivado').length,
        emAtendimento: leads.filter(v => v.puxado_em && FASES_EM_ATENDIMENTO.includes(v.status)).length,
        semContato: linhas.reduce((s, l) => s + l.semContato, 0),
        geladeira: leads.filter(v => v.status === 'Perdido').length,
        fechados: linhas.reduce((s, l) => s + l.fechados, 0),
        acoes: linhas.reduce((s, l) => s + l.acoes, 0)
    }), [leads, linhas]);

    const acontecimentos = useMemo(() => (
        filtroPessoa ? historico.filter(h => normalizarNome(h.consultor) === filtroPessoa) : historico
    ), [historico, filtroPessoa]);

    const ehLider = !ehRecepcaoLogada;
    const nomeUnidade = unidadeFoco?.nome || (visaoGlobal ? 'Todas as unidades' : usuarioLogado?.unidade);
    const historicoNoLimite = historico.length >= LIMITE_HISTORICO;
    const th = 'px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap';
    const td = 'px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 text-center';

    return (
        <div className="space-y-8 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto px-1">

            {/* CABEÇALHO */}
            <div className="flex flex-col items-center text-center pt-4">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-4 border border-blue-200 dark:border-blue-500/30">
                    <Users className="w-8 h-8" />
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                    {ehLider ? 'CRM da Recepção' : 'Quem está operando o CRM?'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
                    {ehLider ? 'Clique num cartão da recepção para ver o Kanban e a Lista daquela pessoa.' : 'Selecione seu nome para iniciar o turno. Embaixo está o andamento da recepção.'}
                </p>
                <span className="mt-3 text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 px-3 py-1 rounded-lg">
                    {nomeUnidade}
                </span>
            </div>

            {/* PAINEL DA REDE: uso do CRM por unidade (Visão Global) */}
            {mostrarPainelRede && (
                <PainelRedeCrm
                    colaboradores={colaboradores}
                    inicioPeriodo={inicioDoPeriodo(periodo)}
                    nomePeriodo={(PERIODOS.find(p => p.val === periodo)?.label || '').toLowerCase()}
                    versao={versao}
                    unidadeFoco={chaveFoco}
                    onFocarUnidade={setUnidadeFoco}
                />
            )}

            {/* CARTÕES DA RECEPÇÃO */}
            {recepcionistas.length === 0 ? (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-6 rounded-2xl text-center max-w-lg mx-auto">
                    <p className="text-amber-700 dark:text-amber-300 font-bold text-sm">Nenhuma recepcionista cadastrada {visaoGlobal && !chaveFoco ? 'na rede' : 'nesta unidade'}.</p>
                    <p className="text-amber-600/80 dark:text-amber-400/80 text-xs font-medium mt-1">Cadastre em Cadastro Geral → Equipe, com o setor Recepção.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {recepcionistas.map(c => {
                        const l = linhaDe(c);
                        const partes = String(c.nome || '').split(' ');
                        return (
                            <button key={c.id} type="button" onClick={() => onEscolher(c)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg hover:-translate-y-1 transition-all group flex flex-col items-center gap-3 text-center">
                                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 group-hover:bg-blue-600 group-hover:text-white rounded-full flex items-center justify-center font-black text-lg transition-colors">
                                    {partes[0]?.charAt(0)}
                                </div>
                                <div>
                                    <span className="font-black text-slate-700 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 block leading-tight uppercase">{partes[0]}</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 block">{partes.slice(1).join(' ')}</span>
                                    {visaoGlobal && c.unidade && (
                                        <span className="inline-block mt-1.5 px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">{c.unidade}</span>
                                    )}
                                </div>
                                {mostrarPainel && l && (
                                    <div className="w-full pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-1">
                                        <div><p className="text-base font-black text-blue-600 dark:text-blue-400">{l.emAtendimento}</p><p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Carteira</p></div>
                                        <div><p className="text-base font-black text-slate-700 dark:text-slate-200">{l.acoes}</p><p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Ações</p></div>
                                        <div><p className="text-base font-black text-emerald-600 dark:text-emerald-400">{l.fechados}</p><p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Fechou</p></div>
                                        <p className="col-span-3 text-[9px] font-bold text-slate-400 mt-1 truncate">
                                            {l.ultima ? `Última: ${formatarDataHora(l.ultima)}` : 'Sem ação no período'}
                                        </p>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* PAINEL DE ANDAMENTO (Líder / Admin / Mentor) */}
            {mostrarPainel && (
                <div className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-6">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Andamento da Recepção
                            {carregando && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                        {onAtualizar && (
                            <button type="button" onClick={onAtualizar} disabled={carregando} title="Buscar os números mais novos agora (sozinho, o painel atualiza no máximo 1 vez por minuto)" className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                                <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
                            </button>
                        )}
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
                            {PERIODOS.map(p => (
                                <button key={p.val} type="button" onClick={() => setPeriodo(p.val)} className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${periodo === p.val ? 'bg-white dark:bg-slate-900 shadow-sm text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        </div>
                    </div>

                    {erroHistorico && (
                        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" /> Não foi possível carregar o histórico de contatos. Os números de ações podem aparecer zerados.
                        </div>
                    )}

                    {historicoNoLimite && (
                        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" /> Muitas ações no período: a planilha leu só as {LIMITE_HISTORICO.toLocaleString('pt-BR')} mais recentes, então os números podem estar abaixo da realidade. Escolha um período menor{visaoGlobal && !chaveFoco ? ' ou clique numa unidade no Painel da Rede' : ''}.
                        </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                        <Kpi icone={Database} titulo="Base aguardando" valor={kpis.base} cor="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300" />
                        <Kpi icone={PhoneForwarded} titulo="Em atendimento" valor={kpis.emAtendimento} cor="bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400" />
                        <Kpi icone={PhoneOff} titulo="Carteira sem contato" valor={kpis.semContato} cor="bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400" />
                        <Kpi icone={Snowflake} titulo="Na Geladeira" valor={kpis.geladeira} cor="bg-cyan-50 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400" />
                        <Kpi icone={CheckCircle2} titulo="Fechados no período" valor={kpis.fechados} cor="bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" />
                        <Kpi icone={Activity} titulo="Ações no período" valor={kpis.acoes} cor="bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400" />
                    </div>

                    {/* PLANILHA POR RECEPCIONISTA */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Planilha por recepcionista</h4>
                            <p className="text-[10px] font-medium text-slate-400 mt-0.5">"Sem contato" = contatos na carteira da pessoa em que nada foi feito no período.</p>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-max">
                                <thead className="bg-slate-50 dark:bg-slate-800/60">
                                    <tr>
                                        <th className={th}>Recepcionista</th>
                                        <th className={`${th} text-center`}>Puxados</th>
                                        <th className={`${th} text-center`}>Visitantes trabalhados</th>
                                        <th className={`${th} text-center`}>Cancelados trabalhados</th>
                                        <th className={`${th} text-center`}>WhatsApp</th>
                                        <th className={`${th} text-center`}>Ligações</th>
                                        <th className={`${th} text-center`}>Notas</th>
                                        <th className={`${th} text-center`}>Fechados</th>
                                        <th className={`${th} text-center`}>Perdidos</th>
                                        <th className={`${th} text-center`}>Sem contato</th>
                                        <th className={th}>Última ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {linhas.length === 0 ? (
                                        <tr><td colSpan="11" className="text-center py-10 text-[10px] font-black uppercase tracking-widest text-slate-400">Nenhuma recepcionista para mostrar.</td></tr>
                                    ) : linhas.map(l => (
                                        <tr key={l.colaborador.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors" onClick={() => onEscolher(l.colaborador)} title="Abrir o Kanban e a Lista desta pessoa">
                                            <td className="px-4 py-3">
                                                <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{l.colaborador.nome}</p>
                                                {visaoGlobal && l.colaborador.unidade && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{l.colaborador.unidade}</p>}
                                            </td>
                                            <td className={td}>{l.puxados}</td>
                                            <td className={td}>{l.visitantes}</td>
                                            <td className={td}>{l.cancelados}</td>
                                            <td className={td}>{l.whatsapp}</td>
                                            <td className={td}>{l.ligacoes}</td>
                                            <td className={td}>{l.notas}</td>
                                            <td className={`${td} text-emerald-600 dark:text-emerald-400 font-black`}>{l.fechados}</td>
                                            <td className={`${td} text-rose-500 dark:text-rose-400`}>{l.perdidos}</td>
                                            <td className={td}>
                                                <span className={`px-2 py-0.5 rounded-md font-black ${l.semContato > 0 ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'text-slate-400'}`}>{l.semContato}</span>
                                            </td>
                                            <td className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">{l.ultima ? formatarDataHora(l.ultima) : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* O QUE ACONTECEU */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" /> O que aconteceu
                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">{acontecimentos.length}</span>
                            </h4>
                            <select value={filtroPessoa} onChange={(e) => setFiltroPessoa(e.target.value)} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 outline-none cursor-pointer">
                                <option value="">Todas as recepcionistas</option>
                                {recepcionistas.map(r => <option key={r.id} value={normalizarNome(r.nome)}>{r.nome}</option>)}
                            </select>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-max">
                                <thead className="bg-slate-50 dark:bg-slate-800/60">
                                    <tr>
                                        <th className={th}>Quando</th>
                                        <th className={th}>Recepcionista</th>
                                        <th className={th}>Ação</th>
                                        <th className={th}>Contato</th>
                                        <th className={th}>Tipo</th>
                                        <th className={th}>Fase atual</th>
                                        <th className={th}>Detalhe</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {acontecimentos.length === 0 ? (
                                        <tr><td colSpan="7" className="text-center py-10 text-[10px] font-black uppercase tracking-widest text-slate-400">{carregando ? 'Carregando...' : 'Nada registrado no período.'}</td></tr>
                                    ) : acontecimentos.slice(0, limiteLista).map(h => {
                                        const lead = leadPorId.get(String(h.lead_id));
                                        const token = lead ? STATUS_TOKENS[lead.status] : null;
                                        return (
                                            <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                                <td className="px-4 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatarDataHora(h.data_registro || h.created_at)}</td>
                                                <td className="px-4 py-2.5 text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase whitespace-nowrap">{String(h.consultor || '').split(' ')[0]}</td>
                                                <td className="px-4 py-2.5"><span className="text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded">{h.tipo_acao}</span></td>
                                                <td className="px-4 py-2.5 text-[11px] font-bold text-slate-800 dark:text-white uppercase whitespace-nowrap">{lead?.nome || <span className="text-slate-400 normal-case font-medium">Contato fora da lista atual</span>}</td>
                                                <td className="px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{lead?.tipo_lead || '—'}</td>
                                                <td className="px-4 py-2.5">
                                                    {lead ? <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${token?.bg || ''} ${token?.text || 'text-slate-500'} ${token?.border || 'border-slate-200'}`}>{lead.status}</span> : <span className="text-slate-400">—</span>}
                                                </td>
                                                <td className="px-4 py-2.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 max-w-[320px] truncate" title={h.observacao}>{h.observacao}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {acontecimentos.length > limiteLista && (
                            <button type="button" onClick={() => setLimiteLista(n => n + 30)} className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1.5 transition-colors">
                                <ChevronDown className="w-4 h-4" /> Ver mais ({acontecimentos.length - limiteLista} restantes)
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PainelInicialCrm;
