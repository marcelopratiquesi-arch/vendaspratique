import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { FileText, Loader2, Download, ChevronDown, AlertTriangle } from 'lucide-react';
import { normalizarNome, formatarDataHora, ehCanceladoOuInativo, dataLocalISO } from './utils';
import { carregarContatosFeitosPeriodo } from './contatosFeitos';
import FichaAlunoPopup from './FichaAlunoPopup';

// ==========================================
// RELATÓRIO POR RECEPCIONISTA (Etapa D)
// Lista das pessoas contatadas no período, com filtro por tipo e totais no topo.
// - Visitante 24h, Visitante 48h, Aniversário e Migração: tabela crm_contatos_feitos (pop-up e aba Migração).
// - Cancelados e Inativos: histórico do CRM (WhatsApp, ligação ou nota) em contatos da Base desses tipos.
//   Contatos antigos gravados como "CANCELADO/INATIVO" ficam no grupo "Cancelado/Inativo (antigo)".
// Todos da unidade veem o relatório de todas (igual ao Andamento da Recepção).
// ==========================================

const TIPOS = [
    { chave: 'VISITANTE_24H', rotulo: 'Visitante 24h', cor: 'text-blue-600 dark:text-blue-400' },
    { chave: 'VISITANTE_48H', rotulo: 'Visitante 48h', cor: 'text-amber-600 dark:text-amber-400' },
    { chave: 'MIGRACAO', rotulo: 'Migração', cor: 'text-emerald-600 dark:text-emerald-400' },
    { chave: 'CANCELADO', rotulo: 'Cancelados', cor: 'text-rose-600 dark:text-rose-400' },
    { chave: 'INATIVO', rotulo: 'Inativos', cor: 'text-orange-600 dark:text-orange-400' },
    { chave: 'CANCELADO_INATIVO_ANTIGO', rotulo: 'Cancelado/Inativo (antigo)', cor: 'text-orange-500 dark:text-orange-300', soSeTiver: true },
    { chave: 'ANIVERSARIO', rotulo: 'Aniversário', cor: 'text-pink-600 dark:text-pink-400' }
];
const ROTULO_TIPO = Object.fromEntries(TIPOS.map(t => [t.chave, t.rotulo]));
const ACOES_CONTATO_LISTA = ['WhatsApp', 'Ligação', 'Observação'];
// Teto de registros lidos de uma vez (acima disso aparece o aviso)
const LIMITE_REGISTROS = 10000;

const PERIODOS = [
    { val: 'hoje', label: 'Hoje' },
    { val: '7d', label: 'Últimos 7 dias' },
    { val: 'mes', label: 'Este mês' },
    { val: 'mes_anterior', label: 'Mês anterior' },
    { val: 'escolher', label: 'Escolher datas' }
];

// Início (incluído) e fim (não incluído) do período, no horário local
const faixaDoPeriodo = (periodo, dataInicio, dataFim) => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
    if (periodo === 'hoje') return { inicio: hoje, fim: amanha };
    if (periodo === '7d') { const i = new Date(hoje); i.setDate(i.getDate() - 6); return { inicio: i, fim: amanha }; }
    if (periodo === 'mes') return { inicio: new Date(hoje.getFullYear(), hoje.getMonth(), 1), fim: amanha };
    if (periodo === 'mes_anterior') return { inicio: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1), fim: new Date(hoje.getFullYear(), hoje.getMonth(), 1) };
    const paraData = (iso, dias = 0) => { if (!iso) return null; const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d + dias); };
    return { inicio: paraData(dataInicio), fim: paraData(dataFim, 1) };
};

const tipoDoLead = (tipoLead) => {
    const t = String(tipoLead || '').toUpperCase();
    if (t === 'CANCELADO') return 'CANCELADO';
    if (t === 'INATIVO') return 'INATIVO';
    return 'CANCELADO_INATIVO_ANTIGO';
};

