import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { Loader2, ArrowLeft, UserX } from 'lucide-react';
import FichaAluno from '../Alunos/ficha/index.jsx';
import ModalAluno from '../../components/Modals/ModalAluno.jsx';
import { anexarUnidades } from '../Alunos/utils.js';
import { mascaraCPF } from '../CadastroGeral/utilsAlunos.js';
import { apenasDigitos } from './utils';
import { tx } from '../../i18n/traduzir.js';

// ==========================================
// FICHA DO ALUNO EM POP-UP, POR CIMA DO CRM
// O CRM continua aberto por baixo: "Voltar para o CRM" só fecha a janela
// (mesma aba, mesmos filtros, mesma busca). Sem Vender/Avaliação: é consulta rápida + Editar.
// ==========================================
const FichaAlunoPopup = ({ contato, usuarioLogado, onFechar }) => {
    const [aluno, setAluno] = useState(null);
    const [carregando, setCarregando] = useState(true);
    const [naoEncontrado, setNaoEncontrado] = useState(false);
    const [editando, setEditando] = useState(false);

    const cpf = apenasDigitos(contato?.cpf);
    const alunoId = contato?.aluno_id || null;

    useEffect(() => {
        let ativo = true;
        const buscar = async () => {
            setCarregando(true);
            setNaoEncontrado(false);
            // Pelo código do aluno (aniversário, migração) ou pelo CPF do contato
            if (!alunoId && cpf.length !== 11) { setNaoEncontrado(true); setCarregando(false); return; }
            const consulta = supabase.from('alunos').select('*');
            const { data, error } = await (alunoId
                ? consulta.eq('id', alunoId).limit(1)
                : consulta.or(`cpf.eq.${cpf},cpf.eq."${mascaraCPF(cpf)}"`).limit(1));
            if (!ativo) return;
            if (error || !data || data.length === 0) {
                if (error) console.error('Erro ao buscar o aluno do contato:', error);
                setNaoEncontrado(true);
                setCarregando(false);
                return;
            }
            const [comUnidade] = await anexarUnidades(data);
            if (!ativo) return;
            setAluno(comUnidade || data[0]);
            setCarregando(false);
        };
        buscar();
        return () => { ativo = false; };
    }, [cpf, alunoId]);

    // Fecha com a tecla Esc
    useEffect(() => {
        const aoApertar = (e) => { if (e.key === 'Escape' && !editando) onFechar(); };
        window.addEventListener('keydown', aoApertar);
        return () => window.removeEventListener('keydown', aoApertar);
    }, [onFechar, editando]);

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-3 md:p-8 overflow-y-auto animate-[fadeIn_0.15s_ease-out]" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
            <div className="w-full max-w-6xl my-auto">
                {carregando ? (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-16 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{tx("Abrindo a ficha do aluno...")}</p>
                    </div>
                ) : naoEncontrado ? (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 flex flex-col items-center text-center max-w-md mx-auto">
                        <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                            <UserX className="w-7 h-7" />
                        </div>
                        <p className="text-sm font-black text-slate-800 dark:text-white uppercase">{contato?.nome}</p>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-2">
                            {alunoId || cpf.length === 11
                                ? tx("Este contato ainda não tem cadastro de aluno.")
                                : tx("Este contato não tem CPF completo, então não dá para achar o cadastro de aluno.")}
                        </p>
                        <button type="button" onClick={onFechar} className="mt-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors">
                            <ArrowLeft className="w-4 h-4" />{' '}{tx("Voltar para o CRM")}
                        </button>
                    </div>
                ) : (
                    <FichaAluno
                        aluno={aluno}
                        onVoltar={onFechar}
                        rotuloVoltar="Voltar para o CRM"
                        onEditar={() => setEditando(true)}
                        usuarioLogado={usuarioLogado}
                    />
                )}
            </div>

            {aluno && (
                <ModalAluno
                    isOpen={editando}
                    onClose={() => setEditando(false)}
                    alunoInicial={{ ...aluno, unidade_vinculo: aluno.unidade }}
                    onSaveSuccess={(salvo) => setAluno(prev => ({ ...prev, ...salvo }))}
                    usuarioLogado={usuarioLogado}
                    unidadeDestino={usuarioLogado?.unidade && usuarioLogado.unidade !== 'TODAS' ? usuarioLogado.unidade : undefined}
                />
            )}
        </div>
    );
};

export default FichaAlunoPopup;
