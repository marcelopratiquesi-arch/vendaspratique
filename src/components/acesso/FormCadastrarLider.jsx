import React, { useMemo, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { avisar } from '../avisar.js';
import { cadastrarLider } from './acessoBanco.js';
import { telefoneValido, juntarTelefone, normalizarEmail } from './regrasAcesso.js';

// ==========================================
// CADASTRAR LÍDER OU ASPIRA PELO E-MAIL (13/11/2026, decisão do dono) — Acessos → Líderes por unidade.
// Nome, e-mail (Google) e WhatsApp; dá para puxar nome e telefone da Equipe da unidade. A pessoa entra com o
// Google sem pedir acesso. Quem ocupava a mesma vaga fica INATIVO (precisa pedir de novo; a unidade não perde
// nada); a outra vaga não muda. Admin em todas; Mentor nas dele (o banco confere: acesso_cadastrar_lider).
// ==========================================

const DDIS = [['55', '+55'], ['54', '+54'], ['1', '+1'], ['351', '+351']];
const campo = 'w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white';
const soNumeros = (t) => String(t || '').replace(/\D/g, '');

const FormCadastrarLider = ({ unidade, posto, atuais = [], colaboradores = [], onFeito, onCancelar }) => {
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [ddi, setDdi] = useState('55');
    const [numero, setNumero] = useState('');
    const [gravando, setGravando] = useState(false);
    const nomePosto = posto === 'ASPIRA' ? tx('Aspira') : tx('Líder');
    const daEquipe = useMemo(() => colaboradores
        .filter(c => c && c.ativo !== false && String(c.unidade || '').trim().toUpperCase() === unidade)
        .sort((a, b) => String(a.nome).localeCompare(String(b.nome))), [colaboradores, unidade]);

    const puxarDaEquipe = (id) => {
        const c = daEquipe.find(x => String(x.id) === String(id));
        if (!c) return;
        setNome(String(c.nome || '').toUpperCase());
        const tel = soNumeros(c.telefone);
        if (tel) setNumero(tel.startsWith('55') && tel.length >= 12 ? tel.slice(2) : tel);
        if (c.email) setEmail(String(c.email).toLowerCase());
    };

    const gravar = async () => {
        const em = normalizarEmail(email);
        const telefone = juntarTelefone(ddi, numero);
        if (nome.trim().split(/\s+/).length < 2) { avisar(tx('Informe o nome completo.'), 'atencao'); return; }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { avisar(tx('E-mail inválido.'), 'atencao'); return; }
        if (!telefoneValido(telefone)) { avisar(tx('WhatsApp inválido: digite o DDD e o número.'), 'atencao'); return; }
        const texto = atuais.length
            ? tx('Cadastrar {nome} como {posto} de {unidade}? {atual} sai e fica INATIVO (precisa pedir acesso de novo). Nada da unidade é apagado e a outra vaga não muda.', { nome: nome.trim().toUpperCase(), posto: nomePosto, unidade, atual: atuais.map(a => a.nome).join(', ') })
            : tx('Cadastrar {nome} como {posto} de {unidade}? Ele(a) entra com o Google no e-mail {email}, sem pedir acesso.', { nome: nome.trim().toUpperCase(), posto: nomePosto, unidade, email: em });
        if (!window.confirm(texto)) return;
        setGravando(true);
        try {
            await cadastrarLider({ unidade, email: em, nome: nome.trim(), telefone, posto });
            avisar(tx('{posto} de {unidade} cadastrado. Ele(a) entra com o Google no e-mail {email}.', { posto: nomePosto, unidade, email: em }), 'sucesso');
            onFeito?.();
        } catch (e) { avisar(e.message || tx('Não foi possível cadastrar.'), 'erro'); } finally { setGravando(false); }
    };

    return (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-2 dark:bg-blue-500/5 dark:border-blue-500/30">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">{tx('Cadastrar {posto}', { posto: nomePosto })}</p>
                <button type="button" onClick={onCancelar} aria-label={tx('Fechar')} className="p-1 rounded-md text-slate-400 hover:bg-white dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
            </div>
            {daEquipe.length > 0 && (
                <select defaultValue="" onChange={e => puxarDaEquipe(e.target.value)} className={campo} aria-label={tx('Puxar da Equipe')}>
                    <option value="">{tx('Puxar nome e telefone da Equipe...')}</option>
                    {daEquipe.map(c => <option key={c.id} value={c.id}>{c.nome}{c.role ? ` · ${c.role}` : ''}</option>)}
                </select>
            )}
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder={tx('Nome completo')} className={`${campo} uppercase`} />
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder={tx('E-mail (Google) da pessoa')} className={campo} />
            <div className="flex gap-2">
                <select value={ddi} onChange={e => setDdi(e.target.value)} className={`${campo} w-20 px-1`} aria-label={tx('Código do país')}>
                    {DDIS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </select>
                <input value={numero} onChange={e => setNumero(e.target.value)} inputMode="tel" placeholder={tx('WhatsApp: DDD + número')} className={campo} />
            </div>
            <button type="button" onClick={gravar} disabled={gravando} className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-1.5">
                {gravando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}{tx('Cadastrar')}
            </button>
        </div>
    );
};

export default FormCadastrarLider;
