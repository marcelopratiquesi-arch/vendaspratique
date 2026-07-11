import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js'; // 🔥 Conexão com o Banco!

// ATENÇÃO: Recebendo a prop usuarioLogado aqui!
const AssinaturasPratique = ({ usuarioLogado, data = [], setData }) => {
    // ==========================================
    // 1. ESTADOS DOS FILTROS
    // ==========================================
    const [tipoFiltroData, setTipoFiltroData] = useState('mes'); // 'mes' ou 'periodo'
    
    // Filtro por Mês/Ano
    const [filtroMes, setFiltroMes] = useState('TODOS');
    const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
    
    // Filtro por Período Personalizado
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    
    // Filtro por Entidades
    const [filtroProduto, setFiltroProduto] = useState('TODOS');
    const [filtroVendedor, setFiltroVendedor] = useState('TODOS');
    const [filtroUnidade, setFiltroUnidade] = useState('TODOS'); // NOVO FILTRO DE UNIDADE

    // Verifica se o usuário atual possui cargo de gestão corporativa
    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';

    // Atualiza ícones do Lucide
    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [data, tipoFiltroData, filtroMes, filtroAno, filtroProduto, filtroVendedor, filtroUnidade]);

    // ==========================================
    // 2. FUNÇÕES DE BANCO DE DADOS (SUPABASE)
    // ==========================================
    const toggleConferiu = async (id, statusAtual) => {
        const novoStatus = !statusAtual;
        
        // 1. Atualização Otimista
        setData(data.map(v => v.id === id ? { ...v, conferiu: novoStatus } : v));

        // 2. Manda para a nuvem em segundo plano
        const { error } = await supabase
            .from('vendas')
            .update({ conferiu: novoStatus })
            .eq('id', id);

        if (error) {
            console.error("Erro ao atualizar status:", error);
            alert("Erro de conexão. O status voltará ao que era.");
            setData(data.map(v => v.id === id ? { ...v, conferiu: statusAtual } : v));
        }
    };

    const removerLancamento = async (id) => {
        if(window.confirm('Atenção: Tem certeza que deseja EXCLUIR permanentemente este registro da Nuvem?')) {
            // 1. Atualização Otimista
            const backupDados = [...data];
            setData(data.filter(v => v.id !== id));

            // 2. Apaga do Banco de Dados
            const { error } = await supabase
                .from('vendas')
                .delete()
                .eq('id', id);

            if (error) {
                console.error("Erro ao deletar:", error);
                alert("Erro ao excluir do banco de dados.");
                setData(backupDados);
            }
        }
    };

    // ==========================================
    // 3. LISTAS DINÂMICAS PARA OS FILTROS
    // ==========================================
    const produtosUnicos = ['TODOS', ...new Set(data.map(v => v.produto))].filter(Boolean);
    const vendedoresUnicos = ['TODOS', ...new Set(data.map(v => v.vendedor))].filter(Boolean);
    const unidadesUnicas = ['TODOS', ...new Set(data.map(v => v.unidade))].filter(Boolean); // LISTA DE UNIDADES
    const anosUnicos = [...new Set(data.map(v => v.data?.split('/')[2]))].filter(Boolean).sort((a,b) => b-a);
    if(anosUnicos.length === 0) anosUnicos.push(new Date().getFullYear().toString());

    const meses = [
        { val: 'TODOS', label: 'Todos os Meses' }, { val: '01', label: '01 - Janeiro' }, { val: '02', label: '02 - Fevereiro' },
        { val: '03', label: '03 - Março' }, { val: '04', label: '04 - Abril' }, { val: '05', label: '05 - Maio' },
        { val: '06', label: '06 - Junho' }, { val: '07', label: '07 - Julho' }, { val: '08', label: '08 - Agosto' },
        { val: '09', label: '09 - Setembro' }, { val: '10', label: '10 - Outubro' }, { val: '11', label: '11 - Novembro' },
        { val: '12', label: '12 - Dezembro' }
    ];

    // ==========================================
    // 4. MOTOR DE FILTRAGEM DE DADOS
    // ==========================================
    const vendasFiltradas = data.filter(venda => {
        // Filtro de Unidade (Apenas se o Admin/Mentor estiver logado)
        if (temVisaoGlobal && filtroUnidade !== 'TODOS' && venda.unidade !== filtroUnidade) return false;

        // Filtro de Produto e Vendedor
        if (filtroProduto !== 'TODOS' && venda.produto !== filtroProduto) return false;
        if (filtroVendedor !== 'TODOS' && venda.vendedor !== filtroVendedor) return false;

        // Filtro de Datas
        if (!venda.data) return false;
        const [d, m, y] = venda.data.split('/');
        const isoDate = `${y}-${m}-${d}`;

        if (tipoFiltroData === 'mes') {
            if (filtroMes !== 'TODOS' && m !== filtroMes) return false;
            if (filtroAno !== 'TODOS' && y !== filtroAno) return false;
        } else {
            if (dataInicio && isoDate < dataInicio) return false;
            if (dataFim && isoDate > dataFim) return false;
        }

        return true;
    });

    return (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto">
            
            {/* PAINEL DE FILTROS INTELIGENTE */}
            <div className="bg-white rounded-[24px] border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.01)] p-6 md:p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-inner">
                            <i data-lucide="filter" className="w-5 h-5"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Filtros de Histórico</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Sincronizado em tempo real</p>
                        </div>
                    </div>
                    
                    {/* Chave de Troca do Tipo de Data */}
                    <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-inner w-full md:w-auto">
                        <button 
                            onClick={() => setTipoFiltroData('mes')} 
                            className={`flex-1 md:w-36 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${tipoFiltroData === 'mes' ? 'bg-white shadow-sm text-blue-600 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <i data-lucide="calendar" className="w-3.5 h-3.5"></i> Mês / Ano
                        </button>
                        <button 
                            onClick={() => setTipoFiltroData('periodo')} 
                            className={`flex-1 md:w-44 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${tipoFiltroData === 'periodo' ? 'bg-white shadow-sm text-blue-600 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <i data-lucide="calendar-days" className="w-3.5 h-3.5"></i> Período Específico
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    
                    {/* Filtros de Data */}
                    {tipoFiltroData === 'mes' ? (
                        <>
                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Mês Ref.</label>
                                <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
                                    {meses.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Ano Ref.</label>
                                <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
                                    <option value="TODOS">Todos os Anos</option>
                                    {anosUnicos.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Data Início</label>
                                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer" />
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Data Fim</label>
                                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer" />
                            </div>
                        </>
                    )}

                    {/* Filtros de Vendedor e Produto */}
                    <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">SDR / Vendedor</label>
                        <select value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer uppercase">
                            {vendedoresUnicos.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Produto / Plano</label>
                        <select value={filtroProduto} onChange={(e) => setFiltroProduto(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer uppercase">
                            {produtosUnicos.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    {/* FILTRO DE UNIDADE DINÂMICO SÓ PARA ADMIN/MENTOR */}
                    {temVisaoGlobal && (
                        <div className="animate-[fadeIn_0.3s_ease-out]">
                            <label className="block text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1.5 ml-1">Isolar Unidade</label>
                            <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} className="w-full bg-white border border-rose-200 rounded-xl px-3 py-2.5 text-xs font-black text-rose-700 focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer uppercase">
                                {unidadesUnicas.map(u => <option key={u} value={u}>{u === 'TODOS' ? 'TODAS AS 10 UNIDADES' : u}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* TABELA DE HISTÓRICO */}
            <div className="bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden flex flex-col">
                
                <div className="px-6 py-5 border-b border-slate-100 bg-white flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2.5">
                            <i data-lucide="history" className="w-5 h-5 text-blue-500"></i> Histórico de Registros
                        </h2>
                    </div>
                    <div className="bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 shadow-sm">
                        {vendasFiltradas.length} de {data.length} Encontrados
                    </div>
                </div>
                
                <div className="overflow-x-auto custom-scrollbar" style={{ maxHeight: '65vh' }}>
                    <table className="w-full text-left border-collapse min-w-max">
                        <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 shadow-sm">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Data</th>
                                {temVisaoGlobal && <th className="px-6 py-4 text-[10px] font-black text-rose-500 uppercase tracking-widest border-b border-slate-200">Unidade</th>}
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Matrícula</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Aluno</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Plano/Produto</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Vendedor</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-center">Qtd</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-right">Valor Total</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {vendasFiltradas.map((row) => (
                                <tr key={row.id} className={`group transition-colors ${row.conferiu ? 'bg-emerald-50/20' : 'hover:bg-slate-50'}`}>
                                    <td className="px-6 py-4 text-xs font-semibold text-slate-500 whitespace-nowrap">{row.data}</td>
                                    
                                    {/* COLUNA DE UNIDADE DINÂMICA */}
                                    {temVisaoGlobal && (
                                        <td className="px-6 py-4 text-xs font-black text-rose-600 bg-rose-50/10 whitespace-nowrap uppercase">
                                            {row.unidade || 'MATRIZ'}
                                        </td>
                                    )}

                                    <td className="px-6 py-4 text-xs text-slate-700 font-bold whitespace-nowrap">{row.matricula || '-'}</td>
                                    <td className="px-6 py-4 text-xs text-slate-800 font-black uppercase max-w-[200px] truncate" title={row.nome_aluno || row.nome}>{row.nome_aluno || row.nome}</td>
                                    <td className="px-6 py-4 text-xs whitespace-nowrap">{row.produto}</td>
                                    <td className="px-6 py-4 text-xs whitespace-nowrap font-bold text-slate-600 uppercase">{row.vendedor}</td>
                                    <td className="px-6 py-4 text-xs text-center font-black text-slate-700">{row.quantidade || '1'}</td>
                                    <td className="px-6 py-4 text-xs font-black text-slate-800 whitespace-nowrap text-right">{row.valor}</td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => toggleConferiu(row.id, row.conferiu)} 
                                                title={row.conferiu ? "Desmarcar conferência" : "Marcar como OK"} 
                                                className={`p-2 rounded-lg transition-all flex items-center justify-center shadow-sm ${row.conferiu ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-white text-slate-400 hover:text-blue-600 border border-slate-200 hover:bg-slate-50'}`}
                                            >
                                                {row.conferiu ? <i data-lucide="check" className="w-3.5 h-3.5"></i> : <i data-lucide="circle" className="w-3.5 h-3.5"></i>}
                                            </button>
                                            <button 
                                                onClick={() => removerLancamento(row.id)} 
                                                title="Excluir Venda" 
                                                className="p-2 text-slate-400 bg-white border border-slate-200 hover:bg-rose-500 hover:text-white hover:border-rose-500 rounded-lg shadow-sm transition-all"
                                            >
                                                <i data-lucide="trash-2" className="w-3.5 h-3.5"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {vendasFiltradas.length === 0 && (
                                <tr>
                                    <td colSpan={temVisaoGlobal ? "9" : "8"} className="px-6 py-16 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                        <i data-lucide="filter-x" className="w-10 h-10 mx-auto text-slate-300 mb-4 opacity-50"></i>
                                        Nenhuma venda encontrada para estes filtros.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AssinaturasPratique;