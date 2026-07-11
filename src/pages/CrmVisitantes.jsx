import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js'; // 🔥 Conexão com a Nuvem!

// Componente interno para os Cards do Dashboard com Gradientes Premium
const DashCard = ({ title, value, icon, gradient, subtitle }) => (
    <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-all`}>
        <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform">{icon}</div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">{title}</p>
        <p className="text-4xl font-black tracking-tight">{value}</p>
        {subtitle && <p className="text-[10px] font-bold mt-4 opacity-80 bg-white/10 self-start px-2.5 py-1 rounded-md inline-block">{subtitle}</p>}
    </div>
);

// ATENÇÃO: Recebendo a prop usuarioLogado aqui!
const CrmVisitantes = ({ usuarioLogado, visitantes = [], setVisitantes, colaboradores = [] }) => {
    // ==========================================
    // 1. ESTADOS DO COMPONENTE
    // ==========================================
    const [formData, setFormData] = useState({ 
        nome: '', telefone: '', vendedor: '', observacao: '' 
    });
    const [visaoAtiva, setVisaoAtiva] = useState('kanban'); // 'kanban' ou 'dashboard'
    const [sucesso, setSucesso] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => { if (window.lucide) window.lucide.createIcons(); }, [visaoAtiva, visitantes.length, sucesso, isSubmitting]);

    // ==========================================
    // 2. CONFIGURAÇÃO DO FUNIL (KANBAN)
    // ==========================================
    const COLUNAS = ['Novo', 'Em Contato', 'Experimental', 'Convertido', 'Perdido'];
    
    const STATUS_TOKENS = {
        'Novo': { border: 'border-blue-200', text: 'text-blue-700', bg: 'bg-blue-50/50', accent: 'bg-blue-500' },
        'Em Contato': { border: 'border-amber-200', text: 'text-amber-700', bg: 'bg-amber-50/50', accent: 'bg-amber-500' },
        'Experimental': { border: 'border-purple-200', text: 'text-purple-700', bg: 'bg-purple-50/50', accent: 'bg-purple-500' },
        'Convertido': { border: 'border-emerald-200', text: 'text-emerald-700', bg: 'bg-emerald-50/50', accent: 'bg-emerald-500' },
        'Perdido': { border: 'border-rose-200', text: 'text-rose-700', bg: 'bg-rose-50/50', accent: 'bg-rose-500' }
    };

    // ==========================================
    // 3. AÇÕES (CRUD SUPABASE)
    // ==========================================
    const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});

    // Criar novo Lead
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.vendedor) {
            alert('Por favor, selecione um vendedor.');
            return;
        }

        setIsSubmitting(true);
        
        // EMPACOTANDO COM A UNIDADE DO USUÁRIO LOGADO
        const novoLead = { 
            unidade: usuarioLogado?.unidade || 'MATRIZ', // O CARIMBO DE MULTITENÂNCIA AQUI
            nome: formData.nome.toUpperCase(), 
            telefone: formData.telefone, 
            vendedor: formData.vendedor, 
            observacao: formData.observacao,
            data: new Date().toLocaleDateString('pt-BR'), 
            status: 'Novo' 
        };

        const { data, error } = await supabase.from('leads').insert([novoLead]).select();

        if (error) {
            console.error("Erro ao salvar lead:", error);
            alert("Erro de conexão ao salvar na nuvem.");
        } else if (data) {
            setVisitantes([data[0], ...visitantes]);
            setSucesso(true);
            setTimeout(() => setSucesso(false), 3000);
            setFormData({ nome: '', telefone: '', vendedor: '', observacao: '' });
        }
        
        setIsSubmitting(false);
    };

    // Mover de Coluna
    const alterarStatus = async (id, novoStatus) => {
        const leadAtual = visitantes.find(v => v.id === id);
        const statusAntigo = leadAtual ? leadAtual.status : null;

        // 1. Atualização Otimista (move o cartão na hora)
        setVisitantes(visitantes.map(v => v.id === id ? { ...v, status: novoStatus } : v));

        // 2. Salva no banco de dados em background
        const { error } = await supabase.from('leads').update({ status: novoStatus }).eq('id', id);

        if (error) {
            console.error("Erro ao atualizar status:", error);
            alert("Erro de conexão. Revertendo ação.");
            setVisitantes(visitantes.map(v => v.id === id ? { ...v, status: statusAntigo } : v));
        }
    };

    // Apagar Lead
    const deletarLead = async (id) => {
        if(window.confirm('Excluir este Lead do funil? Esta ação não pode ser desfeita.')) {
            // 1. Atualização Otimista
            const backupVisitantes = [...visitantes];
            setVisitantes(visitantes.filter(v => v.id !== id));

            // 2. Apaga da Nuvem
            const { error } = await supabase.from('leads').delete().eq('id', id);

            if (error) {
                console.error("Erro ao deletar lead:", error);
                alert("Erro ao excluir do banco de dados.");
                setVisitantes(backupVisitantes);
            }
        }
    };

    // ==========================================
    // 4. LÓGICA MATEMÁTICA (KPIs)
    // ==========================================
    const totalLeads = visitantes.length;
    const convertidos = visitantes.filter(v => v.status === 'Convertido').length;
    const perdidos = visitantes.filter(v => v.status === 'Perdido').length;
    const taxaConversao = totalLeads > 0 ? Math.round((convertidos / totalLeads) * 100) : 0;

    const leadsPorVendedor = colaboradores.map(c => {
        const leads = visitantes.filter(v => v.vendedor === c.nome);
        const conv = leads.filter(v => v.status === 'Convertido').length;
        return { nome: c.nome, total: leads.length, convertidos: conv, taxa: leads.length > 0 ? Math.round((conv / leads.length) * 100) : 0 };
    }).filter(v => v.total > 0).sort((a, b) => b.convertidos - a.convertidos || b.taxa - a.taxa);

    return (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto relative">
            
            {/* ALERTA DE SUCESSO */}
            {sucesso && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-[0_8px_20px_rgba(16,185,129,0.4)] flex items-center gap-3 font-black uppercase tracking-wider text-xs z-50">
                    <i data-lucide="check-circle-2" className="w-5 h-5"></i> Lead Salvo na Nuvem!
                </div>
            )}

            {/* BLOCO 1: BARRA DE CAPTURA RÁPIDA (Design Minimalista) */}
            <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-6 flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between">
                
                <div className="flex items-center gap-4 w-full xl:w-auto">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-inner border border-blue-100 flex-shrink-0">
                        <i data-lucide="user-plus" className="w-6 h-6"></i>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Captura de Leads</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Unidade {usuarioLogado?.unidade}</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-end gap-3 w-full xl:w-auto bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="w-full sm:w-48">
                        <input type="text" name="nome" value={formData.nome} onChange={handleChange} required placeholder="Nome do Lead" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm uppercase" />
                    </div>
                    <div className="w-full sm:w-40">
                        <input type="text" name="telefone" value={formData.telefone} onChange={handleChange} required placeholder="WhatsApp" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                    </div>
                    <div className="w-full sm:w-36">
                        <select name="vendedor" value={formData.vendedor} onChange={handleChange} required className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer shadow-sm uppercase">
                            <option value="">Consultor...</option>
                            {colaboradores.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                        </select>
                    </div>
                    <div className="w-full sm:w-48">
                        <input type="text" name="observacao" value={formData.observacao} onChange={handleChange} placeholder="Como conheceu? (Obs)" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-black px-6 py-2.5 rounded-xl shadow-[0_4px_15px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-2 h-[38px] text-xs uppercase tracking-widest">
                        {isSubmitting ? <i data-lucide="loader-2" className="w-4 h-4 animate-spin"></i> : 'Inserir'}
                    </button>
                </form>
            </div>

            {/* BLOCO 2: SWITCHER DE VISÃO (Kanban / Dashboard) */}
            <div className="flex bg-slate-200 p-1.5 rounded-xl border border-slate-300/60 shadow-inner w-full max-w-sm mx-auto">
                <button onClick={() => setVisaoAtiva('kanban')} className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${visaoAtiva === 'kanban' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}>
                    <i data-lucide="kanban" className="w-4 h-4"></i> Board (CRM)
                </button>
                <button onClick={() => setVisaoAtiva('dashboard')} className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${visaoAtiva === 'dashboard' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}>
                    <i data-lucide="pie-chart" className="w-4 h-4"></i> Métricas
                </button>
            </div>

            {/* ======================================================= */}
            {/* EXIBIÇÃO CONDICIONAL */}
            {/* ======================================================= */}
            {visaoAtiva === 'dashboard' ? (
                
                /* MODO 1: DASHBOARD ANALÍTICO */
                <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                    
                    {/* Cards Superiores */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <DashCard title="Total de Leads" value={totalLeads} icon={<i data-lucide="users" className="w-32 h-32"></i>} subtitle="Potenciais alunos" gradient="from-blue-600 to-blue-800" />
                        <DashCard title="Convertidos" value={convertidos} icon={<i data-lucide="user-check" className="w-32 h-32"></i>} subtitle="Matrículas fechadas" gradient="from-emerald-500 to-teal-700" />
                        <DashCard title="Perdidos" value={perdidos} icon={<i data-lucide="user-x" className="w-32 h-32"></i>} subtitle="Sem interesse" gradient="from-rose-500 to-red-700" />
                        <DashCard title="Conversão Global" value={`${taxaConversao}%`} icon={<i data-lucide="target" className="w-32 h-32"></i>} subtitle="Eficiência do time" gradient="from-indigo-600 to-purple-800" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Funil de Conversão */}
                        <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-8 flex flex-col min-h-[400px]">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <i data-lucide="filter" className="w-5 h-5 text-blue-500"></i> Funil de Vendas
                            </h3>
                            <div className="space-y-6 flex-1 flex flex-col justify-center">
                                {COLUNAS.map((col) => {
                                    const qtd = visitantes.filter(v => v.status === col).length;
                                    const perc = totalLeads > 0 ? (qtd / totalLeads) * 100 : 0;
                                    return (
                                        <div key={col}>
                                            <div className="flex justify-between items-end mb-2 text-xs font-black uppercase tracking-widest text-slate-700">
                                                <span>{col}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-slate-400">{perc.toFixed(0)}%</span>
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">{qtd} un</span>
                                                </div>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                                                <div className={`h-full rounded-full ${STATUS_TOKENS[col].accent} shadow-md transition-all duration-1000`} style={{ width: `${perc}%` }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Ranking de SDRs (Vendedores) */}
                        <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-8 flex flex-col min-h-[400px]">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                                <i data-lucide="award" className="w-5 h-5 text-amber-500"></i> Conversão por Consultor
                            </h3>
                            <div className="overflow-x-auto custom-scrollbar flex-1">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase border-b border-slate-100">Consultor</th>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-center border-b border-slate-100">Leads</th>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-center border-b border-slate-100">Vendas</th>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase text-center border-b border-slate-100">Win Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {leadsPorVendedor.length > 0 ? leadsPorVendedor.map((v, i) => (
                                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-4 text-xs font-black text-slate-700 uppercase flex items-center gap-3">
                                                    {i === 0 ? <span className="text-amber-500 text-lg drop-shadow-md">🥇</span> : <span className="w-5"></span>}
                                                    {v.nome}
                                                </td>
                                                <td className="px-4 py-4 text-xs text-center font-bold text-slate-500">{v.total}</td>
                                                <td className="px-4 py-4 text-xs text-center font-black text-emerald-600">{v.convertidos}</td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${v.taxa >= 30 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                                        {v.taxa}%
                                                    </span>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="4" className="text-center py-10 text-slate-400 text-xs font-bold uppercase tracking-widest opacity-60">Equipe sem Leads processados</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                
                /* MODO 2: KANBAN MATADOR (Estilo Trello/Linear) */
                <div className="flex gap-5 overflow-x-auto pb-6 custom-scrollbar animate-[fadeIn_0.3s_ease-out] items-start min-h-[600px] px-1">
                    {COLUNAS.map(coluna => {
                        const leadsDaColuna = visitantes.filter(v => v.status === coluna);
                        
                        return (
                            <div key={coluna} className={`rounded-[20px] border ${STATUS_TOKENS[coluna].border} bg-slate-50/80 shadow-sm flex flex-col min-w-[290px] max-w-[290px] flex-shrink-0`}>
                                
                                {/* Header da Coluna */}
                                <div className={`p-4 border-b ${STATUS_TOKENS[coluna].border} ${STATUS_TOKENS[coluna].bg} rounded-t-[20px] flex justify-between items-center sticky top-0 backdrop-blur-sm z-10`}>
                                    <h3 className={`font-black ${STATUS_TOKENS[coluna].text} text-[11px] flex items-center gap-2 uppercase tracking-widest`}>
                                        <span className={`w-2 h-2 rounded-full ${STATUS_TOKENS[coluna].accent} shadow-sm`}></span>
                                        {coluna}
                                    </h3>
                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-md shadow-sm border bg-white ${STATUS_TOKENS[coluna].text} ${STATUS_TOKENS[coluna].border}`}>
                                        {leadsDaColuna.length}
                                    </span>
                                </div>
                                
                                {/* Área de Cartões (Scrollável internamente se ficar muito grande) */}
                                <div className="p-3 flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar" style={{ maxHeight: '65vh' }}>
                                    
                                    {leadsDaColuna.map(v => (
                                        <div key={v.id} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all group flex flex-col">
                                            
                                            {/* Topo do Cartão: Nome e Lixeira */}
                                            <div className="flex justify-between items-start mb-3">
                                                <h4 className="font-black text-slate-800 text-sm leading-tight pr-2 uppercase">{v.nome}</h4>
                                                <button onClick={() => deletarLead(v.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" title="Excluir Lead">
                                                    <i data-lucide="trash-2" className="w-4 h-4"></i>
                                                </button>
                                            </div>
                                            
                                            {/* Meio: Informações */}
                                            <div className="space-y-2.5 mb-4 flex-1">
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                    <i data-lucide="calendar" className="w-3 h-3"></i> {v.data}
                                                </div>
                                                
                                                {/* Vendedor Tag */}
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 w-fit pr-3 py-1 rounded-full border border-slate-100 uppercase">
                                                    <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] ml-1 border border-indigo-200">
                                                        {v.vendedor.charAt(0)}
                                                    </div>
                                                    {v.vendedor}
                                                </div>

                                                {/* Observação (Se existir) */}
                                                {v.observacao && (
                                                    <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-100 text-xs font-medium text-amber-900 line-clamp-2" title={v.observacao}>
                                                        <i data-lucide="info" className="w-3 h-3 inline mr-1 opacity-70"></i>
                                                        {v.observacao}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Rodapé do Cartão: WhatsApp e Mover */}
                                            <div className="flex items-center gap-2 pt-3 border-t border-slate-100 mt-auto">
                                                <a 
                                                    href={`https://wa.me/55${v.telefone.replace(/\D/g, '')}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="w-8 h-8 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg flex items-center justify-center border border-emerald-200 hover:border-emerald-500 transition-colors flex-shrink-0"
                                                    title="Chamar no WhatsApp"
                                                >
                                                    <i data-lucide="message-circle" className="w-4 h-4"></i>
                                                </a>
                                                
                                                <select
                                                    value={v.status}
                                                    onChange={(e) => alterarStatus(v.id, e.target.value)}
                                                    className="w-full text-[10px] font-black uppercase tracking-widest text-slate-600 border border-slate-200 rounded-lg h-8 px-2 bg-slate-50 hover:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors outline-none"
                                                >
                                                    {COLUNAS.map(c => <option key={c} value={c}>Mover: {c}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Placeholder caso a coluna esteja vazia */}
                                    {leadsDaColuna.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-10 opacity-40">
                                            <i data-lucide="inbox" className="w-8 h-8 text-slate-400 mb-2"></i>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Coluna Vazia</p>
                                        </div>
                                    )}

                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
};

export default CrmVisitantes;