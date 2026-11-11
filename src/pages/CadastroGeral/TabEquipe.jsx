import React, { useState, useMemo, useEffect } from 'react';
import { Search, Edit3, Power, PowerOff, UserPlus, Building, Zap, MapPin, RefreshCw, AlertTriangle, Sun, Moon, FileSpreadsheet } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { ORDEM_NORMAL, proximaOrdem, ordenarLinhas } from '../../components/ordenacao.js';
import TituloOrdenavel from '../../components/TituloOrdenavel.jsx';
import CopyButton from '../HistoricoVendas/CopyButton.jsx';
import { setorDoColaborador } from '../Lancamentos/seletores/setoresEquipe.js';
import { abrirCentralColaborador } from '../../components/centralColaborador.js';
import { problemasDoColaborador, conjuntoDeSetores, PROBLEMAS_CADASTRO, consumirFiltroEquipe, EVENTO_FILTRO_EQUIPE } from './cadastroColaborador.js';

// ==========================================
// CADASTROS → EQUIPE — revisão 360 de 09/11/2026 (decisão do dono)
// - Botões Novo/Editar/Desligar só para quem tem a permissão 807 (antes apareciam para todos; o banco barrava).
// - Faixa fina: ativos, desligados, setores (clicar filtra) e alertas (recepcionista sem turno, sem telefone).
// - Botões sempre visíveis; copiar telefone; ordenar clicando no título (regra única de ordenacao.js).
// - Filtro de unidade em azul (era vermelho, a cor de erro) e só na visão de várias unidades.
// - CPF dentro de "Dados bancários" só para o Admin (dado sensível).
// - 11/11/2026 (decisão do dono): alertas "recebendo por PIX" (o pagamento principal é o Banco Inter) e "cadastro
//   incompleto" (regra única em cadastroColaborador.js, a mesma do aviso do Líder/Mentor); PIX ganha "trocar para Inter".
// ==========================================

const soNumeros = (t) => String(t || '').replace(/\D/g, '');
const ehRecepcao = (c) => setorDoColaborador(c).chave === 'RECEPCAO';
const semTelefone = (c) => soNumeros(c.telefone).length < 10;

const VALORES = {
    cpf: c => soNumeros(c.cpf) || null,
    nome: c => c.nome || null,
    setor: c => c.role || null,
    unidade: c => c.unidade || null,
    telefone: c => soNumeros(c.telefone) || null,
    banco: c => c.tipo_conta || null,
};

