import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient.js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Componente interno para os Cards do Dashboard com Gradientes Premium
const DashCard = ({ title, value, icon, gradient, subtitle }) => (
    <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-all`}>
        <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform">{icon}</div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">{title}</p>
        <p className="text-4xl font-black tracking-tight">{value}</p>
        {subtitle && <p className="text-[10px] font-bold mt-4 opacity-80 bg-white/10 self-start px-2.5 py-1 rounded-md inline-block">{subtitle}</p>}
    </div>
);

// ==========================================
// HELPER: Máscara de CPF (000.000.000-00)
// ==========================================
const formatarCPF = (valor) => {
    const digitos = valor.replace(/\D/g, '').slice(0, 11);
    return digitos
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const cpfValido = (cpfFormatado) => cpfFormatado.replace(/\D/g, '').length === 11;

// ==========================================
// HELPER: Formata timestamp ISO para "16/07/2026 às 14:32"
// ==========================================
const formatarDataHora = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const data = d.toLocaleDateString('pt-BR');
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${data} às ${hora}`;
};

// ==========================================
// HELPER: MOTOR DE TEXTOS DINÂMICOS DO WHATSAPP
// ==========================================
const gerarTextoWhatsApp = (lead) => {
    const nomeAluno = lead.nome ? lead.nome.trim().split(' ')[0] : 'Aluno';
    
    let mensagem = `Olá ${nomeAluno}, tudo bem?`;

    if (lead.status === 'Novo') {
        mensagem = `Olá ${nomeAluno}, tudo bem?`;
    } 
    else if (lead.status === 'Em Contato') {
        mensagem = `${nomeAluno}, Vem pra PRATIQUE!\n\nVOCÊ GANHOU UM DAY USE DE 3 DIAS\n\n🏋️‍♂️ 3 dias grátis para TREINAR\n📊 01 Exame de Bioimpedância\n💪 01 Montagem de treino \n✅Frequência premiada\n\n🚫 Sem pegadinha, só vir treinar`;
    } 
    else if (lead.status === 'Day Use (3 Dias)') {
        mensagem = `E aí ${nomeAluno}, curtindo os treinos? ...`;
    } 
    else if (lead.status === 'Convertido') {
        mensagem = `Parabéns ${nomeAluno}, seja muito bem-vindo(a) à família Pratique! Que bom ter você com a gente!`;
    } 
    else if (lead.status === 'Perdido') {
        mensagem = `Poxa ${nomeAluno}, que pena! Mas nossas portas estão sempre abertas para quando você quiser focar na sua saúde. Um abraço!`;
    }

    // Retorna o texto PURO (sem encode) para poder ser editado na textarea do Modal
    return mensagem;
};

