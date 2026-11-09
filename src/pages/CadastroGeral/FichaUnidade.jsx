import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft, CheckCircle2, XCircle, UserCog, Phone, Sun, Moon, AlertTriangle, Save, Loader2, Users, KeyRound,
    Dumbbell, Trash2, Monitor, LayoutDashboard, Settings2, Target, Power, ArrowRight, Mail, Gauge,
} from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { NOME_PAPEL } from '../../permissoes/catalogoPermissoes.js';
import { normalizarUnidade, ordenarLogins, unidadesDoMentorEm } from '../Configuracoes/conferenciaLogins.js';
import CopyButton from '../HistoricoVendas/CopyButton.jsx';
import AbaPanorama from './panorama/AbaPanorama.jsx';

// ==========================================
// CENTRAL DA UNIDADE (Cadastros → Unidades, só o Admin) — redesenhada em 09/11/2026 (decisão do dono:
// "uma ficha igual à do aluno", no lugar do painel lateral que cortava o topo com o zoom da tela).
// Janela grande no meio, com rolagem (o mesmo formato do pop-up da ficha do aluno):
// cabeçalho (nome, selos, Mentor, Líder com telefone, login da Recepção) + 5 cartões + abas
// Visão geral ("Unidade pronta?") · Equipe · Logins · Mentor · Configurações (Personal Class).
// Quem grava é o TabUnidades.jsx (onSalvarMentores / onMarcarPersonal / onAtivar / onExcluir).
// ==========================================

const papelDe = (u) => String(u?.role || '').toUpperCase().trim();
const setorDe = (c) => normalizarUnidade(c.role || c.setor);
const soNumeros = (t) => String(t || '').replace(/\D/g, '');
const iniciais = (nome) => String(nome || '?').split(/\s+/).filter(p => p && !/^\d+$/.test(p)).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';
const telefoneBonito = (t) => {
    const n = soNumeros(t);
    if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
    if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
    return t || '';
};

const ABAS = [
    ['geral', 'Visão geral', LayoutDashboard],
    ['panorama', 'Panorama', Gauge], // tudo da unidade: vendas, metas, CRM, avaliações e pendências (09/11/2026)
    ['equipe', 'Equipe', Users],
    ['logins', 'Logins', KeyRound],
    ['mentor', 'Mentor', UserCog],
    ['config', 'Configurações', Settings2],
];

// Onde resolver cada item do "Unidade pronta?" (aba desta janela ou outra tela do sistema)
const COMO_RESOLVER = {
    login_recepcao: { texto: 'Crie em Configurações → Logins (nível Recepção).' },
    login_lider: { texto: 'Crie em Configurações → Logins (nível Líder).' },
    mentor: { aba: 'mentor', botao: 'Marcar Mentor' },
    recepcionistas: { texto: 'Cadastre em Cadastros → Equipe (setor Recepção).' },
    turno: { aba: 'equipe', botao: 'Ver quem está sem turno', texto: 'O turno é marcado no cadastro da Equipe.' },
    metas: { texto: 'O Líder preenche no Dashboard → aba Metas.' },
};