const RelatorioConsultor = ({ recepcionistas = [], leads = [], usuarioLogado, unidadeEscopo = '', pessoa, onPessoa, versao = 0 }) => {
    const [periodo, setPeriodo] = useState('mes');
    const [dataInicio, setDataInicio] = useState(dataLocalISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
    const [dataFim, setDataFim] = useState(dataLocalISO(new Date()));
    const [tipoFiltro, setTipoFiltro] = useState('');
    const [feitos, setFeitos] = useState([]);
    const [historico, setHistorico] = useState([]);
    const [leadsExtras, setLeadsExtras] = useState(new Map());
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState(false);
    const [limite, setLimite] = useState(100);
    const [contatoFicha, setContatoFicha] = useState(null);

    const leadPorId = useMemo(() => {
        const m = new Map(leadsExtras);
        leads.forEach(l => m.set(String(l.id), l));
        return m;
    }, [leads, leadsExtras]);

    // Busca no banco os contatos do período
    useEffect(() => {
        const { inicio, fim } = faixaDoPeriodo(periodo, dataInicio, dataFim);
        if (periodo === 'escolher' && (!inicio || !fim)) return undefined;
        let cancelado = false;
        const buscar = async () => {
            setCarregando(true);
            setErro(false);
            let consulta = supabase.from('historico_leads').select('id, lead_id, consultor, tipo_acao, data_registro')
                .in('tipo_acao', ACOES_CONTATO_LISTA).order('data_registro', { ascending: false }).limit(LIMITE_REGISTROS);
            if (inicio) consulta = consulta.gte('data_registro', inicio.toISOString());
            if (fim) consulta = consulta.lt('data_registro', fim.toISOString());
            const [linhasFeitas, resHist] = await Promise.all([carregarContatosFeitosPeriodo({ inicio, fim }), consulta]);
            if (cancelado) return;
            if (resHist.error) { console.error('Erro ao buscar o histórico do relatório:', resHist.error); setErro(true); }
            setFeitos(linhasFeitas || []);
            setHistorico(resHist.data || []);
            setCarregando(false);
        };
        buscar();
        return () => { cancelado = true; };
    }, [periodo, dataInicio, dataFim, versao]);

    // Contatos do histórico que não estão na lista carregada da tela: busca nome, CPF e tipo no banco
    useEffect(() => {
        const faltando = [...new Set(historico.map(h => String(h.lead_id)))].filter(id => /^\d+$/.test(id) && !leadPorId.has(id));
        if (faltando.length === 0) return undefined;
        let cancelado = false;
        (async () => {
            const extras = new Map();
            for (let i = 0; i < faltando.length; i += 200) {
                const { data } = await supabase.from('leads').select('id, nome, cpf, telefone, tipo_lead, unidade').in('id', faltando.slice(i, i + 200).map(Number));
                (data || []).forEach(l => extras.set(String(l.id), l));
            }
            if (!cancelado && extras.size > 0) setLeadsExtras(prev => new Map([...prev, ...extras]));
        })();
        return () => { cancelado = true; };
    }, [historico, leadPorId]);

    useEffect(() => { setLimite(100); }, [periodo, dataInicio, dataFim, tipoFiltro, pessoa]);

    const nomesEscopo = useMemo(() => new Set(recepcionistas.map(r => normalizarNome(r.nome))), [recepcionistas]);

    // Junta tudo numa lista só (uma linha por pessoa contatada)
    const linhas = useMemo(() => {
        const daUnidade = (unidade) => !unidadeEscopo || normalizarNome(unidade) === unidadeEscopo;
        const resultado = [];
        feitos.forEach(f => {
            if (!daUnidade(f.unidade)) return;
            const lead = f.lead_id ? leadPorId.get(String(f.lead_id)) : null;
            resultado.push({
                id: `f${f.id}`, quando: f.criado_em, consultor: f.consultor, tipo: f.tipo, nome: f.nome || lead?.nome || '—',
                semWhatsApp: f.canal !== 'WHATSAPP', meio: f.canal === 'WHATSAPP' ? 'WhatsApp' : 'Sem WhatsApp',
                justificativa: f.justificativa || '', unidade: f.unidade, feitoPor: f.observacao || '',
                contato: { nome: f.nome || lead?.nome, aluno_id: f.aluno_id || null, cpf: lead?.cpf || '' }
            });
        });
        // Cancelados/Inativos: uma linha por contato, por dia e por recepcionista (junta WhatsApp + ligação + nota)
        const agrupados = new Map();
        historico.forEach(h => {
            const lead = leadPorId.get(String(h.lead_id));
            if (!lead || !ehCanceladoOuInativo(lead.tipo_lead) || !daUnidade(lead.unidade)) return;
            const chave = `${h.lead_id}|${dataLocalISO(h.data_registro)}|${normalizarNome(h.consultor)}`;
            const atual = agrupados.get(chave) || {
                id: `h${h.id}`, quando: h.data_registro, consultor: h.consultor, tipo: tipoDoLead(lead.tipo_lead), nome: lead.nome,
                acoes: new Set(), semWhatsApp: false, justificativa: '', unidade: lead.unidade,
                contato: { nome: lead.nome, cpf: lead.cpf }
            };
            atual.acoes.add(h.tipo_acao);
            agrupados.set(chave, atual);
        });
        agrupados.forEach(g => {
            const meio = g.acoes.has('WhatsApp') ? 'WhatsApp' : g.acoes.has('Ligação') ? 'Ligação' : 'Nota';
            resultado.push({ ...g, meio });
        });
        return resultado
            // Só recepcionistas ativas do escopo (desligadas não aparecem no CRM)
            .filter(l => nomesEscopo.has(normalizarNome(l.consultor)))
            .sort((a, b) => new Date(b.quando) - new Date(a.quando));
    }, [feitos, historico, leadPorId, nomesEscopo, unidadeEscopo]);

    const daPessoa = useMemo(() => (pessoa ? linhas.filter(l => normalizarNome(l.consultor) === pessoa) : linhas), [linhas, pessoa]);
    const filtradas = useMemo(() => (tipoFiltro ? daPessoa.filter(l => l.tipo === tipoFiltro) : daPessoa), [daPessoa, tipoFiltro]);

    const totais = useMemo(() => {
        const t = {};
        TIPOS.forEach(x => { t[x.chave] = { total: 0, sem: 0 }; });
        daPessoa.forEach(l => { if (!t[l.tipo]) return; t[l.tipo].total++; if (l.semWhatsApp) t[l.tipo].sem++; });
        return t;
    }, [daPessoa]);

    const exportarCSV = () => {
        let csv = 'Data;Hora;Recepcionista;Feito por;Tipo;Pessoa;Meio;Justificativa;Unidade\n';
        filtradas.forEach(l => {
            const d = new Date(l.quando);
            const limpar = (v) => String(v || '').replace(/[;\n\r]/g, ' ');
            csv += [d.toLocaleDateString('pt-BR'), d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), limpar(l.consultor), limpar(l.feitoPor), limpar(ROTULO_TIPO[l.tipo]), limpar(l.nome), l.meio, limpar(l.justificativa), limpar(l.unidade)].join(';') + '\n';
        });
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `Relatorio_Contatos_${pessoa ? pessoa.split(' ')[0] : 'todas'}_${periodo}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const th = 'px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap';
    const seletor = 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 outline-none cursor-pointer';

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Relatório por recepcionista
                    {carregando && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                </h4>
                <div className="flex flex-wrap items-center gap-2">
                    <select value={pessoa} onChange={(e) => onPessoa(e.target.value)} className={seletor}>
                        <option value="">Todas as recepcionistas</option>
                        {recepcionistas.map(r => <option key={r.id} value={normalizarNome(r.nome)}>{r.nome}</option>)}
                    </select>
                    <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={seletor}>
                        {PERIODOS.map(p => <option key={p.val} value={p.val}>{p.label}</option>)}
                    </select>
                    {periodo === 'escolher' && (
                        <>
                            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className={seletor} />
                            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className={seletor} />
                        </>
                    )}
                    <button type="button" onClick={exportarCSV} disabled={filtradas.length === 0} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                        <Download className="w-3.5 h-3.5" /> Exportar
                    </button>
                </div>
            </div>

            {erro && (
                <div className="mx-5 mt-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> Não foi possível carregar o histórico de contatos. Cancelados e Inativos podem aparecer zerados.
                </div>
            )}

            {(historico.length >= LIMITE_REGISTROS || feitos.length >= LIMITE_REGISTROS) && (
                <div className="mx-5 mt-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> Muitos registros no período: o relatório leu só os {LIMITE_REGISTROS.toLocaleString('pt-BR')} mais recentes, então os números podem estar abaixo da realidade. Escolha um período menor.
                </div>
            )}

            {/* TOTAIS POR TIPO (clicar filtra a lista) */}
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                <button type="button" onClick={() => setTipoFiltro('')} className={`text-left rounded-xl border p-3 transition-all ${!tipoFiltro ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-500/30 bg-blue-50 dark:bg-blue-500/10' : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500/30'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Todos</p>
                    <p className="text-2xl font-black text-slate-800 dark:text-white">{daPessoa.length}</p>
                </button>
                {TIPOS.filter(t => !t.soSeTiver || totais[t.chave].total > 0).map(t => (
                    <button key={t.chave} type="button" onClick={() => setTipoFiltro(tipoFiltro === t.chave ? '' : t.chave)} className={`text-left rounded-xl border p-3 transition-all ${tipoFiltro === t.chave ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-500/30 bg-blue-50 dark:bg-blue-500/10' : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500/30'}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate" title={t.rotulo}>{t.rotulo}</p>
                        <p className={`text-2xl font-black ${t.cor}`}>{totais[t.chave].total}</p>
                        {totais[t.chave].sem > 0 && <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">{totais[t.chave].sem} sem WhatsApp</p>}
                    </button>
                ))}
            </div>

            <div className="overflow-x-auto custom-scrollbar border-t border-slate-100 dark:border-slate-800">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-slate-50 dark:bg-slate-800/60">
                        <tr>
                            <th className={th}>Quando</th>
                            <th className={th}>Recepcionista</th>
                            <th className={th}>Tipo</th>
                            <th className={th}>Pessoa</th>
                            <th className={th}>Meio</th>
                            <th className={th}>Unidade</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filtradas.length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-10 text-[10px] font-black uppercase tracking-widest text-slate-400">{carregando ? 'Carregando...' : 'Nenhum contato no período.'}</td></tr>
                        ) : filtradas.slice(0, limite).map(l => (
                            <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="px-4 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatarDataHora(l.quando)}</td>
                                <td className="px-4 py-2.5 text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase whitespace-nowrap">
                                    {String(l.consultor || '').split(' ')[0]}
                                    {l.feitoPor && <span className="block text-[10px] font-bold normal-case text-amber-600 dark:text-amber-400">{l.feitoPor}</span>}
                                </td>
                                <td className="px-4 py-2.5"><span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded">{ROTULO_TIPO[l.tipo] || l.tipo}</span></td>
                                <td className="px-4 py-2.5">
                                    <button type="button" onClick={() => setContatoFicha(l.contato)} className="text-[11px] font-bold text-slate-800 dark:text-white uppercase text-left hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-2" title="Abrir a ficha do aluno">{l.nome}</button>
                                </td>
                                <td className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                                    {l.semWhatsApp
                                        ? <span className="text-rose-600 dark:text-rose-400" title={l.justificativa}>Sem WhatsApp{l.justificativa ? ` · ${l.justificativa}` : ''}</span>
                                        : <span className={l.meio === 'WhatsApp' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}>{l.meio}</span>}
                                </td>
                                <td className="px-4 py-2.5 text-[10px] font-black uppercase text-slate-400 whitespace-nowrap">{l.unidade}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {filtradas.length > limite && (
                <button type="button" onClick={() => setLimite(n => n + 100)} className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1.5">
                    <ChevronDown className="w-4 h-4" /> Ver mais ({filtradas.length - limite} restantes)
                </button>
            )}

            {contatoFicha && <FichaAlunoPopup contato={contatoFicha} usuarioLogado={usuarioLogado} onFechar={() => setContatoFicha(null)} />}
        </div>
    );
};

export default RelatorioConsultor;
