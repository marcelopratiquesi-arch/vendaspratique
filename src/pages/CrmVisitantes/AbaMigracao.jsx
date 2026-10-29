import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Repeat, Search, X, MessageCircle, Check, Ban, Loader2, Star, AlertTriangle, ChevronDown, ArrowRightCircle, Undo2 } from 'lucide-react';
import { planoTemNutri } from '../AnaliseVendas/utils.js';
import { preencherMensagem, MENSAGENS_PADRAO, linkWhatsApp, contatoCombinaComBusca, dataLocalISO, diaISO, mesmoNome, normalizarNome, marcaFeitoPor } from './utils';
import {
    carregarUltimoPlanoAlunos, carregarAndamentoMigracao, salvarAndamentoMigracao, puxarParaFilaMigracao,
    devolverDaFilaMigracao, carregarMensagensProntas, registrarContatoFeito, carregarMigracaoContatadosHoje, estaNaoContatar
} from './contatosFeitos';
import { JanelaNaoContatar, JanelaJustificativa } from './JanelasContato';
import FichaAlunoPopup from './FichaAlunoPopup';

// ==========================================
// ABA MIGRAÇÃO
// Alunos da unidade cujo ÚLTIMO PLANO comprado no sistema NÃO tem nutricionista.
// Regra do NUTRI: planoTemNutri (a mesma função do painel de vendas, em AnaliseVendas/utils.js).
// REAVALIAÇÃO e FÉRIAS não contam como "último plano" (a consulta do banco já ignora).
//
// FILA DE TRABALHO (igual à Base): a recepcionista PUXA alunos (plano + quantidade, os que compraram mais
// recentemente primeiro) para a "Minha fila". Quem está na fila de alguém sai dos "Disponíveis".
// Volta sozinho para os Disponíveis (calculado na hora, sem rotina no banco):
//   - puxado e NÃO contatado há 7 dias ou mais;
//   - puxado e NÃO contatado por recepcionista desligada (ativo = false no Cadastro Geral);
//   - "Devolver" (sem dono).
// Andamento: Não contatado → Contatado → Interessado → Migrou (Migrou é automático: venda de plano com
// NUTRI depois que o aluno entrou no andamento).
// Um contato de Migração por aluno por dia: repetir o WhatsApp abre a conversa, mas não soma de novo.
// ==========================================

