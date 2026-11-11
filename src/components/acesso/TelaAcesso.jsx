import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, LogOut, Clock, XCircle, ShieldAlert, Send, Search, Check, MonitorSmartphone } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { avisar } from '../avisar.js';
import { pedirAcesso, unidadesParaCadastro } from './acessoBanco.js';
import { situacaoDaEntrada, telefoneValido, juntarTelefone, telefoneBonito } from './regrasAcesso.js';

// ==========================================
// TELA DE ACESSO (12/11/2026, decisão do dono) — aparece depois do "Entrar com Google" para quem ainda não tem
// acesso ativo: pedido de acesso (Líder: UMA unidade; Mentor: várias), "aguardando liberação", "rejeitado" com o
// motivo e "inativo: fale com a diretoria". Recepção: o e-mail da franquia precisa estar cadastrado pelo Admin.
// ==========================================

const DDIS = [['55', '🇧🇷 +55'], ['54', '🇦🇷 +54'], ['1', '🇺🇸 +1'], ['351', '🇵🇹 +351']];
const campo = 'w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 placeholder:font-medium placeholder:text-slate-400 dark:bg-slate-900 dark:border-slate-700 dark:text-white';
const rotulo = 'block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 dark:text-slate-400';

const Moldura = ({ email, onSair, children }) => (
    <div className="fixed inset-0 overflow-y-auto bg-slate-50 dark:bg-[#0a0f1c] flex items-start sm:items-center justify-center p-4">
        <div className="w-[min(560px,100%)] my-8 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden dark:bg-slate-900 dark:border-slate-800">
            <div className="px-6 py-4 bg-blue-600 text-white flex items-center gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-widest opacity-90">{tx('Pratique Vendas')}</p>
                    <p className="text-[13px] font-bold truncate">{email}</p>
                </div>
                <button type="button" onClick={onSair} className="h-9 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-1.5">
                    <LogOut className="w-3.5 h-3.5" />{tx('Sair')}
                </button>
            </div>
            <div className="p-6">{children}</div>
        </div>
    </div>
);

const Aviso = ({ icone: Icone, cor, titulo, children }) => (
    <div className="text-center py-4">
        <Icone className={`w-12 h-12 mx-auto mb-3 ${cor}`} />
        <h2 className="text-lg font-black text-slate-800 dark:text-white">{titulo}</h2>
        <div className="mt-2 text-[13px] font-semibold text-slate-600 leading-relaxed dark:text-slate-300">{children}</div>
    </div>
);

