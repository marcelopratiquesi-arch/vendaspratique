import React, { useEffect, useMemo, useState } from 'react';
import { Building, Plus, Search, Trash2, X, Save, Loader2, AlertTriangle, MapPin, FileText } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { normalizarUnidade } from '../Configuracoes/conferenciaLogins.js';
import { useDadosUnidades } from './dadosUnidades.js';
import { ORDEM_NORMAL, proximaOrdem, ordenarLinhas } from '../../components/ordenacao.js';
import TituloOrdenavel from '../../components/TituloOrdenavel.jsx';
import FichaUnidade from './FichaUnidade.jsx';

// ==========================================
// CADASTROS → UNIDADES (só o Admin, permissão 808) — veio de Configurações em 09/11/2026 (decisão do dono).
// Faz o mesmo de antes: cadastrar, desativar/reativar (unidade_definir_ativa) e excluir só unidade sem dados
// (unidade_uso; o banco também trava). Novo: busca, filtros (Com pendência / Sem Mentor), colunas Pronta? e Mentor,
// ordenar clicando no título e a FICHA da unidade (FichaUnidade.jsx) com Mentor, Líder, Recepção e Personal Class.
// ==========================================

const normalizarBusca = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

const JanelaNovaUnidade = ({ onCancelar, onSalvar }) => {
    const [nome, setNome] = useState('');
    const [salvando, setSalvando] = useState(false);
    useEffect(() => {
        const aoTeclar = (e) => { if (e.key === 'Escape' && !salvando) onCancelar(); };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [onCancelar, salvando]);
    const salvar = async (e) => {
        e.preventDefault();
        if (!nome.trim() || salvando) return;
        setSalvando(true);
        const ok = await onSalvar(nome.trim().toUpperCase());
        if (!ok) setSalvando(false);
    };
    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !salvando) onCancelar(); }}>
            <form onSubmit={salvar} className="w-full sm:w-[min(420px,100%)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl animate-[fadeIn_0.2s_ease-out]" role="dialog" aria-modal="true" aria-labelledby="titulo-nova-unidade">
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 id="titulo-nova-unidade" className="text-[12px] font-black uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />{tx('Cadastrar Nova Unidade')}
                    </h3>
                    <button type="button" onClick={onCancelar} disabled={salvando} aria-label={tx('Fechar')} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-5">
                    <label htmlFor="nova-unidade-nome" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 dark:text-slate-400">{tx('Nome Oficial da Unidade')}</label>
                    <input id="nova-unidade-nome" autoFocus type="text" value={nome} onChange={(e) => setNome(e.target.value)} required placeholder={tx('Ex: SANTA INÊS 2')}
                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-[13px] font-bold text-slate-800 uppercase placeholder-slate-400 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 outline-none dark:bg-slate-800/60 dark:border-slate-700 dark:text-white dark:focus:bg-slate-900" />
                    <p className="text-[10px] font-bold text-slate-400 mt-1">{tx('Escreva o nome igual ao usado nas vendas e no seletor do topo.')}</p>
                </div>
                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-800">
                    <button type="button" onClick={onCancelar} disabled={salvando} className="h-10 px-4 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">{tx('Cancelar')}</button>
                    <button type="submit" disabled={salvando} className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-sm">
                        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{tx('Salvar Nova Unidade')}
                    </button>
                </div>
            </form>
        </div>
    );
};

const FILTROS = [['todas', 'Todas'], ['pendencia', 'Com pendência'], ['sem_mentor', 'Sem Mentor']];

// Valor de cada coluna para ordenar (vazio fica no fim)
const VALORES = {
    unidade: l => l.u.nome,
    situacao: l => (l.desativada ? 'DESATIVADA' : 'ATIVA'),
    pronta: l => (l.desativada ? null : l.prontidao.faltam),
    mentor: l => (l.mentores[0]?.nome || null),
    lider: l => (l.resumo.lideres[0] || l.resumo.lideresEquipe[0] || null),
    logins: l => l.resumo.logins,
    equipe: l => l.resumo.equipe,
};

