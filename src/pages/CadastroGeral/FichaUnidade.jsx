import React, { useEffect, useMemo, useState } from 'react';
import { X, Building, CheckCircle2, XCircle, UserCog, Phone, Sun, Moon, AlertTriangle, Save, Loader2, Users, KeyRound, Dumbbell, Trash2 } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { NOME_PAPEL } from '../../permissoes/catalogoPermissoes.js';
import { normalizarUnidade, ordenarLogins, unidadesDoMentorEm } from '../Configuracoes/conferenciaLogins.js';

// ==========================================
// FICHA DA UNIDADE (Cadastros → Unidades, só o Admin; 09/11/2026, decisão do dono)
// Tudo de uma unidade num lugar só: "Unidade pronta?", Mentores (marcar daqui), Líder com telefone da Equipe,
// Recepção com turno, logins, equipe ativa por setor e "Não tem Personal Class" (o mesmo da aba Metas).
// Quem grava é o TabUnidades.jsx (onSalvarMentores / onMarcarPersonal / onAtivar / onExcluir).
// ==========================================

const papelDe = (u) => String(u?.role || '').toUpperCase().trim();
const setorDe = (c) => normalizarUnidade(c.role || c.setor);
const soNumeros = (t) => String(t || '').replace(/\D/g, '');

const Secao = ({ icone: Icone, titulo, extra, children }) => (
    <section className="rounded-2xl border border-slate-200 p-4 space-y-2.5 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5 dark:text-slate-400"><Icone className="w-3.5 h-3.5" />{titulo}</h4>
            {extra}
        </div>
        {children}
    </section>
);

const Vazio = ({ children }) => <p className="text-[12px] font-bold text-slate-400">{children}</p>;

