import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js'; 

import { formatarCPF, cpfValido } from './utils';
import Metricas from './Metricas';
import Kanban from './Kanban';
import Lista from './Lista';
import Modais from './Modais';

const CrmVisitantes = ({ usuarioLogado, visitantes = [], setVisitantes, colaboradores = [] }) => {
    const [formData, setFormData] = useState({ nome: '', cpf: '', telefone: '', email: '', tipo_lead: '', vendedor: '', observacao: '' });
    const [visaoAtiva, setVisaoAtiva] = useState('kanban'); 
    const [sucesso, setSucesso] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // MODAIS E HISTÓRICO
    const [modalWpp, setModalWpp] = useState({ show: false, lead: null, texto: '' });
    const [modalDetalhe, setModalDetalhe] = useState({ show: false, lead: null });
    const [historicoLead, setHistoricoLead] = useState([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);

    // ==========================================
    // IDENTIFICAÇÃO DO OPERADOR (RECEPÇÃO)
    // ==========================================
    const [consultorAtivo, setConsultorAtivo] = useState(null);

    // ==========================================
    // GAMIFICAÇÃO & PRODUTIVIDADE (RELATÓRIO DIÁRIO)
    // ==========================================
    const META_DIARIA = 150; 
    const [progressoHoje, setProgressoHoje] = useState([]);
    const [mostrarRelatorio, setMostrarRelatorio] = useState(false);

    // Carrega o progresso correto dependendo de quem está operando
    useEffect(() => {
        if (usuarioLogado?.role === 'RECEPCAO' && !consultorAtivo) return;

        const dataHoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        const nomeOperador = consultorAtivo ? consultorAtivo.nome : usuarioLogado?.nome;
        const chaveLocal = `crm_meta_${nomeOperador}_${dataHoje}`;
        
        const salvo = localStorage.getItem(chaveLocal);
        if (salvo) {
            setProgressoHoje(JSON.parse(salvo));
        } else {
            setProgressoHoje([]); 
        }
    }, [usuarioLogado, consultorAtivo]);

    useEffect(() => { 
        if (window.lucide) window.lucide.createIcons(); 
    }, [visaoAtiva, visitantes, sucesso, isSubmitting, modalWpp.show, modalDetalhe.show, historicoLead, progressoHoje, mostrarRelatorio, consultorAtivo]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'cpf') setFormData({ ...formData, cpf: formatarCPF(value) });
        else setFormData({ ...formData, [name]: value });
    };

    const registrarHistorico = async (leadId, tipoAcao, observacao) => {
        const consultorAtual = consultorAtivo ? consultorAtivo.nome : (usuarioLogado?.nome || 'Sistema');
        
        const novoRegistro = {
            id: Date.now().toString(),
            lead_id: String(leadId),
            tipo_acao: tipoAcao,
            consultor: consultorAtual,
            observacao: observacao,
            data_registro: new Date().toISOString()
        };

        if (modalDetalhe.show && modalDetalhe.lead?.id === leadId) {
            setHistoricoLead(prev => [novoRegistro, ...prev]);
        }

        setProgressoHoje(prev => {
            const novaLista = [...prev, { tipo: tipoAcao, observacao: observacao, data_contato: novoRegistro.data_registro }];
            const dataHoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
            localStorage.setItem(`crm_meta_${consultorAtual}_${dataHoje}`, JSON.stringify(novaLista));
            return novaLista;
        });

        const { error } = await supabase.from('historico_leads').insert([{
            lead_id: String(leadId),
            tipo_acao: tipoAcao,
            consultor: consultorAtual,
            observacao: observacao
        }]);

        if (error) console.error("Erro no Banco de Dados:", error);
    };

    const carregarHistoricoLead = async (leadId) => {
        setLoadingHistorico(true);
        const { data, error } = await supabase
            .from('historico_leads')
            .select('*')
            .eq('lead_id', String(leadId))
            .order('data_registro', { ascending: false });
        
        if (error) console.error("Erro ao ler histórico:", error);
        if (data) setHistoricoLead(data);
        setLoadingHistorico(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.nome.trim() || !cpfValido(formData.cpf) || !formData.telefone.trim() || !formData.tipo_lead || !formData.vendedor) { 
            alert('Preencha todos os campos corretamente.'); return; 
        }

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

        if (data && data[0]) {
            setVisitantes([data[0], ...visitantes]);
            setSucesso(true);
            
            await registrarHistorico(data[0].id, 'Captura', `Lead capturado como ${formData.tipo_lead}. Consultor atribuído: ${formData.vendedor}`);
            if(formData.observacao) await registrarHistorico(data[0].id, 'Observação', formData.observacao);

            setTimeout(() => setSucesso(false), 3000);
            setFormData({ nome: '', cpf: '', telefone: '', email: '', tipo_lead: '', vendedor: '', observacao: '' });
        } else {
            alert("Erro de conexão ao salvar na nuvem.");
        }
        setIsSubmitting(false);
    };

    const alterarStatus = async (id, novoStatus) => {
        const leadAtual = visitantes.find(v => v.id === id);
        const statusAntigo = leadAtual ? leadAtual.status : null;

        if (statusAntigo === novoStatus) return;

        setVisitantes(visitantes.map(v => v.id === id ? { ...v, status: novoStatus } : v));
        
        if (modalDetalhe.show && modalDetalhe.lead?.id === id) {
            setModalDetalhe({ ...modalDetalhe, lead: { ...modalDetalhe.lead, status: novoStatus } });
        }

        await registrarHistorico(id, 'Mudança de Fase', `Movido de "${statusAntigo}" para "${novoStatus}"`);

        const { error } = await supabase.from('leads').update({ status: novoStatus }).eq('id', id);

        if (error) {
            setVisitantes(visitantes.map(v => v.id === id ? { ...v, status: statusAntigo } : v));
            alert("Erro de conexão. Revertendo ação de mudança de funil.");
        }
    };

    // ==========================================
    // SOFT-DELETE (ARQUIVAR AO INVÉS DE APAGAR)
    // ==========================================
    const deletarLead = async (id) => {
        if(window.confirm('Mover este Lead para o Arquivo Morto? Ele não aparecerá mais no funil.')) {
            const backupVisitantes = [...visitantes];
            
            // Otimista na tela
            setVisitantes(visitantes.map(v => v.id === id ? { ...v, status: 'Arquivado' } : v));
            
            // Agora grava EXATAMENTE quem mandou pra lixeira
            await registrarHistorico(id, 'Exclusão', 'Lead arquivado (Soft-Delete) pelo usuário.');

            // Modifica apenas o status no banco de dados
            const { error } = await supabase.from('leads').update({ status: 'Arquivado' }).eq('id', id);
            
            if (error) {
                setVisitantes(backupVisitantes);
                alert("Erro de conexão. A exclusão foi revertida.");
            } else {
                if (modalDetalhe.show && modalDetalhe.lead?.id === id) {
                    setModalDetalhe({ show: false, lead: null });
                }
            }
        }
    };

    // ==========================================
    // RENDERIZAÇÃO DA CATRACA DE IDENTIFICAÇÃO
    // ==========================================
    if (usuarioLogado?.role === 'RECEPCAO' && !consultorAtivo) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] animate-[fadeIn_0.3s_ease-out] px-4">
                <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-blue-200">
                    <i data-lucide="users" className="w-10 h-10"></i>
                </div>
                <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight text-center">Quem está operando o CRM?</h2>
                <p className="text-slate-500 mb-10 font-medium text-center">Selecione seu nome para iniciar o turno e contabilizar sua produtividade.</p>
                
                {colaboradores.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-center max-w-md">
                        <p className="text-amber-700 font-bold">Nenhum consultor cadastrado nesta unidade.</p>
                        <p className="text-xs text-amber-600 mt-2">Peça ao Líder ou Admin para cadastrar a equipe na aba de Configurações.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 w-full max-w-4xl">
                        {colaboradores.map(c => (
                            <button 
                                key={c.id} 
                                onClick={() => setConsultorAtivo(c)} 
                                className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm hover:border-blue-500 hover:shadow-lg hover:-translate-y-1 transition-all group flex flex-col items-center gap-4"
                            >
                                <div className="w-14 h-14 bg-slate-100 text-slate-500 group-hover:bg-blue-500 group-hover:text-white rounded-full flex items-center justify-center font-black text-xl transition-colors shadow-inner">
                                    {c.nome.charAt(0)}
                                </div>
                                <div className="text-center">
                                    <span className="font-black text-slate-700 group-hover:text-blue-700 block leading-tight">{c.nome.split(' ')[0]}</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">{c.nome.split(' ').slice(1).join(' ')}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ==========================================
    // FILTRO DE SOFT-DELETE ANTES DE RENDERIZAR
    // ==========================================
    // Filtramos os 'Arquivados' para não aparecerem nas sub-telas
    const leadsAtivos = visitantes.filter(v => v.status !== 'Arquivado');

    const pctMeta = Math.min(100, Math.round((progressoHoje.length / META_DIARIA) * 100));
    const metaBatida = progressoHoje.length >= META_DIARIA;

    return (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto relative">

            {/* BARRA DE PRODUTIVIDADE E RELATÓRIO */}
            <div className="bg-white rounded-[24px] border border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors shrink-0 ${metaBatida ? 'bg-emerald-100 text-emerald-600 shadow-inner' : 'bg-orange-100 text-orange-600 shadow-inner'}`}>
                        {metaBatida ? <i data-lucide="trophy" className="w-6 h-6"></i> : <i data-lucide="target" className="w-6 h-6 animate-pulse"></i>}
                    </div>
                    <div className="flex-1 max-w-xl">
                        <div className="flex justify-between items-end mb-1.5">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                Operador: <strong className="text-blue-600">{consultorAtivo ? consultorAtivo.nome : usuarioLogado?.nome}</strong>
                            </span>
                            <span className={`text-xs font-black transition-colors ${metaBatida ? 'text-emerald-600' : 'text-orange-600'}`}>
                                {progressoHoje.length} / {META_DIARIA} Ações
                            </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner">
                            <div className={`h-2.5 rounded-full transition-all duration-500 ease-out ${metaBatida ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${pctMeta}%` }}></div>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {consultorAtivo && (
                        <button 
                            onClick={() => setConsultorAtivo(null)} 
                            className="px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-2 bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200"
                            title="Trocar Operador"
                        >
                            <i data-lucide="log-out" className="w-4 h-4"></i> Trocar
                        </button>
                    )}
                    
                    <button 
                        onClick={() => setMostrarRelatorio(true)} 
                        className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-2 ${metaBatida ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_4px_15px_rgba(16,185,129,0.3)]' : 'bg-slate-800 text-white hover:bg-black border border-slate-700 shadow-md'}`}
                    >
                        <i data-lucide="file-text" className="w-4 h-4"></i> Gerar Relatório
                    </button>
                </div>
            </div>

            {/* ALERTA DE SUCESSO PADRÃO */}
            {sucesso && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-[0_8px_20px_rgba(16,185,129,0.4)] flex items-center gap-3 font-black uppercase tracking-wider text-xs z-50">
                    <i data-lucide="check-circle-2" className="w-5 h-5"></i> Lead Salvo na Nuvem!
                </div>
            )}

            {/* BARRA DE CAPTURA RÁPIDA */}
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

            {/* SWITCHER DE VISÃO */}
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

            {/* SUBCOMPONENTES AGORA RECEBEM APENAS "leadsAtivos" (Esconde os Arquivados) */}
            {visaoAtiva === 'dashboard' && <Metricas visitantes={leadsAtivos} colaboradores={colaboradores} />}
            
            {visaoAtiva === 'kanban' && (
                <Kanban 
                    visitantes={leadsAtivos} 
                    alterarStatus={alterarStatus} 
                    deletarLead={deletarLead} 
                    setModalWpp={setModalWpp} 
                    setModalDetalhe={setModalDetalhe}
                    carregarHistoricoLead={carregarHistoricoLead}
                    registrarHistorico={registrarHistorico}
                    usuarioLogado={usuarioLogado}
                />
            )}
            
            {visaoAtiva === 'lista' && (
                <Lista 
                    visitantes={leadsAtivos} 
                    alterarStatus={alterarStatus} 
                    deletarLead={deletarLead} 
                    setModalWpp={setModalWpp} 
                    setModalDetalhe={setModalDetalhe}
                    carregarHistoricoLead={carregarHistoricoLead}
                    registrarHistorico={registrarHistorico}
                    usuarioLogado={usuarioLogado}
                />
            )}

            {/* ÁREA DE JANELAS FLUTUANTES (MODAIS) */}
            <Modais 
                modalWpp={modalWpp} 
                setModalWpp={setModalWpp}
                modalDetalhe={modalDetalhe}
                setModalDetalhe={setModalDetalhe}
                historicoLead={historicoLead}
                loadingHistorico={loadingHistorico}
                registrarHistorico={registrarHistorico}
                alterarStatus={alterarStatus}
                mostrarRelatorio={mostrarRelatorio}
                setMostrarRelatorio={setMostrarRelatorio}
                progressoHoje={progressoHoje}
                consultorAtivo={consultorAtivo}
                usuarioLogado={usuarioLogado}
                META_DIARIA={META_DIARIA}
            />

        </div>
    );
};

export default CrmVisitantes;