const TabUnidades = ({ unidades = [], setUnidades, nomeUsuario = null, planos = [], produtos = [], pendencias = [], pendenciasCarregadas = true, abrirTela }) => {
    const [busca, setBusca] = useState('');
    const [filtro, setFiltro] = useState('todas');
    const [ordem, setOrdem] = useState(ORDEM_NORMAL);
    const [janelaAberta, setJanelaAberta] = useState(false);
    const [fichaId, setFichaId] = useState(null);
    // Leitura e ações numa peça só (dadosUnidades.js), a mesma da Central aberta pelo Dashboard (09/11/2026)
    const { usuarios, colaboradores, vinculos, linhas, acoes: acoesUnidade } = useDadosUnidades({
        ativo: true, completo: true, unidades, setUnidades, nomeUsuario, aoExcluir: () => setFichaId(null),
    });

    const termo = normalizarBusca(busca);
    const ativas = linhas.filter(l => !l.desativada);
    const qtdPendencia = ativas.filter(l => !l.prontidao.pronta).length;
    const qtdSemMentor = ativas.filter(l => l.mentores.length === 0).length;
    const contagem = { todas: linhas.length, pendencia: qtdPendencia, sem_mentor: qtdSemMentor };

    const lista = useMemo(() => {
        const filtradas = linhas
            .filter(l => !termo || normalizarBusca(l.u.nome).includes(termo))
            .filter(l => filtro === 'todas' || (!l.desativada && (filtro === 'pendencia' ? !l.prontidao.pronta : l.mentores.length === 0)));
        // Ordem normal: ativas primeiro (A→Z); desativadas embaixo, apagadas, com "Reativar"
        const normal = [...filtradas].sort((a, b) => (a.desativada - b.desativada) || String(a.u.nome).localeCompare(String(b.u.nome), 'pt-BR', { numeric: true }));
        return ordenarLinhas(normal, ordem, VALORES, l => l.u.nome);
    }, [linhas, termo, filtro, ordem]);
    const ordenar = (coluna, texto) => setOrdem(atual => proximaOrdem(atual, coluna, texto));
    const linhaDaFicha = fichaId !== null ? linhas.find(l => String(l.u.id) === String(fichaId)) : null;

    const salvarUnidade = async (nome) => {
        const ok = await acoesUnidade.cadastrar(nome);
        if (ok) setJanelaAberta(false);
        return ok;
    };
    const handleAtivarUnidade = acoesUnidade.ativar;
    const handleDeleteUnidade = acoesUnidade.excluir;
    const salvarMentoresDaUnidade = acoesUnidade.salvarMentores;
    const marcarPersonal = acoesUnidade.marcarPersonal;

    const situacao = (l) => (l.desativada
        ? <span className="px-2 py-0.5 rounded-md border bg-slate-100 border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">{tx('Desativada')}</span>
        : <span className="px-2 py-0.5 rounded-md border bg-emerald-50 border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-widest dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300">{tx('Ativa')}</span>);

    const pronta = (l) => {
        if (l.desativada) return <span className="text-slate-400">—</span>;
        const faltando = l.prontidao.itens.filter(i => !i.ok).map(i => tx(i.rotulo)).join(' · ');
        return l.prontidao.pronta
            ? <span className="px-2 py-0.5 rounded-md border bg-emerald-50 border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-widest dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300">✓ {tx('Pronta')}</span>
            : <button type="button" onClick={() => setFichaId(l.u.id)} title={tx('Falta: {o_que}', { o_que: faltando })} className="px-2 py-0.5 rounded-md border bg-amber-50 border-amber-200 text-amber-700 text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
                {l.prontidao.faltam === 1 ? tx('Falta 1') : tx('Faltam {qtd}', { qtd: l.prontidao.faltam })}
            </button>;
    };

    const mentor = (l) => {
        if (l.mentores.length > 0) {
            const nomes = l.mentores.map(m => m.nome || m.email);
            return <span title={nomes.join(', ')}>{nomes[0]}{nomes.length > 1 && <span className="text-slate-400"> +{nomes.length - 1}</span>}</span>;
        }
        if (l.desativada) return <span className="text-slate-400">—</span>;
        return <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><AlertTriangle className="w-3 h-3" />{tx('Sem Mentor')}</span>;
    };

    const lider = ({ resumo: r, desativada }) => {
        if (r.lideres.length > 0) return <span title={r.lideres.join(', ')}>{r.lideres.join(', ')}</span>;
        if (r.lideresEquipe.length > 0) return <span className="text-slate-400" title={tx('Está na Equipe, mas não tem login de Líder')}>{r.lideresEquipe.join(', ')} · {tx('sem login')}</span>;
        if (desativada) return <span className="text-slate-400">—</span>;
        return <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><AlertTriangle className="w-3 h-3" />{tx('Sem Líder')}</span>;
    };

    const acoes = (l) => (
        <div className="flex items-center justify-end gap-1.5">
            <button type="button" onClick={() => setFichaId(l.u.id)} className="h-8 px-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1 hover:bg-blue-100 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-300">
                <FileText className="w-3.5 h-3.5" />{tx('Ficha')}
            </button>
            <button type="button" onClick={() => handleAtivarUnidade(l.u, l.desativada)} className={`h-8 px-3 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-colors ${l.desativada ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-300' : 'bg-white border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-amber-500/10'}`}>
                {l.desativada ? tx("Reativar") : tx("Desativar")}
            </button>
            <button type="button" onClick={() => handleDeleteUnidade(l.u)} aria-label={tx("Excluir (só unidade sem nenhum dado)")} title={tx("Excluir (só unidade sem nenhum dado)")} className="p-2 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors dark:bg-slate-900 dark:border-slate-700 dark:hover:text-rose-400 dark:hover:bg-rose-500/10">
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );

    const th = 'px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap dark:text-slate-400';
    const td = 'px-3 py-2.5';
    const titulo = (coluna, rotulo, extra = {}) => <TituloOrdenavel coluna={coluna} ordem={ordem} onOrdenar={ordenar} className={th} {...extra}>{rotulo}</TituloOrdenavel>;

    return (
        <div className="space-y-3 animate-[fadeIn_0.3s_ease-out]">
            <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-3 dark:bg-slate-900 dark:border-slate-800">
                <span className="text-[12px] font-black text-slate-700 flex items-center gap-1.5 dark:text-slate-200">
                    <Building className="w-4 h-4 text-blue-600 dark:text-blue-400" /><span className="text-base">{unidades.length}</span> {tx('unidades')}
                </span>
                <span className="text-[11px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{tx('{qtd} ativas', { qtd: ativas.length })}</span>
                {linhas.length - ativas.length > 0 && <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">{tx('{qtd} desativadas', { qtd: linhas.length - ativas.length })}</span>}
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1 dark:bg-slate-800" role="group" aria-label={tx('Filtro')}>
                    {FILTROS.map(([id, rotulo]) => (
                        <button key={id} type="button" onClick={() => setFiltro(id)} aria-pressed={filtro === id}
                            className={`h-7 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1 transition-colors ${filtro === id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
                            {tx(rotulo)}
                            <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] flex items-center justify-center ${filtro === id ? 'bg-white text-blue-700' : id !== 'todas' && contagem[id] > 0 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{contagem[id]}</span>
                        </button>
                    ))}
                </div>
                <div className="flex-1" />
                <label className="w-full sm:w-[min(240px,100%)] h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 focus-within:ring-2 focus-within:ring-blue-500 dark:bg-slate-800/60 dark:border-slate-700">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={tx('Buscar unidade...')} aria-label={tx('Buscar unidade...')}
                        className="flex-1 min-w-0 bg-transparent outline-none text-[13px] font-bold text-slate-800 placeholder-slate-400 uppercase dark:text-white" />
                </label>
                <button type="button" onClick={() => setJanelaAberta(true)} className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-sm">
                    <Plus className="w-4 h-4" />{tx('Nova unidade')}
                </button>
            </div>

            {(ordem.coluna || filtro !== 'todas' || termo) && (
                <div className="flex flex-wrap items-center gap-3 px-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    <span>{tx('{qtd} de {total} unidades', { qtd: lista.length, total: linhas.length })}</span>
                    {ordem.coluna && <button type="button" onClick={() => setOrdem(ORDEM_NORMAL)} className="text-blue-700 hover:underline dark:text-blue-400">{tx('Voltar à ordem normal')}</button>}
                    {(filtro !== 'todas' || termo) && <button type="button" onClick={() => { setFiltro('todas'); setBusca(''); }} className="text-blue-700 hover:underline dark:text-blue-400">{tx('Limpar filtros')}</button>}
                </div>
            )}

            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-x-auto dark:bg-slate-900 dark:border-slate-800">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-800">
                        <tr>
                            {titulo('unidade', tx('Unidade'), { texto: true })}
                            {titulo('situacao', tx('Situação'), { texto: true })}
                            {titulo('pronta', tx('Pronta?'), { dica: tx('Login da Recepção, login do Líder, Mentor, recepcionista ativa na Equipe, turno das recepcionistas e metas do mês. Clique no selo para ver o que falta.') })}
                            {titulo('mentor', tx('Mentor'), { texto: true })}
                            {titulo('lider', tx('Líder'), { texto: true })}
                            {titulo('logins', tx('Logins'), { alinhar: 'center', className: `${th} text-center` })}
                            {titulo('equipe', tx('Equipe ativa'), { alinhar: 'center', className: `${th} text-center`, dica: tx('Pessoas ativas no cadastro da Equipe (entre parênteses, quantas são da Recepção)') })}
                            <th className={`${th} text-right`}>{tx('Ações')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {lista.map(l => (
                            <tr key={l.u.id} className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 ${l.desativada ? 'opacity-60' : ''}`}>
                                <td className={td}>
                                    <button type="button" onClick={() => setFichaId(l.u.id)} className="text-[13px] font-black text-slate-800 uppercase tracking-wide text-left hover:text-blue-700 hover:underline dark:text-white dark:hover:text-blue-400">{l.u.nome}</button>
                                </td>
                                <td className={td}>{situacao(l)}</td>
                                <td className={td}>{pronta(l)}</td>
                                <td className={`${td} text-[11px] font-black uppercase tracking-wide text-slate-600 max-w-[180px] truncate dark:text-slate-300`}>{mentor(l)}</td>
                                <td className={`${td} text-[11px] font-black uppercase tracking-wide text-slate-600 max-w-[220px] truncate dark:text-slate-300`}>{lider(l)}</td>
                                <td className={`${td} text-center text-[13px] font-black text-slate-700 dark:text-slate-200`}>{l.resumo.logins || <span className="text-slate-300 dark:text-slate-600">0</span>}</td>
                                <td className={`${td} text-center text-[13px] font-black text-slate-700 dark:text-slate-200`}>
                                    {l.resumo.equipe}{l.resumo.equipe > 0 && <span className="text-[11px] font-bold text-slate-400"> ({l.resumo.recepcionistas})</span>}
                                </td>
                                <td className={td}>{acoes(l)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="md:hidden space-y-2">
                {lista.map(l => (
                    <div key={l.u.id} className={`bg-white rounded-2xl border border-slate-200 p-3 space-y-2 dark:bg-slate-900 dark:border-slate-800 ${l.desativada ? 'opacity-60' : ''}`}>
                        <div className="flex items-center justify-between gap-2">
                            <button type="button" onClick={() => setFichaId(l.u.id)} className="text-[13px] font-black text-slate-800 uppercase truncate text-left dark:text-white">{l.u.nome}</button>
                            <span className="flex items-center gap-1.5">{situacao(l)}{pronta(l)}</span>
                        </div>
                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">{tx('Mentor')}: {mentor(l)}</p>
                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">{tx('Líder')}: {lider(l)}</p>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{tx('{logins} logins · {equipe} na equipe', { logins: l.resumo.logins, equipe: l.resumo.equipe })}</span>
                            {acoes(l)}
                        </div>
                    </div>
                ))}
            </div>

            {lista.length === 0 && (
                <p className="py-12 text-center text-[11px] font-black uppercase tracking-widest text-slate-400">
                    {termo || filtro !== 'todas' ? tx('Nenhuma unidade encontrada.') : tx('Nenhuma unidade cadastrada.')}
                </p>
            )}

            {janelaAberta && <JanelaNovaUnidade onCancelar={() => setJanelaAberta(false)} onSalvar={salvarUnidade} />}

            {linhaDaFicha && (
                <FichaUnidade
                    unidade={linhaDaFicha.u}
                    usuarios={usuarios}
                    colaboradores={colaboradores}
                    vinculos={vinculos}
                    prontidao={linhaDaFicha.prontidao}
                    semPersonal={linhaDaFicha.semPersonal}
                    onSalvarMentores={(emails) => salvarMentoresDaUnidade(linhaDaFicha.u, emails)}
                    onMarcarPersonal={(valor) => marcarPersonal(linhaDaFicha.u, valor)}
                    onAtivar={handleAtivarUnidade}
                    onExcluir={handleDeleteUnidade}
                    onFechar={() => setFichaId(null)}
                    planos={planos}
                    produtos={produtos}
                    pendencia={pendenciasCarregadas ? (pendencias.find(p => normalizarUnidade(p.unidade) === normalizarUnidade(linhaDaFicha.u.nome)) || null) : undefined}
                    abrirTela={abrirTela}
                />
            )}
        </div>
    );
};

export default TabUnidades;
