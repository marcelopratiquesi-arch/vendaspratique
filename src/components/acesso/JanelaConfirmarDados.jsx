import React, { useState } from 'react';
import { UserCheck, Loader2 } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { avisar } from '../avisar.js';
import { confirmarDados } from './acessoBanco.js';
import { telefoneValido, juntarTelefone, telefoneBonito, telefoneParaEquipe } from './regrasAcesso.js';

// ==========================================
// CONFIRMAR OS DADOS (12/11/2026, decisão do dono) — Líder, Mentor e Admin. OBRIGATÓRIA (não fecha):
// no primeiro acesso depois de aprovado, quando falta o telefone e a cada 30 dias.
// "Seu telefone ainda é X? Seu e-mail ainda é Y?" → Confirmar (como está) ou Atualizar (corrige nome/telefone).
// O telefone do LÍDER vai também para a Equipe (é o das cobranças no WhatsApp).
// O e-mail é a conta Google da pessoa: para trocar, entra com a outra conta e pede acesso de novo.
// A Recepção não passa por aqui.
// ==========================================

const DDIS = [['55', '+55'], ['54', '+54'], ['1', '+1'], ['351', '+351']];
const campo = 'w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white';
const rotulo = 'block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 dark:text-slate-400';
const separarTelefone = (tel) => {
    const n = String(tel || '').replace(/\D/g, '');
    const ddi = DDIS.map(([d]) => d).find(d => n.startsWith(d) && n.length >= d.length + 10);
    return ddi ? [ddi, n.slice(ddi.length)] : ['55', n];
};

const JanelaConfirmarDados = ({ perfil, onConfirmado }) => {
    const temTelefone = telefoneValido(perfil.telefone);
    const [editando, setEditando] = useState(!temTelefone);
    const [nome, setNome] = useState(perfil.nome || '');
    const [ddi0, num0] = separarTelefone(perfil.telefone);
    const [ddi, setDdi] = useState(ddi0);
    const [numero, setNumero] = useState(num0);
    const [salvando, setSalvando] = useState(false);
    const ehLider = String(perfil.role).toUpperCase() === 'LIDER';

    const salvar = async () => {
        const telefone = editando ? juntarTelefone(ddi, numero) : perfil.telefone;
        if (String(nome).trim().split(/\s+/).length < 2) { avisar(tx('Informe o nome completo.'), 'atencao'); return; }
        if (!telefoneValido(telefone)) { avisar(tx('Telefone inválido: digite o DDD e o número.'), 'atencao'); return; }
        setSalvando(true);
        try {
            const r = await confirmarDados({ nome: nome.trim(), telefone, telefoneEquipe: ehLider ? telefoneParaEquipe(telefone) : null });
            if (ehLider && !r.equipe_atualizada) avisar(tx('Seu telefone não foi para a Equipe: não achamos você no setor Líder da unidade com esse nome. Avise a diretoria.'), 'atencao');
            avisar(tx('Dados confirmados. Obrigado!'), 'sucesso');
            onConfirmado({ nome: nome.trim().toUpperCase(), telefone });
        } catch (e) {
            avisar(e.message || tx('Não foi possível salvar.'), 'erro');
        } finally {
            setSalvando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-confirmar-dados">
            <div className="bg-white rounded-2xl shadow-2xl w-[min(480px,100%)] overflow-hidden dark:bg-slate-900">
                <div className="px-6 py-4 bg-blue-600 text-white flex items-start gap-3">
                    <UserCheck className="w-6 h-6 shrink-0 mt-0.5" />
                    <div>
                        <h2 id="titulo-confirmar-dados" className="text-sm font-black uppercase tracking-widest">{tx('Confirme os seus dados')}</h2>
                        <p className="text-[12px] font-semibold opacity-90">{temTelefone ? tx('A cada 30 dias pedimos para conferir se está tudo certo.') : tx('Falta o seu telefone. Ele é obrigatório.')}</p>
                    </div>
                </div>
                <div className="px-6 py-5 space-y-4">
                    {!editando ? (
                        <div className="space-y-2 text-[14px] font-semibold text-slate-700 dark:text-slate-200">
                            <p>{tx('Seu nome ainda é')} <b className="uppercase">{perfil.nome}</b>?</p>
                            <p>{tx('Seu telefone ainda é')} <b>{telefoneBonito(perfil.telefone)}</b>?</p>
                            <p>{tx('Seu e-mail ainda é')} <b>{perfil.email}</b>?</p>
                            {ehLider && <p className="text-[12px] text-slate-500 dark:text-slate-400">{tx('Unidade: {unidade}', { unidade: perfil.unidade })}</p>}
                        </div>
                    ) : (
                        <>
                            <label className="block">
                                <span className={rotulo}>{tx('Nome completo')}</span>
                                <input value={nome} onChange={e => setNome(e.target.value)} className={`${campo} uppercase`} />
                            </label>
                            <div>
                                <span className={rotulo}>{tx('Telefone (WhatsApp)')}</span>
                                <div className="flex gap-2">
                                    <select value={ddi} onChange={e => setDdi(e.target.value)} className={`${campo} w-24 cursor-pointer`} aria-label={tx('Código do país')}>
                                        {DDIS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                                    </select>
                                    <input value={numero} onChange={e => setNumero(e.target.value)} inputMode="tel" placeholder={tx('DDD + número')} className={campo} />
                                </div>
                            </div>
                            <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{tx('E-mail de login: {email} (sua conta Google). Para trocar de e-mail, fale com a diretoria.', { email: perfil.email })}</p>
                            {ehLider && <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{tx('Unidade: {unidade}. Para mudar de unidade, fale com o seu mentor.', { unidade: perfil.unidade })}</p>}
                        </>
                    )}
                </div>
                <div className="px-6 py-4 border-t border-slate-200 grid grid-cols-2 gap-3 dark:border-slate-800">
                    {!editando
                        ? <button type="button" onClick={() => setEditando(true)} disabled={salvando} className="h-11 rounded-xl bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">{tx('Atualizar')}</button>
                        : <span />}
                    <button type="button" onClick={salvar} disabled={salvando} className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-widest inline-flex items-center justify-center gap-2">
                        {salvando && <Loader2 className="w-4 h-4 animate-spin" />}{editando ? tx('Salvar') : tx('Confirmar')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JanelaConfirmarDados;