const FichaUnidade = ({ unidade, usuarios = [], colaboradores = [], vinculos = {}, prontidao, semPersonal = false, onSalvarMentores, onMarcarPersonal, onAtivar, onExcluir, onFechar }) => {
    const chave = normalizarUnidade(unidade.nome);
    const mentoresTodos = useMemo(() => ordenarLogins(usuarios.filter(u => papelDe(u) === 'MENTOR')), [usuarios]);
    const marcadosIniciais = useMemo(() => new Set(mentoresTodos
        .filter(m => unidadesDoMentorEm(vinculos, m.email).some(n => normalizarUnidade(n) === chave))
        .map(m => String(m.email).toLowerCase().trim())), [mentoresTodos, vinculos, chave]);
    const [marcados, setMarcados] = useState(marcadosIniciais);
    const [salvando, setSalvando] = useState(false);
    useEffect(() => { setMarcados(new Set(marcadosIniciais)); }, [marcadosIniciais]);
    useEffect(() => {
        const aoTeclar = (e) => { if (e.key === 'Escape' && !salvando) onFechar(); };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [onFechar, salvando]);

    const mudouMentores = marcados.size !== marcadosIniciais.size || [...marcados].some(e => !marcadosIniciais.has(e));
    const alternar = (email) => setMarcados(atual => { const n = new Set(atual); if (n.has(email)) n.delete(email); else n.add(email); return n; });
    const salvarMentores = async () => {
        setSalvando(true);
        await onSalvarMentores([...marcados]);
        setSalvando(false);
    };

    const logins = ordenarLogins(usuarios.filter(u => normalizarUnidade(u.unidade) === chave));
    const equipe = colaboradores.filter(c => normalizarUnidade(c.unidade) === chave && c.ativo !== false)
        .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    const lideresEquipe = equipe.filter(c => setorDe(c).includes('LIDER'));
    const recepcionistas = equipe.filter(c => setorDe(c).includes('RECEP'));
    const porSetor = Object.entries(equipe.reduce((acc, c) => { const s = String(c.role || c.setor || tx('Sem setor')).toUpperCase(); acc[s] = (acc[s] || 0) + 1; return acc; }, {}))
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
    const loginsLider = logins.filter(u => papelDe(u) === 'LIDER');
    const desativada = unidade.ativa === false;

    const etiquetaTurno = (c) => {
        const t = String(c.turno || '').toUpperCase();
        if (t === 'MANHA') return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-black uppercase dark:bg-amber-500/10 dark:text-amber-300"><Sun className="w-3 h-3" />{tx('Manhã')}</span>;
        if (t === 'NOITE') return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-black uppercase dark:bg-blue-500/10 dark:text-blue-300"><Moon className="w-3 h-3" />{tx('Noite')}</span>;
        return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-black uppercase dark:bg-rose-500/10 dark:text-rose-300"><AlertTriangle className="w-3 h-3" />{tx('Sem turno')}</span>;
    };

    const textoDetalhe = (item) => {
        if (item.id === 'mentor' && item.detalhe?.length) return item.detalhe.join(', ');
        if (item.id === 'recepcionistas' && item.qtd) return tx('{qtd} ativas', { qtd: item.qtd });
        if (item.id === 'turno' && item.detalhe?.length) return tx('Sem turno: {nomes}', { nomes: item.detalhe.join(', ') });
        if (item.id === 'metas' && item.detalhe?.length) return tx('Falta: {o_que}', { o_que: item.detalhe.map(d => tx(d)).join(', ') });
        return '';
    };

    return (
        <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/50 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget && !salvando) onFechar(); }}>
            <aside className="w-[min(560px,100%)] h-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl animate-[fadeIn_0.2s_ease-out]" role="dialog" aria-modal="true" aria-labelledby="titulo-ficha-unidade">
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="min-w-0">
                        <h3 id="titulo-ficha-unidade" className="text-lg font-black text-slate-800 uppercase tracking-tight truncate flex items-center gap-2 dark:text-white">
                            <Building className="w-5 h-5 text-blue-600 shrink-0 dark:text-blue-400" />{unidade.nome}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {desativada
                                ? <span className="px-2 py-0.5 rounded-md border bg-slate-100 border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">{tx('Desativada')}</span>
                                : prontidao?.pronta
                                    ? <span className="px-2 py-0.5 rounded-md border bg-emerald-50 border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-widest dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300">✓ {tx('Pronta')}</span>
                                    : <span className="px-2 py-0.5 rounded-md border bg-amber-50 border-amber-200 text-amber-700 text-[10px] font-black uppercase tracking-widest dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">{prontidao?.faltam === 1 ? tx('Falta 1') : tx('Faltam {qtd}', { qtd: prontidao?.faltam || 0 })}</span>}
                            {semPersonal && <span className="px-2 py-0.5 rounded-md border bg-slate-100 border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">{tx('Sem Personal Class')}</span>}
                        </div>
                    </div>
                    <button type="button" onClick={onFechar} disabled={salvando} aria-label={tx('Fechar')} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3">
                    {!desativada && prontidao && (
                        <Secao icone={CheckCircle2} titulo={tx('Unidade pronta?')}>
                            <ul className="space-y-1.5">
                                {prontidao.itens.map(item => (
                                    <li key={item.id} className="flex items-start gap-2 text-[12px] font-bold text-slate-700 dark:text-slate-200">
                                        {item.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                                        <span>{tx(item.rotulo)}{textoDetalhe(item) && <span className="font-semibold text-slate-400"> · {textoDetalhe(item)}</span>}</span>
                                    </li>
                                ))}
                            </ul>
                        </Secao>
                    )}

                    <Secao icone={UserCog} titulo={tx('Mentor')}
                        extra={mudouMentores && (
                            <button type="button" onClick={salvarMentores} disabled={salvando} className="h-7 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1 disabled:opacity-60">
                                {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}{tx('Salvar')}
                            </button>
                        )}>
                        {mentoresTodos.length === 0 ? <Vazio>{tx('Nenhum login de Mentor cadastrado.')}</Vazio> : (
                            <div className="flex flex-wrap gap-1.5">
                                {mentoresTodos.map(m => {
                                    const email = String(m.email).toLowerCase().trim();
                                    const ligado = marcados.has(email);
                                    return (
                                        <button key={email} type="button" onClick={() => alternar(email)} aria-pressed={ligado} title={m.email}
                                            className={`h-8 px-3 rounded-lg border text-[11px] font-black uppercase tracking-wide transition-colors ${ligado ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-purple-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400'}`}>
                                            {ligado ? '✓ ' : ''}{m.nome || m.email}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <p className="text-[10px] font-bold text-slate-400">{tx('Clique para marcar ou tirar. É o mesmo que o botão "Unidades" do Mentor em Configurações.')}</p>
                    </Secao>

                    <Secao icone={KeyRound} titulo={tx('Líder')}>
                        {loginsLider.length === 0 && lideresEquipe.length === 0 && <Vazio>{tx('Sem Líder: nem login, nem na Equipe.')}</Vazio>}
                        {loginsLider.map(u => (
                            <p key={u.email} className="text-[12px] font-black text-slate-700 uppercase dark:text-slate-200">{u.nome || u.email} <span className="normal-case font-semibold text-slate-400">· {tx('login')} {u.email}</span></p>
                        ))}
                        {loginsLider.length === 0 && lideresEquipe.length > 0 && <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">⚠️ {tx('Está na Equipe, mas não tem login de Líder')}</p>}
                        {lideresEquipe.map(c => (
                            <p key={c.id || c.nome} className="text-[12px] font-bold text-slate-600 flex items-center gap-1.5 dark:text-slate-300">
                                <Phone className="w-3.5 h-3.5 text-slate-400" />{c.nome}
                                {soNumeros(c.telefone).length >= 10
                                    ? <span className="text-emerald-600 dark:text-emerald-400">· {c.telefone}</span>
                                    : <span className="text-rose-600 dark:text-rose-400">· ⚠️ {tx('sem telefone (a cobrança no WhatsApp não chega)')}</span>}
                            </p>
                        ))}
                        {loginsLider.length > 0 && lideresEquipe.length === 0 && <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">⚠️ {tx('Líder fora da Equipe: a cobrança no WhatsApp usa o telefone do cadastro da Equipe (setor Líder).')}</p>}
                    </Secao>

                    <Secao icone={Users} titulo={tx('Recepção')}>
                        {recepcionistas.length === 0 ? <Vazio>{tx('Nenhuma recepcionista ativa na Equipe.')}</Vazio> : (
                            <ul className="space-y-1">
                                {recepcionistas.map(c => (
                                    <li key={c.id || c.nome} className="flex items-center justify-between gap-2 text-[12px] font-bold text-slate-700 dark:text-slate-200">
                                        <span className="truncate">{c.nome}</span>{etiquetaTurno(c)}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {!logins.some(u => papelDe(u) === 'RECEPCAO') && <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">⚠️ {tx('Sem login da Recepção (o relatório de fechamento só conta pelo login da Recepção).')}</p>}
                    </Secao>

                    <Secao icone={KeyRound} titulo={tx('Logins ({qtd})', { qtd: logins.length })}>
                        {logins.length === 0 ? <Vazio>{tx('Nenhum login ligado a esta unidade.')}</Vazio> : (
                            <ul className="space-y-1">
                                {logins.map(u => (
                                    <li key={u.email} className="flex items-center justify-between gap-2 text-[12px] font-bold text-slate-700 dark:text-slate-200">
                                        <span className="truncate">{u.nome || '—'} <span className="font-semibold text-slate-400 lowercase">· {u.email}</span></span>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 shrink-0">{tx(NOME_PAPEL[papelDe(u)] || papelDe(u))}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Secao>

                    <Secao icone={Users} titulo={tx('Equipe ativa ({qtd})', { qtd: equipe.length })}>
                        {equipe.length === 0 ? <Vazio>{tx('Ninguém ativo na Equipe.')}</Vazio> : (
                            <div className="flex flex-wrap gap-1.5">
                                {porSetor.map(([setor, qtd]) => <span key={setor} className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wide dark:bg-slate-800 dark:text-slate-300">{setor} · {qtd}</span>)}
                            </div>
                        )}
                    </Secao>

                    <Secao icone={Dumbbell} titulo={tx('Personal Class')}>
                        <label className="flex items-center justify-between gap-3 cursor-pointer">
                            <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">{tx('Esta unidade NÃO tem Personal Class')}</span>
                            <input type="checkbox" checked={semPersonal} onChange={(e) => onMarcarPersonal(e.target.checked)} className="w-5 h-5 accent-blue-600 cursor-pointer" />
                        </label>
                        <p className="text-[10px] font-bold text-slate-400">{tx('O mesmo da aba Metas: o Personal some das metas e a gratificação mensal fica com 3 indicadores.')}</p>
                    </Secao>
                </div>

                <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-800">
                    <button type="button" onClick={() => onExcluir(unidade)} className="h-10 px-3 rounded-xl border border-slate-200 text-slate-500 text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400">
                        <Trash2 className="w-3.5 h-3.5" />{tx('Excluir')}
                    </button>
                    <button type="button" onClick={() => onAtivar(unidade, desativada)} className={`h-10 px-4 rounded-xl border text-[11px] font-black uppercase tracking-widest ${desativada ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-amber-500/10'}`}>
                        {desativada ? tx('Reativar') : tx('Desativar')}
                    </button>
                </div>
            </aside>
        </div>
    );
};

export default FichaUnidade;
