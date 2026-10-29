import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { Download, TrendingUp, Activity, Loader2, AlertTriangle, Snowflake } from 'lucide-react';
import { SeletorPeriodo } from '../HistoricoVendas/FiltrosCompactos.jsx';
import { usePeriodoPadrao } from '../../components/periodoPadrao.js';
import { dataDoLead, dataLocalISO, grupoMotivoPerda } from './utils';
import { tx, localeAtual } from '../../i18n/traduzir.js';

// ============================================================================
// UTILITÁRIOS INTERNOS (Isolados para não depender de arquivos externos)
// ============================================================================
// Dia no horário local (um contato das 22h não cai no dia seguinte)
const safeIsoDate = (dStr) => dataLocalISO(dStr);

// Busca no banco em páginas de 1000 (limite do Supabase), até 30 mil contatos
const PAGINA = 1000;
const MAX_PAGINAS = 30;

// "AAAA-MM-DD" somando dias, no horário local
const somarDias = (iso, dias) => {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d + dias);
};

// ============================================================================
// COMPONENTE PRINCIPAL DO RELATÓRIO DO CRM
// ============================================================================
const RelatorioCrm = ({ visitantes = [], temVisaoGlobal, usuarioLogado }) => {
    // Filtro de período padrão do sistema (começa em "Este mês", como antes)
    const periodo = usePeriodoPadrao('este_mes');

    // O App só carrega 90 dias de contatos (e no máximo 3 mil na Visão Global). O relatório busca
    // no banco os contatos do período escolhido, para fechados antigos também entrarem na conta.
    const [leadsDoBanco, setLeadsDoBanco] = useState(null); // null = ainda não chegou ou deu erro: usa os da tela
    const [carregando, setCarregando] = useState(false);
    const [cortado, setCortado] = useState(false);
    const unidadeDoUsuario = !temVisaoGlobal && usuarioLogado?.unidade && usuarioLogado.unidade !== 'TODAS' ? usuarioLogado.unidade : '';

    // Faixa de datas do filtro (AAAA-MM-DD, fim incluído). Vazio = sem limite daquele lado.
    const faixa = useMemo(() => {
        const { inicio, fim } = periodo.faixa;
        const ultimoDia = fim ? new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() - 1) : null;
        return { inicio: inicio ? dataLocalISO(inicio) : '', fim: ultimoDia ? dataLocalISO(ultimoDia) : '' };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- a faixa muda junto com periodo.chave
    }, [periodo.chave]);

    useEffect(() => {
        let cancelado = false;
        // A data de entrada pode estar em 3 campos (CRM, Novo Visitante e banco): o contato entra se qualquer um cair na faixa.
        // 1 dia de folga em cada lado (fuso horário); o filtro exato é feito logo abaixo, como antes.
        const desde = faixa.inicio ? `"${somarDias(faixa.inicio, -1).toISOString()}"` : '';
        const ate = faixa.fim ? `"${somarDias(faixa.fim, 2).toISOString()}"` : '';
        const condicao = (campo) => {
            const partes = [desde && `${campo}.gte.${desde}`, ate && `${campo}.lt.${ate}`].filter(Boolean);
            return partes.length > 1 ? `and(${partes.join(',')})` : partes[0];
        };
        const filtroDatas = (desde || ate) ? ['created_at', 'criado_em', 'data_criacao'].map(condicao).join(',') : '';

        const buscar = async () => {
            setCarregando(true);
            const encontrados = [];
            let bateuNoTeto = true;
            for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
                let query = supabase.from('leads').select('*').order('id', { ascending: true }).range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1);
                if (filtroDatas) query = query.or(filtroDatas);
                if (unidadeDoUsuario) query = query.ilike('unidade', unidadeDoUsuario);
                const { data, error } = await query;
                if (cancelado) return;
                if (error) { console.error('Erro ao buscar contatos do relatório:', error); setLeadsDoBanco(null); setCarregando(false); return; }
                encontrados.push(...(data || []));
                if (!data || data.length < PAGINA) { bateuNoTeto = false; break; }
            }
            if (cancelado) return;
            setLeadsDoBanco(encontrados);
            setCortado(bateuNoTeto);
            setCarregando(false);
        };
        buscar();
        return () => { cancelado = true; };
    }, [faixa, unidadeDoUsuario]);

    const fonte = leadsDoBanco || visitantes;

    // 1. FILTRAGEM DE DATA (Mantém apenas os leads do período selecionado)
    const leadsFiltrados = useMemo(() => {
        return fonte.filter(v => {
            // Se não tiver visão global, trava na unidade do usuário
            if (!temVisaoGlobal && String(v.unidade || '').toUpperCase() !== String(usuarioLogado?.unidade || '').toUpperCase()) return false;

            const dataBase = dataDoLead(v);
            if (!dataBase) return false;
            
            const isoDate = safeIsoDate(dataBase);
            if (faixa.inicio && isoDate < faixa.inicio) return false;
            if (faixa.fim && isoDate > faixa.fim) return false;

            return true;
        });
    }, [fonte, temVisaoGlobal, usuarioLogado, faixa]);

    // 2. CONSOLIDAÇÃO DOS DADOS POR UNIDADE
    const relatorioUnidades = useMemo(() => {
        const relatorio = {};

        leadsFiltrados.forEach(lead => {
            const unidade = lead.unidade || 'SEM UNIDADE';
            
            if (!relatorio[unidade]) {
                relatorio[unidade] = {
                    unidade: unidade,
                    total: 0,
                    fechados: 0,
                    perdidos: 0,
                    emAtendimento: 0
                };
            }

            relatorio[unidade].total++;

            if (lead.status === 'Fechado') relatorio[unidade].fechados++;
            else if (lead.status === 'Perdido') relatorio[unidade].perdidos++;
            else relatorio[unidade].emAtendimento++;
        });

        // Transforma o objeto em Array e calcula as taxas
        const linhas = Object.values(relatorio).map(row => {
            row.taxaConversao = row.total > 0 ? ((row.fechados / row.total) * 100).toFixed(1) : 0;
            return row;
        });

        // Ordena por maior volume de leads
        return linhas.sort((a, b) => b.total - a.total);
    }, [leadsFiltrados]);

    // POR QUE PERDEMOS: motivos dos contatos que estão em Perdido no período ("Outro: ..." contam juntos)
    const motivosPerda = useMemo(() => {
        const mapa = new Map();
        const perdidos = leadsFiltrados.filter(l => l.status === 'Perdido');
        perdidos.forEach(l => {
            const motivo = grupoMotivoPerda(l.motivo_perda);
            const atual = mapa.get(motivo) || { motivo, qtd: 0, exemplos: [] };
            atual.qtd++;
            if (motivo === 'Outro' && atual.exemplos.length < 10) atual.exemplos.push(String(l.motivo_perda));
            mapa.set(motivo, atual);
        });
        const linhas = [...mapa.values()]
            .map(m => ({ ...m, pct: perdidos.length ? Math.round((m.qtd / perdidos.length) * 100) : 0 }))
            // "Sem motivo informado" sempre por último
            .sort((a, b) => (a.motivo === 'Sem motivo informado') - (b.motivo === 'Sem motivo informado') || b.qtd - a.qtd);
        return { total: perdidos.length, linhas, semMotivo: mapa.get('Sem motivo informado')?.qtd || 0 };
    }, [leadsFiltrados]);

    // 3. TOTAIS GERAIS (Rodapé da Tabela)
    const totaisGerais = relatorioUnidades.reduce((acc, row) => {
        acc.total += row.total;
        acc.fechados += row.fechados;
        acc.perdidos += row.perdidos;
        acc.emAtendimento += row.emAtendimento;
        return acc;
    }, { total: 0, fechados: 0, perdidos: 0, emAtendimento: 0 });

    const taxaConversaoGeral = totaisGerais.total > 0 ? ((totaisGerais.fechados / totaisGerais.total) * 100).toFixed(1) : 0;

    // 4. EXPORTAÇÃO PARA EXCEL (CSV)
    const exportarCSV = () => {
        let csv = 'Unidade;Total Visitantes;Em Atendimento;Convertidos (Matriculados);Perdidos;Taxa de Conversao (%)\n';

        relatorioUnidades.forEach(row => {
            csv += `${row.unidade};${row.total};${row.emAtendimento};${row.fechados};${row.perdidos};${row.taxaConversao}%\n`;
        });

        csv += `TOTAL GERAL;${totaisGerais.total};${totaisGerais.emAtendimento};${totaisGerais.fechados};${totaisGerais.perdidos};${taxaConversaoGeral}%\n`;

        if (motivosPerda.total > 0) {
            csv += '\nPor que perdemos;Quantidade;%\n';
            motivosPerda.linhas.forEach(m => { csv += `${m.motivo};${m.qtd};${m.pct}%\n`; });
        }

        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }); // \uFEFF força o UTF-8 no Excel Excel
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `Relatorio_Visitantes_${String(periodo.rotulo).replace(/[^\w-]+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 lg:p-8 animate-[fadeIn_0.3s_ease-out] flex flex-col min-h-[600px]">
            
            {/* CABEÇALHO E FILTROS */}
            <div className="flex flex-col xl:flex-row justify-between items-start gap-6 mb-8 border-b border-slate-100 dark:border-slate-800 pb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
                        <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />{' '}{tx("Relatório Global de Conversão")}
                    </h2>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">{usuarioLogado?.unidade && usuarioLogado.unidade !== 'TODAS' ? tx("Unidade {unidade}", { unidade: usuarioLogado.unidade }) : tx("Visão consolidada de todas as unidades")}</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
                    <SeletorPeriodo {...periodo.propsSeletor} />

                    <button onClick={exportarCSV} disabled={relatorioUnidades.length === 0} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-[0_4px_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2">
                        <Download className="w-4 h-4" />{' '}{tx("Exportar Planilha")}
                    </button>
                </div>
            </div>

            {(carregando || cortado || !leadsDoBanco) && (
                <div className={`mb-4 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-2 border ${carregando ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300' : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300'}`}>
                    {carregando
                        ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" />{' '}{tx("Buscando os contatos do período no banco...")}</>
                        : cortado
                            ? <><AlertTriangle className="w-4 h-4 shrink-0" />{' '}{tx("Período muito grande: o relatório usou os primeiros")}{' '}{(PAGINA * MAX_PAGINAS).toLocaleString(localeAtual())}{' '}{tx("contatos. Escolha um período menor para números exatos.")}</>
                            : <><AlertTriangle className="w-4 h-4 shrink-0" />{' '}{tx("Não foi possível buscar no banco: mostrando só os contatos carregados na tela (últimos 90 dias).")}</>}
                </div>
            )}

            {/* TABELA DENSIDADE ALTA (ESTILO EXCEL) */}
            <div className="flex-1 overflow-auto custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-2xl shadow-inner bg-slate-50 dark:bg-slate-800/60">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-slate-800 text-white sticky top-0 z-10 shadow-md">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b border-slate-900">{tx("Unidade")}</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b border-slate-900 text-center">{tx("Total Entradas")}</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b border-slate-900 text-center">{tx("Em Atendimento (Kanban)")}</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b border-slate-900 text-center text-emerald-400">{tx("Convertidos (Matriculou)")}</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b border-slate-900 text-center text-rose-400">{tx("Perdidos (Geladeira)")}</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b border-slate-900 text-right">{tx("Taxa de Conversão")}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {relatorioUnidades.length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-16 text-slate-400 font-bold uppercase tracking-widest text-xs bg-white dark:bg-slate-900">{tx("Nenhum dado encontrado para o período.")}</td></tr>
                        ) : (
                            relatorioUnidades.map((row, idx) => (
                                <tr key={row.unidade} className="hover:bg-blue-50/50 dark:hover:bg-blue-500/10 transition-colors">
                                    <td className="px-6 py-3 border-r border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-400">{idx + 1}º</span>
                                            <p className="text-sm font-black text-slate-800 dark:text-white uppercase">{row.unidade}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-center border-r border-slate-100 dark:border-slate-800">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">{row.total}</span>
                                    </td>
                                    <td className="px-6 py-3 text-center border-r border-slate-100 dark:border-slate-800">
                                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{row.emAtendimento}</span>
                                    </td>
                                    <td className="px-6 py-3 text-center border-r border-emerald-50 dark:border-emerald-500/30">
                                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-100 dark:border-emerald-500/20">{row.fechados}</span>
                                    </td>
                                    <td className="px-6 py-3 text-center border-r border-rose-50 dark:border-rose-500/30">
                                        <span className="text-sm font-bold text-rose-500">{row.perdidos}</span>
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <TrendingUp className={`w-4 h-4 ${row.taxaConversao >= 30 ? 'text-emerald-500' : row.taxaConversao >= 15 ? 'text-blue-500' : 'text-orange-500'}`} />
                                            <span className="text-base font-black text-slate-800 dark:text-white">{row.taxaConversao}%</span>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    {/* LINHA DE TOTAIS FIXA NO RODAPÉ */}
                    {relatorioUnidades.length > 0 && (
                        <tfoot className="bg-slate-100 dark:bg-slate-800 sticky bottom-0 border-t-2 border-slate-300 dark:border-slate-700 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
                            <tr>
                                <td className="px-6 py-5 text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest border-r border-slate-200 dark:border-slate-800">{tx("Total Global")}</td>
                                <td className="px-6 py-5 text-center font-black text-slate-800 dark:text-white text-base border-r border-slate-200 dark:border-slate-800">{totaisGerais.total}</td>
                                <td className="px-6 py-5 text-center font-black text-slate-600 dark:text-slate-300 text-base border-r border-slate-200 dark:border-slate-800">{totaisGerais.emAtendimento}</td>
                                <td className="px-6 py-5 text-center font-black text-emerald-700 dark:text-emerald-300 text-base border-r border-slate-200 dark:border-slate-800">{totaisGerais.fechados}</td>
                                <td className="px-6 py-5 text-center font-black text-rose-600 dark:text-rose-400 text-base border-r border-slate-200 dark:border-slate-800">{totaisGerais.perdidos}</td>
                                <td className="px-6 py-5 text-right font-black text-blue-700 dark:text-blue-300 text-lg">{taxaConversaoGeral}%</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* POR QUE PERDEMOS (Bloco 4): motivos dos contatos Perdidos do período */}
            <div className="mt-6 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-500/30 rounded-2xl p-5">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-2 mb-1">
                    <Snowflake className="w-4 h-4 text-rose-500" />{' '}{tx("Por que perdemos")}
                </h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">
                    {motivosPerda.total} {motivosPerda.total === 1 ? tx("contato perdido") : tx("contatos perdidos")}{' '}{tx("no período")}
                </p>
                {motivosPerda.total === 0 ? (
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600">{tx("Nenhum contato perdido no período.")}</p>
                ) : (
                    <div className="space-y-2.5">
                        {motivosPerda.linhas.map(m => (
                            <div key={m.motivo} title={m.exemplos.length ? m.exemplos.join('\n') : undefined}>
                                <div className="flex justify-between items-baseline gap-3 mb-1">
                                    <span className={`text-xs font-black uppercase tracking-wide ${m.motivo === 'Sem motivo informado' ? 'text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{tx(m.motivo)}</span>
                                    <span className="text-xs font-black text-rose-600 dark:text-rose-400">{m.qtd} <span className="text-slate-400 font-bold">({m.pct}%)</span></span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                    <div className={`h-2 rounded-full ${m.motivo === 'Sem motivo informado' ? 'bg-slate-300 dark:bg-slate-600' : 'bg-rose-500'}`} style={{ width: `${m.pct}%` }}></div>
                                </div>
                            </div>
                        ))}
                        {motivosPerda.semMotivo > 0 && (
                            <p className="text-[10px] font-bold text-slate-400 pt-1">{tx("\"Sem motivo informado\" = perdidos antes de o motivo passar a ser pedido.")}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RelatorioCrm;