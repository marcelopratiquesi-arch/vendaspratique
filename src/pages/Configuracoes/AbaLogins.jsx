import React, { useMemo, useState } from 'react';
import { Search, MapPin, RefreshCw, Pencil, Building2, KeyRound, UserMinus, AlertTriangle, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { NOME_PAPEL } from '../../permissoes/catalogoPermissoes.js';
import { ORDEM_PAPEIS, ordenarLogins, filtrarLogins, resumoLogins, conferirLogins, unidadesDoMentorEm } from './conferenciaLogins.js';
import { ORDEM_NORMAL, proximaOrdem, ordenarLinhas } from '../../components/ordenacao.js';
import TituloOrdenavel from '../../components/TituloOrdenavel.jsx';

// ==========================================
// CONFIGURAÇÕES → LOGINS (visual novo, 09/11/2026, decisão do dono)
// Faixa fina com os números por nível (clicar filtra) e o "para conferir"; busca + filtros; tabela
// (no celular vira cartões). Ações por linha: Editar, Unidades (Mentor), Permissões deste login e Revogar.
// Desde 09/11/2026: etiqueta "🔑 N exceções" (clicar abre as permissões do login) e ordenar clicando no título.
// ==========================================

const MAX_ETIQUETAS_MENTOR = 3;

const COR_PAPEL = {
    ADMIN: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
    MENTOR: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/30',
    LIDER: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
    RECEPCAO: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30',
};

const papelDe = (u) => String(u?.role || '').toUpperCase().trim();
const emailDe = (u) => String(u?.email || '').toLowerCase().trim();

const EtiquetaPapel = ({ papel }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${COR_PAPEL[papel] || 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>
        {papel === 'RECEPCAO' ? tx('Recepção / Consultor') : tx(NOME_PAPEL[papel] || papel || '—')}
    </span>
);

const textoAviso = (a) => {
    switch (a.tipo) {
        case 'mentor_sem_unidade': return tx('{nome}: Mentor sem nenhuma unidade marcada (não vê nada no sistema).', { nome: a.nome || a.email });
        case 'sem_unidade_propria': return tx('{nome}: Líder/Recepção ligado a "Todas" (deveria ter uma unidade).', { nome: a.nome || a.email });
        case 'unidade_inexistente': return tx('{nome}: ligado à unidade {unidade}, que não está cadastrada.', { nome: a.nome || a.email, unidade: a.unidade });
        case 'unidade_desativada': return tx('{nome}: ligado à unidade {unidade}, que está desativada.', { nome: a.nome || a.email, unidade: a.unidade });
        case 'unidade_sem_lider': return tx('Unidade {unidade}: sem login de Líder.', { unidade: a.unidade });
        case 'unidade_sem_recepcao': return tx('Unidade {unidade}: sem login da Recepção.', { unidade: a.unidade });
        default: return '';
    }
};

const AbaLogins = ({ usuarios = [], unidades = [], vinculos = {}, excecoesPorEmail = {}, carregando = false, onEditar, onUnidadesMentor, onPermissoes, onRevogar }) => {
    const [busca, setBusca] = useState('');
    const [papel, setPapel] = useState('');
    const [unidade, setUnidade] = useState('');
    const [conferirAberto, setConferirAberto] = useState(false);
    const [ordem, setOrdem] = useState(ORDEM_NORMAL);
    const ordenar = (coluna, texto) => setOrdem(atual => proximaOrdem(atual, coluna, texto));

    const resumo = useMemo(() => resumoLogins(usuarios), [usuarios]);
    const avisos = useMemo(() => conferirLogins({ usuarios, unidades, vinculos }), [usuarios, unidades, vinculos]);
    const lista = useMemo(() => {
        const normal = ordenarLogins(filtrarLogins(usuarios, { busca, papel, unidade, vinculos }));
        const valores = {
            nome: u => u.nome || null,
            email: u => emailDe(u) || null,
            nivel: u => { const i = ORDEM_PAPEIS.indexOf(papelDe(u)); return i < 0 ? null : String(i); },
            unidade: u => (papelDe(u) === 'MENTOR' ? ([...unidadesDoMentorEm(vinculos, u.email)].sort()[0] || null) : (u.unidade || null)),
            excecoes: u => excecoesPorEmail[emailDe(u)] || null,
        };
        return ordenarLinhas(normal, ordem, valores, u => u.nome || u.email);
    }, [usuarios, busca, papel, unidade, vinculos, ordem, excecoesPorEmail]);
    const temFiltro = !!(busca.trim() || papel || unidade);
    const limpar = () => { setBusca(''); setPapel(''); setUnidade(''); };
    const unidadesOrdenadas = useMemo(() => [...unidades].filter(u => u?.nome)
        .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR', { numeric: true })), [unidades]);
    const loginPorEmail = (email) => usuarios.find(u => String(u.email || '').toLowerCase().trim() === email);

    const colunaUnidade = (u) => {
        if (papelDe(u) !== 'MENTOR') return <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400 shrink-0" />{u.unidade === 'TODAS' ? tx('Todas') : (u.unidade || '—')}</span>;
        const minhas = [...unidadesDoMentorEm(vinculos, u.email)].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true }));
        if (minhas.length === 0) return <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400"><AlertTriangle className="w-3 h-3" />{tx('Nenhuma unidade')}</span>;
        const extras = minhas.length - MAX_ETIQUETAS_MENTOR;
        return (
            <span className="inline-flex flex-wrap items-center gap-1" title={minhas.join(', ')}>
                {minhas.slice(0, MAX_ETIQUETAS_MENTOR).map(n => <span key={n} className="px-1.5 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-black dark:bg-purple-500/10 dark:border-purple-500/30 dark:text-purple-300">{n}</span>)}
                {extras > 0 && <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-black dark:bg-slate-800 dark:text-slate-300">+{extras}</span>}
            </span>
        );
    };

    const etiquetaExcecoes = (u) => {
        const qtd = excecoesPorEmail[emailDe(u)] || 0;
        if (!qtd || papelDe(u) === 'ADMIN') return null;
        return (
            <button type="button" onClick={() => onPermissoes(u)} title={tx('Este login tem permissões diferentes do nível dele. Clique para ver.')}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wide whitespace-nowrap hover:bg-amber-100 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
                <KeyRound className="w-3 h-3" />{qtd === 1 ? tx('1 exceção') : tx('{qtd} exceções', { qtd })}
            </button>
        );
    };

    const botao = 'p-2 rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400';
    const acoes = (u) => {
        const p = papelDe(u);
        return (
            <div className="flex items-center justify-end gap-1.5">
                <button type="button" onClick={() => onEditar(u)} title={tx('Editar login')} aria-label={tx('Editar login')} className={`${botao} hover:text-blue-700 hover:border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-500/10 dark:hover:text-blue-300`}><Pencil className="w-3.5 h-3.5" /></button>
                {p === 'MENTOR' && <button type="button" onClick={() => onUnidadesMentor(u)} title={tx('Escolher as unidades deste mentor')} aria-label={tx('Escolher as unidades deste mentor')} className={`${botao} hover:text-blue-700 hover:border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-500/10 dark:hover:text-blue-300`}><Building2 className="w-3.5 h-3.5" /></button>}
                {p !== 'ADMIN' && <button type="button" onClick={() => onPermissoes(u)} title={tx('Permissões deste login')} aria-label={tx('Permissões deste login')} className={`${botao} hover:text-blue-700 hover:border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-500/10 dark:hover:text-blue-300`}><KeyRound className="w-3.5 h-3.5" /></button>}
                {p !== 'ADMIN' && <button type="button" onClick={() => onRevogar(u)} title={tx('Revogar Acesso')} aria-label={tx('Revogar Acesso')} className={`${botao} hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-500/10 dark:hover:text-rose-400`}><UserMinus className="w-3.5 h-3.5" /></button>}
            </div>
        );
    };

    const th = 'px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap dark:text-slate-400';

    return (
        <div className="space-y-3">
            {/* Faixa fina: números por nível (clicar filtra) + para conferir */}
            <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 dark:bg-slate-900 dark:border-slate-800">
                <button type="button" onClick={() => setPapel('')} className={`text-[12px] font-black flex items-center gap-1.5 ${papel === '' ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>
                    <Users className="w-4 h-4" /><span className="text-base">{resumo.total}</span> {tx('logins')}
                </button>
                {ORDEM_PAPEIS.map(p => (
                    <button key={p} type="button" onClick={() => setPapel(papel === p ? '' : p)} aria-pressed={papel === p}
                        className={`text-[11px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-colors ${papel === p ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
                        {tx(NOME_PAPEL[p])} <span className="text-[13px]">{resumo.porPapel[p]}</span>
                    </button>
                ))}
                <div className="flex-1" />
                {avisos.length > 0 ? (
                    <button type="button" onClick={() => setConferirAberto(v => !v)} aria-expanded={conferirAberto}
                        className="h-8 px-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5" />{avisos.length === 1 ? tx('1 para conferir') : tx('{qtd} para conferir', { qtd: avisos.length })}
                        {conferirAberto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                ) : !carregando && (
                    <span className="text-[11px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">✓ {tx('Nada para conferir')}</span>
                )}
            </div>

            {conferirAberto && avisos.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 space-y-1.5 dark:bg-amber-500/10 dark:border-amber-500/30">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-300 px-1">{tx('Só um aviso: nada é mudado sozinho.')}</p>
                    {avisos.map((a, i) => {
                        const login = a.email ? loginPorEmail(a.email) : null;
                        return (
                            <div key={`${a.tipo}-${a.email || a.unidade}-${i}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white text-[12px] font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                <span className="flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />{textoAviso(a)}</span>
                                {login && a.tipo === 'mentor_sem_unidade' && <button type="button" onClick={() => onUnidadesMentor(login)} className="text-[11px] font-black uppercase tracking-widest text-blue-600 hover:underline dark:text-blue-400">{tx('Marcar unidades')}</button>}
                                {login && a.tipo !== 'mentor_sem_unidade' && <button type="button" onClick={() => onEditar(login)} className="text-[11px] font-black uppercase tracking-widest text-blue-600 hover:underline dark:text-blue-400">{tx('Editar login')}</button>}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Busca + filtros */}
            <div className="flex flex-wrap items-center gap-2">
                <label className="flex-[2] min-w-[min(240px,100%)] h-10 px-3 bg-white border border-slate-200 rounded-xl flex items-center gap-2 focus-within:ring-2 focus-within:ring-blue-500 dark:bg-slate-900 dark:border-slate-800">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={tx('Buscar por nome ou e-mail...')} aria-label={tx('Buscar por nome ou e-mail...')}
                        className="flex-1 min-w-0 bg-transparent outline-none text-[13px] font-bold text-slate-800 placeholder-slate-400 dark:text-white" />
                </label>
                <select value={papel} onChange={(e) => setPapel(e.target.value)} aria-label={tx('Nível')}
                    className="flex-1 min-w-[150px] h-10 px-3 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200">
                    <option value="">{tx('Todos os níveis')}</option>
                    {ORDEM_PAPEIS.map(p => <option key={p} value={p}>{tx(NOME_PAPEL[p])}</option>)}
                </select>
                <label className="flex-1 min-w-[170px] h-10 pl-3 rounded-xl border border-slate-200 bg-white flex items-center gap-1.5 focus-within:ring-2 focus-within:ring-blue-500 dark:bg-slate-900 dark:border-slate-800">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <select value={unidade} onChange={(e) => setUnidade(e.target.value)} aria-label={tx('Unidade')}
                        className="flex-1 min-w-0 h-full pr-2 bg-transparent text-[12px] font-bold text-slate-700 outline-none uppercase dark:text-slate-200 dark:bg-slate-900">
                        <option value="">{tx('Todas as unidades')}</option>
                        <option value="TODAS">{tx('Ligados a "Todas" (global)')}</option>
                        {unidadesOrdenadas.map(u => <option key={u.id} value={u.nome}>{u.nome}{u.ativa === false ? ` (${tx('desativada')})` : ''}</option>)}
                    </select>
                </label>
                {temFiltro && (
                    <button type="button" onClick={limpar} className="h-10 px-3 rounded-xl text-[12px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 inline-flex items-center gap-1.5 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800">
                        <RefreshCw className="w-3.5 h-3.5" />{tx('Limpar filtros')}
                    </button>
                )}
            </div>

            {(temFiltro || ordem.coluna) && (
                <div className="flex flex-wrap items-center gap-3 px-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {temFiltro && <span>{tx('{qtd} de {total} logins', { qtd: lista.length, total: usuarios.length })}</span>}
                    {ordem.coluna && <button type="button" onClick={() => setOrdem(ORDEM_NORMAL)} className="text-blue-700 hover:underline dark:text-blue-400">{tx('Voltar à ordem normal')}</button>}
                </div>
            )}

            {/* Tabela (computador) */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-800">
                        <tr>
                            <TituloOrdenavel coluna="nome" texto ordem={ordem} onOrdenar={ordenar} className={th}>{tx('Nome')}</TituloOrdenavel>
                            <TituloOrdenavel coluna="email" texto ordem={ordem} onOrdenar={ordenar} className={th}>{tx('E-mail')}</TituloOrdenavel>
                            <TituloOrdenavel coluna="nivel" texto ordem={ordem} onOrdenar={ordenar} className={th}>{tx('Nível')}</TituloOrdenavel>
                            <TituloOrdenavel coluna="excecoes" ordem={ordem} onOrdenar={ordenar} className={th} dica={tx('Permissões diferentes do nível, marcadas só para este login (Permissões → Exceções por login).')}>{tx('Exceções')}</TituloOrdenavel>
                            <TituloOrdenavel coluna="unidade" texto ordem={ordem} onOrdenar={ordenar} className={th}>{tx('Unidade(s)')}</TituloOrdenavel>
                            <th className={`${th} text-right`}>{tx('Ações')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {lista.map(u => (
                            <tr key={u.email} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                                <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-[12px] font-black shrink-0 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">{String(u.nome || u.email || '?').charAt(0)}</span>
                                        <span className="text-[13px] font-black text-slate-800 uppercase truncate dark:text-white">{u.nome || '—'}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-2.5 text-[12px] font-semibold text-slate-500 lowercase dark:text-slate-400">{u.email}</td>
                                <td className="px-4 py-2.5"><EtiquetaPapel papel={papelDe(u)} /></td>
                                <td className="px-4 py-2.5">{etiquetaExcecoes(u) || <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                                <td className="px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">{colunaUnidade(u)}</td>
                                <td className="px-4 py-2.5">{acoes(u)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Cartões (celular) */}
            <div className="md:hidden space-y-2">
                {lista.map(u => (
                    <div key={u.email} className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2 dark:bg-slate-900 dark:border-slate-800">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-[13px] font-black text-slate-800 uppercase truncate dark:text-white">{u.nome || '—'}</p>
                                <p className="text-[11px] font-semibold text-slate-500 lowercase truncate dark:text-slate-400">{u.email}</p>
                            </div>
                            <span className="flex flex-col items-end gap-1"><EtiquetaPapel papel={papelDe(u)} />{etiquetaExcecoes(u)}</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">{colunaUnidade(u)}</span>
                            {acoes(u)}
                        </div>
                    </div>
                ))}
            </div>

            {!carregando && lista.length === 0 && (
                <p className="py-12 text-center text-[11px] font-black uppercase tracking-widest text-slate-400">
                    {temFiltro ? tx('Nenhum login encontrado com esses filtros.') : tx('Nenhum login cadastrado.')}
                </p>
            )}
            {carregando && <p className="py-12 text-center text-[11px] font-black uppercase tracking-widest text-slate-400">{tx('Carregando...')}</p>}
        </div>
    );
};

export default AbaLogins;
