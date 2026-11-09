import React, { useEffect, useRef, useState } from 'react';
import { X, UserCheck, Save, Loader2, KeyRound } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';

// ==========================================
// JANELA "NOVO LOGIN" / "EDITAR LOGIN" (Configurações → Logins, só Admin; 09/11/2026)
// Novo: e-mail, nível, senha (Líder e Recepção recebem a senha padrão 123456, como antes), nome e unidade.
// Editar: o e-mail não muda (é a chave do login) e a senha não é pedida; troca nível, nome e unidade.
// Quem grava é o index.jsx (onSalvar devolve true quando deu certo).
// ==========================================

const SENHA_PADRAO = '123456';
const NIVEIS = [
    ['ADMIN', 'Administrador Global (Admin)'],
    ['MENTOR', 'Mentor (unidades vinculadas)'],
    ['LIDER', 'Líder de Unidade'],
    ['RECEPCAO', 'Recepção / Consultor'],
];

const campo = 'w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-[13px] font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed dark:bg-slate-800/60 dark:border-slate-700 dark:text-white dark:focus:bg-slate-900';
const rotulo = 'block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 dark:text-slate-400';

const JanelaLogin = ({ login = null, unidades = [], onCancelar, onSalvar }) => {
    const editando = !!login;
    const [email, setEmail] = useState(login?.email || '');
    const [nivel, setNivel] = useState(String(login?.role || '').toUpperCase());
    const [senha, setSenha] = useState('');
    const [nome, setNome] = useState(login?.nome || '');
    const [unidade, setUnidade] = useState(login?.unidade || '');
    const [salvando, setSalvando] = useState(false);
    const primeiroCampo = useRef(null);

    const senhaAutomatica = nivel === 'LIDER' || nivel === 'RECEPCAO';
    useEffect(() => { primeiroCampo.current?.focus(); }, []);
    useEffect(() => {
        const aoTeclar = (e) => { if (e.key === 'Escape' && !salvando) onCancelar(); };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [onCancelar, salvando]);

    // A unidade gravada pode ser de uma unidade desativada: continua aparecendo na lista para não sumir
    const ativas = unidades.filter(u => u?.nome && u.ativa !== false);
    const atualForaDaLista = unidade && unidade !== 'TODAS' && !ativas.some(u => u.nome === unidade);

    const salvar = async (e) => {
        e.preventDefault();
        if (salvando) return;
        const senhaFinal = senhaAutomatica ? SENHA_PADRAO : senha;
        if (!email.trim() || !nivel || !nome.trim() || !unidade || (!editando && !senhaFinal)) return;
        setSalvando(true);
        const ok = await onSalvar({ email: email.toLowerCase().trim(), role: nivel, senha: senhaFinal, nome: nome.toUpperCase().trim(), unidade: unidade.toUpperCase() });
        if (!ok) setSalvando(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !salvando) onCancelar(); }}>
            <form onSubmit={salvar} className="w-full sm:w-[min(460px,100%)] max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl animate-[fadeIn_0.2s_ease-out]" role="dialog" aria-modal="true" aria-labelledby="titulo-janela-login">
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 id="titulo-janela-login" className="text-[12px] font-black uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        {editando ? tx('Editar login') : tx('Novo login')}
                    </h3>
                    <button type="button" onClick={onCancelar} disabled={salvando} aria-label={tx('Fechar')} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div>
                        <label htmlFor="login-email" className={rotulo}>{tx('E-mail do Usuário')}</label>
                        <input id="login-email" ref={editando ? null : primeiroCampo} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={editando}
                            placeholder={tx('email@pratique.com')} className={`${campo} lowercase`} />
                        {editando && <p className="text-[10px] font-bold text-slate-400 mt-1">{tx('O e-mail é a identificação do login e não pode ser trocado.')}</p>}
                    </div>

                    <div>
                        <label htmlFor="login-nivel" className={rotulo}>{tx('Nível de Permissão')}</label>
                        <select id="login-nivel" ref={editando ? primeiroCampo : null} value={nivel} onChange={(e) => setNivel(e.target.value)} required className={`${campo} cursor-pointer`}>
                            <option value="" disabled>{tx('Selecione o Nível...')}</option>
                            {NIVEIS.map(([v, r]) => <option key={v} value={v}>{tx(r)}</option>)}
                        </select>
                    </div>

                    {!editando && (
                        <div>
                            <label htmlFor="login-senha" className={rotulo}>{tx('Senha Inicial')}</label>
                            <input id="login-senha" type="text" value={senhaAutomatica ? SENHA_PADRAO : senha} onChange={(e) => setSenha(e.target.value)} required disabled={senhaAutomatica}
                                placeholder={tx('Defina uma senha segura')} className={campo} />
                            {senhaAutomatica && <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{tx('Senha padrão "123456" aplicada automaticamente.')}</p>}
                        </div>
                    )}

                    <div>
                        <label htmlFor="login-nome" className={rotulo}>{tx('Nome de Exibição')}</label>
                        <input id="login-nome" type="text" value={nome} onChange={(e) => setNome(e.target.value)} required placeholder={tx('Ex: Marcelo de Paula')} className={`${campo} uppercase`} />
                    </div>

                    <div>
                        <label htmlFor="login-unidade" className={rotulo}>{tx('Vincular à Unidade')}</label>
                        <select id="login-unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} required className={`${campo} cursor-pointer uppercase`}>
                            <option value="" disabled>{tx('Selecione a Unidade...')}</option>
                            <option value="TODAS">{tx('Todas as Unidades (Global)')}</option>
                            {atualForaDaLista && <option value={unidade}>{unidade} ({tx('desativada')})</option>}
                            {ativas.map(u => <option key={u.id} value={u.nome}>{u.nome}</option>)}
                        </select>
                        {nivel === 'MENTOR' && <p className="text-[10px] font-bold text-slate-400 mt-1">{tx('O Mentor vê as unidades marcadas no botão "Unidades" da lista.')}</p>}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-800">
                    <button type="button" onClick={onCancelar} disabled={salvando} className="h-10 px-4 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
                        {tx('Cancelar')}
                    </button>
                    <button type="submit" disabled={salvando} className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-sm">
                        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : editando ? <Save className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        {editando ? tx('Salvar alterações') : tx('Criar login')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default JanelaLogin;
