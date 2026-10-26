import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient.js';
import { UserRoundPen, ShoppingCart, Dumbbell, IdCard, Phone, Mail } from 'lucide-react';
import { extrairIniciais, formatarTelefone, limparApenasDigitos } from '../utils.js';
import CopyButton from './CopyButton.jsx';

const CabecalhoFicha = ({ aluno, onEditar, onVender, onAvaliar, langAtual = 'pt-BR' }) => {
    // Estados para armazenar os dados reais caso o aluno venha da lista de "Recentes" (mascarado)
    const [cpfReal, setCpfReal] = useState(aluno.cpf || '');
    const [telefoneReal, setTelefoneReal] = useState(aluno.telefone || '');
    const [emailReal, setEmailReal] = useState(aluno.email || '');

    useEffect(() => {
        // 🔥 MÁGICA DE DESMASCARAR: Se o CPF tiver '*', busca o original direto no banco de dados!
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
                } catch (err) {
                    console.error('Erro ao desmascarar dados:', err);
                }
            } else {
                setCpfReal(aluno.cpf);
                setTelefoneReal(aluno.telefone);
                setEmailReal(aluno.email);
            }
        };
        buscarDadosReais();
    }, [aluno]);

    // Prepara o CPF para ser exibido inteiro e formatado lindamente
    const cpfLimpo = limparApenasDigitos(cpfReal);
    const cpfCompletoExibicao = cpfLimpo.length === 11 
        ? cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") 
        : (cpfReal || 'S/ CPF');

    return (
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 pb-5 mb-5 border-b border-slate-200/80 dark:border-slate-800">
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
                <div className="relative shrink-0">
                    {aluno.foto_url ? (
                        <img src={aluno.foto_url} alt={aluno.nome} className="w-14 h-14 rounded-full object-cover border border-slate-200 shadow-sm" />
                    ) : (
                        <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center text-lg font-bold shadow-sm">
                            {extrairIniciais(aluno.nome)}
                        </div>
                    )}
                    {aluno.matricula && aluno.matricula !== 'VISITANTE' && (
                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-sm" title="Matrícula Ativa"></div>
                    )}
                </div>

                <div className="flex flex-col w-full">
                    <h2 className="text-[19px] font-extrabold text-slate-800 uppercase tracking-tight mb-1.5">
                        {aluno.nome}
                    </h2>
                    
                    <div className="flex flex-wrap items-center gap-y-2 gap-x-3 text-[12px] font-medium text-slate-500">
                        
                        {/* MATRÍCULA - AZUL */}
                        <div className="flex items-center gap-1.5">
                            <IdCard className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-blue-600 font-semibold">{aluno.matricula && aluno.matricula !== 'VISITANTE' ? `#${aluno.matricula}` : 'S/ Matrícula'}</span>
                            {aluno.matricula && aluno.matricula !== 'VISITANTE' && (
                                <CopyButton value={aluno.matricula} label="Copiar Matrícula" className="!w-6 !h-6 !min-w-[24px] !rounded-md" />
                            )}
                        </div>

                        <div className="hidden sm:block w-px h-3 bg-slate-300"></div>

                        {/* CPF - VIOLETA */}
                        <div className="flex items-center gap-1.5">
                            <IdCard className="w-3.5 h-3.5 text-violet-500" />
                            <span>{cpfCompletoExibicao}</span>
                            {cpfLimpo && (
                                <CopyButton value={cpfLimpo} label="Copiar CPF" className="!w-6 !h-6 !min-w-[24px] !rounded-md" />
                            )}
                        </div>

                        <div className="hidden sm:block w-px h-3 bg-slate-300"></div>

                        {/* TELEFONE - VERDE */}
                        <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{formatarTelefone(telefoneReal)}</span>
                            {telefoneReal && (
                                <CopyButton value={limparApenasDigitos(telefoneReal)} label="Copiar Telefone" className="!w-6 !h-6 !min-w-[24px] !rounded-md" />
                            )}
                        </div>

                        <div className="hidden lg:block w-px h-3 bg-slate-300"></div>

                        {/* E-MAIL - ÂMBER */}
                        <div className="flex items-center gap-1.5 lowercase">
                            <Mail className="w-3.5 h-3.5 text-amber-500" />
                            <span>{emailReal || 'sem e-mail'}</span>
                            {emailReal && (
                                <CopyButton value={emailReal} label="Copiar E-mail" className="!w-6 !h-6 !min-w-[24px] !rounded-md" />
                            )}
                        </div>

                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
                <button onClick={onEditar} className="flex-1 sm:flex-none px-4 py-2 rounded-lg border border-slate-200 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center gap-1.5">
                    <UserRoundPen className="w-3.5 h-3.5" /> Editar
                </button>
                
                {onVender && (
                    <button onClick={onVender} className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-1.5">
                        <ShoppingCart className="w-3.5 h-3.5" /> Vender
                    </button>
                )}
                
                {onAvaliar && (
                    <button onClick={onAvaliar} className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-1.5">
                        <Dumbbell className="w-3.5 h-3.5" /> Avaliação
                    </button>
                )}
            </div>
        </div>
    );
};

export default CabecalhoFicha;