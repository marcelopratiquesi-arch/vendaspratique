import React, { useState } from 'react';
import { supabase } from '../../supabaseClient.js';
import { getLocalDateISO } from './utils.js';
import { UserPlus, Phone, Target, Send, Loader2, CheckCircle2, User, Briefcase, CreditCard } from 'lucide-react';

const FormVisitante = ({ usuarioLogado, unidades, colaboradores, voltarHub }) => {
    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';

    const [leadForm, setLeadForm] = useState({
        unidade: temVisaoGlobal ? '' : (usuarioLogado?.unidade || ''), 
        nome: '', 
        cpf: '', 
        telefone: '', 
        interesse: '', 
        vendedor: '', 
        observacao: ''
    });

    const [sucesso, setSucesso] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const vendedoresDaUnidade = colaboradores.filter(c => 
        temVisaoGlobal 
            ? c.unidade?.toUpperCase() === leadForm.unidade?.toUpperCase()
            : c.unidade?.toUpperCase() === usuarioLogado?.unidade?.toUpperCase()
    );

    const handleLeadChange = (e) => {
        let { name, value } = e.target;

        if (name === 'cpf') {
            value = value.replace(/\D/g, '')
                         .replace(/(\d{3})(\d)/, '$1.$2')
                         .replace(/(\d{3})(\d)/, '$1.$2')
                         .replace(/(\d{3})(\d{1,2})/, '$1-$2')
                         .substring(0, 14); 
        }

        if (name === 'telefone') {
            let v = value.replace(/\D/g, '');
            if (v.length <= 10) {
                value = v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
            } else {
                value = v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{4}).*/, '$1-$2');
            }
        }

        if (name === 'unidade') {
            setLeadForm({ ...leadForm, unidade: value, vendedor: '' });
            return;
        }
        
        setLeadForm({ ...leadForm, [name]: value });
    };

    const handleSubmitVisitante = async (e) => {
        e.preventDefault();
        if (temVisaoGlobal && !leadForm.unidade) return alert('Selecione a Unidade do visitante.');

        setIsSubmitting(true);
        try {
            const agora = new Date().toISOString();
            const vendedorSelecionado = leadForm.vendedor.toUpperCase();

            const novoLead = {
                unidade: leadForm.unidade.toUpperCase(),
                data: getLocalDateISO(), 
                nome: leadForm.nome.toUpperCase(),
                cpf: leadForm.cpf.replace(/\D/g, ''), 
                telefone: leadForm.telefone,
                interesse: leadForm.interesse.toUpperCase(),
                vendedor: vendedorSelecionado, 
                observacao: leadForm.observacao,
                // ✅ REGRA DE NEGÓCIO: Carimba que este é um visitante físico real
                origem: 'RECEPCAO', 
                status: 'Novo', 
                data_criacao: agora,
                criado_por: usuarioLogado?.nome || 'SISTEMA',
                puxado_em: agora,
                puxado_por: vendedorSelecionado
            };

            const { error } = await supabase.from('leads').insert([novoLead]);
            
            if (error) {
                if (error.code === '23505') {
                    alert(`🚨 BLOQUEADO: O CPF ${leadForm.cpf} já está cadastrado no sistema!\n\nSe for um retorno de aluno antigo, peça ao consultor responsável para procurá-lo na aba "Base" ou "Geladeira" do CRM.`);
                    setIsSubmitting(false);
                    return; 
                }
                throw error; 
            }
            
            setSucesso(true);
            setTimeout(() => {
                setSucesso(false);
                voltarHub();
            }, 1200); 

        } catch (error) {
            console.error("Erro:", error); 
            alert("Erro genérico ao salvar visitante. Detalhes no console.");
        } finally { 
            setIsSubmitting(false); 
        }
    };

    const labelClass = "block text-sm font-semibold text-slate-700 mb-1.5";
    const inputClassBase = "w-full bg-white border border-slate-300 rounded-lg py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200";

    return (
        <form onSubmit={handleSubmitVisitante} className="max-w-3xl mx-auto space-y-6 animate-[fadeIn_0.3s_ease-out]">
            
            {sucesso && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center animate-[zoomIn_0.2s_ease-out] max-w-sm w-full mx-4 border border-slate-200">
                        <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-blue-200">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Lead Capturado!</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Enviado direto para o Funil.</p>
                    </div>
                </div>
            )}

            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-blue-500" /> Cadastro Rápido de Visitante
                    </h3>
                    <span className="bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">Vai para Funil do CRM</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                        <label className={labelClass}>Nome Completo do Visitante *</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <User className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input type="text" name="nome" value={leadForm.nome} onChange={handleLeadChange} required placeholder="Ex: João da Silva" className={`${inputClassBase} pl-10 pr-4 uppercase`} />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>CPF *</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <CreditCard className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input type="text" name="cpf" value={leadForm.cpf} onChange={handleLeadChange} required placeholder="000.000.000-00" className={`${inputClassBase} pl-10 pr-4`} />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>WhatsApp / Telefone *</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <Phone className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input type="text" name="telefone" value={leadForm.telefone} onChange={handleLeadChange} required placeholder="(00) 00000-0000" className={`${inputClassBase} pl-10 pr-4`} />
                        </div>
                    </div>

                    {temVisaoGlobal && (
                        <div className="md:col-span-2">
                            <label className={labelClass}>Unidade da Visita *</label>
                            <select name="unidade" value={leadForm.unidade} onChange={handleLeadChange} required className={`${inputClassBase} px-4`}>
                                <option value="">Selecione a Unidade...</option>
                                {unidades.map(u => <option key={u.id || u.nome} value={u.nome}>{u.nome}</option>)}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className={labelClass}>Interesse Principal</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <Target className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input type="text" name="interesse" value={leadForm.interesse} onChange={handleLeadChange} placeholder="Ex: Musculação..." className={`${inputClassBase} pl-10 pr-4 uppercase`} />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Consultor Responsável *</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <Briefcase className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <select name="vendedor" value={leadForm.vendedor} onChange={handleLeadChange} required disabled={temVisaoGlobal && !leadForm.unidade} className={`${inputClassBase} pl-10 pr-4 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed uppercase`}>
                                <option value="">{(temVisaoGlobal && !leadForm.unidade) ? 'Escolha a unidade...' : 'Quem atendeu?'}</option>
                                {vendedoresDaUnidade.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="md:col-span-2 mt-2">
                        <label className={labelClass}>Detalhes da Conversa / Observação</label>
                        <textarea name="observacao" value={leadForm.observacao} onChange={handleLeadChange} rows="3" placeholder="Anotações importantes sobre o que o cliente procura..." className={`${inputClassBase} px-4 resize-none`}></textarea>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                    <button type="submit" disabled={isSubmitting} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 font-bold py-3.5 px-10 rounded-xl shadow-sm transition-all duration-200 flex justify-center items-center gap-2 text-sm active:scale-[0.98]">
                        {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Inserindo no CRM...</> : <><Send className="w-4 h-4" /> Enviar para o Funil</>}
                    </button>
                </div>
            </div>
        </form>
    );
};

export default FormVisitante;