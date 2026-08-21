import React, { useState, useRef } from 'react';
import { supabase } from '../../supabaseClient.js';
import { getLocalDateISO } from './utils.js';
import { mascaraCPF, validarCPF } from '../CadastroGeral/utilsAlunos.js';
import ModalAluno from '../../components/Modals/ModalAluno.jsx';
import { UserPlus, Phone, Target, Send, Loader2, CheckCircle2, User, Briefcase, CreditCard, Dumbbell, AlertTriangle, UserRoundPen } from 'lucide-react';

const FormVisitante = ({ usuarioLogado, unidades, colaboradores, voltarHub }) => {
    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';

    const [leadForm, setLeadForm] = useState({
        unidade: temVisaoGlobal ? '' : (usuarioLogado?.unidade || ''), 
        interesse: '', 
        vendedor: '', 
        observacao: ''
    });

    // 🔥 IDENTIDADE BLINDADA DO VISITANTE
    const [cpfBusca, setCpfBusca] = useState('');
    const [cpfErro, setCpfErro] = useState(false);
    const [buscandoCpf, setBuscandoCpf] = useState(false);
    const [alunoEncontrado, setAlunoEncontrado] = useState(null); 
    const [statusCpf, setStatusCpf] = useState(null); 
    const [modalAlunoAberto, setModalAlunoAberto] = useState(false);
    const debounceRef = useRef(null);

    const [fezDayUse, setFezDayUse] = useState(false);
    const [sucesso, setSucesso] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const vendedoresDaUnidade = colaboradores.filter(c => 
        temVisaoGlobal 
            ? c.unidade?.toUpperCase() === leadForm.unidade?.toUpperCase()
            : c.unidade?.toUpperCase() === usuarioLogado?.unidade?.toUpperCase()
    );

    // ==========================================
    // BUSCA INTELIGENTE DE CPF
    // ==========================================
    const buscarAlunoPorCpf = async (cpfLimpo) => {
        setBuscandoCpf(true);
        setStatusCpf(null);
        try {
            const { data, error } = await supabase.from('alunos').select('*').eq('cpf', cpfLimpo).maybeSingle();
            if (error && error.code !== 'PGRST116') throw error;

            if (data) {
                setAlunoEncontrado(data);
                setStatusCpf('encontrado');
            } else {
                setAlunoEncontrado(null);
                setStatusCpf('novo');
            }
        } catch (error) {
            console.error(error);
            setStatusCpf('erro');
        } finally {
            setBuscandoCpf(false);
        }
    };

    const handleCpfChange = (e) => {
        const masked = mascaraCPF(e.target.value);
        setCpfBusca(masked);
        setAlunoEncontrado(null); 
        setStatusCpf(null);
        
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (masked.length === 14) {
            if (!validarCPF(masked)) {
                setCpfErro(true);
            } else {
                setCpfErro(false);
                const limpo = masked.replace(/\D/g, '');
                debounceRef.current = setTimeout(() => buscarAlunoPorCpf(limpo), 500);
            }
        } else {
            setCpfErro(false);
        }
    };

    const handleSaveAlunoSuccess = (alunoAtualizado) => {
        setAlunoEncontrado(alunoAtualizado);
        setCpfBusca(mascaraCPF(alunoAtualizado.cpf)); 
        setStatusCpf('encontrado');
    };

    const handleLeadChange = (e) => {
        let { name, value } = e.target;
        if (name === 'unidade') {
            setLeadForm({ ...leadForm, unidade: value, vendedor: '' });
            return;
        }
        setLeadForm({ ...leadForm, [name]: value });
    };

    const handleSubmitVisitante = async (e) => {
        e.preventDefault();
        if (!alunoEncontrado) return alert('Localize ou cadastre o visitante usando o CPF primeiro.');
        if (temVisaoGlobal && !leadForm.unidade) return alert('Selecione a Unidade do visitante.');

        setIsSubmitting(true);
        try {
            const agora = new Date().toISOString();
            const vendedorSelecionado = leadForm.vendedor.toUpperCase();

            const stringInteresse = fezDayUse 
                ? `[DAY USE] ${leadForm.interesse.toUpperCase()}`.trim() 
                : leadForm.interesse.toUpperCase();

            const novoLead = {
                unidade: leadForm.unidade.toUpperCase(),
                data: getLocalDateISO(), 
                nome: alunoEncontrado.nome.toUpperCase(), // 🔥 Usa o nome verificado do banco
                cpf: alunoEncontrado.cpf.replace(/\D/g, ''), 
                telefone: alunoEncontrado.telefone || '', // 🔥 Puxa o telefone já cadastrado
                interesse: stringInteresse, 
                vendedor: vendedorSelecionado, 
                observacao: leadForm.observacao,
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
                    alert(`🚨 BLOQUEADO: O CPF ${alunoEncontrado.cpf} já está rodando no funil!\n\nSe for um retorno, peça ao consultor responsável para procurá-lo na aba "Base" ou "Geladeira" do CRM.`);
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

    const labelClass = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1";
    const inputClassBase = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all shadow-sm placeholder:text-slate-400";
    const sectionClass = "bg-white p-6 md:p-8 rounded-[24px] border border-slate-200 shadow-sm";

    return (
        <>
            {/* 🔥 CONEXÃO CIRÚRGICA: unidadeDestino adicionada */}
            <ModalAluno 
                isOpen={modalAlunoAberto} 
                onClose={() => setModalAlunoAberto(false)} 
                alunoInicial={alunoEncontrado || { cpf: cpfBusca }} 
                onSaveSuccess={handleSaveAlunoSuccess} 
                usuarioLogado={usuarioLogado}
                unidadeDestino={leadForm.unidade}
            />

            <form onSubmit={handleSubmitVisitante} className="max-w-3xl mx-auto space-y-6 animate-[fadeIn_0.3s_ease-out] pb-10">
                
                {sucesso && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                        <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center animate-[zoomIn_0.2s_ease-out] max-w-sm w-full mx-4 border border-slate-200">
                            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-blue-200">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Lead Capturado!</h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Enviado direto para o Funil CRM.</p>
                        </div>
                    </div>
                )}

                <div className={sectionClass}>
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <UserPlus className="w-6 h-6 text-blue-500" /> Cadastro de Visitante
                        </h3>
                        <span className="bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm">Vai para CRM</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* IDENTIDADE DO VISITANTE */}
                        <div className="md:col-span-2">
                            <div className="relative w-full max-w-sm">
                                <label className={labelClass}>CPF do Visitante *</label>
                                <div className="relative">
                                    <input type="text" value={cpfBusca} onChange={handleCpfChange} maxLength="14" className={`${inputClassBase} ${cpfErro ? 'border-rose-300 bg-rose-50 focus:ring-rose-500' : 'focus:ring-blue-500'}`} placeholder="000.000.000-00" />
                                    {buscandoCpf && <Loader2 className="w-4 h-4 text-blue-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
                                    {alunoEncontrado && <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                                    {statusCpf === 'erro' && <AlertTriangle className="w-4 h-4 text-rose-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                                </div>
                                {cpfErro && <span className="text-rose-500 text-[9px] font-bold uppercase mt-1 ml-1">CPF Inválido</span>}
                                {statusCpf === 'encontrado' && <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1.5 ml-1">Visitante / Aluno localizado</p>}
                                {statusCpf === 'novo' && <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mt-1.5 ml-1">Cliente Novo (Cadastrar)</p>}
                            </div>

                            {!buscandoCpf && cpfBusca.length === 14 && !cpfErro && statusCpf !== 'erro' && (
                                alunoEncontrado ? (
                                    <div className="mt-4 bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-inner flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-[fadeIn_0.3s_ease-out]">
                                        <div>
                                            <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-2">{alunoEncontrado.nome} <CheckCircle2 className="w-4 h-4 text-emerald-500" /></h4>
                                            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-slate-500">
                                                {alunoEncontrado.telefone && <span className="flex items-center gap-1">📞 {alunoEncontrado.telefone}</span>}
                                                {alunoEncontrado.email && <span className="flex items-center gap-1">✉️ {alunoEncontrado.email}</span>}
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => {
                                            if(temVisaoGlobal && !leadForm.unidade) return alert('Selecione a unidade antes de editar o visitante.');
                                            setModalAlunoAberto(true);
                                        }} className="w-full md:w-auto px-5 py-2.5 bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-sm shrink-0">
                                            <UserRoundPen className="w-4 h-4" /> Editar Cadastro
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-inner flex flex-col md:flex-row justify-between items-center gap-4 animate-[fadeIn_0.3s_ease-out]">
                                        <div>
                                            <h4 className="text-sm font-black text-amber-800 uppercase tracking-tight mb-1">Registro Inexistente</h4>
                                            <p className="text-xs font-bold text-amber-700/70">Este visitante ainda não possui cadastro.</p>
                                        </div>
                                        <button type="button" onClick={() => {
                                            if(temVisaoGlobal && !leadForm.unidade) return alert('Selecione a unidade antes de cadastrar o visitante.');
                                            setModalAlunoAberto(true);
                                        }} className="w-full md:w-auto px-5 py-2.5 bg-amber-500 text-white hover:bg-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-sm shrink-0">
                                            <UserPlus className="w-4 h-4" /> Cadastrar Visitante Rápido
                                        </button>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>

                <div className={`transition-all duration-500 ${!alunoEncontrado ? 'opacity-30 pointer-events-none grayscale-[50%]' : 'opacity-100'}`}>
                    <div className={sectionClass}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {temVisaoGlobal && (
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Unidade da Visita *</label>
                                    <select name="unidade" value={leadForm.unidade} onChange={handleLeadChange} required className={inputClassBase}>
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
                                    <input type="text" name="interesse" value={leadForm.interesse} onChange={handleLeadChange} placeholder="Ex: Musculação, Emagrecimento..." className={`${inputClassBase} pl-10 pr-4 uppercase disabled:opacity-50`} disabled={!alunoEncontrado} />
                                </div>
                            </div>

                            <div>
                                <label className={labelClass}>Consultor Responsável *</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Briefcase className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <select name="vendedor" value={leadForm.vendedor} onChange={handleLeadChange} required disabled={!alunoEncontrado || (temVisaoGlobal && !leadForm.unidade)} className={`${inputClassBase} pl-10 pr-4 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed uppercase`}>
                                        <option value="">{(temVisaoGlobal && !leadForm.unidade) ? 'Escolha a unidade...' : 'Quem atendeu?'}</option>
                                        {vendedoresDaUnidade.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="md:col-span-2 pt-2 pb-1">
                                <label className={`flex items-center gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all ${fezDayUse ? 'bg-amber-50 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.2)]' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                                    <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 border ${fezDayUse ? 'bg-amber-500 border-amber-600 text-white' : 'bg-white border-slate-300 text-transparent'}`}>
                                        <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h4 className={`text-sm font-black uppercase tracking-wide ${fezDayUse ? 'text-amber-700' : 'text-slate-700'}`}>Cliente vai fazer Day Use?</h4>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Marque se o visitante fará um treino experimental hoje.</p>
                                    </div>
                                    <Dumbbell className={`w-10 h-10 ml-auto transition-all ${fezDayUse ? 'text-amber-500 scale-110' : 'text-slate-300 grayscale opacity-50'}`} />
                                    <input type="checkbox" className="hidden" checked={fezDayUse} disabled={!alunoEncontrado} onChange={(e) => setFezDayUse(e.target.checked)} />
                                </label>
                            </div>

                            <div className="md:col-span-2 mt-2">
                                <label className={labelClass}>Detalhes da Conversa / Observação</label>
                                <textarea name="observacao" value={leadForm.observacao} onChange={handleLeadChange} disabled={!alunoEncontrado} rows="3" placeholder="Anotações importantes sobre o que o cliente procura..." className={`${inputClassBase} px-4 resize-none`}></textarea>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                            <button type="submit" disabled={isSubmitting || !alunoEncontrado} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 font-black uppercase tracking-widest py-4 px-10 rounded-2xl shadow-sm transition-all duration-200 flex justify-center items-center gap-2 text-xs active:scale-[0.98]">
                                {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Inserindo no CRM...</> : <><Send className="w-5 h-5" /> Enviar para o Funil CRM</>}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </>
    );
};

export default FormVisitante;