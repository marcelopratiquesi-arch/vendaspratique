import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, LogOut, Clock, XCircle, ShieldAlert, Send, Search, Check, MonitorSmartphone, UserRound, Building2 } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { avisar } from '../avisar.js';
import { pedirAcesso, unidadesParaCadastro } from './acessoBanco.js';
import { situacaoDaEntrada, telefoneValido, juntarTelefone, telefoneBonito } from './regrasAcesso.js';

// ==========================================
// TELA DE ACESSO (12/11/2026, decisão do dono) — aparece depois do "Entrar com Google" para quem ainda não tem
// acesso ativo: pedido de acesso (Líder: UMA unidade; Mentor: várias), "aguardando liberação", "rejeitado" com o
// motivo e "inativo: fale com a diretoria". Recepção: o e-mail da franquia precisa estar cadastrado pelo Admin.
// Visual (decisão do dono, 12/11/2026, depois da reclamação de um líder): página larga com DOIS cartões lado a lado
// (1 Seus dados | 2 Função e unidade), letras e caixas grandes; no celular os cartões ficam um embaixo do outro.
// ==========================================

const DDIS = [['55', '🇧🇷 +55'], ['54', '🇦🇷 +54'], ['1', '🇺🇸 +1'], ['351', '🇵🇹 +351']];
const caixa = 'h-14 px-4 rounded-xl border-2 border-slate-200 bg-white text-lg font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 placeholder:font-medium placeholder:text-slate-400 dark:bg-slate-900 dark:border-slate-700 dark:text-white';
const campo = `w-full ${caixa}`;
const rotulo = 'block text-[13px] font-black uppercase tracking-widest text-slate-600 mb-2 dark:text-slate-300';

const Topo = ({ email, onSair }) => (
    <div className="flex items-center gap-3 rounded-2xl bg-blue-600 text-white px-5 py-4 shadow-lg shadow-blue-600/20">
        <div className="min-w-0 flex-1">
            <p className="text-[12px] font-black uppercase tracking-widest opacity-90">{tx('Pratique Vendas')}</p>
            <p className="text-base font-bold truncate">{email}</p>
        </div>
        <button type="button" onClick={onSair} className="h-11 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-[13px] font-black uppercase tracking-widest inline-flex items-center gap-2 shrink-0">
            <LogOut className="w-4 h-4" />{tx('Sair')}
        </button>
    </div>
);

// Telas curtas (aguardando, rejeitado, inativo): um cartão no meio
const Moldura = ({ email, onSair, children }) => (
    <div className="fixed inset-0 overflow-y-auto bg-slate-50 dark:bg-[#0a0f1c] flex items-start sm:items-center justify-center p-4">
        <div className="w-[min(640px,100%)] my-8 space-y-4">
            <Topo email={email} onSair={onSair} />
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8 dark:bg-slate-900 dark:border-slate-800">{children}</div>
        </div>
    </div>
);

const Aviso = ({ icone: Icone, cor, titulo, children }) => (
    <div className="text-center py-4">
        <Icone className={`w-16 h-16 mx-auto mb-4 ${cor}`} />
        <h2 className="text-2xl font-black text-slate-800 dark:text-white">{titulo}</h2>
        <div className="mt-3 text-lg font-semibold text-slate-600 leading-relaxed dark:text-slate-300">{children}</div>
    </div>
);

const Cartao = ({ numero, icone: Icone, titulo, children }) => (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-xl p-5 sm:p-6 flex flex-col dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-5">
            <span className="w-10 h-10 rounded-xl bg-blue-600 text-white text-lg font-black flex items-center justify-center shrink-0">{numero}</span>
            <Icone className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0" />
            <h2 className="text-xl font-black text-slate-800 dark:text-white">{titulo}</h2>
        </div>
        {children}
    </section>
);