const TabEquipe = ({ colaboradores = [], onEdit, onToggleStatus, temVisaoGlobal, unidades = [], onOpenModal, podeEditarEquipe = true, ehAdmin = false, listaSetores = [] }) => {
    const [termoBusca, setTermoBusca] = useState('');
    const [filtroUnidade, setFiltroUnidade] = useState('TODOS');
    const [filtroSetor, setFiltroSetor] = useState('TODOS');
    const [filtroStatus, setFiltroStatus] = useState('ATIVOS');
    // '' | 'sem_turno' | 'sem_telefone' | 'pix' | 'incompleto' (os dois últimos podem vir pedidos pela janela do Líder/Mentor)
    const [filtroAlerta, setFiltroAlerta] = useState(() => consumirFiltroEquipe() || '');
    useEffect(() => {
        const aoPedir = () => { const f = consumirFiltroEquipe(); if (f) { setFiltroAlerta(f); setFiltroStatus('ATIVOS'); } };
        window.addEventListener(EVENTO_FILTRO_EQUIPE, aoPedir);
        return () => window.removeEventListener(EVENTO_FILTRO_EQUIPE, aoPedir);
    }, []);
    const setoresValidos = useMemo(() => conjuntoDeSetores(listaSetores), [listaSetores]);
    const [ordem, setOrdem] = useState(ORDEM_NORMAL);
    const ordenar = (coluna, texto) => setOrdem(atual => proximaOrdem(atual, coluna, texto));

    const setoresUnicos = useMemo(() => [...new Set(colaboradores.map(c => c.role).filter(Boolean))].sort(), [colaboradores]);

    // Base da faixa: respeita a unidade escolhida no filtro (as contas mudam junto)
    const daUnidade = useMemo(() => colaboradores.filter(c => filtroUnidade === 'TODOS' || String(c.unidade || '').toUpperCase() === filtroUnidade.toUpperCase()), [colaboradores, filtroUnidade]);
    const ativos = daUnidade.filter(c => c.ativo !== false);
    const resumo = {
        ativos: ativos.length,
        desligados: daUnidade.length - ativos.length,
        semTurno: ativos.filter(c => ehRecepcao(c) && !c.turno).length,
        semTelefone: ativos.filter(semTelefone).length,
        pix: ativos.filter(c => c.tipo_conta === 'PIX_CPF').length,
        incompleto: ativos.filter(c => problemasDoColaborador(c, setoresValidos).length > 0).length,
        porSetor: Object.entries(ativos.reduce((acc, c) => { const s = c.role || tx('Sem setor'); acc[s] = (acc[s] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')),
    };

    const dadosProcessados = useMemo(() => {
        const busca = termoBusca.toLowerCase().trim();
        const buscaNum = soNumeros(busca);
        const filtrados = daUnidade.filter(c => {
            const isAtivo = c.ativo !== false;
            if (filtroStatus === 'ATIVOS' && !isAtivo) return false;
            if (filtroStatus === 'INATIVOS' && isAtivo) return false;
            if (filtroSetor !== 'TODOS' && String(c.role || '').toUpperCase() !== filtroSetor.toUpperCase()) return false;
            if (filtroAlerta === 'sem_turno' && !(ehRecepcao(c) && !c.turno)) return false;
            if (filtroAlerta === 'sem_telefone' && !semTelefone(c)) return false;
            if (filtroAlerta === 'pix' && c.tipo_conta !== 'PIX_CPF') return false;
            if (filtroAlerta === 'incompleto' && !problemasDoColaborador(c, setoresValidos).length) return false;
            if (!busca) return true;
            return String(c.nome || '').toLowerCase().includes(busca)
                || (buscaNum && (soNumeros(c.cpf).includes(buscaNum) || soNumeros(c.telefone).includes(buscaNum)));
        });
        const normal = [...filtrados].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
        return ordenarLinhas(normal, ordem, VALORES, c => c.nome);
    }, [daUnidade, filtroSetor, filtroStatus, filtroAlerta, termoBusca, ordem, setoresValidos]);

    // Planilha da Equipe (revisão de 10/11/2026, só o Admin: tem dados bancários). Exporta a lista que está na tela
    // (o padrão é "Ativos"); abre no Excel (separador ";" e acentos certos).
    const exportarPlanilha = () => {
        const cel = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const banco = (c) => (c.tipo_conta === 'PIX_CPF' ? 'PIX (CPF)' : c.tipo_conta === 'INTER' ? 'Banco Inter' : '');
        const linhas = [
            ['Nome', 'CPF', 'Setor', 'Turno', 'Unidade', 'Telefone', 'Recebimento', 'Conta Inter', 'Situação'],
            ...dadosProcessados.map(c => [c.nome, c.cpf, c.role, c.turno === 'MANHA' ? 'Manhã' : c.turno === 'NOITE' ? 'Noite' : '', c.unidade, c.telefone, banco(c), c.tipo_conta === 'INTER' ? c.conta_inter : '', c.ativo === false ? 'Desligado' : 'Ativo']),
        ];
        const texto = '\ufeff' + linhas.map(l => l.map(cel).join(';')).join('\r\n');
        const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        const hoje = new Date();
        a.href = url;
        a.download = `equipe-${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const temFiltro = !!(termoBusca.trim() || filtroUnidade !== 'TODOS' || filtroSetor !== 'TODOS' || filtroStatus !== 'ATIVOS' || filtroAlerta);
    const limpar = () => { setTermoBusca(''); setFiltroUnidade('TODOS'); setFiltroSetor('TODOS'); setFiltroStatus('ATIVOS'); setFiltroAlerta(''); };
    const alternarAlerta = (id) => { setFiltroAlerta(a => (a === id ? '' : id)); setFiltroStatus('ATIVOS'); };

    const th = 'px-4 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap dark:text-slate-400';
    const select = 'h-10 px-3 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200';
    const colunas = 6 + (temVisaoGlobal ? 1 : 0);

    return (
        <div className="space-y-3 animate-[fadeIn_0.3s_ease-out]">
            {/* FAIXA FINA: resumo (clicar filtra) */}
            <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 dark:bg-slate-900 dark:border-slate-800">
                <button type="button" onClick={() => { setFiltroStatus('ATIVOS'); setFiltroAlerta(''); }} className="text-[12px] font-black text-slate-700 dark:text-slate-200">
                    <span className="text-base text-emerald-600 dark:text-emerald-400">{resumo.ativos}</span> {resumo.ativos === 1 ? tx('ativo') : tx('ativos')}
                </button>
                {resumo.desligados > 0 && (
                    <button type="button" onClick={() => { setFiltroStatus('INATIVOS'); setFiltroAlerta(''); }} className="text-[12px] font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <span className="text-base">{resumo.desligados}</span> {resumo.desligados === 1 ? tx('desligado') : tx('desligados')}
                    </button>
                )}
                <span className="hidden sm:block w-px h-4 bg-slate-200 dark:bg-slate-700" />
                {resumo.porSetor.map(([setor, qtd]) => {
                    const ativo = filtroSetor.toUpperCase() === String(setor).toUpperCase();
                    const cor = setorDoColaborador({ role: setor }).cor;
                    return (
                        <button key={setor} type="button" onClick={() => setFiltroSetor(ativo ? 'TODOS' : setor)} aria-pressed={ativo}
                            className={`h-7 px-2 rounded-lg text-[10px] font-black uppercase tracking-wide inline-flex items-center gap-1.5 transition-colors ${ativo ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                            <span className="w-2 h-2 rounded-full" style={{ background: cor }} />{setor} <span className="opacity-70">{qtd}</span>
                        </button>
                    );
                })}
                <div className="flex-1" />
                {resumo.pix > 0 && (
                    <button type="button" onClick={() => alternarAlerta('pix')} aria-pressed={filtroAlerta === 'pix'} title={tx('O pagamento principal é o Banco Inter. O PIX (chave CPF) é só para quem ainda não tem conta no Inter.')}
                        className={`h-8 px-3 rounded-xl border text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 ${filtroAlerta === 'pix' ? 'bg-rose-600 border-rose-600 text-white' : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300'}`}>
                        <Zap className="w-3.5 h-3.5" />{resumo.pix === 1 ? tx('1 recebendo por PIX') : tx('{qtd} recebendo por PIX', { qtd: resumo.pix })}
                    </button>
                )}
                {resumo.incompleto > 0 && (
                    <button type="button" onClick={() => alternarAlerta('incompleto')} aria-pressed={filtroAlerta === 'incompleto'} title={tx('PIX no lugar do Banco Inter, sem conta, CPF vazio ou inválido, sem telefone ou sem setor')}
                        className={`h-8 px-3 rounded-xl border text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 ${filtroAlerta === 'incompleto' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300'}`}>
                        <AlertTriangle className="w-3.5 h-3.5" />{resumo.incompleto === 1 ? tx('1 cadastro incompleto') : tx('{qtd} cadastros incompletos', { qtd: resumo.incompleto })}
                    </button>
                )}
                {resumo.semTurno > 0 && (
                    <button type="button" onClick={() => alternarAlerta('sem_turno')} aria-pressed={filtroAlerta === 'sem_turno'}
                        className={`h-8 px-3 rounded-xl border text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 ${filtroAlerta === 'sem_turno' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300'}`}>
                        <AlertTriangle className="w-3.5 h-3.5" />{resumo.semTurno === 1 ? tx('1 recepcionista sem turno') : tx('{qtd} recepcionistas sem turno', { qtd: resumo.semTurno })}
                    </button>
                )}
                {resumo.semTelefone > 0 && (
                    <button type="button" onClick={() => alternarAlerta('sem_telefone')} aria-pressed={filtroAlerta === 'sem_telefone'}
                        className={`h-8 px-3 rounded-xl border text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 ${filtroAlerta === 'sem_telefone' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300'}`}>
                        <AlertTriangle className="w-3.5 h-3.5" />{resumo.semTelefone === 1 ? tx('1 sem telefone') : tx('{qtd} sem telefone', { qtd: resumo.semTelefone })}
                    </button>
                )}
            </div>

            {/* BUSCA + FILTROS + NOVO */}
            <div className="flex flex-wrap items-center gap-2">
                <label className="flex-[2] min-w-[min(220px,100%)] h-10 px-3 bg-white border border-slate-200 rounded-xl flex items-center gap-2 focus-within:ring-2 focus-within:ring-blue-500 dark:bg-slate-900 dark:border-slate-800">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input type="text" value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} placeholder={tx('Buscar por nome, CPF ou telefone...')} aria-label={tx('Buscar por nome, CPF ou telefone...')}
                        className="flex-1 min-w-0 bg-transparent outline-none text-[13px] font-bold text-slate-800 placeholder-slate-400 dark:text-white" />
                </label>
                <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} aria-label={tx('Situação')} className={`${select} flex-1 min-w-[130px]`}>
                    <option value="ATIVOS">{tx('Ativos')}</option>
                    <option value="INATIVOS">{tx('Desligados')}</option>
                    <option value="TODOS">{tx('Todos')}</option>
                </select>
                <select value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)} aria-label={tx('Setor')} className={`${select} flex-1 min-w-[150px] uppercase`}>
                    <option value="TODOS">{tx('Todos os setores')}</option>
                    {setoresUnicos.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {temVisaoGlobal && (
                    <label className="flex-1 min-w-[170px] h-10 pl-3 rounded-xl border border-slate-200 bg-white flex items-center gap-1.5 focus-within:ring-2 focus-within:ring-blue-500 dark:bg-slate-900 dark:border-slate-800">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} aria-label={tx('Unidade')} className="flex-1 min-w-0 h-full pr-2 bg-transparent text-[12px] font-bold text-slate-700 outline-none uppercase dark:text-slate-200 dark:bg-slate-900">
                            <option value="TODOS">{tx('Todas as unidades')}</option>
                            {unidades.map(u => <option key={u.id || u.nome} value={u.nome}>{u.nome}</option>)}
                        </select>
                    </label>
                )}
                {temFiltro && (
                    <button type="button" onClick={limpar} className="h-10 px-3 rounded-xl text-[12px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 inline-flex items-center gap-1.5 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800">
                        <RefreshCw className="w-3.5 h-3.5" />{tx('Limpar filtros')}
                    </button>
                )}
                {ehAdmin && (
                    <button type="button" onClick={exportarPlanilha} disabled={dadosProcessados.length === 0} title={tx('Baixa a lista que está na tela (com dados bancários), para abrir no Excel')}
                        className="h-10 px-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400">
                        <FileSpreadsheet className="w-4 h-4" />{tx('Exportar planilha')}
                    </button>
                )}
                {podeEditarEquipe && (
                    <button type="button" onClick={onOpenModal} className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-sm">
                        <UserPlus className="w-4 h-4" />{tx('Novo Colaborador')}
                    </button>
                )}
            </div>

            {(temFiltro || ordem.coluna) && (
                <div className="flex flex-wrap items-center gap-3 px-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    <span>{tx('{qtd} de {total} pessoas', { qtd: dadosProcessados.length, total: daUnidade.length })}</span>
                    {ordem.coluna && <button type="button" onClick={() => setOrdem(ORDEM_NORMAL)} className="text-blue-700 hover:underline dark:text-blue-400">{tx('Voltar à ordem normal')}</button>}
                </div>
            )}

            {/* TABELA */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full min-w-[860px]">
                        <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-800">
                            <tr>
                                <TituloOrdenavel coluna="nome" texto ordem={ordem} onOrdenar={ordenar} className={th}>{tx('Nome Completo')}</TituloOrdenavel>
                                <TituloOrdenavel coluna="cpf" texto ordem={ordem} onOrdenar={ordenar} className={th}>{tx('CPF (Chave)')}</TituloOrdenavel>
                                <TituloOrdenavel coluna="setor" texto ordem={ordem} onOrdenar={ordenar} className={th}>{tx('Setor / Cargo')}</TituloOrdenavel>
                                {temVisaoGlobal && <TituloOrdenavel coluna="unidade" texto ordem={ordem} onOrdenar={ordenar} className={th}>{tx('Unidade')}</TituloOrdenavel>}
                                <TituloOrdenavel coluna="telefone" texto ordem={ordem} onOrdenar={ordenar} className={th}>{tx('Telefone')}</TituloOrdenavel>
                                <TituloOrdenavel coluna="banco" texto ordem={ordem} onOrdenar={ordenar} className={th}>{tx('Dados Bancários')}</TituloOrdenavel>
                                <th className={`${th} text-right`}>{podeEditarEquipe ? tx('Ações') : ''}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {dadosProcessados.map(c => {
                                const isAtivo = c.ativo !== false;
                                const setor = setorDoColaborador(c);
                                const turno = String(c.turno || '').toUpperCase();
                                // Problemas que não aparecem em outra coluna (PIX e telefone já aparecem)
                                const outrosProblemas = isAtivo ? problemasDoColaborador(c, setoresValidos).filter(p => p !== 'pix' && p !== 'telefone') : [];
                                return (
                                    <tr key={c.id} className={`transition-colors ${isAtivo ? 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40' : 'bg-slate-50/60 opacity-70 hover:opacity-100 dark:bg-slate-800/40'}`}>
                                        <td className="px-4 py-2.5">
                                            {/* Nome abre a Central do Colaborador (11/11/2026; permissão 809) + copiar o nome */}
                                            <span className="inline-flex items-center gap-1">
                                                <button type="button" onClick={() => abrirCentralColaborador(c, { onEditar: podeEditarEquipe ? onEdit : null })} title={tx('Abrir a Central do Colaborador')}
                                                    className={`text-left text-[13px] font-black uppercase tracking-tight hover:text-blue-700 hover:underline dark:hover:text-blue-400 ${isAtivo ? 'text-slate-800 dark:text-white' : 'text-slate-500 line-through decoration-slate-300 dark:text-slate-400'}`}>{c.nome}</button>
                                                <CopyButton textToCopy={c.nome} label={tx('Copiar nome')} />
                                            </span>
                                            {!isAtivo && <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">
                                                {tx('DESLIGADO')}
                                                {/* Data e motivo do desligamento (11/11/2026; vazio nos desligamentos antigos) */}
                                                {c.desligado_em && <span className="normal-case tracking-normal font-bold text-slate-500 dark:text-slate-400"> · {tx('em {data}', { data: String(c.desligado_em).slice(0, 10).split('-').reverse().join('/') })}</span>}
                                                {c.motivo_desligamento && <span className="normal-case tracking-normal font-bold text-slate-500 dark:text-slate-400"> · {tx(c.motivo_desligamento)}</span>}
                                            </p>}
                                            {outrosProblemas.length > 0 && (
                                                <p className="text-[10px] font-black text-amber-700 uppercase tracking-wide inline-flex items-center gap-1 dark:text-amber-400">
                                                    <AlertTriangle className="w-3 h-3 shrink-0" />{outrosProblemas.map(p => tx(PROBLEMAS_CADASTRO[p])).join(' · ')}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {c.cpf
                                                ? <span className="inline-flex items-center gap-1 font-mono text-[12px] font-bold text-slate-600 dark:text-slate-300">{c.cpf}<CopyButton textToCopy={soNumeros(c.cpf)} label={tx('Copiar CPF')} /></span>
                                                : <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">{tx('PENDENTE')}</span>}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: setor.cor }} />{c.role || '—'}
                                            </span>
                                            {ehRecepcao(c) && isAtivo && (
                                                turno === 'MANHA' ? <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-black uppercase dark:bg-amber-500/10 dark:text-amber-300"><Sun className="w-3 h-3" />{tx('Manhã')}</span>
                                                    : turno === 'NOITE' ? <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-black uppercase dark:bg-blue-500/10 dark:text-blue-300"><Moon className="w-3 h-3" />{tx('Noite')}</span>
                                                        : <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-black uppercase dark:bg-rose-500/10 dark:text-rose-300"><AlertTriangle className="w-3 h-3" />{tx('Sem turno')}</span>
                                            )}
                                        </td>
                                        {temVisaoGlobal && (
                                            <td className="px-4 py-2.5 text-[11px] font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">
                                                <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" />{c.unidade || '—'}</span>
                                            </td>
                                        )}
                                        <td className="px-4 py-2.5 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                                            {semTelefone(c)
                                                ? <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">{tx('sem telefone')}</span>
                                                : <span className="inline-flex items-center gap-1">{c.telefone}<CopyButton textToCopy={soNumeros(c.telefone)} label={tx('Copiar telefone')} /></span>}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {c.tipo_conta === 'PIX_CPF' ? (
                                                <span className="inline-flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 dark:bg-emerald-500/20 dark:text-emerald-400"><Zap className="w-3.5 h-3.5" /></span>
                                                    <span>
                                                        <span className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest dark:text-emerald-400">{tx('PIX (Chave CPF)')}</span>
                                                        {ehAdmin && <span className="block text-[10px] font-mono font-bold text-emerald-800 dark:text-emerald-300">{c.cpf}</span>}
                                                        {isAtivo && <span className="mt-0.5 inline-block px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-black uppercase dark:bg-rose-500/10 dark:text-rose-300" title={tx('O pagamento principal é o Banco Inter. O PIX (chave CPF) é só para quem ainda não tem conta no Inter.')}>{tx('Trocar para Inter')}</span>}
                                                    </span>
                                                </span>
                                            ) : c.tipo_conta === 'INTER' ? (
                                                <span className="inline-flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 dark:bg-orange-500/20 dark:text-orange-400"><Building className="w-3.5 h-3.5" /></span>
                                                    <span>
                                                        <span className="block text-[10px] font-black text-orange-600 uppercase tracking-widest dark:text-orange-400">{tx('Banco Inter')}</span>
                                                        {ehAdmin && <span className="block text-[11px] font-mono font-black text-orange-900 dark:text-orange-300">{c.conta_inter || tx('Não informada')}</span>}
                                                    </span>
                                                </span>
                                            ) : (
                                                <span className={`text-[10px] font-black uppercase ${isAtivo ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>{tx('Não Definido')}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            {podeEditarEquipe && (
                                                <div className="flex justify-end gap-1.5">
                                                    <button type="button" onClick={() => onEdit(c)} className="w-8 h-8 inline-flex items-center justify-center bg-white text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-blue-500/10 dark:border-blue-500/30" title={tx('Editar Cadastro')} aria-label={tx('Editar Cadastro')}>
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </button>
                                                    {isAtivo ? (
                                                        <button type="button" onClick={() => onToggleStatus(c)} className="w-8 h-8 inline-flex items-center justify-center bg-white text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-500/10 dark:border-rose-500/30" title={tx('Desligar/Inativar Colaborador')} aria-label={tx('Desligar/Inativar Colaborador')}>
                                                            <PowerOff className="w-3.5 h-3.5" />
                                                        </button>
                                                    ) : (
                                                        <button type="button" onClick={() => onToggleStatus(c)} className="w-8 h-8 inline-flex items-center justify-center bg-white text-emerald-600 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors dark:bg-slate-900 dark:text-emerald-400 dark:hover:bg-emerald-500/10 dark:border-emerald-500/30" title={tx('Reativar Acesso')} aria-label={tx('Reativar Acesso')}>
                                                            <Power className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {dadosProcessados.length === 0 && (
                                <tr><td colSpan={colunas} className="text-center py-16 text-slate-400 uppercase tracking-widest text-[10px] font-bold">{tx('Nenhum colaborador encontrado nos filtros.')}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TabEquipe;
