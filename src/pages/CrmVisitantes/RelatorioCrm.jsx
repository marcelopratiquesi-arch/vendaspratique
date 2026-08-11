import React, { useState, useMemo } from 'react';
import { Calendar, CalendarDays, Sun, Download, TrendingUp, Users, Target, Activity } from 'lucide-react';

// ============================================================================
// UTILITÁRIOS INTERNOS (Isolados para não depender de arquivos externos)
// ============================================================================
const meses = [
    { val: 'TODOS', label: 'Todos os Meses' }, { val: '01', label: '01 - Janeiro' }, { val: '02', label: '02 - Fevereiro' },
    { val: '03', label: '03 - Março' }, { val: '04', label: '04 - Abril' }, { val: '05', label: '05 - Maio' },
    { val: '06', label: '06 - Junho' }, { val: '07', label: '07 - Julho' }, { val: '08', label: '08 - Agosto' },
    { val: '09', label: '09 - Setembro' }, { val: '10', label: '10 - Outubro' }, { val: '11', label: '11 - Novembro' },
    { val: '12', label: '12 - Dezembro' }
];

const safeIsoDate = (dStr) => {
    if (!dStr) return '';
    if (dStr.includes('T')) return dStr.split('T')[0];
    if (dStr.includes('/')) {
        const partes = dStr.split(' ')[0].split('/');
        if(partes.length === 3) return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
    return dStr.split(' ')[0];
};

// ============================================================================
// COMPONENTE PRINCIPAL DO RELATÓRIO DO CRM
// ============================================================================
const RelatorioCrm = ({ visitantes = [], temVisaoGlobal, usuarioLogado }) => {
    const hojePadrao = new Date().toISOString().split('T')[0];
    const mesPadrao = String(new Date().getMonth() + 1).padStart(2, '0');
    const anoPadrao = new Date().getFullYear().toString();

    const [tipoFiltroData, setTipoFiltroData] = useState('mes'); 
    const [filtroMes, setFiltroMes] = useState(mesPadrao);
    const [filtroAno, setFiltroAno] = useState(anoPadrao);
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [diaEspecifico, setDiaEspecifico] = useState(hojePadrao);

    const anosUnicos = useMemo(() => {
        const anos = [...new Set(visitantes.map(v => safeIsoDate(v.criado_em || v.data).split('-')[0]))].filter(Boolean).sort((a,b) => b-a); 
        if(anos.length === 0) anos.push(anoPadrao);
        return anos;
    }, [visitantes, anoPadrao]);

    // 1. FILTRAGEM DE DATA (Mantém apenas os leads do período selecionado)
    const leadsFiltrados = useMemo(() => {
        return visitantes.filter(v => {
            // Se não tiver visão global, trava na unidade do usuário
            if (!temVisaoGlobal && v.unidade !== usuarioLogado?.unidade) return false;

            const dataBase = v.criado_em || v.data;
            if (!dataBase) return false;
            
            const isoDate = safeIsoDate(dataBase);
            const partes = isoDate.split('-');
            if (partes.length !== 3) return false;
            const [y, m, d] = partes;

            if (tipoFiltroData === 'mes') {
                if (filtroMes !== 'TODOS' && m !== filtroMes) return false;
                if (filtroAno !== 'TODOS' && y !== filtroAno) return false;
            } else if (tipoFiltroData === 'periodo') {
                if (dataInicio && isoDate < dataInicio) return false;
                if (dataFim && isoDate > dataFim) return false;
            } else if (tipoFiltroData === 'dia') {
                if (diaEspecifico && isoDate !== diaEspecifico) return false;
            }

            return true;
        });
    }, [visitantes, temVisaoGlobal, usuarioLogado, tipoFiltroData, filtroMes, filtroAno, dataInicio, dataFim, diaEspecifico]);

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
                    emAtendimento: 0,
                    dayUse: 0
                };
            }

            relatorio[unidade].total++;

            if (lead.status === 'Fechado') relatorio[unidade].fechados++;
            else if (lead.status === 'Perdido') relatorio[unidade].perdidos++;
            else relatorio[unidade].emAtendimento++;

            // Verifica se o lead realizou Day Use (buscando a palavra-chave)
            const interesse = (lead.interesse || '').toUpperCase();
            const obs = (lead.observacao || '').toUpperCase();
            if (interesse.includes('DAY USE') || interesse.includes('DAYUSE') || obs.includes('DAY USE')) {
                relatorio[unidade].dayUse++;
            }
        });

        // Transforma o objeto em Array e calcula as taxas
        const linhas = Object.values(relatorio).map(row => {
            row.taxaConversao = row.total > 0 ? ((row.fechados / row.total) * 100).toFixed(1) : 0;
            return row;
        });

        // Ordena por maior volume de leads
        return linhas.sort((a, b) => b.total - a.total);
    }, [leadsFiltrados]);

    // 3. TOTAIS GERAIS (Rodapé da Tabela)
    const totaisGerais = relatorioUnidades.reduce((acc, row) => {
        acc.total += row.total;
        acc.fechados += row.fechados;
        acc.perdidos += row.perdidos;
        acc.emAtendimento += row.emAtendimento;
        acc.dayUse += row.dayUse;
        return acc;
    }, { total: 0, fechados: 0, perdidos: 0, emAtendimento: 0, dayUse: 0 });

    const taxaConversaoGeral = totaisGerais.total > 0 ? ((totaisGerais.fechados / totaisGerais.total) * 100).toFixed(1) : 0;

    // 4. EXPORTAÇÃO PARA EXCEL (CSV)
    const exportarCSV = () => {
        let csv = 'Unidade;Total Visitantes;Em Atendimento;Convertidos (Matriculados);Perdidos;Day Use;Taxa de Conversao (%)\n';
        
        relatorioUnidades.forEach(row => {
            csv += `${row.unidade};${row.total};${row.emAtendimento};${row.fechados};${row.perdidos};${row.dayUse};${row.taxaConversao}%\n`;
        });
        
        csv += `TOTAL GERAL;${totaisGerais.total};${totaisGerais.emAtendimento};${totaisGerais.fechados};${totaisGerais.perdidos};${totaisGerais.dayUse};${taxaConversaoGeral}%\n`;

        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }); // \uFEFF força o UTF-8 no Excel Excel
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `Relatorio_Visitantes_${tipoFiltroData}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 lg:p-8 animate-[fadeIn_0.3s_ease-out] flex flex-col min-h-[600px]">
            
            {/* CABEÇALHO E FILTROS */}
            <div className="flex flex-col xl:flex-row justify-between items-start gap-6 mb-8 border-b border-slate-100 pb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <Activity className="w-6 h-6 text-indigo-600" /> Relatório Global de Conversão
                    </h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Visão consolidada de todas as unidades</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
                    <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto overflow-x-auto custom-scrollbar shadow-inner">
                        <button onClick={() => setTipoFiltroData('mes')} className={`flex-1 sm:min-w-[90px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${tipoFiltroData === 'mes' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}>
                            <Calendar className="w-4 h-4" /> Mês
                        </button>
                        <button onClick={() => setTipoFiltroData('periodo')} className={`flex-1 sm:min-w-[90px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${tipoFiltroData === 'periodo' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}>
                            <CalendarDays className="w-4 h-4" /> Período
                        </button>
                        <button onClick={() => setTipoFiltroData('dia')} className={`flex-1 sm:min-w-[90px] px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${tipoFiltroData === 'dia' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}>
                            <Sun className="w-4 h-4" /> Dia
                        </button>
                    </div>

                    <button onClick={exportarCSV} disabled={relatorioUnidades.length === 0} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-[0_4px_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2">
                        <Download className="w-4 h-4" /> Exportar Planilha
                    </button>
                </div>
            </div>

            {/* CONTROLES DE DATA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
                {tipoFiltroData === 'mes' && (
                    <>
                        <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer">
                            {meses.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                        </select>
                        <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer">
                            {anosUnicos.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </>
                )}
                {tipoFiltroData === 'periodo' && (
                    <>
                        <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer" />
                        <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer" />
                    </>
                )}
                {tipoFiltroData === 'dia' && (
                    <div className="sm:col-span-2">
                        <input type="date" value={diaEspecifico} onChange={(e) => setDiaEspecifico(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer" />
                    </div>
                )}
            </div>

            {/* TABELA DENSIDADE ALTA (ESTILO EXCEL) */}
            <div className="flex-1 overflow-auto custom-scrollbar border border-slate-200 rounded-2xl shadow-inner bg-slate-50">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-slate-800 text-white sticky top-0 z-10 shadow-md">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b border-slate-900">Unidade</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b border-slate-900 text-center">Total Entradas</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b border-slate-900 text-center">Em Atendimento (Kanban)</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b border-slate-900 text-center text-emerald-400">Convertidos (Matriculou)</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b border-slate-900 text-center text-rose-400">Perdidos (Geladeira)</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b border-slate-900 text-center text-amber-400">Fizeram Day Use</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b border-slate-900 text-right">Taxa de Conversão</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {relatorioUnidades.length === 0 ? (
                            <tr><td colSpan="7" className="text-center py-16 text-slate-400 font-bold uppercase tracking-widest text-xs bg-white">Nenhum dado encontrado para o período.</td></tr>
                        ) : (
                            relatorioUnidades.map((row, idx) => (
                                <tr key={row.unidade} className="hover:bg-indigo-50/50 transition-colors">
                                    <td className="px-6 py-3 border-r border-slate-100">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-400">{idx + 1}º</span>
                                            <p className="text-sm font-black text-slate-800 uppercase">{row.unidade}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-center border-r border-slate-100">
                                        <span className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">{row.total}</span>
                                    </td>
                                    <td className="px-6 py-3 text-center border-r border-slate-100">
                                        <span className="text-sm font-bold text-slate-500">{row.emAtendimento}</span>
                                    </td>
                                    <td className="px-6 py-3 text-center border-r border-emerald-50">
                                        <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">{row.fechados}</span>
                                    </td>
                                    <td className="px-6 py-3 text-center border-r border-rose-50">
                                        <span className="text-sm font-bold text-rose-500">{row.perdidos}</span>
                                    </td>
                                    <td className="px-6 py-3 text-center border-r border-amber-50">
                                        <span className="text-sm font-bold text-amber-600">{row.dayUse}</span>
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <TrendingUp className={`w-4 h-4 ${row.taxaConversao >= 30 ? 'text-emerald-500' : row.taxaConversao >= 15 ? 'text-blue-500' : 'text-orange-500'}`} />
                                            <span className="text-base font-black text-slate-800">{row.taxaConversao}%</span>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    {/* LINHA DE TOTAIS FIXA NO RODAPÉ */}
                    {relatorioUnidades.length > 0 && (
                        <tfoot className="bg-slate-100 sticky bottom-0 border-t-2 border-slate-300 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
                            <tr>
                                <td className="px-6 py-5 text-sm font-black text-slate-800 uppercase tracking-widest border-r border-slate-200">Total Global</td>
                                <td className="px-6 py-5 text-center font-black text-slate-800 text-base border-r border-slate-200">{totaisGerais.total}</td>
                                <td className="px-6 py-5 text-center font-black text-slate-600 text-base border-r border-slate-200">{totaisGerais.emAtendimento}</td>
                                <td className="px-6 py-5 text-center font-black text-emerald-700 text-base border-r border-slate-200">{totaisGerais.fechados}</td>
                                <td className="px-6 py-5 text-center font-black text-rose-600 text-base border-r border-slate-200">{totaisGerais.perdidos}</td>
                                <td className="px-6 py-5 text-center font-black text-amber-600 text-base border-r border-slate-200">{totaisGerais.dayUse}</td>
                                <td className="px-6 py-5 text-right font-black text-indigo-700 text-lg">{taxaConversaoGeral}%</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
};

export default RelatorioCrm;