const ANDAMENTOS = {
    NAO_CONTATADO: { rotulo: 'Não contatado', classe: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700' },
    CONTATADO: { rotulo: 'Contatado', classe: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30' },
    INTERESSADO: { rotulo: 'Interessado', classe: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30' },
    MIGROU: { rotulo: 'Migrou', classe: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30' }
};
const FILTROS_ANDAMENTO = [
    { val: 'PENDENTES', label: 'Pendentes' },
    { val: 'NAO_CONTATADO', label: 'Não contatado' },
    { val: 'CONTATADO', label: 'Contatado' },
    { val: 'INTERESSADO', label: 'Interessado' },
    { val: 'MIGROU', label: 'Migrou' },
    { val: 'TODOS', label: 'Todos' }
];
const VISOES = [
    { val: 'FILA', label: 'Minha fila' },
    { val: 'DISPONIVEIS', label: 'Disponíveis' },
    { val: 'TODOS', label: 'Todos' }
];
const QUANTIDADES_PUXAR = [10, 15, 20, 50];
const DIAS_PARA_DEVOLVER = 7;
const POR_PAGINA = 50;

const AbaMigracao = ({ unidade, operador, usuarioLogado, colaboradores = [], naoContatar = new Set(), onNaoContatar, onContatoFeito }) => {
    const [alunos, setAlunos] = useState(null);
    const [andamento, setAndamento] = useState(new Map());
    const [mensagem, setMensagem] = useState(MENSAGENS_PADRAO.MIGRACAO);
    const [carregando, setCarregando] = useState(true);
    const [indisponivel, setIndisponivel] = useState(false);
    const [visao, setVisao] = useState('FILA');
    const [filtroAndamento, setFiltroAndamento] = useState('PENDENTES');
    const [filtroPlano, setFiltroPlano] = useState('');
    const [busca, setBusca] = useState('');
    const [limite, setLimite] = useState(POR_PAGINA);
    const [planoPuxar, setPlanoPuxar] = useState('');
    const [qtdPuxar, setQtdPuxar] = useState(10);
    const [puxando, setPuxando] = useState(false);
    const [salvando, setSalvando] = useState('');
    const [contatoFicha, setContatoFicha] = useState(null);
    const [justificando, setJustificando] = useState(null);
    const [bloqueando, setBloqueando] = useState(null);
    const [contatadosHoje, setContatadosHoje] = useState(new Set());

    const unidadeChave = String(unidade || '').toUpperCase().trim();

    // Nomes de quem foi desligado (ativo = false): a fila não contatada dessas pessoas volta para os Disponíveis
    const desligadas = useMemo(() => new Set(colaboradores.filter(c => c.ativo === false).map(c => normalizarNome(c.nome))), [colaboradores]);

    const carregar = useCallback(async () => {
        if (!unidadeChave) return;
        setCarregando(true);
        const [lista, mapa, msgs, hoje] = await Promise.all([carregarUltimoPlanoAlunos(unidadeChave), carregarAndamentoMigracao(), carregarMensagensProntas(), carregarMigracaoContatadosHoje()]);
        setContatadosHoje(hoje);
        setIndisponivel(lista === null || mapa === null);
        setAlunos(lista || []);
        setAndamento(mapa || new Map());
        setMensagem(msgs.MIGRACAO);
        setCarregando(false);
    }, [unidadeChave]);

    useEffect(() => { carregar(); }, [carregar]);
    useEffect(() => { setLimite(POR_PAGINA); }, [visao, filtroAndamento, filtroPlano, busca]);

    // Monta cada aluno com: situação (andamento), dono da fila e se está disponível para puxar
    const linhas = useMemo(() => {
        const limiteFila = new Date();
        limiteFila.setDate(limiteFila.getDate() - DIAS_PARA_DEVOLVER);
        return (alunos || [])
            .filter(a => !estaNaoContatar(naoContatar, { cpf: a.cpf, alunoId: a.aluno_id }))
            .map(a => {
                const registro = andamento.get(a.aluno_id);
                let situacao;
                if (planoTemNutri(a.ultimo_plano)) {
                    // Só aparece como "Migrou" quem entrou no andamento e depois comprou plano com NUTRI
                    if (!registro || !a.data_compra || String(a.data_compra) < dataLocalISO(registro.criado_em || registro.atualizado_em)) return null;
                    situacao = 'MIGROU';
                } else {
                    situacao = !registro || registro.status === 'NA_FILA' ? 'NAO_CONTATADO' : registro.status;
                }
                // Puxado e ainda não contatado: devolve se passou de 7 dias, se a dona foi desligada ou se não tem dono
                const naFilaSemContato = registro?.status === 'NA_FILA';
                const filaVencida = naFilaSemContato && (
                    !registro.puxado_por
                    || (registro.puxado_em && new Date(registro.puxado_em) < limiteFila)
                    || desligadas.has(normalizarNome(registro.puxado_por))
                );
                const dono = filaVencida ? '' : (registro?.puxado_por || registro?.atualizado_por || '');
                const disponivel = situacao !== 'MIGROU' && (!registro || filaVencida);
                return { ...a, situacao, registro, dono, disponivel, minhaFila: !disponivel && mesmoNome(dono, operador) };
            })
            .filter(Boolean);
    }, [alunos, andamento, naoContatar, desligadas, operador]);

    const daVisao = useMemo(() => linhas.filter(l => (
        visao === 'FILA' ? l.minhaFila : visao === 'DISPONIVEIS' ? l.disponivel : true
    )), [linhas, visao]);

    const planosDisponiveis = useMemo(() => [...new Set(linhas.filter(l => l.disponivel).map(l => l.ultimo_plano))].sort(), [linhas]);
    const planosDaVisao = useMemo(() => [...new Set(daVisao.map(l => l.ultimo_plano))].sort(), [daVisao]);
    const totalDisponiveis = useMemo(() => linhas.filter(l => l.disponivel && (!planoPuxar || l.ultimo_plano === planoPuxar)).length, [linhas, planoPuxar]);

    const filtradas = useMemo(() => daVisao.filter(l => {
        if (filtroAndamento === 'PENDENTES' && l.situacao === 'MIGROU') return false;
        if (!['PENDENTES', 'TODOS'].includes(filtroAndamento) && l.situacao !== filtroAndamento) return false;
        if (filtroPlano && l.ultimo_plano !== filtroPlano) return false;
        return contatoCombinaComBusca(l, busca);
    }), [daVisao, filtroAndamento, filtroPlano, busca]);

    const contagem = useMemo(() => {
        const c = { NAO_CONTATADO: 0, CONTATADO: 0, INTERESSADO: 0, MIGROU: 0 };
        daVisao.forEach(l => { c[l.situacao]++; });
        return c;
    }, [daVisao]);

    const atualizarLocal = (alunoId, campos) => setAndamento(prev => {
        const novo = new Map(prev);
        novo.set(alunoId, { ...(prev.get(alunoId) || { criado_em: new Date().toISOString() }), aluno_id: alunoId, ...campos });
        return novo;
    });

    // Puxa os N mais recentes (pela data da compra) do plano escolhido para a minha fila
    const puxar = async () => {
        const candidatos = linhas
            .filter(l => l.disponivel && (!planoPuxar || l.ultimo_plano === planoPuxar))
            .sort((a, b) => String(b.data_compra || '').localeCompare(String(a.data_compra || '')))
            .slice(0, qtdPuxar);
        if (candidatos.length === 0) return alert('Não há alunos disponíveis para puxar com esse filtro.');
        setPuxando(true);
        try {
            const confirmados = await puxarParaFilaMigracao({ alunoIds: candidatos.map(c => c.aluno_id), unidade: unidadeChave, operador });
            // Recarrega o andamento do banco: a tela mostra exatamente quem ficou com cada aluno
            const mapa = await carregarAndamentoMigracao();
            if (mapa) setAndamento(mapa);
            setVisao('FILA');
            setFiltroAndamento('PENDENTES');
            const perdidos = candidatos.length - confirmados.length;
            if (confirmados.length === 0) alert('Nenhum aluno foi puxado: todos já tinham sido puxados por outra pessoa. A lista foi atualizada.');
            else if (perdidos > 0) alert(`${confirmados.length} aluno(s) puxado(s). ${perdidos} já tinha(m) sido puxado(s) por outra pessoa.`);
        } catch (err) {
            console.error('Erro ao puxar alunos da migração:', err);
            alert(`Não foi possível puxar.\n\n${err?.message || ''}`);
        } finally {
            setPuxando(false);
        }
    };

    // Registra o contato de Migração (relatório) e passa o andamento para "Contatado" (sem rebaixar quem já é Interessado)
    const registrarContato = async (linha, { canal, justificativa = null }) => {
        // Já contatado hoje: não grava de novo (não infla meta, planilha nem relatório)
        if (contatadosHoje.has(linha.aluno_id)) return;
        setSalvando(linha.aluno_id);
        try {
            const gravou = await registrarContatoFeito({
                unidade: unidadeChave, consultor: operador, tipo: 'MIGRACAO',
                aluno_id: linha.aluno_id, nome: linha.nome, referencia: diaISO(0), canal, justificativa,
                observacao: marcaFeitoPor(usuarioLogado, operador) || null
            });
            setContatadosHoje(prev => new Set(prev).add(linha.aluno_id));
            if (gravou && onContatoFeito) onContatoFeito(`Contato de migração ${canal === 'WHATSAPP' ? 'via WhatsApp' : 'sem WhatsApp'}`, `aluno:${linha.aluno_id}`);
            if (linha.situacao === 'NAO_CONTATADO') {
                const dono = linha.dono || operador;
                const puxadoEm = linha.registro?.puxado_em && !linha.disponivel ? linha.registro.puxado_em : new Date().toISOString();
                await salvarAndamentoMigracao({ aluno_id: linha.aluno_id, unidade: unidadeChave, status: 'CONTATADO', quem: operador, puxado_por: dono, puxado_em: puxadoEm });
                atualizarLocal(linha.aluno_id, { status: 'CONTATADO', puxado_por: dono, puxado_em: puxadoEm });
            }
        } catch (err) {
            console.error('Erro ao registrar contato de migração:', err);
            alert(`Não foi possível registrar o contato.\n\n${err?.message || ''}`);
        } finally {
            setSalvando('');
        }
    };

    const abrirWhatsApp = async (linha) => {
        if (!linha.telefone) return alert('Este aluno está sem telefone cadastrado.');
        window.open(linkWhatsApp(linha.telefone, preencherMensagem(mensagem, { nome: linha.nome, unidade: unidadeChave })), '_blank');
        await registrarContato(linha, { canal: 'WHATSAPP' });
    };

    const mudarInteresse = async (linha) => {
        const novo = linha.situacao === 'INTERESSADO' ? 'CONTATADO' : 'INTERESSADO';
        setSalvando(linha.aluno_id);
        try {
            await salvarAndamentoMigracao({ aluno_id: linha.aluno_id, unidade: unidadeChave, status: novo, quem: operador });
            atualizarLocal(linha.aluno_id, { status: novo });
        } catch (err) {
            alert(`Não foi possível salvar.\n\n${err?.message || ''}`);
        } finally {
            setSalvando('');
        }
    };

    const devolver = async (linha) => {
        setSalvando(linha.aluno_id);
        try {
            await devolverDaFilaMigracao({ aluno_id: linha.aluno_id, unidade: unidadeChave, quem: operador });
            atualizarLocal(linha.aluno_id, { status: 'NA_FILA', puxado_por: null, puxado_em: null });
        } catch (err) {
            alert(`Não foi possível devolver.\n\n${err?.message || ''}`);
        } finally {
            setSalvando('');
        }
    };

    const th = 'px-4 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap';
    const seletor = 'bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 outline-none cursor-pointer';

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex flex-wrap justify-between items-start gap-4 mb-5 border-b border-slate-100 dark:border-slate-800 pb-5">
                <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                        <Repeat className="w-6 h-6 text-blue-500" /> Migração para plano com nutricionista
                        {carregando && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">Alunos de {unidadeChave} cujo último plano comprado não tem NUTRI. Puxe alguns para a sua fila e trabalhe aos poucos.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(ANDAMENTOS).map(([chave, a]) => (
                        <span key={chave} className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${a.classe}`}>{contagem[chave]} {a.rotulo}</span>
                    ))}
                </div>
            </div>

            {indisponivel && (
                <div className="mb-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> A Migração precisa dos comandos da Etapa C no Supabase (tabela crm_migracao e consulta crm_migracao_alunos).
                </div>
            )}

            {/* PUXAR PARA A MINHA FILA */}
            <div className="mb-5 bg-blue-50/60 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-2xl p-4 flex flex-wrap items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">Puxar para a minha fila:</span>
                <select value={planoPuxar} onChange={(e) => setPlanoPuxar(e.target.value)} className={seletor}>
                    <option value="">Todos os planos</option>
                    {planosDisponiveis.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={qtdPuxar} onChange={(e) => setQtdPuxar(Number(e.target.value))} className={seletor}>
                    {QUANTIDADES_PUXAR.map(q => <option key={q} value={q}>{q} alunos</option>)}
                </select>
                <button type="button" onClick={puxar} disabled={puxando || totalDisponiveis === 0} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                    {puxando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightCircle className="w-4 h-4" />} Puxar
                </button>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{totalDisponiveis} disponível(is){planoPuxar ? ` em ${planoPuxar}` : ''} · os que compraram mais recentemente vêm primeiro</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    {VISOES.map(v => (
                        <button key={v.val} type="button" onClick={() => setVisao(v.val)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${visao === v.val ? 'bg-white dark:bg-slate-900 shadow-sm text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
                            {v.label}
                        </button>
                    ))}
                </div>
                <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, CPF ou telefone" className="w-64 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/30" />
                    {busca && <button type="button" onClick={() => setBusca('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"><X className="w-3.5 h-3.5" /></button>}
                </div>
                <select value={filtroAndamento} onChange={(e) => setFiltroAndamento(e.target.value)} className={seletor}>
                    {FILTROS_ANDAMENTO.map(f => <option key={f.val} value={f.val}>{f.label}</option>)}
                </select>
                <select value={filtroPlano} onChange={(e) => setFiltroPlano(e.target.value)} className={seletor}>
                    <option value="">Todos os planos</option>
                    {planosDaVisao.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{filtradas.length} aluno(s)</span>
            </div>

            <div className="overflow-x-auto custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-slate-50 dark:bg-slate-800/60">
                        <tr>
                            <th className={th}>Aluno</th>
                            <th className={th}>Último plano</th>
                            <th className={th}>Compra</th>
                            <th className={th}>Telefone</th>
                            <th className={th}>Andamento</th>
                            {visao === 'TODOS' && <th className={th}>Na fila de</th>}
                            <th className={`${th} text-right`}>Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filtradas.length === 0 ? (
                            <tr><td colSpan={visao === 'TODOS' ? 7 : 6} className="text-center py-12 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {carregando ? 'Carregando...' : visao === 'FILA' ? 'Sua fila está vazia. Use "Puxar" para pegar alunos para trabalhar.' : 'Nenhum aluno neste filtro.'}
                            </td></tr>
                        ) : filtradas.slice(0, limite).map(l => {
                            const a = ANDAMENTOS[l.situacao];
                            const ocupado = salvando === l.aluno_id;
                            // Só trabalha (WhatsApp, registrar, interessado) quem está na própria fila
                            const podeTrabalhar = l.minhaFila && l.situacao !== 'MIGROU';
                            const jaHoje = contatadosHoje.has(l.aluno_id);
                            return (
                                <tr key={l.aluno_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                    <td className="px-4 py-3">
                                        <button type="button" onClick={() => setContatoFicha(l)} className="text-xs font-black text-slate-800 dark:text-white uppercase text-left hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-2" title="Abrir a ficha do aluno">{l.nome}</button>
                                    </td>
                                    <td className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">{l.ultimo_plano}</td>
                                    <td className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">{l.data_compra ? String(l.data_compra).split('-').reverse().join('/') : '—'}</td>
                                    <td className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">{l.telefone || '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${a.classe}`}>{a.rotulo}</span>
                                    </td>
                                    {visao === 'TODOS' && <td className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">{l.disponivel ? 'Disponível' : (l.dono ? String(l.dono).split(' ')[0] : '—')}</td>}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {podeTrabalhar && (
                                                <>
                                                    <button type="button" onClick={() => abrirWhatsApp(l)} disabled={ocupado} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-1" title="Abre o WhatsApp com a mensagem de migração e já registra o contato">
                                                        {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />} WhatsApp
                                                    </button>
                                                    {jaHoje ? (
                                                        <span className="px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[9px] font-black uppercase tracking-widest flex items-center gap-1" title="O contato de hoje já foi registrado. Abrir o WhatsApp de novo não soma outra vez.">
                                                            <Check className="w-3.5 h-3.5" /> Contatado hoje
                                                        </span>
                                                    ) : (
                                                        <button type="button" onClick={() => setJustificando(l)} disabled={ocupado} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 disabled:opacity-60" title="Contato feito por ligação ou pessoalmente (fica em vermelho para o Líder)">
                                                            <Check className="w-3.5 h-3.5" /> Registrar contato
                                                        </button>
                                                    )}
                                                    {l.situacao !== 'NAO_CONTATADO' && (
                                                        <button type="button" onClick={() => mudarInteresse(l)} disabled={ocupado} className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 border disabled:opacity-60 ${l.situacao === 'INTERESSADO' ? 'bg-amber-500 text-white border-amber-600' : 'border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300'}`} title="Marcar/desmarcar como interessado">
                                                            <Star className="w-3.5 h-3.5" /> Interessado
                                                        </button>
                                                    )}
                                                    {l.situacao === 'NAO_CONTATADO' && (
                                                        <button type="button" onClick={() => devolver(l)} disabled={ocupado} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-60" title="Devolver para os Disponíveis">
                                                            <Undo2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                            {l.situacao !== 'MIGROU' && (
                                                <button type="button" onClick={() => setBloqueando(l)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Não contatar">
                                                    <Ban className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {filtradas.length > limite && (
                <button type="button" onClick={() => setLimite(n => n + POR_PAGINA)} className="w-full mt-3 py-3 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl flex items-center justify-center gap-1.5">
                    <ChevronDown className="w-4 h-4" /> Ver mais ({filtradas.length - limite} restantes)
                </button>
            )}

            {contatoFicha && <FichaAlunoPopup contato={contatoFicha} usuarioLogado={usuarioLogado} onFechar={() => setContatoFicha(null)} />}
            {justificando && (
                <JanelaJustificativa pessoa={justificando} onFechar={() => setJustificando(null)} onConfirmar={(justificativa) => registrarContato(justificando, { canal: 'MANUAL', justificativa })} />
            )}
            {bloqueando && (
                <JanelaNaoContatar
                    pessoa={bloqueando}
                    unidade={unidadeChave}
                    quem={operador}
                    onFechar={() => setBloqueando(null)}
                    onFeito={(p) => { if (onNaoContatar) onNaoContatar(p); }}
                />
            )}
        </div>
    );
};

export default AbaMigracao;