const CrmVisitantes = ({ usuarioLogado, visitantes = [], setVisitantes, colaboradores = [] }) => {
    // ==========================================
    // 1. ESTADOS DO COMPONENTE
    // ==========================================
    const [formData, setFormData] = useState({
        nome: '', cpf: '', telefone: '', email: '', tipo_lead: '', vendedor: '', observacao: ''
    });
    const [visaoAtiva, setVisaoAtiva] = useState('kanban'); 
    const [sucesso, setSucesso] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ESTADOS DO MODAL DE WHATSAPP
    const [modalWpp, setModalWpp] = useState({ show: false, lead: null, texto: '' });

    useEffect(() => { 
        if (window.lucide) window.lucide.createIcons(); 
    }, [visaoAtiva, visitantes, sucesso, isSubmitting, modalWpp.show]);

    // ==========================================
    // 2. CONFIGURAÇÃO DO FUNIL E CORES
    // ==========================================
    const COLUNAS = ['Novo', 'Em Contato', 'Day Use (3 Dias)', 'Convertido', 'Perdido'];
    
    const STATUS_TOKENS = {
        'Novo': { border: 'border-blue-200', text: 'text-blue-700', bg: 'bg-blue-50/50', accent: 'bg-blue-500', hex: '#3b82f6' },
        'Em Contato': { border: 'border-amber-200', text: 'text-amber-700', bg: 'bg-amber-50/50', accent: 'bg-amber-500', hex: '#f59e0b' },
        'Day Use (3 Dias)': { border: 'border-purple-200', text: 'text-purple-700', bg: 'bg-purple-50/50', accent: 'bg-purple-500', hex: '#a855f7' },
        'Convertido': { border: 'border-emerald-200', text: 'text-emerald-700', bg: 'bg-emerald-50/50', accent: 'bg-emerald-500', hex: '#10b981' },
        'Perdido': { border: 'border-rose-200', text: 'text-rose-700', bg: 'bg-rose-50/50', accent: 'bg-rose-500', hex: '#f43f5e' }
    };

    // ==========================================
    // 3. AÇÕES (CRUD SUPABASE)
    // ==========================================
    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'cpf') {
            setFormData({ ...formData, cpf: formatarCPF(value) });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.nome.trim()) { alert('Informe o nome do lead.'); return; }
        if (!cpfValido(formData.cpf)) { alert('CPF inválido. Preencha os 11 dígitos.'); return; }
        if (!formData.telefone.trim()) { alert('Informe o telefone.'); return; }
        if (!formData.tipo_lead) { alert('Informe o Tipo (Visitante ou Cancelado).'); return; }
        if (!formData.vendedor) { alert('Por favor, selecione um consultor.'); return; }

        setIsSubmitting(true);

        const novoLead = {
            unidade: usuarioLogado?.unidade || 'MATRIZ',
            nome: formData.nome.toUpperCase(),
            cpf: formData.cpf,
            telefone: formData.telefone,
            email: formData.email.trim() || null, 
            tipo_lead: formData.tipo_lead, 
            vendedor: formData.vendedor,
            observacao: formData.observacao,
            data: new Date().toLocaleDateString('pt-BR'), 
            criado_em: new Date().toISOString(), 
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
            setFormData({ nome: '', cpf: '', telefone: '', email: '', tipo_lead: '', vendedor: '', observacao: '' });
        }

        setIsSubmitting(false);
    };

    const alterarStatus = async (id, novoStatus) => {
        const leadAtual = visitantes.find(v => v.id === id);
        const statusAntigo = leadAtual ? leadAtual.status : null;

        setVisitantes(visitantes.map(v => v.id === id ? { ...v, status: novoStatus } : v));

        const { error } = await supabase.from('leads').update({ status: novoStatus }).eq('id', id);

        if (error) {
            console.error("Erro ao atualizar status:", error);
            alert("Erro de conexão. Revertendo ação.");
            setVisitantes(visitantes.map(v => v.id === id ? { ...v, status: statusAntigo } : v));
        }
    };

    const deletarLead = async (id) => {
        if(window.confirm('Excluir este Lead do funil? Esta ação não pode ser desfeita.')) {
            const backupVisitantes = [...visitantes];
            setVisitantes(visitantes.filter(v => v.id !== id));

            const { error } = await supabase.from('leads').delete().eq('id', id);

            if (error) {
                console.error("Erro ao deletar lead:", error);
                alert("Erro ao excluir do banco de dados.");
                setVisitantes(backupVisitantes);
            }
        }
    };

    // ==========================================
    // 4. FUNÇÕES DO MODAL DO WHATSAPP
    // ==========================================
    const abrirModalWpp = (lead) => {
        const textoInicial = gerarTextoWhatsApp(lead);
        setModalWpp({ show: true, lead: lead, texto: textoInicial });
    };

    const fecharModalWpp = () => {
        setModalWpp({ show: false, lead: null, texto: '' });
    };

    const copiarTextoWpp = () => {
        navigator.clipboard.writeText(modalWpp.texto);
        // Exibe um mini alerta visual ou som para o usuário saber que copiou
        alert("Texto copiado para a área de transferência!");
    };

    const enviarWppDireto = () => {
        if(!modalWpp.lead || !modalWpp.lead.telefone) return;
        const linkWhatsApp = `https://wa.me/55${modalWpp.lead.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(modalWpp.texto)}`;
        window.open(linkWhatsApp, '_blank');
        fecharModalWpp();
    };

    // ==========================================
    // 5. LÓGICA MATEMÁTICA E GRÁFICOS (KPIs)
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

    const dadosGraficoConsultores = useMemo(() => {
        return leadsPorVendedor.map(v => ({
            nome: v.nome.split(' ')[0], 
            Total: v.total,
            Convertidos: v.convertidos
        }));
    }, [leadsPorVendedor]);

    const dadosGraficoFunil = useMemo(() => {
        return COLUNAS.map(col => ({
            nome: col,
            quantidade: visitantes.filter(v => v.status === col).length,
            fill: STATUS_TOKENS[col]?.hex || '#94a3b8'
        })).filter(d => d.quantidade > 0);
    }, [visitantes]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl px-5 py-4 text-sm z-50">
                <p className="font-black text-slate-300 uppercase tracking-widest text-[10px] mb-2">{label}</p>
                {payload.map((p, i) => (
                    <p key={i} style={{ color: p.color || p.payload.fill }} className="font-black text-lg">
                        {p.name}: {p.value}
                    </p>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto relative">

            {/* MODAL REDIMENSIONÁVEL DO WHATSAPP */}
            {modalWpp.show && modalWpp.lead && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    {/* Fundo escuro */}
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={fecharModalWpp}></div>
                    
                    {/* Caixa do Modal */}
                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-[zoomIn_0.2s_ease-out] flex flex-col border border-slate-200">
                        {/* Header Modal */}
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
                                <i data-lucide="message-circle" className="w-5 h-5 text-emerald-500"></i>
                                Revisão de Mensagem
                            </h3>
                            <button onClick={fecharModalWpp} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                                <i data-lucide="x" className="w-5 h-5"></i>
                            </button>
                        </div>

                        {/* Corpo Modal */}
                        <div className="p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase border ${STATUS_TOKENS[modalWpp.lead.status]?.bg} ${STATUS_TOKENS[modalWpp.lead.status]?.text} ${STATUS_TOKENS[modalWpp.lead.status]?.border}`}>
                                    Fase: {modalWpp.lead.status}
                                </span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Enviando para: <strong className="text-slate-700">{modalWpp.lead.nome}</strong>
                                </span>
                            </div>
                            
                            {/* Textarea Redimensionável Verticalmente */}
                            <textarea
                                value={modalWpp.texto}
                                onChange={(e) => setModalWpp({ ...modalWpp, texto: e.target.value })}
                                className="w-full h-48 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-y transition-all custom-scrollbar leading-relaxed"
                            ></textarea>
                        </div>

                        {/* Rodapé Modal */}
                        <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
                            <button onClick={copiarTextoWpp} className="flex-1 py-3.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-sm flex items-center justify-center gap-2">
                                <i data-lucide="copy" className="w-4 h-4"></i> Copiar
                            </button>
                            <button onClick={enviarWppDireto} className="flex-[2] py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-[0_4px_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2">
                                <i data-lucide="send" className="w-4 h-4"></i> Enviar p/ WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ALERTA DE SUCESSO */}
            {sucesso && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-[0_8px_20px_rgba(16,185,129,0.4)] flex items-center gap-3 font-black uppercase tracking-wider text-xs z-50">
                    <i data-lucide="check-circle-2" className="w-5 h-5"></i> Lead Salvo na Nuvem!
                </div>
            )}

            {/* BLOCO 1: BARRA DE CAPTURA RÁPIDA */}
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

                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row flex-wrap items-end gap-3 w-full xl:w-auto bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="w-full sm:w-[140px]">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Tipo de Lead *</label>
                        <select name="tipo_lead" value={formData.tipo_lead} onChange={handleChange} required className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-black text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer shadow-sm uppercase">
                            <option value="" disabled hidden>Selecione...</option>
                            <option value="VISITANTE">VISITANTE</option>
                            <option value="CANCELADO/INATIVO">CANCELADO / INATIVO</option>
                        </select>
                    </div>
                    <div className="w-full sm:w-44">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Nome *</label>
                        <input type="text" name="nome" value={formData.nome} onChange={handleChange} required placeholder="Nome do Lead" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm uppercase" />
                    </div>
                    <div className="w-full sm:w-36">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">CPF *</label>
                        <input type="text" name="cpf" value={formData.cpf} onChange={handleChange} required placeholder="000.000.000-00" maxLength={14} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                    </div>
                    <div className="w-full sm:w-36">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Telefone/Zap *</label>
                        <input type="text" name="telefone" value={formData.telefone} onChange={handleChange} required placeholder="(00) 00000-0000" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                    </div>
                    <div className="w-full sm:w-[140px]">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Consultor *</label>
                        <select name="vendedor" value={formData.vendedor} onChange={handleChange} required className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer shadow-sm uppercase">
                            <option value="">Consultor...</option>
                            {colaboradores.map(c => <option key={c.id} value={c.nome}>{c.nome.split(' ')[0]}</option>)}
                        </select>
                    </div>
                    <div className="w-full sm:w-44">
                        <label className="block text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1 ml-1">Observação</label>
                        <input type="text" name="observacao" value={formData.observacao} onChange={handleChange} placeholder="Como conheceu?" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-black px-6 py-2.5 rounded-xl shadow-[0_4px_15px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-2 h-[38px] text-xs uppercase tracking-widest">
                        {isSubmitting ? <i data-lucide="loader-2" className="w-4 h-4 animate-spin"></i> : 'Inserir'}
                    </button>
                </form>
            </div>

            {/* BLOCO 2: SWITCHER DE VISÃO */}
            <div className="flex bg-slate-200 p-1.5 rounded-xl border border-slate-300/60 shadow-inner w-full max-w-lg mx-auto">
                <button onClick={() => setVisaoAtiva('kanban')} className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${visaoAtiva === 'kanban' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}>
                    <i data-lucide="kanban" className="w-4 h-4"></i> Kanban
                </button>
                <button onClick={() => setVisaoAtiva('lista')} className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${visaoAtiva === 'lista' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}>
                    <i data-lucide="list" className="w-4 h-4"></i> Lista
                </button>
                <button onClick={() => setVisaoAtiva('dashboard')} className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${visaoAtiva === 'dashboard' ? 'bg-slate-900 shadow-sm text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                    <i data-lucide="pie-chart" className="w-4 h-4"></i> Métricas
                </button>
            </div>

            {/* ======================================================= */}
            {/* EXIBIÇÃO CONDICIONAL DAS ABAS */}
            {/* ======================================================= */}
            
            {/* MODO 1: DASHBOARD ANALÍTICO */}
            {visaoAtiva === 'dashboard' && (
                <div className="bg-slate-950 p-8 rounded-[2rem] shadow-2xl space-y-8 animate-[fadeIn_0.3s_ease-out]">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                            <i data-lucide="activity" className="w-5 h-5 text-white"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight">Performance Comercial</h2>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Métricas Globais de Leads</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform"><i data-lucide="users" className="w-32 h-32 text-blue-500"></i></div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total no Funil</p>
                            <p className="text-4xl font-black text-white tracking-tight">{totalLeads}</p>
                            <p className="text-xs text-blue-400 font-bold mt-2">Volume de trabalho</p>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform"><i data-lucide="user-check" className="w-32 h-32 text-emerald-500"></i></div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Convertidos</p>
                            <p className="text-4xl font-black text-white tracking-tight">{convertidos}</p>
                            <p className="text-xs text-emerald-400 font-bold mt-2">Fechamentos Concluídos</p>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform"><i data-lucide="user-x" className="w-32 h-32 text-rose-500"></i></div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Perdidos</p>
                            <p className="text-4xl font-black text-white tracking-tight">{perdidos}</p>
                            <p className="text-xs text-rose-400 font-bold mt-2">Contatos Sem Sucesso</p>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform"><i data-lucide="target" className="w-32 h-32 text-purple-500"></i></div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Taxa de Conversão</p>
                            <p className="text-4xl font-black text-white tracking-tight">{taxaConversao}%</p>
                            <p className="text-xs text-purple-400 font-bold mt-2">Eficiência da Equipe</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                                <i data-lucide="bar-chart-2" className="w-4 h-4 text-emerald-500"></i> Performance por Consultor
                            </h3>
                            {dadosGraficoConsultores.length === 0 ? (
                                <p className="text-slate-600 font-bold text-center py-10">Gráfico aguardando volume de dados.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={dadosGraficoConsultores} barSize={24}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                        <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} dy={10} />
                                        <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} dx={-10} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
                                        <Bar dataKey="Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Convertidos" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                                <i data-lucide="pie-chart" className="w-4 h-4 text-orange-500"></i> Distribuição no Funil
                            </h3>
                            {dadosGraficoFunil.length === 0 ? (
                                <p className="text-slate-600 font-bold text-center py-10">Gráfico aguardando volume de dados.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie data={dadosGraficoFunil} dataKey="quantidade" nameKey="nome" cx="50%" cy="50%" outerRadius={100} innerRadius={60} paddingAngle={4} stroke="none">
                                            {dadosGraficoFunil.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODO 2: KANBAN MATADOR */}
            {visaoAtiva === 'kanban' && (
                <div className="flex gap-5 overflow-x-auto pb-6 custom-scrollbar animate-[fadeIn_0.3s_ease-out] items-start min-h-[600px] px-1">
                    {COLUNAS.map(coluna => {
                        const leadsDaColuna = visitantes.filter(v => v.status === coluna);
                        const token = STATUS_TOKENS[coluna] || STATUS_TOKENS['Novo']; 

                        return (
                            <div key={coluna} className={`rounded-[20px] border ${token.border} bg-slate-50/80 shadow-sm flex flex-col min-w-[300px] max-w-[300px] flex-shrink-0`}>
                                <div className={`p-4 border-b ${token.border} ${token.bg} rounded-t-[20px] flex justify-between items-center sticky top-0 backdrop-blur-sm z-10`}>
                                    <h3 className={`font-black ${token.text} text-[11px] flex items-center gap-2 uppercase tracking-widest`}>
                                        <span className={`w-2 h-2 rounded-full ${token.accent} shadow-sm`}></span>
                                        {coluna}
                                    </h3>
                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-md shadow-sm border bg-white ${token.text} ${token.border}`}>
                                        {leadsDaColuna.length}
                                    </span>
                                </div>
                                <div className="p-3 flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar" style={{ maxHeight: '65vh' }}>
                                    {leadsDaColuna.map(v => (
                                        <div key={v.id} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all group flex flex-col">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h4 className="font-black text-slate-800 text-sm leading-tight uppercase">{v.nome}</h4>
                                                    <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase border ${v.tipo_lead === 'VISITANTE' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : v.tipo_lead === 'CANCELADO/INATIVO' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                        {v.tipo_lead || 'Não Informado'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="space-y-2.5 mb-4 flex-1">
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                    <i data-lucide="calendar-clock" className="w-3 h-3"></i> {formatarDataHora(v.criado_em) || v.data}
                                                </div>
                                                {v.cpf && (
                                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 tracking-wider">
                                                        <i data-lucide="id-card" className="w-3 h-3"></i> {v.cpf}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 w-fit pr-3 py-1 rounded-full border border-slate-100 uppercase">
                                                    <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] ml-1 border border-indigo-200">
                                                        {v.vendedor ? v.vendedor.charAt(0) : '?'}
                                                    </div>
                                                    {v.vendedor}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 pt-3 border-t border-slate-100 mt-auto flex-wrap">
                                                <a href={`sip:${v.telefone.replace(/\D/g, '')}`} className="flex-1 py-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg flex items-center justify-center gap-1.5 border border-blue-200 transition-colors text-[9px] font-black uppercase tracking-widest" title="Ligar via MicroSIP">
                                                    <i data-lucide="phone-call" className="w-3.5 h-3.5"></i> Ligar
                                                </a>
                                                
                                                {/* NOVO BOTÃO QUE CHAMA O MODAL DE REVISÃO DO WHATSAPP */}
                                                <button type="button" onClick={() => abrirModalWpp(v)} className="flex-1 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg flex items-center justify-center gap-1.5 border border-emerald-200 transition-colors text-[9px] font-black uppercase tracking-widest">
                                                    <i data-lucide="message-circle" className="w-3.5 h-3.5"></i> Whats
                                                </button>
                                                
                                                <select value={v.status} onChange={(e) => alterarStatus(v.id, e.target.value)} className="w-full mt-2 text-[9px] font-black uppercase tracking-widest text-slate-600 border border-slate-200 rounded-lg h-8 px-1.5 bg-slate-50 hover:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors outline-none">
                                                    {COLUNAS.map(c => <option key={c} value={c}>Mover: {c}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    ))}
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

            {/* MODO 3: VISÃO EM LISTA (TABELA) */}
            {visaoAtiva === 'lista' && (
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden animate-[fadeIn_0.3s_ease-out]">
                    <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                            <i data-lucide="list-checks" className="w-5 h-5 text-blue-500"></i> Relatório Geral de Leads
                        </h3>
                        <span className="text-[10px] font-black text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
                            {visitantes.length} Registros
                        </span>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-max">
                            <thead className="bg-slate-50/50">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Data e Hora</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Aluno / Lead</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Origem</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Contato</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Consultor</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 w-48 text-center">Fase Funil</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {visitantes.length > 0 ? visitantes.map(v => {
                                    const token = STATUS_TOKENS[v.status] || STATUS_TOKENS['Novo'];
                                    
                                    return (
                                        <tr key={v.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase align-middle">
                                                {formatarDataHora(v.criado_em) || v.data}
                                            </td>
                                            <td className="px-6 py-4 align-middle">
                                                <p className="text-xs font-black text-slate-800 uppercase">{v.nome}</p>
                                                {v.cpf && <p className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-wider">CPF: {v.cpf}</p>}
                                            </td>
                                            <td className="px-6 py-4 align-middle">
                                                <span className={`px-2 py-1 rounded text-[9px] font-black tracking-widest uppercase border ${v.tipo_lead === 'VISITANTE' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : v.tipo_lead === 'CANCELADO/INATIVO' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                    {v.tipo_lead || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 align-middle">
                                                <p className="text-xs font-bold text-slate-600">{v.telefone}</p>
                                            </td>
                                            <td className="px-6 py-4 align-middle">
                                                <span className="text-[10px] font-black uppercase text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                                    {v.vendedor}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 align-middle">
                                                <select
                                                    value={v.status}
                                                    onChange={(e) => alterarStatus(v.id, e.target.value)}
                                                    className={`w-full text-[10px] font-black uppercase tracking-widest border rounded-lg h-9 px-2 cursor-pointer transition-all outline-none focus:ring-2 focus:ring-blue-500 ${token.bg} ${token.text} ${token.border}`}
                                                >
                                                    {COLUNAS.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 text-center align-middle">
                                                <div className="flex items-center justify-center gap-2">
                                                    <a 
                                                        href={`sip:${v.telefone.replace(/\D/g, '')}`} 
                                                        className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg flex items-center justify-center gap-1.5 border border-blue-200 transition-colors text-[10px] font-black uppercase tracking-widest"
                                                        title="Ligar via MicroSIP"
                                                    >
                                                        <i data-lucide="phone-call" className="w-3.5 h-3.5"></i> Ligar (MicroSIP)
                                                    </a>
                                                    
                                                    {/* NOVO BOTÃO QUE CHAMA O MODAL DE REVISÃO DO WHATSAPP (NA LISTA) */}
                                                    <button 
                                                        onClick={() => abrirModalWpp(v)}
                                                        className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg flex items-center justify-center gap-1.5 border border-emerald-200 transition-colors text-[10px] font-black uppercase tracking-widest"
                                                        title="Chamar no WhatsApp"
                                                    >
                                                        <i data-lucide="message-circle" className="w-3.5 h-3.5"></i> WhatsApp
                                                    </button>
                                                    
                                                    <button 
                                                        onClick={() => deletarLead(v.id)} 
                                                        className="px-3 py-1.5 bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white rounded-lg flex items-center justify-center gap-1.5 border border-rose-200 transition-colors text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100"
                                                        title="Excluir"
                                                    >
                                                        <i data-lucide="trash-2" className="w-3.5 h-3.5"></i> Excluir
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan="7" className="text-center py-16 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                            Nenhum visitante ou lead encontrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

        </div>
    );
};

export default CrmVisitantes;