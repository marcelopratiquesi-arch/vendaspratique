import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BellRing, Send, Loader2, Users, X, CheckCircle2, AlertTriangle, History, Search, FlaskConical, Power } from 'lucide-react';
import { supabase } from '../../supabaseClient.js';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import { avisar } from '../../components/avisar.js';
import { CartaoCelular, LinhaCartao } from '../../components/celular/Cartao.jsx';
import {
    enviarAvisoCelular, lerHistoricoAvisos, lerModoAvisos, definirModoAvisos, TELAS_DO_AVISO, linkDaTela,
} from '../../components/avisosCelular/avisosPush.js';

// ==========================================
// AVISO NO CELULAR (25/11/2026, decisão do dono; regra 28 do CLAUDE.md)
// Comunicados → "Aviso no celular" (permissão 913, só o Admin). Título, texto, tela que abre ao tocar e para quem
// (todos · nível e/ou unidade · pessoas escolhidas). Antes de sair, a janela de conferência mostra o texto,
// quantas pessoas/aparelhos recebem e quem ainda não ativou. Embaixo, o histórico.
// Modo teste: só o Admin vê a faixa de ativar; "Liberar para a equipe" liga para todos.
// ==========================================
const LIMITE_TITULO = 60;
const LIMITE_TEXTO = 240;
const NIVEIS = [
    { id: 'ADMIN', nome: 'Admin' },
    { id: 'MENTOR', nome: 'Mentor' },
    { id: 'LIDER', nome: 'Líder' },
    { id: 'RECEPCAO', nome: 'Recepção' },
];
const nomeNivel = (id) => NIVEIS.find(n => n.id === id)?.nome || id;

const cartao = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5';
const rotulo = 'block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5';
const campo = 'w-full bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-blue-500';
const chip = (ativo) => `px-3 py-1.5 max-md:min-h-10 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-colors ${ativo
    ? 'bg-blue-600 border-blue-600 text-white'
    : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400'}`;

