import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { mesesLista, formatMoney, getUltimos6Meses } from './utils.js';
import ConferenciaTab from './ConferenciaTab.jsx';
import ComissoesTab from './ComissoesTab.jsx';
import VisaoGeralTab from './VisaoGeralTab.jsx';
import AuditoriaTab from './AuditoriaTab.jsx';

const FechamentoCaixa = ({ vendas = [], setVendas, usuarioLogado }) => {
    const [subAba, setSubAba] = useState('conferencia');

    const [confProduto, setConfProduto] = useState('TODOS');
    const [confVendedor, setConfVendedor] = useState('TODOS');

    const [tipoFiltroAvancado, setTipoFiltroAvancado] = useState('mes');
    const [filtroMes, setFiltroMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
    const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
    const [dataInicialInput, setDataInicialInput] = useState('');
    const [dataFinalInput, setDataFinalInput] = useState('');
    const [filtroDia, setFiltroDia] = useState(new Date().toISOString().split('T')[0]);
    const [filtroUnidadeIsolada, setFiltroUnidadeIsolada] = useState('TODOS'); 

    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    let colunasVisiveis = 10;
    if (temVisaoGlobal) colunasVisiveis++;

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [subAba, tipoFiltroAvancado]);

    const produtosUnicos = ['TODOS', ...new Set(vendas.map(v => v.produto))].filter(Boolean);
    const vendedoresUnicos = ['TODOS', ...new Set(vendas.map(v => v.vendedor))].filter(Boolean);
    const unidadesUnicas = ['TODOS', ...new Set(vendas.map(v => v.unidade))].filter(Boolean); 
    const anosUnicos = [...new Set(vendas.map(v => v.data?.split('-')[0]))].filter(Boolean).sort((a,b) => b-a);
    if(anosUnicos.length === 0) anosUnicos.push(new Date().getFullYear().toString());

    // MOTOR DE DATA GLOBAL
    const vendasDataAvancada = vendas.filter(v => {
        if (!v.data) return false;
        if (tipoFiltroAvancado === 'dia') return v.data === filtroDia;
        if (tipoFiltroAvancado === 'mes') return v.data.startsWith(`${filtroAno}-${filtroMes}`);
        if (dataInicialInput && v.data < dataInicialInput) return false;
        if (dataFinalInput && v.data > dataFinalInput) return false;
        return true;
    });

    const vendasParaConferencia = vendasDataAvancada.filter(v => {
        const passProduto = confProduto === 'TODOS' || v.produto === confProduto;
        const passVendedor = confVendedor === 'TODOS' || v.vendedor === confVendedor;
        
        const unid = v.unidade || 'MATRIZ';
        const passUnidade = filtroUnidadeIsolada === 'TODOS' || unid === filtroUnidadeIsolada;
        const passSeguranca = temVisaoGlobal || unid === usuarioLogado?.unidade;

        return passProduto && passVendedor && passUnidade && passSeguranca;
    });

    const valorTotalAConferir = vendasParaConferencia.reduce((acc, v) => acc + (Number(v.valor) || 0), 0);

    const toggleConferido = async (id, statusAtual) => {
        const novoStatus = !statusAtual;
        const validadorNome = novoStatus ? usuarioLogado.nome : null;
        const validadorData = novoStatus ? new Date().toISOString() : null;

        setVendas(vendas.map(v => v.id === id ? { ...v, conferiu: novoStatus, conferido_por: validadorNome, conferido_em: validadorData } : v));
        const { error } = await supabase.from('vendas').update({ conferiu: novoStatus, conferido_por: validadorNome, conferido_em: validadorData }).eq('id', id);

        if (error) {
            console.error("Erro ao atualizar:", error);
            alert("Erro de conexão. Revertendo alteração.");
            setVendas(vendas.map(v => v.id === id ? { ...v, conferiu: statusAtual } : v));
        }
    };

    const handleObsLocalChange = (id, novaObs) => setVendas(vendas.map(v => v.id === id ? { ...v, observacao: novaObs } : v));
    const handleObsSaveDb = async (id, textoFinal) => await supabase.from('vendas').update({ observacao: textoFinal }).eq('id', id);

    const marcarTodosConferidos = async () => {
        const idsFiltrados = vendasParaConferencia.map(v => v.id);
        if (idsFiltrados.length === 0) return;
        if (!window.confirm(`Marcar os ${vendasParaConferencia.length} itens como CONFERIDOS?`)) return;
        
        const validadorNome = usuarioLogado.nome;
        const validadorData = new Date().toISOString();

        setVendas(vendas.map(v => idsFiltrados.includes(v.id) ? { ...v, conferiu: true, conferido_por: validadorNome, conferido_em: validadorData } : v));
        await supabase.from('vendas').update({ conferiu: true, conferido_por: validadorNome, conferido_em: validadorData }).in('id', idsFiltrados);
    };

    const vendasComissionadas = vendasDataAvancada.filter(v => {
        if (!v.conferiu) return false; 
        const unid = v.unidade || 'MATRIZ';
        if (temVisaoGlobal && filtroUnidadeIsolada !== 'TODOS' && unid !== filtroUnidadeIsolada) return false;
        if (!temVisaoGlobal && unid !== usuarioLogado?.unidade) return false;
        return true;
    });

    let comissaoTotalGeral = 0;
    const relatorioVendedores = {};

    vendasComissionadas.forEach(venda => {
        const valorComissao = Number(venda.valor) || 0;
        if (valorComissao <= 0) return; 

        comissaoTotalGeral += valorComissao;

        if (!relatorioVendedores[venda.vendedor]) {
            relatorioVendedores[venda.vendedor] = { vendedor: venda.vendedor, totalComissao: 0, itens: {} };
        }
        
        relatorioVendedores[venda.vendedor].totalComissao += valorComissao;
        const qty = parseInt(venda.quantidade) || 1;
        relatorioVendedores[venda.vendedor].itens[venda.produto] = (relatorioVendedores[venda.vendedor].itens[venda.produto] || 0) + qty;
    });

    const dadosTabelaComissoes = Object.values(relatorioVendedores).map(r => ({
        ...r, 
        totalItens: Object.values(r.itens).reduce((acc, q) => acc + q, 0)
    })).sort((a, b) => b.totalComissao - a.totalComissao);

    const relatorioAuditoria = {};
    let totalAuditoriaRegistrados = 0;
    let totalAuditoriaConferidos = 0;
    let totalAuditoriaPendentes = 0;

    vendasDataAvancada.forEach(v => {
        const unid = v.unidade || 'MATRIZ';
        if (filtroUnidadeIsolada !== 'TODOS' && unid !== filtroUnidadeIsolada) return;

        if (!relatorioAuditoria[unid]) relatorioAuditoria[unid] = { unidade: unid, registrados: 0, conferidos: 0, pendentes: 0 };
        
        relatorioAuditoria[unid].registrados++;
        totalAuditoriaRegistrados++;

        if (v.conferiu) {
            relatorioAuditoria[unid].conferidos++;
            totalAuditoriaConferidos++;
        } else {
            relatorioAuditoria[unid].pendentes++;
            totalAuditoriaPendentes++;
        }
    });

    const dadosTabelaAuditoria = Object.values(relatorioAuditoria).sort((a, b) => b.pendentes - a.pendentes);
    const ultimos6Meses = getUltimos6Meses();
    const mesAtualLabel = ultimos6Meses[0].label; 

    const unidadesParaAnalisar = temVisaoGlobal 
        ? unidadesUnicas.filter(u => u !== 'TODOS') 
        : [usuarioLogado?.unidade].filter(Boolean);

    const visaoGeralUnidades = unidadesParaAnalisar.map(unidade => {
        const vendasDaUnidade = vendas.filter(v => v.unidade === unidade && v.conferiu);
        const historico = ultimos6Meses.map(m => {
            const totalDoMes = vendasDaUnidade
                .filter(v => v.data?.startsWith(`${m.ano}-${m.mes}`))
                .reduce((acc, v) => acc + (Number(v.valor) || 0), 0);
            return { label: m.label, total: totalDoMes };
        }).reverse(); 

        const totalAtual = historico[historico.length - 1].total; 
        return { unidade, totalAtual, historico };
    }).sort((a, b) => b.totalAtual - a.totalAtual);

    const totalGeralRedeAtual = visaoGeralUnidades.reduce((acc, u) => acc + u.totalAtual, 0);

    return (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto">
            
            <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl shadow-inner border ${subAba === 'geral' ? 'bg-violet-50 text-violet-600 border-violet-100' : subAba === 'auditoria' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                        <i data-lucide={subAba === 'geral' ? "pie-chart" : subAba === 'auditoria' ? "shield-alert" : "wallet"} className="w-6 h-6"></i>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Fechamento & Auditoria</h2>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Unidade {usuarioLogado?.unidade}</p>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1.5 rounded-xl w-full md:w-auto overflow-x-auto custom-scrollbar">
                    <button onClick={() => setSubAba('conferencia')} className={`flex-1 md:w-36 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${subAba === 'conferencia' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                        <i data-lucide="clipboard-check" className="w-3.5 h-3.5"></i> Conferência
                    </button>
                    <button onClick={() => setSubAba('comissoes')} className={`flex-1 md:w-36 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${subAba === 'comissoes' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>
                        <i data-lucide="users" className="w-3.5 h-3.5"></i> Comissões
                    </button>
                    <button onClick={() => setSubAba('geral')} className={`flex-1 md:w-36 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${subAba === 'geral' ? 'bg-white shadow-sm text-violet-600' : 'text-slate-500 hover:text-slate-700'}`}>
                        <i data-lucide="bar-chart-2" className="w-3.5 h-3.5"></i> Visão Geral
                    </button>
                    {temVisaoGlobal && (
                        <button onClick={() => setSubAba('auditoria')} className={`flex-1 md:w-36 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${subAba === 'auditoria' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}>
                            <i data-lucide="shield-alert" className="w-3.5 h-3.5"></i> Auditoria
                        </button>
                    )}
                </div>
            </div>

            {/* O SEGREDO ESTAVA AQUI! Agora o filtro de data aparece na Conferência, Comissões e Auditoria */}
            {subAba !== 'geral' && (
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 md:p-8 animate-[fadeIn_0.3s_ease-out]">
                    <div className="flex flex-col xl:flex-row justify-between items-start gap-8">
                        <div className="flex-1 w-full">
                            <div className="flex bg-slate-100 p-1.5 rounded-xl mb-6 w-fit border border-slate-200 shadow-inner">
                                <button onClick={() => setTipoFiltroAvancado('mes')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${tipoFiltroAvancado === 'mes' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                                    <i data-lucide="calendar" className="w-3.5 h-3.5"></i> Mês
                                </button>
                                <button onClick={() => setTipoFiltroAvancado('periodo')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${tipoFiltroAvancado === 'periodo' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                                    <i data-lucide="calendar-days" className="w-3.5 h-3.5"></i> Período
                                </button>
                                <button onClick={() => setTipoFiltroAvancado('dia')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${tipoFiltroAvancado === 'dia' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                                    <i data-lucide="sun" className="w-3.5 h-3.5"></i> Dia Único
                                </button>
                            </div>

                            <div className="flex flex-col sm:flex-row items-end gap-4 w-full">
                                {tipoFiltroAvancado === 'mes' && (
                                    <>
                                        <div className="w-full sm:w-auto flex-1">
                                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Mês Ref.</label>
                                            <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-slate-500 outline-none cursor-pointer">
                                                {mesesLista.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="w-full sm:w-auto">
                                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Ano Ref.</label>
                                            <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="w-32 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-slate-500 outline-none cursor-pointer">
                                                {anosUnicos.map(a => <option key={a} value={a}>{a}</option>)}
                                            </select>
                                        </div>
                                    </>
                                )}

                                {tipoFiltroAvancado === 'periodo' && (
                                    <>
                                        <div className="w-full sm:w-auto flex-1">
                                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">De (Início)</label>
                                            <input type="date" value={dataInicialInput} onChange={(e) => setDataInicialInput(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-slate-500 outline-none cursor-pointer" />
                                        </div>
                                        <div className="w-full sm:w-auto flex-1">
                                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Até (Fim)</label>
                                            <input type="date" value={dataFinalInput} onChange={(e) => setDataFinalInput(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-slate-500 outline-none cursor-pointer" />
                                        </div>
                                    </>
                                )}

                                {tipoFiltroAvancado === 'dia' && (
                                    <div className="w-full sm:w-auto flex-1">
                                        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Dia Específico</label>
                                        <input type="date" value={filtroDia} onChange={(e) => setFiltroDia(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-slate-500 outline-none cursor-pointer" />
                                    </div>
                                )}

                                {temVisaoGlobal && (
                                    <div className="w-full sm:w-auto flex-1 animate-[fadeIn_0.3s_ease-out]">
                                        <label className="block text-[10px] font-semibold text-rose-500 uppercase tracking-widest mb-1.5 ml-1">Isolar Unidade</label>
                                        <select value={filtroUnidadeIsolada} onChange={(e) => setFiltroUnidadeIsolada(e.target.value)} className="w-full bg-rose-50/20 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-xs font-semibold focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer uppercase">
                                            {unidadesUnicas.map(u => <option key={u} value={u}>{u === 'TODOS' ? 'TODAS AS UNIDADES' : u}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SCORECARDS ESPECÍFICOS */}
            {subAba === 'comissoes' && (
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6 animate-[fadeIn_0.3s_ease-out]">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-2">Status do Repasse</h3>
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Pagamento Aprovado</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Comissão Total Auditada</p>
                        <p className="text-4xl font-bold text-emerald-700 tracking-tight leading-none">{formatMoney(comissaoTotalGeral)}</p>
                    </div>
                </div>
            )}

            {subAba === 'auditoria' && (
                <div className="flex gap-4 w-full xl:w-auto flex-wrap sm:flex-nowrap animate-[fadeIn_0.3s_ease-out]">
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col items-end flex-1 shadow-sm">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Registrado</span>
                        <span className="text-3xl font-black text-slate-800 tracking-tight leading-none mt-1">{totalAuditoriaRegistrados}</span>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex flex-col items-end flex-1 shadow-sm">
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Conferidos</span>
                        <span className="text-3xl font-black text-emerald-700 tracking-tight leading-none mt-1">{totalAuditoriaConferidos}</span>
                    </div>
                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex flex-col items-end flex-1 shadow-sm">
                        <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Pendentes</span>
                        <span className="text-3xl font-black text-rose-700 tracking-tight leading-none mt-1">{totalAuditoriaPendentes}</span>
                    </div>
                </div>
            )}

            {/* ABAS */}
            {subAba === 'conferencia' && (
                <ConferenciaTab 
                    vendasParaConferencia={vendasParaConferencia} temVisaoGlobal={temVisaoGlobal} colunasVisiveis={colunasVisiveis}
                    confVendedor={confVendedor} setConfVendedor={setConfVendedor} vendedoresUnicos={vendedoresUnicos}
                    confProduto={confProduto} setConfProduto={setConfProduto} produtosUnicos={produtosUnicos}
                    valorTotalAConferir={valorTotalAConferir} marcarTodosConferidos={marcarTodosConferidos} usuarioLogado={usuarioLogado}
                    toggleConferido={toggleConferido} handleObsLocalChange={handleObsLocalChange} handleObsSaveDb={handleObsSaveDb}
                />
            )}
            {subAba === 'comissoes' && <ComissoesTab dadosTabelaComissoes={dadosTabelaComissoes} />}
            {subAba === 'auditoria' && temVisaoGlobal && <AuditoriaTab dadosTabelaAuditoria={dadosTabelaAuditoria} />}
            {subAba === 'geral' && <VisaoGeralTab mesAtualLabel={mesAtualLabel} totalGeralRedeAtual={totalGeralRedeAtual} visaoGeralUnidades={visaoGeralUnidades} />}
        </div>
    );
};

export default FechamentoCaixa;