const botaoGrande = 'w-full h-14 mt-4 rounded-xl text-[15px] font-black uppercase tracking-widest';

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
                        <p className="mt-3 text-base text-slate-500 dark:text-slate-400">
                            {p.papel === 'LIDER' ? tx('Líder') : tx('Mentor')} · {(p.unidades || []).join(', ')}{p.tipo === 'TROCA_LIDER' ? ` · ${tx('troca de líder')}` : ''}
                        </p>
                    </Aviso>
                    <button type="button" onClick={onAtualizar} className={`${botaoGrande} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200`}>{tx('Já fui liberado? Conferir')}</button>
                </Moldura>
            );
        }
        if (estado === 'inativo') {
            return (
                <Moldura email={email} onSair={onSair}>
                    <Aviso icone={ShieldAlert} cor="text-rose-500" titulo={tx('Acesso inativo')}>
                        <p>{tx('Este acesso não está mais ativo. Fale com a diretoria.')}</p>
                        {situacao.perfil?.inativado_motivo && <p className="mt-3 text-base text-slate-500 dark:text-slate-400">{situacao.perfil.inativado_motivo}</p>}
                    </Aviso>
                </Moldura>
            );
        }
        // rejeitado
        return (
            <Moldura email={email} onSair={onSair}>
                <Aviso icone={XCircle} cor="text-rose-500" titulo={tx('Pedido não aprovado')}>
                    <p>{tx('Motivo: {motivo}', { motivo: situacao.pedido?.motivo || '—' })}</p>
                    <p className="mt-2">{tx('Fale com a diretoria ou faça um novo pedido com os dados corretos.')}</p>
                </Aviso>
                <button type="button" onClick={() => setRefazer(true)} className={`${botaoGrande} bg-blue-600 hover:bg-blue-700 text-white`}>{tx('Fazer novo pedido')}</button>
            </Moldura>
        );
    }

    return (
        <div className="fixed inset-0 overflow-y-auto bg-slate-50 dark:bg-[#0a0f1c]">
            <form onSubmit={enviar} className="w-[min(1180px,100%)] mx-auto px-4 py-4 sm:py-5 space-y-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-blue-600 text-white px-5 sm:px-7 py-5 shadow-lg shadow-blue-600/20">
                    <div className="min-w-0 flex-1 basis-72">
                        <h1 className="text-2xl sm:text-3xl font-black">{tx('Pedir acesso ao sistema')}</h1>
                        <p className="mt-1 text-base font-semibold opacity-90">{tx('Preencha seus dados. O seu mentor (ou a diretoria) vai liberar o acesso.')}</p>
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="text-base font-bold truncate min-w-0">{email}</span>
                        <button type="button" onClick={onSair} className="h-11 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-[13px] font-black uppercase tracking-widest inline-flex items-center gap-2 shrink-0">
                            <LogOut className="w-4 h-4" />{tx('Sair')}
                        </button>
                    </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2 items-stretch">
                    {/* 1 · Seus dados */}
                    <Cartao numero="1" icone={UserRound} titulo={tx('Seus dados')}>
                        <div className="space-y-5">
                            <label className="block">
                                <span className={rotulo}>{tx('E-mail (sua conta Google)')}</span>
                                <input value={email} readOnly className={`${campo} bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400`} />
                            </label>
                            <label className="block">
                                <span className={rotulo}>{tx('Nome completo')}</span>
                                <input value={nome} onChange={e => setNome(e.target.value)} autoFocus placeholder={tx('Ex: Maria Aparecida Souza')} className={`${campo} uppercase`} />
                            </label>
                            <div>
                                <span className={rotulo}>{tx('Telefone (WhatsApp)')}</span>
                                <div className="flex gap-3">
                                    <select value={ddi} onChange={e => setDdi(e.target.value)} className={`${caixa} w-[7.5rem] shrink-0 px-2 cursor-pointer`} aria-label={tx('Código do país')}>
                                        {DDIS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                                    </select>
                                    <input value={numero} onChange={e => setNumero(e.target.value)} inputMode="tel" placeholder={tx('DDD + número')} className={`${caixa} flex-1 min-w-0`} />
                                </div>
                                {numero && <p className="mt-2 text-base font-bold text-slate-600 dark:text-slate-300">{telefoneBonito(juntarTelefone(ddi, numero))}</p>}
                            </div>
                        </div>
                        <div className="mt-auto pt-6">
                            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[15px] font-semibold text-blue-900 flex items-start gap-3 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-200">
                                <MonitorSmartphone className="w-5 h-5 shrink-0 mt-0.5" />
                                <span>{tx('Computador da Recepção? Entre com o e-mail da franquia. Se ele não abrir o sistema, peça à diretoria para cadastrar esse e-mail.')}</span>
                            </div>
                        </div>
                    </Cartao>

                    {/* 2 · Função e unidade */}
                    <Cartao numero="2" icone={Building2} titulo={tx('Função e unidade')}>
                        <div>
                            <span className={rotulo}>{tx('Você é')}</span>
                            <div className="grid grid-cols-2 gap-3">
                                {[['LIDER', 'Líder da unidade'], ['MENTOR', 'Mentor']].map(([v, r]) => (
                                    <button key={v} type="button" onClick={() => trocarPapel(v)} aria-pressed={papel === v}
                                        className={`h-14 rounded-xl border-2 text-[15px] font-black uppercase tracking-wide ${papel === v ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'}`}>{tx(r)}</button>
                                ))}
                            </div>
                        </div>
                        <div className="mt-4 flex-1 flex flex-col">
                            <span className={rotulo}>{papel === 'LIDER' ? tx('Sua unidade (só uma)') : tx('Suas unidades')}</span>
                            <label className="flex items-center gap-3 h-14 px-4 rounded-xl border-2 border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/15 dark:bg-slate-900 dark:border-slate-700">
                                <Search className="w-5 h-5 text-slate-400" />
                                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder={tx('Buscar unidade...')} className="flex-1 min-w-0 bg-transparent outline-none text-lg font-bold text-slate-800 placeholder:font-medium placeholder:text-slate-400 dark:text-white" />
                            </label>
                            <div className="mt-3 max-h-[10.25rem] overflow-y-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">
                                {unidades === null && <p className="sm:col-span-2 p-3 text-base font-semibold text-slate-400 flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />{tx('Carregando...')}</p>}
                                {filtradas.map(u => {
                                    const marcada = escolhidas.includes(u);
                                    return (
                                        <button key={u} type="button" onClick={() => alternar(u)} aria-pressed={marcada}
                                            className={`min-h-12 px-4 py-2 rounded-xl border-2 text-left text-[15px] font-black uppercase flex items-center justify-between gap-2 ${marcada ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'}`}>
                                            <span className="min-w-0 break-words">{u}</span>{marcada && <Check className="w-5 h-5 shrink-0" />}
                                        </button>
                                    );
                                })}
                                {unidades && filtradas.length === 0 && <p className="sm:col-span-2 p-3 text-base font-semibold text-slate-400">{tx('Nenhuma unidade encontrada.')}</p>}
                            </div>
                            {escolhidas.length > 0 && <p className="mt-3 text-base font-black text-blue-700 dark:text-blue-400">{escolhidas.join(' · ')}</p>}
                            {papel === 'LIDER' && <p className="mt-2 text-[14px] font-semibold text-slate-500 dark:text-slate-400">{tx('Se a unidade já tem líder, o pedido vira TROCA DE LÍDER e o líder atual sai quando o pedido for aprovado.')}</p>}
                        </div>
                        <button type="submit" disabled={enviando} className="w-full h-14 mt-5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-base font-black uppercase tracking-widest inline-flex items-center justify-center gap-2">
                            {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}{tx('Enviar pedido')}
                        </button>
                    </Cartao>
                </div>
            </form>
        </div>
    );
};

export default TelaAcesso;
