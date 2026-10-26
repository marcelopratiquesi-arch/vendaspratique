import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient.js';
import { Building2, IdCard, Calendar, User, Phone, Mail, MessageCircle, Clock, Edit2 } from 'lucide-react';
import { formatarTelefone, formatarDataBR, limparApenasDigitos } from '../utils.js';
import CopyButton from './CopyButton.jsx';

const TabDados = ({ aluno, onEditar, temVisaoGlobal }) => {
    const [cpfReal, setCpfReal] = useState(aluno.cpf || '');
    const [telefoneReal, setTelefoneReal] = useState(aluno.telefone || '');
    const [emailReal, setEmailReal] = useState(aluno.email || '');

    useEffect(() => {
        const buscarDadosReais = async () => {
            if (aluno.id && (String(aluno.cpf).includes('*') || !aluno.cpf)) {
                try {
                    const { data } = await supabase
                        .from('alunos')
                        .select('cpf, telefone, email')
                        .eq('id', aluno.id)
                        .single();
                    if (data) {
                        if (data.cpf) setCpfReal(data.cpf);
                        if (data.telefone) setTelefoneReal(data.telefone);
                        if (data.email) setEmailReal(data.email);
                    }
                } catch (err) {}
            } else {
                setCpfReal(aluno.cpf);
                setTelefoneReal(aluno.telefone);
                setEmailReal(aluno.email);
            }
        };
        buscarDadosReais();
    }, [aluno]);

    const calcularIdade = (data) => {
        if (!data) return '—';
        const hoje = new Date();
        const nasc = new Date(data + 'T12:00:00');
        let idade = hoje.getFullYear() - nasc.getFullYear();
        const m = hoje.getMonth() - nasc.getMonth();
        if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
        return idade;
    };

    const telefoneLimpo = limparApenasDigitos(telefoneReal);
    const linkWhatsApp = telefoneLimpo ? `https://wa.me/55${telefoneLimpo}` : null;
    
    const cpfLimpo = limparApenasDigitos(cpfReal);
    const cpfCompletoExibicao = cpfLimpo.length === 11 
        ? cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") 
        : (cpfReal || 'S/ CPF');

    const rowClass = "flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3";
    const rowBorder = "border-b border-slate-200/50 dark:border-slate-700/50";
    const labelContainer = "flex items-center gap-2.5 text-slate-500 dark:text-slate-400 shrink-0";
    const labelText = "text-[11px] font-bold uppercase tracking-wider";
    const valueContainer = "flex items-center gap-3 self-end sm:self-auto min-w-0";
    const valueText = "text-[13px] font-bold text-slate-800 dark:text-slate-100";
    const nestedContainer = "bg-[#F8FAFC] dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl flex flex-col";
    const pillButton = "flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-sm";

    return (
        <div className="space-y-5 animate-[fadeIn_0.2s_ease-out]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                
                <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" /> Pessoal
                        </h3>
                        <button type="button" className={pillButton} title="Funcionalidade em breve">
                            <Clock className="w-3 h-3" /> Histórico
                        </button>
                    </div>
                    
                    <div className={nestedContainer}>
                        <div className={`${rowClass} ${rowBorder}`}>
                            <div className={labelContainer}>
                                <IdCard className="w-3.5 h-3.5" /> <span className={labelText}>CPF</span>
                            </div>
                            <div className={valueContainer}>
                                <span className={valueText}>{cpfCompletoExibicao}</span>
                                {cpfLimpo && <CopyButton value={cpfLimpo} label="Copiar CPF" className="!w-7 !h-7 !min-w-[28px] !bg-white !rounded-md shadow-sm" />}
                            </div>
                        </div>

                        <div className={`${rowClass} ${rowBorder}`}>
                            <div className={labelContainer}>
                                <Calendar className="w-3.5 h-3.5" /> <span className={labelText}>Nascimento</span>
                            </div>
                            <div className={valueContainer}>
                                <div className="text-right flex flex-col items-end">
                                    <span className={valueText}>{formatarDataBR(aluno.data_nascimento)}</span>
                                    <span className="text-[10px] font-medium text-slate-400 mt-0.5">{calcularIdade(aluno.data_nascimento)} anos</span>
                                </div>
                                <div className="w-7 h-7 shrink-0"></div>
                            </div>
                        </div>

                        <div className={rowClass}>
                            <div className={labelContainer}>
                                <User className="w-3.5 h-3.5" /> <span className={labelText}>Gênero</span>
                            </div>
                            <div className={valueContainer}>
                                <span className={`${valueText} uppercase`}>{aluno.genero || 'N/I'}</span>
                                <div className="w-7 h-7 shrink-0"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 flex items-center gap-2">
                            <Phone className="w-4 h-4 text-slate-400" /> Contatos
                        </h3>
                        <button onClick={onEditar} type="button" className={pillButton}>
                            <Edit2 className="w-3 h-3" /> Editar
                        </button>
                    </div>
                    
                    <div className={nestedContainer}>
                        <div className={`${rowClass} ${rowBorder}`}>
                            <div className={labelContainer}>
                                <Phone className="w-3.5 h-3.5" /> <span className={labelText}>Telemóvel</span>
                            </div>
                            <div className={valueContainer}>
                                <span className={valueText}>{formatarTelefone(telefoneReal)}</span>
                                {linkWhatsApp ? (
                                    <a href={linkWhatsApp} target="_blank" rel="noopener noreferrer" title="Abrir no WhatsApp" className="flex items-center justify-center shrink-0 w-7 h-7 bg-emerald-500 hover:bg-emerald-600 rounded-md text-white shadow-sm transition-colors">
                                        <MessageCircle className="w-3.5 h-3.5" />
                                    </a>
                                ) : (
                                    <CopyButton value={telefoneLimpo} label="Copiar Telefone" className="!w-7 !h-7 !min-w-[28px] !bg-white !rounded-md shadow-sm" />
                                )}
                            </div>
                        </div>

                        <div className={rowClass}>
                            <div className={labelContainer}>
                                <Mail className="w-3.5 h-3.5" /> <span className={labelText}>E-mail</span>
                            </div>
                            <div className={valueContainer}>
                                <span className={`${valueText} lowercase truncate`}>{emailReal || '—'}</span>
                                {emailReal ? (
                                    <CopyButton value={emailReal} label="Copiar E-mail" className="!w-7 !h-7 !min-w-[28px] !bg-white !rounded-md shadow-sm" />
                                ) : (
                                    <div className="w-7 h-7 shrink-0"></div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {temVisaoGlobal && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                            <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-800">Vínculo de Unidade</h4>
                            <p className="text-[11px] font-medium text-slate-500 mt-0.5">Unidade onde o aluno está matriculado e ativo.</p>
                        </div>
                    </div>
                    <div className="bg-[#F8FAFC] border border-slate-200/80 px-4 py-2 rounded-lg shadow-sm shrink-0 text-center">
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                            {aluno.unidade || 'SEM VÍNCULO'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TabDados;