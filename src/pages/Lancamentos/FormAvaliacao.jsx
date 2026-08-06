import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { getLocalDateISO } from './utils.js';
import { ClipboardSignature, User, Send, Loader2, CheckCircle2, Dumbbell, Clock, Calendar } from 'lucide-react';

const FormAvaliacao = ({ usuarioLogado, unidades, colaboradores, voltarHub }) => {
    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';

    const [formDados, setFormDados] = useState({
        unidade: temVisaoGlobal ? '' : (usuarioLogado?.unidade || ''), 
        data: getLocalDateISO(),
        hora: '', 
        professor: '',
        aluno: ''
    });

    useEffect(() => {
        const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        setFormDados(prev => ({ ...prev, hora: horaAtual }));
    }, []);

    const [sucesso, setSucesso] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const professoresDaUnidade = colaboradores.filter(c => 
        temVisaoGlobal 
            ? c.unidade?.toUpperCase() === formDados.unidade?.toUpperCase()
            : c.unidade?.toUpperCase() === usuarioLogado?.unidade?.toUpperCase()
    );

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'unidade') setFormDados({ ...formDados, unidade: value, professor: '' });
        else setFormDados({ ...formDados, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (temVisaoGlobal && !formDados.unidade) return alert('Selecione a Unidade.');

        setIsSubmitting(true);
        try {
            const novaAvaliacao = {
                data: formDados.data,
                hora: formDados.hora,
                unidade: formDados.unidade.toUpperCase(),
                professor: formDados.professor.toUpperCase(),
                aluno: formDados.aluno.toUpperCase(),
                usuario_responsavel: usuarioLogado?.nome || 'SISTEMA'
            };

            const { error } = await supabase.from('avaliacoes_realizadas').insert([novaAvaliacao]);
            if (error) throw error;
            
            setSucesso(true);
            setTimeout(() => {
                setSucesso(false);
                voltarHub();
            }, 1200); // <-- Tempo reduzido para maior velocidade
        } catch (error) {
            console.error("Erro:", error); alert("Erro ao registrar avaliação.");
        } finally { setIsSubmitting(false); }
    };

    const labelClass = "block text-sm font-semibold text-slate-700 mb-1.5";
    const inputClassBase = "w-full bg-white border border-slate-300 rounded-lg py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all duration-200";

    return (
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6 animate-[fadeIn_0.3s_ease-out]">
            
            {/* === NOVO POP-UP CENTRAL === */}
            {sucesso && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center animate-[zoomIn_0.2s_ease-out] max-w-sm w-full mx-4 border border-slate-200">
                        <div className="w-20 h-20 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mb-6 shadow-inner border border-orange-200">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Avaliação Salva!</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Procedimento registrado com sucesso.</p>
                    </div>
                </div>
            )}

            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <ClipboardSignature className="w-5 h-5 text-orange-500" /> Confirmar Avaliação Física
                    </h3>
                    <span className="bg-orange-50 text-orange-600 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">
                        Operação
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {temVisaoGlobal && (
                        <div className="md:col-span-2">
                            <label className={labelClass}>Unidade *</label>
                            <select name="unidade" value={formDados.unidade} onChange={handleChange} required className={`${inputClassBase} px-4`}>
                                <option value="">Selecione a Unidade...</option>
                                {unidades.map(u => <option key={u.id || u.nome} value={u.nome}>{u.nome}</option>)}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className={labelClass}>Data</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <Calendar className="w-4 h-4 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                            </div>
                            <input type="date" name="data" value={formDados.data} readOnly className={`${inputClassBase} pl-10 pr-4 bg-slate-50 cursor-not-allowed text-slate-500`} />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Hora da Avaliação *</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <Clock className="w-4 h-4 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                            </div>
                            <input type="time" name="hora" value={formDados.hora} onChange={handleChange} required className={`${inputClassBase} pl-10 pr-4 font-bold`} />
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className={labelClass}>Nome Completo do Aluno *</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <User className="w-4 h-4 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                            </div>
                            <input type="text" name="aluno" value={formDados.aluno} onChange={handleChange} required autoFocus placeholder="Ex: Carlos Eduardo Silva" className={`${inputClassBase} pl-10 pr-4 uppercase`} />
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className={labelClass}>Professor(a) / Instrutor(a) *</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <Dumbbell className="w-4 h-4 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                            </div>
                            <select name="professor" value={formDados.professor} onChange={handleChange} required disabled={temVisaoGlobal && !formDados.unidade} className={`${inputClassBase} pl-10 pr-4 uppercase disabled:bg-slate-50 disabled:cursor-not-allowed`}>
                                <option value="">Quem executou a avaliação?</option>
                                {professoresDaUnidade.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                    <button type="submit" disabled={isSubmitting} className="w-full md:w-auto bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 font-bold py-3.5 px-10 rounded-xl shadow-sm transition-all duration-200 flex justify-center items-center gap-2 text-sm active:scale-[0.98]">
                        {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Registrando...</> : <><Send className="w-4 h-4" /> Confirmar Avaliação</>}
                    </button>
                </div>
            </div>
        </form>
    );
};

export default FormAvaliacao;