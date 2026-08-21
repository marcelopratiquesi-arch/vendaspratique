import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { UserRoundPen, X, Loader2, Save, UserPlus } from 'lucide-react';
import { normalizarNome, normalizarNumeros, formatarTelefone, normalizarEmail, validarEmail, validarTelefone, calcularIdade, mascaraCPF } from '../../pages/CadastroGeral/utilsAlunos.js';

const ModalAluno = ({ isOpen, onClose, alunoInicial, onSaveSuccess, usuarioLogado }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({ id: null, nome: '', cpf: '', matricula: '', telefone: '', email: '', data_nascimento: '' });
    const [idade, setIdade] = useState(null);

    useEffect(() => {
        if (isOpen && alunoInicial) {
            setFormData({
                id: alunoInicial.id || null,
                nome: alunoInicial.nome || '',
                cpf: alunoInicial.cpf ? mascaraCPF(alunoInicial.cpf) : '',
                matricula: alunoInicial.matricula || '',
                telefone: alunoInicial.telefone ? formatarTelefone(alunoInicial.telefone) : '',
                email: alunoInicial.email || '',
                data_nascimento: alunoInicial.data_nascimento || ''
            });
        }
    }, [isOpen, alunoInicial]);

    useEffect(() => {
        setIdade(calcularIdade(formData.data_nascimento));
    }, [formData.data_nascimento]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'telefone') {
            setFormData(prev => ({ ...prev, [name]: formatarTelefone(value) }));
        } else if (name === 'cpf' && !formData.id) {
            setFormData(prev => ({ ...prev, [name]: mascaraCPF(value) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        const nomeLimpo = normalizarNome(formData.nome);
        const cpfLimpo = normalizarNumeros(formData.cpf);
        const telefoneLimpo = normalizarNumeros(formData.telefone);
        const emailLimpo = normalizarEmail(formData.email);

        if (!nomeLimpo) return alert("O nome é obrigatório.");
        if (telefoneLimpo && !validarTelefone(telefoneLimpo)) return alert("Telefone inválido.");
        if (emailLimpo && !validarEmail(emailLimpo)) return alert("E-mail inválido.");

        setIsSubmitting(true);
        try {
            const auditNome = usuarioLogado?.nome || 'SISTEMA';
            const auditEmail = usuarioLogado?.email || '';

            const payload = {
                nome: nomeLimpo,
                cpf: cpfLimpo,
                matricula: formData.matricula.trim() || null,
                telefone: telefoneLimpo || null,
                email: emailLimpo || null,
                data_nascimento: formData.data_nascimento || null
            };

            let dataResult;

            if (formData.id) {
                // UPDATE (Edição)
                payload.updated_at = new Date().toISOString();
                payload.atualizado_por_nome = auditNome;
                payload.atualizado_por_email = auditEmail;

                const { data, error } = await supabase.from('alunos').update(payload).eq('id', formData.id).select().single();
                if (error) throw error;
                dataResult = data;
            } else {
                // INSERT (Novo Aluno pelo Card)
                const { data, error } = await supabase.from('alunos').insert([payload]).select().single();
                if (error) throw error;
                dataResult = data;
            }

            onSaveSuccess(dataResult);
            onClose();
        } catch (error) {
            console.error(error);
            alert(error.message.includes('unique constraint') ? 'CPF ou Matrícula já existe no sistema!' : 'Erro ao salvar aluno.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const labelClass = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1";
    const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all shadow-sm placeholder:text-slate-300 disabled:opacity-60 disabled:cursor-not-allowed";

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-[zoomIn_0.2s_ease-out]">
                
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${formData.id ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {formData.id ? <UserRoundPen className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800 tracking-tight">{formData.id ? 'Editar Dados do Aluno' : 'Cadastrar Novo Aluno'}</h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Módulo Central de Identidade</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className={labelClass}>CPF *</label>
                            <input type="text" name="cpf" value={formData.cpf} onChange={handleChange} disabled={!!formData.id} className={inputClass} placeholder="000.000.000-00" required />
                            {formData.id && <p className="text-[9px] font-bold text-rose-500 mt-1 ml-1 uppercase tracking-widest">O CPF é o identificador mestre e não pode ser alterado.</p>}
                        </div>
                        <div className="col-span-2">
                            <label className={labelClass}>Nome Completo *</label>
                            <input type="text" name="nome" value={formData.nome} onChange={handleChange} required className={inputClass} placeholder="Ex: João da Silva" />
                        </div>
                        <div className="col-span-1">
                            <label className={labelClass}>Data de Nascimento</label>
                            <input type="date" name="data_nascimento" value={formData.data_nascimento} onChange={handleChange} className={inputClass} />
                        </div>
                        <div className="col-span-1">
                            <label className={labelClass}>Idade Calculada</label>
                            <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-slate-500 flex items-center">
                                {idade !== null ? `${idade} anos` : '—'}
                            </div>
                        </div>
                        <div className="col-span-1">
                            <label className={labelClass}>Telefone / WhatsApp</label>
                            <input type="text" name="telefone" value={formData.telefone} onChange={handleChange} className={inputClass} placeholder="(00) 00000-0000" />
                        </div>
                        <div className="col-span-1">
                            <label className={labelClass}>Matrícula</label>
                            <input type="text" name="matricula" value={formData.matricula} onChange={handleChange} className={inputClass} placeholder="Ex: 012345" />
                        </div>
                        <div className="col-span-2">
                            <label className={labelClass}>E-mail</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} placeholder="aluno@email.com" />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-3 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">Cancelar</button>
                        <button type="submit" disabled={isSubmitting} className={`px-6 py-3 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${formData.id ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {isSubmitting ? 'Salvando...' : 'Salvar Aluno'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ModalAluno;