const dataHora = (iso) => {
    try { return new Date(iso).toLocaleString(localeAtual(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
};

export default function AvisoCelular({ usuarioLogado, unidades = [], onVoltar }) {
    const ehAdmin = String(usuarioLogado?.roleReal || usuarioLogado?.role || '').toUpperCase() === 'ADMIN';
    const [modo, setModo] = useState(null);
    const [titulo, setTitulo] = useState('');
    const [texto, setTexto] = useState('');
    const [tela, setTela] = useState('');
    const [tipo, setTipo] = useState('todos'); // todos | filtro | pessoas
    const [niveis, setNiveis] = useState([]);
    const [unidadesSel, setUnidadesSel] = useState([]);
    const [pessoasSel, setPessoasSel] = useState([]);
    const [logins, setLogins] = useState([]);
    const [buscaPessoa, setBuscaPessoa] = useState('');
    const [conferencia, setConferencia] = useState(null); // { pessoas, aparelhos, semAparelho }
    const [carregando, setCarregando] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [historico, setHistorico] = useState({ lista: [], erro: null });
    const [aberto, setAberto] = useState(null);

    const carregarHistorico = useCallback(async () => setHistorico(await lerHistoricoAvisos(50)), []);
    useEffect(() => {
        lerModoAvisos().then(setModo);
        carregarHistorico();
        supabase.from('usuarios_sistema').select('email, nome, role, unidade, status').then(({ data }) => {
            setLogins((data || []).filter(l => l.email && String(l.status || 'ATIVO').toUpperCase() === 'ATIVO')
                .sort((a, b) => String(a.nome || a.email).localeCompare(String(b.nome || b.email))));
        });
    }, [carregarHistorico]);

    useEffect(() => {
        if (!conferencia) return undefined;
        const aoTeclar = (e) => { if (e.key === 'Escape' && !enviando) setConferencia(null); };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [conferencia, enviando]);

    const alternar = (lista, setLista, valor) => setLista(lista.includes(valor) ? lista.filter(v => v !== valor) : [...lista, valor]);

    const destino = useMemo(() => {
        if (tipo === 'pessoas') return { tipo: 'pessoas', emails: pessoasSel };
        if (tipo === 'filtro') return { tipo: 'filtro', papeis: niveis, unidades: unidadesSel };
        return { tipo: 'todos' };
    }, [tipo, pessoasSel, niveis, unidadesSel]);

    const resumoDestino = useMemo(() => {
        if (tipo === 'pessoas') return tx('{qtd} pessoa(s) escolhida(s)', { qtd: pessoasSel.length });
        if (tipo === 'filtro') {
            const n = niveis.length ? niveis.map(nomeNivel).join(', ') : tx('todos os níveis');
            const u = unidadesSel.length ? unidadesSel.join(', ') : tx('todas as unidades');
            return `${n} · ${u}`;
        }
        return tx('Todos');
    }, [tipo, pessoasSel, niveis, unidadesSel]);

    const loginsFiltrados = useMemo(() => {
        const b = buscaPessoa.trim().toLowerCase();
        if (!b) return logins;
        return logins.filter(l => [l.nome, l.email, l.unidade, l.role].some(v => String(v || '').toLowerCase().includes(b)));
    }, [logins, buscaPessoa]);

    const corpo = () => ({ titulo: titulo.trim(), texto: texto.trim(), link: linkDaTela(tela), destino, destinoResumo: resumoDestino });

    const conferir = async () => {
        if (!titulo.trim()) return avisar(tx('Escreva o título do aviso.'), 'atencao');
        if (!texto.trim()) return avisar(tx('Escreva o texto do aviso.'), 'atencao');
        if (tipo === 'pessoas' && pessoasSel.length === 0) return avisar(tx('Escolha pelo menos uma pessoa.'), 'atencao');
        setCarregando(true);
        try {
            setConferencia(await enviarAvisoCelular({ ...corpo(), somenteContar: true }));
        } catch (e) {
            avisar(tx(e.message), 'erro');
        } finally {
            setCarregando(false);
        }
    };

    const enviar = async () => {
        setEnviando(true);
        try {
            const r = await enviarAvisoCelular(corpo());
            avisar(tx('Aviso enviado: chegou em {ok} de {total} aparelho(s).', { ok: r.entregues, total: r.aparelhos }), r.falhas ? 'atencao' : 'sucesso');
            setConferencia(null);
            setTitulo(''); setTexto('');
            carregarHistorico();
        } catch (e) {
            avisar(tx(e.message), 'erro');
        } finally {
            setEnviando(false);
        }
    };

    const trocarModo = async (novo) => {
        const perguntas = {
            ligado: tx('Liberar os avisos para a equipe?\n\nTodo mundo (Líder, Mentor e Recepção) passa a ver a faixa "Ative os avisos" até ativar.'),
            teste: tx('Voltar para o modo teste?\n\nSó você vê a faixa de ativar. Quem já ativou continua recebendo.'),
            desligado: tx('Desligar a faixa dos avisos?\n\nNinguém mais vê a faixa de ativar. Quem já ativou continua recebendo o que você mandar.'),
        };
        if (!window.confirm(perguntas[novo])) return;
        try {
            await definirModoAvisos(novo);
            setModo(novo);
            avisar(tx('Modo dos avisos atualizado.'), 'sucesso');
        } catch (e) {
            avisar(tx('Não foi possível mudar o modo: {erro}', { erro: e.message }), 'erro');
        }
    };

    const semSql = modo === 'desligado' && historico.erro;

    return (
        <div className="space-y-4 max-w-[1100px] mx-auto pb-10 font-sans">
            {/* Topo compacto */}
            <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={onVoltar} className="max-md:min-h-10 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 dark:text-slate-400">
                    <ArrowLeft className="w-4 h-4" /> {tx('Comunicados')}
                </button>
                <div className="flex items-center gap-2">
                    <BellRing className="w-5 h-5 text-blue-600" />
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">{tx('Aviso no celular')}</h2>
                </div>
                <div className="flex-1" />
                {modo && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${modo === 'ligado'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : modo === 'teste' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {modo === 'ligado' ? tx('Liberado para a equipe') : modo === 'teste' ? tx('Modo teste: só você') : tx('Faixa desligada')}
                    </span>
                )}
                {ehAdmin && modo && !semSql && (
                    <div className="flex gap-1.5 max-md:flex-wrap max-md:[&>button]:min-h-10 max-md:[&>button]:min-w-10 max-md:[&>button]:justify-center">
                        {modo !== 'ligado' && <button type="button" onClick={() => trocarModo('ligado')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest"><Users className="w-3.5 h-3.5" /> {tx('Liberar para a equipe')}</button>}
                        {modo !== 'teste' && <button type="button" onClick={() => trocarModo('teste')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-amber-300 text-amber-700 dark:text-amber-300 text-[10px] font-black uppercase tracking-widest hover:bg-amber-50 dark:hover:bg-amber-500/10"><FlaskConical className="w-3.5 h-3.5" /> {tx('Modo teste')}</button>}
                        {modo !== 'desligado' && <button type="button" onClick={() => trocarModo('desligado')} title={tx('Desligar a faixa de ativar')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800"><Power className="w-3.5 h-3.5" /></button>}
                    </div>
                )}
            </div>

            {semSql && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-3 text-xs font-bold text-amber-800 dark:text-amber-300">
                    {tx('O banco ainda não tem os avisos no celular. Rode sql/2026-11-25-avisos-celular/1_avisos_celular.sql no SQL Editor do Supabase.')}
                </div>
            )}
            {modo === 'teste' && (
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {tx('Modo teste: só você vê a faixa "Ative os avisos". Ative no seu celular, mande um aviso para você mesmo (Pessoas escolhidas) e, se chegar, toque em "Liberar para a equipe".')}
                </p>
            )}

            {/* Formulário */}
            <div className={`${cartao} space-y-4`}>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-4">
                    <div>
                        <label className={rotulo}>{tx('Título')} <span className="normal-case tracking-normal font-bold text-slate-400">({titulo.length}/{LIMITE_TITULO})</span></label>
                        <input value={titulo} maxLength={LIMITE_TITULO} onChange={e => setTitulo(e.target.value)} className={campo} placeholder={tx('Ex.: Reunião de líderes')} autoFocus />
                    </div>
                    <div>
                        <label className={rotulo}>{tx('Ao tocar, abre')}</label>
                        <select value={tela} onChange={e => setTela(e.target.value)} className={`${campo} cursor-pointer`}>
                            {TELAS_DO_AVISO.map(t => <option key={t.id} value={t.id}>{tx(t.nome)}</option>)}
                        </select>
                    </div>
                </div>
                <div>
                    <label className={rotulo}>{tx('Texto')} <span className="normal-case tracking-normal font-bold text-slate-400">({texto.length}/{LIMITE_TEXTO})</span></label>
                    <textarea value={texto} maxLength={LIMITE_TEXTO} onChange={e => setTexto(e.target.value)} rows={3} className={`${campo} resize-y`} placeholder={tx('Ex.: Amanhã às 9h na Matriz. Tragam os números do mês.')} />
                </div>

                <div>
                    <label className={rotulo}>{tx('Para quem')}</label>
                    <div className="flex flex-wrap gap-1.5">
                        <button type="button" className={chip(tipo === 'todos')} onClick={() => setTipo('todos')}>{tx('Todos')}</button>
                        <button type="button" className={chip(tipo === 'filtro')} onClick={() => setTipo('filtro')}>{tx('Por nível / unidade')}</button>
                        <button type="button" className={chip(tipo === 'pessoas')} onClick={() => setTipo('pessoas')}>{tx('Pessoas escolhidas')}</button>
                    </div>
                </div>

                {tipo === 'filtro' && (
                    <div className="space-y-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                        <div>
                            <p className={rotulo}>{tx('Nível (nenhum marcado = todos)')}</p>
                            <div className="flex flex-wrap gap-1.5">
                                {NIVEIS.map(n => <button key={n.id} type="button" className={chip(niveis.includes(n.id))} onClick={() => alternar(niveis, setNiveis, n.id)}>{tx(n.nome)}</button>)}
                            </div>
                        </div>
                        <div>
                            <p className={rotulo}>{tx('Unidade (nenhuma marcada = todas)')}</p>
                            <div className="flex flex-wrap gap-1.5">
                                {unidades.map(u => <button key={u.id || u.nome} type="button" className={chip(unidadesSel.includes(u.nome))} onClick={() => alternar(unidadesSel, setUnidadesSel, u.nome)}>{u.nome}</button>)}
                            </div>
                            <p className="mt-1.5 text-[10px] font-bold text-slate-400">{tx('O Mentor entra pelas unidades marcadas para ele.')}</p>
                        </div>
                    </div>
                )}

                {tipo === 'pessoas' && (
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 space-y-2">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input value={buscaPessoa} onChange={e => setBuscaPessoa(e.target.value)} className={`${campo} pl-9`} placeholder={tx('Buscar por nome, e-mail ou unidade')} />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tx('{qtd} escolhida(s)', { qtd: pessoasSel.length })}</p>
                        <div className="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-slate-200 dark:divide-slate-700">
                            {loginsFiltrados.map(l => {
                                const email = String(l.email).toLowerCase();
                                return (
                                    <label key={email} className="flex items-center gap-3 py-2 cursor-pointer">
                                        <input type="checkbox" checked={pessoasSel.includes(email)} onChange={() => alternar(pessoasSel, setPessoasSel, email)} className="w-4 h-4 accent-blue-600" />
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-xs font-black text-slate-800 dark:text-white truncate">{l.nome || l.email}</span>
                                            <span className="block text-[10px] font-bold text-slate-500 truncate">{nomeNivel(String(l.role || '').toUpperCase())} · {l.unidade || '—'} · {l.email}</span>
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex justify-end">
                    <button type="button" onClick={conferir} disabled={carregando}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest disabled:opacity-60">
                        {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {tx('Conferir e enviar')}
                    </button>
                </div>
            </div>

            {/* Histórico */}
            <div className={cartao}>
                <div className="flex items-center gap-2 mb-3">
                    <History className="w-4 h-4 text-slate-500" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">{tx('Avisos enviados')}</h3>
                </div>
                {historico.lista.length === 0 ? (
                    <p className="text-xs font-bold text-slate-400">{tx('Nenhum aviso enviado ainda.')}</p>
                ) : (
                    <>
                    {/* CELULAR (26/11/2026): um cartão por aviso enviado */}
                    <div className="md:hidden space-y-2">
                        {historico.lista.map(h => {
                            const sem = Array.isArray(h.sem_aparelho) ? h.sem_aparelho : [];
                            return (
                                <CartaoCelular key={h.id} titulo={h.titulo} subtitulo={dataHora(h.criado_em)}>
                                    <p className="text-[12px] font-bold text-slate-600 break-words dark:text-slate-300">{h.texto}</p>
                                    <div className="mt-2">
                                        <LinhaCartao rotulo={tx('Chegou')} valor={`${h.entregues}/${h.aparelhos}`} cor={h.falhas ? 'text-amber-600' : 'text-emerald-600'} />
                                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tx('Aparelhos que receberam / aparelhos ativados')}</p>
                                        <p className="mt-1 text-[11px] font-bold text-slate-600 break-words dark:text-slate-300">{tx('Para quem')}: {h.destino_resumo || '—'}{h.comunicado_id ? ` · ${tx('comunicado')}` : ''}</p>
                                    </div>
                                    {sem.length ? (
                                        <button type="button" onClick={() => setAberto(aberto === h.id ? null : h.id)} aria-expanded={aberto === h.id}
                                            className="mt-2 w-full h-10 rounded-xl border border-rose-200 text-rose-600 text-[11px] font-black uppercase tracking-widest dark:border-rose-500/30 dark:text-rose-400">
                                            {tx('Sem ativar')}: {sem.length}
                                        </button>
                                    ) : <LinhaCartao rotulo={tx('Sem ativar')} valor={0} cor="text-emerald-600" />}
                                    {aberto === h.id && (
                                        <p className="mt-2 rounded-xl bg-rose-50/60 dark:bg-rose-500/5 p-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                            {sem.map(p => `${p.nome || p.email} (${p.unidade || '—'})`).join(' · ')}
                                        </p>
                                    )}
                                </CartaoCelular>
                            );
                        })}
                    </div>
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-800">
                                    <th className="py-2 pr-3">{tx('Quando')}</th>
                                    <th className="py-2 pr-3">{tx('Aviso')}</th>
                                    <th className="py-2 pr-3">{tx('Para quem')}</th>
                                    <th className="py-2 pr-3 text-right" title={tx('Aparelhos que receberam / aparelhos ativados')}>{tx('Chegou')}</th>
                                    <th className="py-2 text-right" title={tx('Pessoas que ainda não ativaram os avisos')}>{tx('Sem ativar')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historico.lista.map(h => {
                                    const sem = Array.isArray(h.sem_aparelho) ? h.sem_aparelho : [];
                                    return (
                                        <React.Fragment key={h.id}>
                                            <tr className="border-b border-slate-100 dark:border-slate-800/60 align-top">
                                                <td className="py-2 pr-3 font-bold text-slate-500 whitespace-nowrap">{dataHora(h.criado_em)}</td>
                                                <td className="py-2 pr-3">
                                                    <span className="block font-black text-slate-800 dark:text-white">{h.titulo}</span>
                                                    <span className="block font-bold text-slate-500">{h.texto}</span>
                                                </td>
                                                <td className="py-2 pr-3 font-bold text-slate-600 dark:text-slate-300">{h.destino_resumo || '—'}{h.comunicado_id ? ` · ${tx('comunicado')}` : ''}</td>
                                                <td className={`py-2 pr-3 text-right font-black ${h.falhas ? 'text-amber-600' : 'text-emerald-600'}`}>{h.entregues}/{h.aparelhos}</td>
                                                <td className="py-2 text-right">
                                                    {sem.length ? (
                                                        <button type="button" onClick={() => setAberto(aberto === h.id ? null : h.id)} className="font-black text-rose-600 underline decoration-dotted">{sem.length}</button>
                                                    ) : <span className="font-black text-emerald-600">0</span>}
                                                </td>
                                            </tr>
                                            {aberto === h.id && (
                                                <tr><td colSpan={5} className="py-2 px-2 bg-rose-50/60 dark:bg-rose-500/5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                                    {sem.map(p => `${p.nome || p.email} (${p.unidade || '—'})`).join(' · ')}
                                                </td></tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    </>
                )}
            </div>

            {/* Janela de conferência */}
            {conferencia && (
                <div className="fixed inset-0 z-[200] bg-slate-900/60 flex items-center justify-center p-4" onClick={() => !enviando && setConferencia(null)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-[min(560px,100%)] max-h-[90vh] max-md:max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">{tx('Conferir antes de enviar')}</h3>
                            <button type="button" onClick={() => !enviando && setConferencia(null)} aria-label={tx('Fechar')} className="p-1 max-md:p-2.5 max-md:-m-2 text-slate-400 hover:text-rose-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            {/* Como vai aparecer no celular */}
                            <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 p-3 flex gap-3">
                                <img src="/icons/icon-192.png" alt="" className="w-10 h-10 rounded-xl shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-slate-500">Vendas Pratique</p>
                                    <p className="text-sm font-black text-slate-800 dark:text-white">{titulo.trim()}</p>
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{texto.trim()}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-center">
                                <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 p-3">
                                    <p className="text-lg font-black text-blue-700 dark:text-blue-300">{conferencia.pessoas}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tx('Pessoas')}</p>
                                </div>
                                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3">
                                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">{conferencia.aparelhos}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tx('Aparelhos que vão apitar')}</p>
                                </div>
                            </div>
                            <p className="text-[11px] font-bold text-slate-500">{tx('Para quem')}: {resumoDestino} · {tx('Ao tocar, abre')}: {tx(TELAS_DO_AVISO.find(t => t.id === tela)?.nome || '')}</p>
                            {conferencia.semAparelho.length > 0 ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-3">
                                    <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300 mb-1.5">
                                        <AlertTriangle className="w-4 h-4" /> {tx('Ainda não ativaram ({qtd}): não vão receber', { qtd: conferencia.semAparelho.length })}
                                    </p>
                                    <div className="max-h-40 overflow-y-auto custom-scrollbar text-[11px] font-bold text-slate-600 dark:text-slate-300 space-y-0.5">
                                        {conferencia.semAparelho.map(p => <p key={p.email}>{p.nome || p.email} · {nomeNivel(String(p.papel || '').toUpperCase())} · {p.unidade || '—'}</p>)}
                                    </div>
                                </div>
                            ) : (
                                <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-emerald-600"><CheckCircle2 className="w-4 h-4" /> {tx('Todos já ativaram os avisos')}</p>
                            )}
                            {conferencia.aparelhos === 0 && (
                                <p className="text-xs font-bold text-rose-600">{tx('Ninguém desta lista ativou os avisos ainda: o aviso não chegaria em ninguém.')}</p>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-800 max-md:sticky max-md:bottom-0 max-md:bg-white max-md:dark:bg-slate-900 max-md:[&>button]:flex-1 max-md:[&>button]:min-h-11 max-md:[&>button]:justify-center">
                            <button type="button" onClick={() => setConferencia(null)} disabled={enviando} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">{tx('Voltar')}</button>
                            <button type="button" onClick={enviar} disabled={enviando || conferencia.aparelhos === 0}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50">
                                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {tx('Enviar agora')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
