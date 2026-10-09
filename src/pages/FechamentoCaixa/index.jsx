import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { mesesLista, formatMoney, getUltimos6Meses } from './utils.js';
import ConferenciaTab from './ConferenciaTab.jsx';
import ComissoesTab from './ComissoesTab.jsx';
import VisaoGeralTab from './VisaoGeralTab.jsx';
import AuditoriaTab from './AuditoriaTab.jsx';
import { CalendarDays, CalendarRange, Sun, RefreshCw, Building2, UserCheck, AlertCircle, PieChart, ShieldAlert, Wallet, ClipboardCheck, Users, BarChart2 } from 'lucide-react';

const FechamentoCaixa = ({ vendas = [], setVendas, usuarioLogado, visitantes = [], avaliacoes = [], colaboradores = [] }) => {
    const [subAba, setSubAba] = useState('conferencia');
    
    // 🔥 BUSCA O CATÁLOGO DIRETAMENTE NA FONTE (Evita o erro de drop-down vazio)
    const [catalogoGeral, setCatalogoGeral] = useState([]);
    useEffect(() => {
        const fetchCatalogo = async () => {
            const { data, error } = await supabase.from('catalogo').select('id, nome, tipo, valor');
            if (data && !error) setCatalogoGeral(data);
        };
        fetchCatalogo();
    }, []);

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

    const limparFiltros = () => {
        setTipoFiltroAvancado('dia');
        setFiltroMes(String(new Date().getMonth() + 1).padStart(2, '0'));
        setFiltroAno(new Date().getFullYear().toString());
        setDataInicialInput('');
        setDataFinalInput('');
        setFiltroDia(new Date().toISOString().split('T')[0]);
        if (temVisaoGlobal) setFiltroUnidadeIsolada('TODOS');
    };

    const unidadesUnicas = ['TODOS', ...new Set(vendas.map(v => v.unidade))].filter(Boolean); 
    const anosUnicos = [...new Set(vendas.map(v => v.data?.split('-')[0]))].filter(Boolean).sort((a,b) => b-a);
    if(anosUnicos.length === 0) anosUnicos.push(new Date().getFullYear().toString());

    const vendasDataAvancada = vendas.filter(v => {
        if (!v.data) return false;
        if (tipoFiltroAvancado === 'dia') return v.data === filtroDia;
        if (tipoFiltroAvancado === 'mes') return v.data.startsWith(`${filtroAno}-${filtroMes}`);
        if (dataInicialInput && v.data < dataInicialInput) return false;
        if (dataFinalInput && v.data > dataFinalInput) return false;
        return true;
    });

    const vendasParaConferencia = vendasDataAvancada.filter(v => {
        const unid = v.unidade || 'MATRIZ';
        const passUnidade = filtroUnidadeIsolada === 'TODOS' || unid === filtroUnidadeIsolada;
        const passSeguranca = temVisaoGlobal || unid === usuarioLogado?.unidade;
        return passUnidade && passSeguranca;
    });

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

    const handleSalvarEdicaoVenda = async (vendaEditada) => {
        const { error } = await supabase.from('vendas').update({
            data: vendaEditada.data,
            vendedor: vendaEditada.vendedor,
            nome_aluno: vendaEditada.nome_aluno,
            nome: vendaEditada.nome,
            cpf: vendaEditada.cpf,
            matricula: vendaEditada.matricula,
            produto: vendaEditada.produto,
            quantidade: vendaEditada.quantidade,
            valor: vendaEditada.valor
        }).eq('id', vendaEditada.id);

        if (error) {
            console.error("Erro ao editar venda:", error);
            alert("Erro ao salvar a edição. Tente novamente.");
            throw error; 
        } else {
            setVendas(vendas.map(v => v.id === vendaEditada.id ? { ...v, ...vendaEditada } : v));
        }
    };

    const handleExcluirVenda = async (id) => {
        const { error } = await supabase.from('vendas').delete().eq('id', id);
        if (error) {
            console.error("Erro ao excluir venda:", error);
            alert("Erro ao excluir. Tente novamente.");
        } else {
            setVendas(vendas.filter(v => v.id !== id));
        }
    };

    const marcarTodosConferidos = async (idsParaMarcar = []) => {
        const idsAlvo = Array.isArray(idsParaMarcar) && idsParaMarcar.length > 0 ? idsParaMarcar : vendasParaConferencia.map(v => v.id);
        if (idsAlvo.length === 0) return;
        if (!window.confirm(`Marcar os ${idsAlvo.length} itens da lista atual como CONFERIDOS?`)) return;
        
        const validadorNome = usuarioLogado.nome;
        const validadorData = new Date().toISOString();

        setVendas(vendas.map(v => idsAlvo.includes(v.id) ? { ...v, conferiu: true, conferido_por: validadorNome, conferido_em: validadorData } : v));
        await supabase.from('vendas').update({ conferiu: true, conferido_por: validadorNome, conferido_em: validadorData }).in('id', idsAlvo);
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

    const normalizarTexto = (texto) => String(texto || '').replace(/\s+/g, ' ').trim().toUpperCase();

    const dadosTabelaComissoes = Object.values(relatorioVendedores).map(r => {
        const nomeVenda = normalizarTexto(r.vendedor);
        let infoColaborador = colaboradores.find(c => normalizarTexto(c.nome) === nomeVenda);
        
        if (!infoColaborador) {
            infoColaborador = colaboradores.find(c => {
                if (!c.nome) return false;
                const nomeRH = normalizarTexto(c.nome);
                if (nomeRH.length < 3) return false; 
                return nomeVenda.includes(nomeRH) || nomeRH.includes(nomeVenda);
            });
        }

        infoColaborador = infoColaborador || {}; 

        return {
            ...r, 
            totalItens: Object.values(r.itens).reduce((acc, q) => acc + q, 0),
            cpf: infoColaborador.cpf || '',
            tipo_conta: infoColaborador.tipo_conta || '',
            conta_inter: infoColaborador.conta_inter || ''
        };
    }).sort((a, b) => b.totalComissao - a.totalComissao);

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
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto pb-10">
            
            {/* NOVO HEADER REDESIGN PREMIUM */}
            <div className="bg-white rounded-[24px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-200 p-6 md:p-8 relative z-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-600 text-white rounded-[18px] flex items-center justify-center shrink-0 shadow-md">
                            <Wallet className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Fechamento & Auditoria</h2>
                            <p className="text-[13px] font-medium text-slate-500 mt-0.5">Gestão Financeira • Unidade {usuarioLogado?.unidade}</p>
                            <p className="text-[11px] font-medium text-slate-400 mt-0.5">Selecione o período desejado para conferência de caixa e comissionamento.</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                        <button onClick={limparFiltros} title="Limpar Filtros" className="flex flex-col items-center justify-center w-14 h-14 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-500 rounded-[16px] transition-all shadow-sm shrink-0">
                            <RefreshCw className="w-4 h-4 mb-0.5" />
                            <span className="text-[8px] font-black uppercase tracking-widest leading-none text-center">Limpar<br/>Filtros</span>
                        </button>
                        
                        <div className="flex bg-slate-50 p-1.5 rounded-[20px] border border-slate-200 flex-1 md:flex-none overflow-x-auto custom-scrollbar shadow-inner">
                            <button onClick={() => setTipoFiltroAvancado('mes')} className={`flex-1 md:w-32 px-4 py-3 rounded-[14px] text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${tipoFiltroAvancado === 'mes' ? 'bg-white shadow-sm text-indigo-700 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                                <CalendarDays className="w-4 h-4" /> Mês
                            </button>
                            <button onClick={() => setTipoFiltroAvancado('periodo')} className={`flex-1 md:w-32 px-4 py-3 rounded-[14px] text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${tipoFiltroAvancado === 'periodo' ? 'bg-white shadow-sm text-indigo-700 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                                <CalendarRange className="w-4 h-4" /> Período
                            </button>
                            <button onClick={() => setTipoFiltroAvancado('dia')} className={`flex-1 md:w-32 px-4 py-3 rounded-[14px] text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${tipoFiltroAvancado === 'dia' ? 'bg-white shadow-sm text-indigo-700 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                                <Sun className="w-4 h-4" /> Dia
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 mb-6">
                    {tipoFiltroAvancado === 'mes' && (
                        <>
                            <div className="bg-slate-50/50 border border-slate-100 rounded-[20px] p-4 flex flex-col gap-3 transition-colors hover:bg-slate-50">
                                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Mês Ref.</label>
                                <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none shadow-sm cursor-pointer">
                                    {mesesLista.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                                </select>
                            </div>
                            <div className="bg-slate-50/50 border border-slate-100 rounded-[20px] p-4 flex flex-col gap-3 transition-colors hover:bg-slate-50">
                                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Ano Ref.</label>
                                <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none shadow-sm cursor-pointer">
                                    {anosUnicos.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                        </>
                    )}

                    {tipoFiltroAvancado === 'periodo' && (
                        <>
                            <div className="bg-slate-50/50 border border-slate-100 rounded-[20px] p-4 flex flex-col gap-3 transition-colors hover:bg-slate-50">
                                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">A partir de</label>
                                <input type="date" value={dataInicialInput} onChange={(e) => setDataInicialInput(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none shadow-sm" />
                            </div>
                            <div className="bg-slate-50/50 border border-slate-100 rounded-[20px] p-4 flex flex-col gap-3 transition-colors hover:bg-slate-50">
                                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Até (Fim)</label>
                                <input type="date" value={dataFinalInput} onChange={(e) => setDataFinalInput(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none shadow-sm" />
                            </div>
                        </>
                    )}

                    {tipoFiltroAvancado === 'dia' && (
                        <div className="xl:col-span-2 bg-slate-50/50 border border-slate-100 rounded-[20px] p-4 flex flex-col gap-3 transition-colors hover:bg-slate-50">
                            <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Dia Específico</label>
                            <input type="date" value={filtroDia} onChange={(e) => setFiltroDia(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none shadow-sm" />
                        </div>
                    )}

                    {temVisaoGlobal && (
                        <div className="bg-rose-50/30 border border-rose-100 rounded-[20px] p-4 flex flex-col gap-3 transition-colors hover:bg-rose-50/50">
                            <label className="text-[11px] font-black text-rose-700 uppercase tracking-widest flex items-center gap-2"><Building2 className="w-3 h-3"/> Isolar Unidade</label>
                            <select value={filtroUnidadeIsolada} onChange={(e) => setFiltroUnidadeIsolada(e.target.value)} className="w-full bg-white border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm font-black outline-none cursor-pointer uppercase shadow-sm">
                                {unidadesUnicas.map(u => <option key={u} value={u}>{u === 'TODOS' ? 'TODAS AS UNIDADES' : u}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                {/* BOTÕES DE ABAS */}
                <div className="flex bg-slate-100 p-1.5 rounded-[18px] w-full border border-slate-200 overflow-x-auto custom-scrollbar shadow-inner mt-4">
                    <button onClick={() => setSubAba('conferencia')} className={`flex-1 md:min-w-[150px] px-4 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${subAba === 'conferencia' ? 'bg-white shadow-sm text-indigo-600 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                        <ClipboardCheck className="w-4 h-4" /> Conferência
                    </button>
                    <button onClick={() => setSubAba('comissoes')} className={`flex-1 md:min-w-[150px] px-4 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${subAba === 'comissoes' ? 'bg-white shadow-sm text-emerald-600 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                        <Users className="w-4 h-4" /> Comissões
                    </button>
                    <button onClick={() => setSubAba('geral')} className={`flex-1 md:min-w-[150px] px-4 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${subAba === 'geral' ? 'bg-white shadow-sm text-violet-600 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                        <PieChart className="w-4 h-4" /> Visão Geral
                    </button>
                    {temVisaoGlobal && (
                        <button onClick={() => setSubAba('auditoria')} className={`flex-1 md:min-w-[150px] px-4 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${subAba === 'auditoria' ? 'bg-white shadow-sm text-rose-600 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                            <ShieldAlert className="w-4 h-4" /> Auditoria
                        </button>
                    )}
                </div>
            </div>

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

            {subAba === 'conferencia' && (
                <ConferenciaTab 
                    vendasParaConferencia={vendasParaConferencia} 
                    catalogoCompleto={catalogoGeral} // <- Aqui o Catálogo carrega no pop-up!
                    temVisaoGlobal={temVisaoGlobal} 
                    colunasVisiveis={colunasVisiveis}
                    usuarioLogado={usuarioLogado}
                    marcarTodosConferidos={marcarTodosConferidos} 
                    toggleConferido={toggleConferido} 
                    handleObsLocalChange={handleObsLocalChange} 
                    handleObsSaveDb={handleObsSaveDb}
                    onSalvarEdicao={handleSalvarEdicaoVenda}
                    onExcluirVenda={handleExcluirVenda}
                />
            )}
            {subAba === 'comissoes' && <ComissoesTab dadosTabelaComissoes={dadosTabelaComissoes} />}
            {subAba === 'auditoria' && temVisaoGlobal && <AuditoriaTab dadosTabelaAuditoria={dadosTabelaAuditoria} />}
            {subAba === 'geral' && <VisaoGeralTab mesAtualLabel={mesAtualLabel} totalGeralRedeAtual={totalGeralRedeAtual} visaoGeralUnidades={visaoGeralUnidades} />}
        </div>
    );
};

export default FechamentoCaixa;