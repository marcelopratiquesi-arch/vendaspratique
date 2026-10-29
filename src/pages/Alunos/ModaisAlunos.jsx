import React, { useState, useEffect } from 'react';
import { Trash2, X, AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { formatarCPF, executarExclusaoAluno } from './utils.js';
import { tx } from '../../i18n/traduzir.js';

export const ModalConfirmarExclusaoAluno = ({
    isOpen,
    aluno,
    onClose,
    usuarioLogado,
    onExcluidoSucesso
}) => {
    const [motivo, setMotivo] = useState('Cadastro duplicado ou realizado de forma indevida');
    const [excluindo, setExcluindo] = useState(false);
    const [erroBloqueio, setErroBloqueio] = useState('');

    useEffect(() => {
        if (isOpen) {
            setErroBloqueio('');
            setMotivo('Cadastro duplicado ou realizado de forma indevida');
        }
    }, [isOpen, aluno?.id]);

    if (!isOpen || !aluno) return null;

    const handleConfirmar = async (e) => {
        e.preventDefault();
        setExcluindo(true);
        setErroBloqueio('');

        try {
            const res = await executarExclusaoAluno({
                alunoId: aluno.id,
                roleUsuario: usuarioLogado?.role,
                nomeUsuario: usuarioLogado?.nome,
                emailUsuario: usuarioLogado?.email,
                motivo
            });

            if (!res?.sucesso) {
                setErroBloqueio(res?.mensagem || 'Não foi possível excluir este registro.');
            } else {
                onExcluidoSucesso(aluno);
                onClose();
            }
        } catch (err) {
            setErroBloqueio(err?.message || 'Erro de comunicação ao validar vínculos do aluno.');
        } finally {
            setExcluindo(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
                <div className="bg-slate-900 px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                            <Trash2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-white uppercase tracking-tight">
                                {tx("Excluir Aluno")}
                            </h3>
                            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                                {tx("Ação exclusiva Admin • Auditada")}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleConfirmar} className="p-6 space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-800/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase">
                            {aluno.nome}
                        </p>
                        <p className="text-xs font-mono font-bold text-slate-500 mt-1 dark:text-slate-400">
                            {tx("CPF:")}{' '}{formatarCPF(aluno.cpf)} {aluno.matricula ? tx("• Matrícula #{matricula}", { matricula: aluno.matricula }) : ''}
                        </p>
                    </div>

                    {erroBloqueio ? (
                        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-4 rounded-2xl flex items-start gap-3">
                            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 dark:text-rose-400" />
                            <div className="text-xs font-bold text-rose-700 dark:text-rose-300 leading-relaxed">
                                {erroBloqueio}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-3.5 rounded-xl flex items-start gap-2.5">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 dark:text-amber-400" />
                            <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 leading-snug">
                                {tx("Se este aluno possuir vendas ou avaliações vinculadas, o banco bloqueará a exclusão automaticamente para proteger o histórico financeiro.")}
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 dark:text-slate-400">
                            {tx("Motivo para o Registro de Auditoria *")}
                        </label>
                        <input
                            type="text"
                            required
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-rose-500"
                        />
                    </div>

                    <div className="pt-3 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            {tx("Cancelar")}
                        </button>
                        <button
                            type="submit"
                            disabled={excluindo || !motivo.trim()}
                            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm"
                        >
                            {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            {tx("Confirmar Exclusão")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};