const Cartao = ({ icone: Icone, cor, titulo, valor, sub, alerta }) => (
    <div className={`bg-white p-4 rounded-xl border shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-[96px] dark:bg-slate-900 ${alerta ? 'border-amber-300 dark:border-amber-500/40' : 'border-slate-200/80 dark:border-slate-800'}`}>
        <div className="flex items-center gap-2.5 mb-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${cor}`}><Icone className="w-3.5 h-3.5" strokeWidth={2.5} /></div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate dark:text-slate-400">{titulo}</span>
        </div>
        <span className="text-[15px] font-extrabold uppercase tracking-tight text-slate-800 truncate dark:text-white" title={String(valor)}>{valor}</span>
        <span className={`text-[10px] font-semibold mt-0.5 truncate ${alerta ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} title={sub}>{sub}</span>
    </div>
);

const Quadro = ({ children, className = '' }) => (
    <div className={`bg-white rounded-xl border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800 ${className}`}>{children}</div>
);

const th = 'px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap dark:text-slate-400';
const td = 'px-4 py-2.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200';

const FichaUnidade = ({ unidade, usuarios = [], colaboradores = [], vinculos = {}, prontidao, semPersonal = false, onSalvarMentores, onMarcarPersonal, onAtivar, onExcluir, onFechar, planos = [], produtos = [], pendencia, abrirTela, modo = 'completo', abaInicial = 'geral', rotuloVoltar }) => {
    // modo 'leitura' (Mentor e Líder, aberta pelo Dashboard; 09/11/2026): só Panorama e Equipe, sem ações
    const completo = modo !== 'leitura';
    const abasVisiveis = completo ? ABAS : ABAS.filter(([id]) => id === 'panorama' || id === 'equipe');
    const [aba, setAba] = useState(abasVisiveis.some(([id]) => id === abaInicial) ? abaInicial : abasVisiveis[0][0]);
    const chave = normalizarUnidade(unidade.nome);
    const desativada = unidade.ativa === false;

    // ---------- Mentores (marcar pela unidade) ----------
    const mentoresTodos = useMemo(() => ordenarLogins(usuarios.filter(u => papelDe(u) === 'MENTOR')), [usuarios]);
    const marcadosIniciais = useMemo(() => new Set(mentoresTodos
        .filter(m => unidadesDoMentorEm(vinculos, m.email).some(n => normalizarUnidade(n) === chave))
        .map(m => String(m.email).toLowerCase().trim())), [mentoresTodos, vinculos, chave]);
    const [marcados, setMarcados] = useState(marcadosIniciais);
    const [salvando, setSalvando] = useState(false);
    useEffect(() => { setMarcados(new Set(marcadosIniciais)); }, [marcadosIniciais]);
    const mudouMentores = marcados.size !== marcadosIniciais.size || [...marcados].some(e => !marcadosIniciais.has(e));
    const alternar = (email) => setMarcados(atual => { const n = new Set(atual); if (n.has(email)) n.delete(email); else n.add(email); return n; });
    const salvarMentores = async () => { setSalvando(true); await onSalvarMentores([...marcados]); setSalvando(false); };

    useEffect(() => {
        const aoTeclar = (e) => { if (e.key === 'Escape' && !salvando) onFechar(); };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [onFechar, salvando]);

    // ---------- Dados da unidade ----------
    const logins = ordenarLogins(usuarios.filter(u => normalizarUnidade(u.unidade) === chave));
    const daUnidade = colaboradores.filter(c => normalizarUnidade(c.unidade) === chave);
    const equipe = daUnidade.filter(c => c.ativo !== false).sort((a, b) => String(a.role || '').localeCompare(String(b.role || ''), 'pt-BR') || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    const desligados = daUnidade.length - equipe.length;
    const lideresEquipe = equipe.filter(c => setorDe(c).includes('LIDER'));
    const recepcionistas = equipe.filter(c => setorDe(c).includes('RECEP'));
    const semTurno = recepcionistas.filter(c => !c.turno);
    const loginsLider = logins.filter(u => papelDe(u) === 'LIDER');
    const loginsRecepcao = logins.filter(u => papelDe(u) === 'RECEPCAO');
    const mentores = mentoresTodos.filter(m => marcadosIniciais.has(String(m.email).toLowerCase().trim()));
    const qtdSetores = new Set(equipe.map(c => String(c.role || c.setor || '').toUpperCase())).size;
    const itemMetas = prontidao?.itens.find(i => i.id === 'metas');
    const liderPrincipal = lideresEquipe[0] || null;
    const nomeLider = loginsLider[0]?.nome || liderPrincipal?.nome || null;
    const telefoneLider = liderPrincipal && soNumeros(liderPrincipal.telefone).length >= 10 ? liderPrincipal.telefone : null;

    const etiquetaTurno = (c) => {
        if (!setorDe(c).includes('RECEP')) return <span className="text-slate-300 dark:text-slate-600">—</span>;
        const t = String(c.turno || '').toUpperCase();
        if (t === 'MANHA') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold uppercase dark:bg-amber-500/10 dark:text-amber-300"><Sun className="w-3 h-3" />{tx('Manhã')}</span>;
        if (t === 'NOITE') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold uppercase dark:bg-blue-500/10 dark:text-blue-300"><Moon className="w-3 h-3" />{tx('Noite')}</span>;
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-bold uppercase dark:bg-rose-500/10 dark:text-rose-300"><AlertTriangle className="w-3 h-3" />{tx('Sem turno')}</span>;
    };

    const detalheItem = (item) => {
        if (item.id === 'mentor' && item.detalhe?.length) return item.detalhe.join(', ');
        if (item.id === 'recepcionistas' && item.qtd) return tx('{qtd} ativas', { qtd: item.qtd });
        if (item.id === 'turno' && item.detalhe?.length) return tx('Sem turno: {nomes}', { nomes: item.detalhe.join(', ') });
        if (item.id === 'metas' && item.detalhe?.length) return tx('Falta: {o_que}', { o_que: item.detalhe.map(d => tx(d)).join(', ') });
        return '';
    };

    const separador = <span className="hidden sm:block w-px h-3 bg-slate-300 dark:bg-slate-700" />;
    const botaoTopo = 'flex-1 sm:flex-none px-4 py-2 rounded-lg border text-[11px] font-bold uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-1.5';

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-3 md:p-8 overflow-y-auto animate-[fadeIn_0.15s_ease-out]" onMouseDown={(e) => { if (e.target === e.currentTarget && !salvando) onFechar(); }}>
            <div className="w-full min-w-0 max-w-6xl my-auto bg-[#F8FAFC] dark:bg-slate-950 rounded-[20px] p-5 md:p-6 flex flex-col shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="titulo-central-unidade">

                <div className="mb-5 flex items-center">
                    <button type="button" onClick={onFechar} disabled={salvando}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-colors shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/60">
                        <ArrowLeft className="w-3.5 h-3.5" />{rotuloVoltar || tx('Voltar para Unidades')}
                    </button>
                </div>

                {/* CABEÇALHO (modelo da ficha do aluno) */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 pb-5 mb-5 border-b border-slate-200/80 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto min-w-0">
                        <div className="relative shrink-0">
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-black shadow-sm border ${desativada ? 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700' : 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30'}`}>
                                {iniciais(unidade.nome)}
                            </div>
                            {!desativada && <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-sm dark:border-slate-950" title={tx('Ativa')} />}
                        </div>
                        <div className="flex flex-col w-full min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <h2 id="titulo-central-unidade" className="text-[19px] font-extrabold text-slate-800 uppercase tracking-tight dark:text-white">{unidade.nome}</h2>
                                {!completo ? null : desativada
                                    ? <span className="px-2 py-0.5 rounded-md border bg-slate-100 border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">{tx('Desativada')}</span>
                                    : prontidao?.pronta
                                        ? <span className="px-2 py-0.5 rounded-md border bg-emerald-50 border-emerald-200 text-emerald-700 text-[10px] font-bold uppercase tracking-wider dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300">✓ {tx('Pronta')}</span>
                                        : <button type="button" onClick={() => setAba('geral')} className="px-2 py-0.5 rounded-md border bg-amber-50 border-amber-200 text-amber-700 text-[10px] font-bold uppercase tracking-wider hover:bg-amber-100 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">{prontidao?.faltam === 1 ? tx('Falta 1') : tx('Faltam {qtd}', { qtd: prontidao?.faltam || 0 })}</button>}
                                {semPersonal && <span className="px-2 py-0.5 rounded-md border bg-slate-100 border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">{tx('Sem Personal Class')}</span>}
                            </div>
                            <div className="flex flex-wrap items-center gap-y-2 gap-x-3 text-[12px] font-medium text-slate-500 dark:text-slate-400">
                                {completo && <span className="flex items-center gap-1.5"><UserCog className="w-3.5 h-3.5 text-purple-500" />{tx('Mentor')}: <b className="font-semibold text-slate-700 dark:text-slate-200">{mentores.length ? mentores.map(m => m.nome || m.email).join(', ') : tx('nenhum')}</b></span>}
                                {completo && separador}
                                <span className="flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5 text-amber-500" />{tx('Líder')}: <b className="font-semibold text-slate-700 dark:text-slate-200">{nomeLider || tx('nenhum')}</b></span>
                                {separador}
                                <span className="flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                                    {telefoneLider
                                        ? <>{telefoneBonito(telefoneLider)}<CopyButton textToCopy={soNumeros(telefoneLider)} label={tx('Copiar telefone')} /></>
                                        : <span className="text-rose-600 dark:text-rose-400">{tx('Líder sem telefone na Equipe')}</span>}
                                </span>
                                {completo && <span className="flex items-center gap-1.5 lowercase basis-full sm:basis-auto">
                                    <Monitor className="w-3.5 h-3.5 text-blue-500" />
                                    {loginsRecepcao[0]
                                        ? <>{loginsRecepcao[0].email}<CopyButton textToCopy={loginsRecepcao[0].email} label={tx('Copiar e-mail')} /></>
                                        : <span className="normal-case text-rose-600 dark:text-rose-400">{tx('sem login da Recepção')}</span>}
                                </span>}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto shrink-0">
                        <button type="button" onClick={() => setAba('panorama')}
                            className={`${botaoTopo} bg-blue-600 border-blue-600 text-white hover:bg-blue-700`}>
                            <Gauge className="w-3.5 h-3.5" />{tx('Ver tudo da unidade')}
                        </button>
                        {completo && <button type="button" onClick={() => onAtivar(unidade, desativada)}
                            className={`${botaoTopo} ${desativada ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-amber-500/10'}`}>
                            <Power className="w-3.5 h-3.5" />{desativada ? tx('Reativar') : tx('Desativar')}
                        </button>}
                        {completo && <button type="button" onClick={() => onExcluir(unidade)} title={tx("Excluir (só unidade sem nenhum dado)")}
                            className={`${botaoTopo} bg-white border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400`}>
                            <Trash2 className="w-3.5 h-3.5" />{tx('Excluir')}
                        </button>}
                    </div>
                </div>

                {/* 5 CARTÕES */}
                <div className={`grid grid-cols-2 gap-3 mb-5 ${completo ? 'lg:grid-cols-5' : 'lg:grid-cols-3'}`}>
                    {completo && <Cartao icone={KeyRound} cor="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" titulo={tx('Logins')} valor={logins.length}
                        sub={tx('{lider} Líder · {recepcao} Recepção', { lider: loginsLider.length, recepcao: loginsRecepcao.length })} alerta={!desativada && (!loginsLider.length || !loginsRecepcao.length)} />}
                    <Cartao icone={Users} cor="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" titulo={tx('Equipe ativa')} valor={equipe.length}
                        sub={qtdSetores === 1 ? tx('1 setor') : tx('{qtd} setores', { qtd: qtdSetores })} />
                    <Cartao icone={Monitor} cor="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" titulo={tx('Recepcionistas')} valor={recepcionistas.length}
                        sub={recepcionistas.length === 0 ? tx('ninguém na Recepção') : semTurno.length ? tx('{qtd} sem turno', { qtd: semTurno.length }) : tx('turnos marcados')} alerta={!desativada && (recepcionistas.length === 0 || semTurno.length > 0)} />
                    {completo && <Cartao icone={UserCog} cor="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400" titulo={tx('Mentor')} valor={mentores[0]?.nome || tx('Nenhum')}
                        sub={mentores.length > 1 ? tx('+{qtd} outros', { qtd: mentores.length - 1 }) : mentores.length ? tx('acompanha a unidade') : tx('ninguém acompanha')} alerta={!desativada && mentores.length === 0} />}
                    <Cartao icone={Target} cor="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400" titulo={tx('Metas do mês')}
                        valor={!itemMetas ? '—' : itemMetas.ok ? tx('Preenchidas') : tx('Pendentes')}
                        sub={!itemMetas ? tx('não deu para conferir') : itemMetas.ok ? tx('Meta Start e Mensal') : detalheItem(itemMetas)} alerta={!desativada && itemMetas && !itemMetas.ok} />
                </div>

                {/* ABAS */}
                <div className="flex bg-white p-1.5 rounded-xl border border-slate-200/80 overflow-x-auto custom-scrollbar mb-5 shadow-sm dark:bg-slate-900 dark:border-slate-800" role="tablist">
                    {abasVisiveis.map(([id, rotulo, Icone]) => {
                        const ativo = aba === id;
                        return (
                            <button key={id} type="button" role="tab" aria-selected={ativo} onClick={() => setAba(id)}
                                className={`flex-1 min-w-[110px] px-3 py-2.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 whitespace-nowrap outline-none ${ativo ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'}`}>
                                <Icone className="w-3.5 h-3.5" strokeWidth={ativo ? 2.5 : 2} />{tx(rotulo)}
                            </button>
                        );
                    })}
                </div>

                <div className="min-h-[260px]">
                    {/* VISÃO GERAL: Unidade pronta? */}
                    {aba === 'geral' && (desativada ? (
                        <Quadro className="p-8 text-center text-[12px] font-bold text-slate-500 dark:text-slate-400">
                            {tx('Unidade desativada: some do seletor do topo e das listas, mas vendas, alunos, metas e contatos continuam guardados. Use "Reativar" para voltar.')}
                        </Quadro>
                    ) : (
                        <>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3 dark:text-slate-400">
                                {tx('Unidade pronta?')} · {prontidao?.pronta ? tx('tudo certo') : tx('{qtd} de {total} itens precisam de atenção', { qtd: prontidao?.faltam || 0, total: prontidao?.itens.length || 0 })}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {(prontidao?.itens || []).map(item => {
                                    const resolver = COMO_RESOLVER[item.id] || {};
                                    return (
                                        <Quadro key={item.id} className={`p-4 flex items-start gap-3 ${item.ok ? '' : 'border-rose-200 dark:border-rose-500/30'}`}>
                                            {item.ok
                                                ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                                : <XCircle className="w-5 h-5 text-rose-500 shrink-0" />}
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[13px] font-bold text-slate-800 dark:text-white">{tx(item.rotulo)}</p>
                                                {detalheItem(item) && <p className="text-[11px] font-semibold text-slate-500 mt-0.5 dark:text-slate-400">{detalheItem(item)}</p>}
                                                {!item.ok && (
                                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                                        {resolver.aba && (
                                                            <button type="button" onClick={() => setAba(resolver.aba)} className="h-7 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                                                                {tx(resolver.botao)}<ArrowRight className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                        {resolver.texto && <span className="text-[11px] font-semibold text-slate-400">{tx(resolver.texto)}</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </Quadro>
                                    );
                                })}
                            </div>
                        </>
                    ))}

                    {/* PANORAMA: só carrega quando a aba é aberta */}
                    {aba === 'panorama' && (
                        <AbaPanorama unidade={unidade} recepcionistas={recepcionistas} semPersonal={semPersonal} pendencia={pendencia}
                            planos={planos} produtos={produtos} abrirTela={abrirTela ? (tela, opcoes) => abrirTela(unidade.nome, tela, opcoes) : null} />
                    )}

                    {/* EQUIPE */}
                    {aba === 'equipe' && (
                        <Quadro className="overflow-hidden">
                            {equipe.length === 0 ? <p className="p-8 text-center text-[12px] font-bold text-slate-400">{tx('Ninguém ativo na Equipe.')}</p> : (
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full min-w-[560px]">
                                        <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-800">
                                            <tr><th className={th}>{tx('Nome')}</th><th className={th}>{tx('Setor')}</th><th className={th}>{tx('Turno')}</th><th className={th}>{tx('Telefone')}</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {equipe.map(c => (
                                                <tr key={c.id || c.nome} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                                                    <td className={`${td} font-bold uppercase`}>{c.nome}</td>
                                                    <td className={`${td} text-[11px] uppercase text-slate-500 dark:text-slate-400`}>{c.role || c.setor || '—'}</td>
                                                    <td className={td}>{etiquetaTurno(c)}</td>
                                                    <td className={td}>
                                                        {soNumeros(c.telefone).length >= 10
                                                            ? <span className="inline-flex items-center gap-1">{telefoneBonito(c.telefone)}<CopyButton textToCopy={soNumeros(c.telefone)} label={tx('Copiar telefone')} /></span>
                                                            : <span className="text-rose-600 dark:text-rose-400">{tx('sem telefone')}</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <p className="px-4 py-2.5 border-t border-slate-100 text-[11px] font-semibold text-slate-400 dark:border-slate-800">
                                {tx('O turno e o telefone são alterados em Cadastros → Equipe.')}{desligados > 0 && ` ${tx('{qtd} desligados não aparecem.', { qtd: desligados })}`}
                            </p>
                        </Quadro>
                    )}

                    {/* LOGINS */}
                    {aba === 'logins' && (
                        <Quadro className="overflow-hidden">
                            {logins.length === 0 ? <p className="p-8 text-center text-[12px] font-bold text-slate-400">{tx('Nenhum login ligado a esta unidade.')}</p> : (
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full min-w-[480px]">
                                        <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-800">
                                            <tr><th className={th}>{tx('Nome')}</th><th className={th}>{tx('E-mail')}</th><th className={th}>{tx('Nível')}</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {logins.map(u => (
                                                <tr key={u.email} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                                                    <td className={`${td} font-bold uppercase`}>{u.nome || '—'}</td>
                                                    <td className={`${td} lowercase text-slate-500 dark:text-slate-400`}><span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-slate-400" />{u.email}<CopyButton textToCopy={u.email} label={tx('Copiar e-mail')} /></span></td>
                                                    <td className={`${td} text-[11px] font-bold uppercase tracking-wider`}>{tx(NOME_PAPEL[papelDe(u)] || papelDe(u))}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <p className="px-4 py-2.5 border-t border-slate-100 text-[11px] font-semibold text-slate-400 dark:border-slate-800">
                                {tx('Logins são criados e editados em Configurações → Logins. O Mentor aparece na aba Mentor.')}
                            </p>
                        </Quadro>
                    )}

                    {/* MENTOR */}
                    {aba === 'mentor' && (
                        <Quadro className="p-5 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{tx('Clique para marcar ou tirar. É o mesmo que o botão "Unidades" do Mentor em Configurações.')}</p>
                                {mudouMentores && (
                                    <button type="button" onClick={salvarMentores} disabled={salvando} className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 disabled:opacity-60">
                                        {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{tx('Salvar')}
                                    </button>
                                )}
                            </div>
                            {mentoresTodos.length === 0 ? <p className="text-[12px] font-bold text-slate-400">{tx('Nenhum login de Mentor cadastrado.')}</p> : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {mentoresTodos.map(m => {
                                        const email = String(m.email).toLowerCase().trim();
                                        const ligado = marcados.has(email);
                                        const qtd = unidadesDoMentorEm(vinculos, m.email).length;
                                        return (
                                            <button key={email} type="button" onClick={() => alternar(email)} aria-pressed={ligado}
                                                className={`text-left p-3 rounded-xl border transition-colors flex items-center gap-3 ${ligado ? 'bg-purple-50 border-purple-300 dark:bg-purple-500/10 dark:border-purple-500/40' : 'bg-white border-slate-200 hover:border-purple-200 dark:bg-slate-900 dark:border-slate-700'}`}>
                                                <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${ligado ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{ligado && <CheckCircle2 className="w-3.5 h-3.5" />}</span>
                                                <span className="min-w-0">
                                                    <span className="block text-[12px] font-bold uppercase text-slate-800 truncate dark:text-white">{m.nome || m.email}</span>
                                                    <span className="block text-[11px] font-semibold text-slate-400 truncate">{m.email} · {qtd === 1 ? tx('1 unidade') : tx('{qtd} unidades', { qtd })}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </Quadro>
                    )}

                    {/* CONFIGURAÇÕES DA UNIDADE */}
                    {aba === 'config' && (
                        <Quadro className="p-5">
                            <label className="flex items-start justify-between gap-4 cursor-pointer">
                                <span className="flex items-start gap-3">
                                    <span className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 dark:bg-rose-500/10 dark:text-rose-400"><Dumbbell className="w-4 h-4" /></span>
                                    <span>
                                        <span className="block text-[13px] font-bold text-slate-800 dark:text-white">{tx('Esta unidade NÃO tem Personal Class')}</span>
                                        <span className="block text-[11px] font-semibold text-slate-400 mt-0.5">{tx('O mesmo da aba Metas: o Personal some das metas e a gratificação mensal fica com 3 indicadores.')}</span>
                                    </span>
                                </span>
                                <input type="checkbox" checked={semPersonal} onChange={(e) => onMarcarPersonal(e.target.checked)} className="w-5 h-5 mt-1 accent-blue-600 cursor-pointer shrink-0" />
                            </label>
                        </Quadro>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FichaUnidade;