const TelaAcesso = ({ email, situacao, onSair, onAtualizar }) => {
    const estado = situacaoDaEntrada(situacao);
    const [refazer, setRefazer] = useState(false);
    const mostrarCadastro = estado === 'cadastro' || (estado === 'rejeitado' && refazer);

    // ---------- Pedido de acesso ----------
    const [nome, setNome] = useState('');
    const [ddi, setDdi] = useState('55');
    const [numero, setNumero] = useState('');
    const [papel, setPapel] = useState('LIDER');
    const [escolhidas, setEscolhidas] = useState([]);
    const [busca, setBusca] = useState('');
    const [unidades, setUnidades] = useState(null);
    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
        if (!mostrarCadastro || unidades) return;
        unidadesParaCadastro().then(setUnidades).catch(e => { console.warn(e); setUnidades([]); avisar(tx('Não foi possível carregar as unidades: {erro}', { erro: e.message || '' }), 'erro'); });
    }, [mostrarCadastro, unidades]);

    const filtradas = useMemo(() => {
        const b = busca.trim().toUpperCase();
        return (unidades || []).filter(u => !b || u.toUpperCase().includes(b));
    }, [unidades, busca]);

    const alternar = (u) => {
        if (papel === 'LIDER') { setEscolhidas([u]); return; }
        setEscolhidas(lista => (lista.includes(u) ? lista.filter(x => x !== u) : [...lista, u]));
    };
    const trocarPapel = (p) => { setPapel(p); if (p === 'LIDER') setEscolhidas(l => l.slice(0, 1)); };

    const enviar = async (e) => {
        e.preventDefault();
        const telefone = juntarTelefone(ddi, numero);
        if (nome.trim().split(/\s+/).length < 2) { avisar(tx('Informe o nome completo.'), 'atencao'); return; }
        if (!telefoneValido(telefone)) { avisar(tx('Telefone inválido: digite o DDD e o número.'), 'atencao'); return; }
        if (!escolhidas.length) { avisar(papel === 'LIDER' ? tx('Escolha a sua unidade.') : tx('Escolha as suas unidades.'), 'atencao'); return; }
        setEnviando(true);
        try {
            await pedirAcesso({ nome: nome.trim(), telefone, papel, unidades: escolhidas });
            avisar(tx('Pedido enviado. Aguarde a liberação.'), 'sucesso');
            setRefazer(false);
            await onAtualizar();
        } catch (erro) {
            avisar(erro.message || tx('Não foi possível enviar o pedido.'), 'erro');
        } finally {
            setEnviando(false);
        }
    };

    if (!mostrarCadastro) {
        if (estado === 'aguardando') {
            const p = situacao.pedido;
            return (
                <Moldura email={email} onSair={onSair}>
                    <Aviso icone={Clock} cor="text-amber-500" titulo={tx('Aguardando liberação')}>
                        <p>{tx('Seu acesso está aguardando liberação do seu mentor ou da diretoria.')}</p>
                        <p className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">
                            {p.papel === 'LIDER' ? tx('Líder') : tx('Mentor')} · {(p.unidades || []).join(', ')}{p.tipo === 'TROCA_LIDER' ? ` · ${tx('troca de líder')}` : ''}
                        </p>
                    </Aviso>
                    <button type="button" onClick={onAtualizar} className="w-full h-11 mt-3 rounded-xl bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">{tx('Já fui liberado? Conferir')}</button>
                </Moldura>
            );
        }
        if (estado === 'inativo') {
            return (
                <Moldura email={email} onSair={onSair}>
                    <Aviso icone={ShieldAlert} cor="text-rose-500" titulo={tx('Acesso inativo')}>
                        <p>{tx('Este acesso não está mais ativo. Fale com a diretoria.')}</p>
                        {situacao.perfil?.inativado_motivo && <p className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">{situacao.perfil.inativado_motivo}</p>}
                    </Aviso>
                </Moldura>
            );
        }
        // rejeitado
        return (
            <Moldura email={email} onSair={onSair}>
                <Aviso icone={XCircle} cor="text-rose-500" titulo={tx('Pedido não aprovado')}>
                    <p>{tx('Motivo: {motivo}', { motivo: situacao.pedido?.motivo || '—' })}</p>
                    <p className="mt-1">{tx('Fale com a diretoria ou faça um novo pedido com os dados corretos.')}</p>
                </Aviso>
                <button type="button" onClick={() => setRefazer(true)} className="w-full h-11 mt-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest">{tx('Fazer novo pedido')}</button>
            </Moldura>
        );
    }

    return (
        <Moldura email={email} onSair={onSair}>
            <h2 className="text-lg font-black text-slate-800 dark:text-white">{tx('Pedir acesso ao sistema')}</h2>
            <p className="mt-1 text-[12px] font-semibold text-slate-500 dark:text-slate-400">{tx('Preencha seus dados. O seu mentor (ou a diretoria) vai liberar o acesso.')}</p>
            <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] font-semibold text-blue-900 flex items-start gap-2 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-200">
                <MonitorSmartphone className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{tx('Computador da Recepção? Entre com o e-mail da franquia. Se ele não abrir o sistema, peça à diretoria para cadastrar esse e-mail.')}</span>
            </div>
            <form onSubmit={enviar} className="mt-5 space-y-4">
                <label className="block">
                    <span className={rotulo}>{tx('E-mail (sua conta Google)')}</span>
                    <input value={email} readOnly className={`${campo} bg-slate-50 text-slate-500 dark:bg-slate-800`} />
                </label>
                <label className="block">
                    <span className={rotulo}>{tx('Nome completo')}</span>
                    <input value={nome} onChange={e => setNome(e.target.value)} autoFocus placeholder={tx('Ex: Maria Aparecida Souza')} className={`${campo} uppercase`} />
                </label>
                <div>
                    <span className={rotulo}>{tx('Telefone (WhatsApp)')}</span>
                    <div className="flex gap-2">
                        <select value={ddi} onChange={e => setDdi(e.target.value)} className={`${campo} w-32 cursor-pointer`} aria-label={tx('Código do país')}>
                            {DDIS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                        </select>
                        <input value={numero} onChange={e => setNumero(e.target.value)} inputMode="tel" placeholder={tx('DDD + número')} className={campo} />
                    </div>
                    {numero && <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{telefoneBonito(juntarTelefone(ddi, numero))}</p>}
                </div>
                <div>
                    <span className={rotulo}>{tx('Você é')}</span>
                    <div className="grid grid-cols-2 gap-2">
                        {[['LIDER', 'Líder da unidade'], ['MENTOR', 'Mentor']].map(([v, r]) => (
                            <button key={v} type="button" onClick={() => trocarPapel(v)} aria-pressed={papel === v}
                                className={`h-11 rounded-xl border text-[11px] font-black uppercase tracking-wide ${papel === v ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'}`}>{tx(r)}</button>
                        ))}
                    </div>
                </div>
                <div>
                    <span className={rotulo}>{papel === 'LIDER' ? tx('Sua unidade (só uma)') : tx('Suas unidades')}</span>
                    <label className="flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-blue-500 dark:bg-slate-900 dark:border-slate-700">
                        <Search className="w-4 h-4 text-slate-400" />
                        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder={tx('Buscar unidade...')} className="flex-1 min-w-0 bg-transparent outline-none text-sm font-bold text-slate-800 dark:text-white" />
                    </label>
                    <div className="mt-2 max-h-52 overflow-y-auto custom-scrollbar rounded-xl border border-slate-200 divide-y divide-slate-100 dark:border-slate-800 dark:divide-slate-800">
                        {unidades === null && <p className="p-3 text-[12px] font-semibold text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{tx('Carregando...')}</p>}
                        {filtradas.map(u => {
                            const marcada = escolhidas.includes(u);
                            return (
                                <button key={u} type="button" onClick={() => alternar(u)} aria-pressed={marcada}
                                    className={`w-full px-3 py-2.5 text-left text-[12px] font-black uppercase flex items-center justify-between ${marcada ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'}`}>
                                    {u}{marcada && <Check className="w-4 h-4" />}
                                </button>
                            );
                        })}
                        {unidades && filtradas.length === 0 && <p className="p-3 text-[12px] font-semibold text-slate-400">{tx('Nenhuma unidade encontrada.')}</p>}
                    </div>
                    {escolhidas.length > 0 && <p className="mt-1.5 text-[11px] font-bold text-blue-700 dark:text-blue-400">{escolhidas.join(' · ')}</p>}
                    {papel === 'LIDER' && <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tx('Se a unidade já tem líder, o pedido vira TROCA DE LÍDER e o líder atual sai quando o pedido for aprovado.')}</p>}
                </div>
                <button type="submit" disabled={enviando} className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[12px] font-black uppercase tracking-widest inline-flex items-center justify-center gap-2">
                    {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{tx('Enviar pedido')}
                </button>
            </form>
        </Moldura>
    );
};

export default TelaAcesso;
