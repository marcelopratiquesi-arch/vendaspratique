import React, { useEffect, useMemo, useState } from 'react';
import {
    KeyRound, UserPlus, LogIn, ShieldAlert, Crown, UserCheck, AlertOctagon, Users, RefreshCw, Loader2, Power, Search, Globe, Timer,
} from 'lucide-react';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import { avisar } from '../../components/avisar.js';
import CopyButton from '../HistoricoVendas/CopyButton.jsx';
import PedidosAcesso from '../../components/acesso/PedidosAcesso.jsx';
import { liberarEmergencia, mudarSituacao, resolverAlerta, definirLider, tirarLider } from '../../components/acesso/acessoBanco.js';
import AbaTemporarios from '../../components/acesso/AbaTemporarios.jsx';
import { telefoneBonito, postoDe, dataBr } from '../../components/acesso/regrasAcesso.js';
import { sistemaPausado } from '../../components/pausaSistema.js';

// ==========================================
// ACESSOS (menu lateral; 12/11/2026, decisão do dono: "uma aba própria para monitorar, fora de Pendências").
// Admin vê tudo; Mentor só as unidades dele (o banco filtra em acesso_painel). Atualiza sozinha a cada 1 minuto.
// Abas: Pedidos · Entradas recentes (48 h) · Sem acesso (7+ dias) · Líderes por unidade (Admin "Definir líder",
// inclusive ele mesmo) · Dados não confirmados · "Não fui eu" · Todos os logins (com a adesão ao Google).
// Letras maiores e e-mail legível; no celular cada linha vira um cartão (grade em vez de tabela).
// ==========================================

const PAPEL = { ADMIN: 'Admin', MENTOR: 'Mentor', LIDER: 'Líder', RECEPCAO: 'Recepção' };
const COR_PAPEL = {
    ADMIN: 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900',
    MENTOR: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300',
    LIDER: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    RECEPCAO: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
};
const EVENTO = { LOGIN: 'Entrou', LOGOUT: 'Saiu', EXPIROU: 'Sessão expirou', NEGADO: 'Acesso negado' };
const quando = (v) => { if (!v) return '—'; const d = new Date(v); return isNaN(d) ? '—' : d.toLocaleString(localeAtual(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
const ha = (v) => { if (!v) return tx('nunca entrou'); const m = Math.floor((Date.now() - new Date(v)) / 60000); if (m < 60) return tx('há {qtd} min', { qtd: Math.max(1, m) }); const h = Math.floor(m / 60); if (h < 24) return tx('há {qtd} h', { qtd: h }); return tx('há {qtd} dias', { qtd: Math.floor(h / 24) }); };
const papelDe = (l) => String(l?.role || '').toUpperCase();
// Liberação da entrada com senha (decisão do dono, 12/11/2026): até 7 dias, renovável até a pessoa resolver o e-mail
const PRAZOS_SENHA = [[24, '24 h'], [72, '3 dias'], [168, '7 dias']];

// Líder com posto ASPIRA aparece "Aspira" (13/11/2026: segundo líder fixo da unidade, mesmas permissões)
const EtiquetaPapel = ({ role, posto }) => (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wide ${COR_PAPEL[String(role).toUpperCase()] || 'bg-slate-100 text-slate-600'}`}>
        {String(role).toUpperCase() === 'LIDER' && String(posto || '').toUpperCase() === 'ASPIRA' ? tx('Aspira') : tx(PAPEL[String(role).toUpperCase()] || role || '—')}
    </span>
);
const POSTOS_UNIDADE = [['TITULAR', 'Líder'], ['ASPIRA', 'Aspira']];
const Pessoa = ({ l }) => (
    <div className="min-w-0">
        <p className="text-[14px] font-bold text-slate-800 uppercase truncate dark:text-white">{l.nome || l.email}</p>
        {l.email && <p className="text-[13px] font-medium text-slate-600 flex items-center gap-1 truncate dark:text-slate-300">{l.email}<CopyButton textToCopy={l.email} label={tx('Copiar e-mail')} /></p>}
    </div>
);
// Linha que vira cartão no celular: "colunas" = classes do grid a partir do md
const Linha = ({ colunas, children, destaque }) => (
    <div className={`grid grid-cols-1 gap-1.5 md:gap-3 md:items-center px-4 py-3 border-b border-slate-100 last:border-0 dark:border-slate-800 ${destaque || ''} ${colunas}`}>{children}</div>
);
const Cabecalho = ({ colunas, titulos }) => (
    <div className={`hidden md:grid gap-3 px-4 py-2 bg-slate-50 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-800 ${colunas}`}>
        {titulos.map((t, i) => <span key={i} className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{t}</span>)}
    </div>
);
const Caixa = ({ children }) => <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">{children}</div>;
const Vazio = ({ texto }) => <p className="px-4 py-8 text-center text-[14px] font-bold text-emerald-600 dark:text-emerald-400">✓ {texto || tx('Tudo certo.')}</p>;
const Rotulo = ({ children }) => <span className="md:hidden text-[11px] font-black uppercase tracking-widest text-slate-400">{children} </span>;

// somenteAbas / esconderAbas (12/11/2026): a lista "Todos os logins" também aparece em Configurações → Entradas e senha
// (só ela) e, para o Admin, sai da aba Acessos do menu; o Mentor continua vendo a lista aqui.
const PaginaAcessos = ({ acessos, ehAdmin = false, unidades = [], somenteAbas = null, esconderAbas = [], podeLiberar = true }) => {
    const { contas, painel, carregando, recarregar, semSql } = acessos || {};
    const [aba, setAba] = useState(somenteAbas?.[0] || 'pedidos');
    const [busca, setBusca] = useState('');
    const [filtroPapel, setFiltroPapel] = useState('');
    const [soSemGoogle, setSoSemGoogle] = useState(false);
    const [escolhaLider, setEscolhaLider] = useState({}); // unidade → email escolhido
    const [atualizadoEm, setAtualizadoEm] = useState(new Date());
    const [menuSenha, setMenuSenha] = useState(''); // e-mail da linha com a escolha do prazo da senha aberta

    // Atualiza sozinha a cada 1 minuto (menos com o sistema pausado)
    useEffect(() => {
        const id = setInterval(() => { if (!sistemaPausado()) { recarregar?.(); setAtualizadoEm(new Date()); } }, 60000);
        return () => clearInterval(id);
    }, [recarregar]);
    const atualizar = () => { recarregar?.(); setAtualizadoEm(new Date()); };

    const logins = useMemo(() => painel?.logins || [], [painel]);
    const candidatosLider = useMemo(() => logins.filter(l => String(l.status || 'ATIVO') === 'ATIVO' && papelDe(l) !== 'RECEPCAO')
        .sort((a, b) => String(a.nome).localeCompare(String(b.nome))), [logins]);
    const filtrar = (lista) => {
        const b = busca.trim().toLowerCase();
        return lista.filter(l => (!filtroPapel || papelDe(l) === filtroPapel)
            && (!b || [l.nome, l.email, l.unidade].some(v => String(v || '').toLowerCase().includes(b))));
    };

    if (semSql) return <div className="max-w-[1400px] mx-auto"><Caixa><p className="p-6 text-[14px] font-bold text-amber-700 dark:text-amber-300">{tx('Para ver os acessos, rode no Supabase os passos 0 e 1 de sql/2026-11-12-login-google.')}</p></Caixa></div>;
    if (!contas) return <div className="max-w-[1400px] mx-auto p-6 text-[14px] font-semibold text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{tx('Carregando...')}</div>;

    const acaoLogin = async (l, acao) => {
        try {
            if (String(acao).startsWith('emergencia')) {
                const horas = Number(String(acao).split(':')[1] ?? 24);
                setMenuSenha('');
                if (horas === 0) {
                    if (!window.confirm(tx('Encerrar a entrada com senha de {nome}? Ele(a) volta a entrar só pelo Google.', { nome: l.nome }))) return;
                    await liberarEmergencia(l.email, 0);
                    avisar(tx('Entrada com senha de {nome} encerrada.', { nome: l.nome }), 'sucesso');
                } else {
                    const prazo = PRAZOS_SENHA.find(p => p[0] === horas)?.[1] || `${horas} h`;
                    if (!window.confirm(tx('Liberar {nome} para entrar com a senha por {prazo} (a partir de agora)?', { nome: l.nome, prazo: tx(prazo) }))) return;
                    const ate = await liberarEmergencia(l.email, horas);
                    avisar(tx('{nome} pode entrar com a senha até {quando}.', { nome: l.nome, quando: quando(ate) }), 'sucesso');
                }
            } else if (acao === 'inativar') {
                const motivo = window.prompt(tx('Motivo para inativar {nome} (nada é apagado):', { nome: l.nome }));
                if (motivo === null) return;
                if (motivo.trim().length < 5) { avisar(tx('Cancelado: o motivo precisa ter pelo menos 5 letras.'), 'atencao'); return; }
                await mudarSituacao(l.email, 'INATIVO', motivo.trim());
                avisar(tx('{nome} inativado.', { nome: l.nome }), 'sucesso');
            } else if (acao === 'reativar') {
                if (!window.confirm(tx('Reativar {nome}?', { nome: l.nome }))) return;
                await mudarSituacao(l.email, 'ATIVO');
                avisar(tx('{nome} reativado.', { nome: l.nome }), 'sucesso');
            }
            atualizar();
        } catch (e) { avisar(e.message || tx('Não foi possível concluir.'), 'erro'); }
    };
    // Líder e Aspira (13/11/2026): cada posto é trocado sozinho; o outro não é tocado
    const salvarLider = async (unidade, posto, atuais) => {
        const chave = `${unidade}|${posto}`;
        const email = escolhaLider[chave];
        if (!email) { avisar(tx('Escolha quem vai ocupar o posto.'), 'atencao'); return; }
        const novo = candidatosLider.find(l => l.email === email);
        const nomePosto = posto === 'ASPIRA' ? tx('Aspira') : tx('Líder');
        const texto = atuais.length
            ? tx('Trocar o {posto} de {unidade}? {atual} sai e {novo} entra. Se {atual} for login de nível Líder, fica INATIVO. O outro posto não muda.', { posto: nomePosto, unidade, atual: atuais.map(a => a.nome).join(', '), novo: novo?.nome })
            : tx('Definir {novo} como {posto} de {unidade}?', { unidade, novo: novo?.nome, posto: nomePosto });
        if (!window.confirm(texto)) return;
        try { await definirLider(unidade, email, posto); avisar(tx('{posto} de {unidade} definido.', { unidade, posto: nomePosto }), 'sucesso'); setEscolhaLider(s => ({ ...s, [chave]: '' })); atualizar(); }
        catch (e) { avisar(e.message || tx('Não foi possível definir o líder.'), 'erro'); }
    };
    const tirarDoPosto = async (unidade, l) => {
        const motivo = window.prompt(tx('Tirar {nome} da liderança de {unidade}, sem colocar outra pessoa? Se for login de nível Líder, fica INATIVO (nada é apagado). Motivo:', { nome: l.nome, unidade }));
        if (motivo === null) return;
        if (motivo.trim().length < 5) { avisar(tx('Cancelado: o motivo precisa ter pelo menos 5 letras.'), 'atencao'); return; }
        try { await tirarLider(unidade, l.email, motivo.trim()); avisar(tx('{nome} saiu da liderança de {unidade}.', { nome: l.nome, unidade }), 'sucesso'); atualizar(); }
        catch (e) { avisar(e.message || tx('Não foi possível concluir.'), 'erro'); }
    };
    const botoesLogin = (l) => (
        <span className="inline-flex flex-wrap gap-1.5 md:justify-end">
            {ehAdmin && String(l.status || 'ATIVO') === 'ATIVO' && (menuSenha === l.email ? (
                <span className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-blue-50 px-1.5 py-1 dark:bg-blue-500/10">
                    <span className="text-[11px] font-black uppercase text-blue-700 px-1 dark:text-blue-300">{tx('Senha por')}</span>
                    {PRAZOS_SENHA.map(([h, r]) => (
                        <button key={h} type="button" onClick={() => acaoLogin(l, `emergencia:${h}`)}
                            className="h-7 px-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase">{tx(r)}</button>
                    ))}
                    {l.emergencia_ate && new Date(l.emergencia_ate) > new Date() && (
                        <button type="button" onClick={() => acaoLogin(l, 'emergencia:0')} className="h-7 px-2 rounded-md border border-rose-200 bg-white text-rose-600 text-[11px] font-black uppercase hover:bg-rose-50 dark:bg-slate-900 dark:border-rose-500/30 dark:text-rose-300">{tx('Encerrar')}</button>
                    )}
                    <button type="button" onClick={() => setMenuSenha('')} className="h-7 px-1.5 text-[11px] font-black uppercase text-slate-500 hover:text-slate-700 dark:text-slate-400">✕</button>
                </span>
            ) : (
                <button type="button" onClick={() => setMenuSenha(l.email)} title={tx('Liberar entrada com senha por 24 h, 3 dias ou 7 dias (quando o Google não funcionar). Dá para renovar até resolver.')}
                    className="h-8 px-2.5 rounded-lg border border-blue-200 text-blue-700 text-[11px] font-black uppercase inline-flex items-center gap-1 hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300"><KeyRound className="w-3.5 h-3.5" />{tx('Senha')}</button>
            ))}
            {String(l.status || 'ATIVO') === 'ATIVO'
                ? <button type="button" onClick={() => acaoLogin(l, 'inativar')} className="h-8 px-2.5 rounded-lg border border-rose-200 text-rose-600 text-[11px] font-black uppercase inline-flex items-center gap-1 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300"><Power className="w-3.5 h-3.5" />{tx('Inativar')}</button>
                : <button type="button" onClick={() => acaoLogin(l, 'reativar')} className="h-8 px-2.5 rounded-lg border border-emerald-200 text-emerald-700 text-[11px] font-black uppercase inline-flex items-center gap-1 hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-300"><Power className="w-3.5 h-3.5" />{tx('Reativar')}</button>}
        </span>
    );

    const qtdGoogle = logins.filter(l => String(l.status || 'ATIVO') === 'ATIVO' && l.ultimo_metodo === 'google').length;
    const qtdAtivos = logins.filter(l => String(l.status || 'ATIVO') === 'ATIVO').length;
    const ABAS_TODAS = [
        ['pedidos', 'Pedidos', UserPlus, contas.pedidos.length, 'rose'],
        ['recentes', 'Entradas recentes', LogIn, contas.recentes.filter(r => r.evento === 'LOGIN').length, 'azul'],
        ['sem', 'Sem acesso', ShieldAlert, contas.semAcesso.length, 'rose'],
        ['lideres', 'Líderes por unidade', Crown, contas.unidadesSemLider.length, 'amarelo'],
        ['temporarios', 'Temporários', Timer, contas.tempVencendo?.length || 0, 'amarelo'],
        ['dados', 'Dados não confirmados', UserCheck, contas.naoConfirmados.length, 'amarelo'],
        ['alertas', '"Não fui eu"', AlertOctagon, contas.alertas.length, 'rose'],
        ['logins', 'Todos os logins', Users, qtdAtivos, 'cinza'],
    ];
    const ABAS = ABAS_TODAS.filter(([id]) => (!somenteAbas || somenteAbas.includes(id)) && !esconderAbas.includes(id));
    const corNumero = { rose: 'bg-rose-500 text-white', amarelo: 'bg-amber-500 text-white', azul: 'bg-blue-600 text-white', cinza: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' };

    return (
        <div className="max-w-[1400px] mx-auto space-y-3 pb-10 animate-[fadeIn_0.3s_ease-out]">
            {/* TOPO EM UMA FAIXA */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center dark:bg-blue-500/10 dark:text-blue-400"><KeyRound className="w-5 h-5" /></div>
                    <div className="min-w-0">
                        <h1 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">{somenteAbas ? tx('Entradas e senha') : tx('Acessos')}</h1>
                        <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                            {tx('{qtd} pedidos', { qtd: contas.pedidos.length })} · {tx('{qtd} sem acesso há 7+ dias', { qtd: contas.semAcesso.length })} · <Globe className="inline w-3.5 h-3.5 -mt-0.5" /> {tx('Google: {feito} de {total} já entraram', { feito: qtdGoogle, total: qtdAtivos })}
                        </p>
                    </div>
                </div>
                <button type="button" onClick={atualizar} className="h-9 px-3 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-100 inline-flex items-center gap-1.5 dark:text-slate-300 dark:hover:bg-slate-800">
                    {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}{tx('Atualizar')}
                    <span className="text-[11px] font-semibold text-slate-400">{atualizadoEm.toLocaleTimeString(localeAtual(), { hour: '2-digit', minute: '2-digit' })}</span>
                </button>
            </div>

            {/* ABAS */}
            {ABAS.length > 1 && <div className="flex gap-1 p-1 bg-white rounded-xl border border-slate-200 overflow-x-auto custom-scrollbar dark:bg-slate-900 dark:border-slate-800" role="tablist">
                {ABAS.map(([id, rotulo, Icone, qtd, cor]) => {
                    const sel = aba === id;
                    return (
                        <button key={id} type="button" role="tab" aria-selected={sel} onClick={() => setAba(id)}
                            className={`h-9 px-3 rounded-lg text-[12px] font-black uppercase tracking-wide inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${sel ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                            <Icone className="w-4 h-4" />{tx(rotulo)}
                            {qtd > 0 && <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] inline-flex items-center justify-center ${sel ? 'bg-white/25 text-white' : corNumero[cor]}`}>{qtd}</span>}
                        </button>
                    );
                })}
            </div>}

            {/* BUSCA (abas de listas de pessoas) */}
            {['sem', 'dados', 'logins'].includes(aba) && (
                <div className="flex flex-wrap items-center gap-2">
                    <label className="flex-1 min-w-[min(260px,100%)] h-10 px-3 bg-white border border-slate-200 rounded-xl flex items-center gap-2 focus-within:ring-2 focus-within:ring-blue-500 dark:bg-slate-900 dark:border-slate-800">
                        <Search className="w-4 h-4 text-slate-400" />
                        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder={tx('Buscar nome, e-mail ou unidade...')} className="flex-1 min-w-0 bg-transparent outline-none text-[14px] font-semibold text-slate-800 dark:text-white" />
                    </label>
                    <select value={filtroPapel} onChange={e => setFiltroPapel(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px] font-bold dark:bg-slate-900 dark:border-slate-800 dark:text-white" aria-label={tx('Papel')}>
                        <option value="">{tx('Todos os papéis')}</option>
                        {Object.entries(PAPEL).map(([v, r]) => <option key={v} value={v}>{tx(r)}</option>)}
                    </select>
                    {aba === 'logins' && (
                        <button type="button" onClick={() => setSoSemGoogle(v => !v)} aria-pressed={soSemGoogle}
                            className={`h-10 px-3 rounded-xl border text-[12px] font-black uppercase tracking-wide inline-flex items-center gap-1.5 ${soSemGoogle ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'}`}>
                            <Globe className="w-4 h-4" />{tx('Só quem ainda não entrou pelo Google')}
                        </button>
                    )}
                </div>
            )}

            {/* PEDIDOS */}
            {aba === 'pedidos' && <PedidosAcesso pedidos={contas.pedidos} ehAdmin={ehAdmin} unidades={unidades} onDecidido={atualizar} />}

            {/* ENTRADAS RECENTES */}
            {aba === 'recentes' && (
                <Caixa>
                    <Cabecalho colunas="md:grid-cols-[110px_minmax(0,1.6fr)_110px_minmax(0,1fr)_150px_minmax(0,1fr)]" titulos={[tx('Quando'), tx('Pessoa'), tx('Papel'), tx('Unidade'), tx('O que'), tx('Como')]} />
                    {contas.recentes.length ? contas.recentes.map(r => (
                        <Linha key={r.id} colunas="md:grid-cols-[110px_minmax(0,1.6fr)_110px_minmax(0,1fr)_150px_minmax(0,1fr)]">
                            <span className="text-[13px] font-bold text-slate-700 tabular-nums dark:text-slate-200">{quando(r.quando)}<span className="block text-[11px] font-semibold text-slate-400">{ha(r.quando)}</span></span>
                            <Pessoa l={r} />
                            <span><EtiquetaPapel role={r.role} /></span>
                            <span className="text-[13px] font-bold uppercase text-slate-700 dark:text-slate-200"><Rotulo>{tx('Unidade')}:</Rotulo>{r.unidade || '—'}</span>
                            <span className={`text-[13px] font-black ${r.evento === 'LOGIN' ? 'text-emerald-600 dark:text-emerald-400' : r.evento === 'NEGADO' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>{tx(EVENTO[r.evento] || r.evento)}</span>
                            <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">{[r.metodo === 'google' ? 'Google' : r.metodo === 'senha' ? tx('Senha') : r.metodo, r.dispositivo].filter(Boolean).join(' · ') || '—'}</span>
                        </Linha>
                    )) : <Vazio texto={tx('Ninguém entrou nas últimas 48 horas.')} />}
                </Caixa>
            )}

            {/* SEM ACESSO */}
            {aba === 'sem' && (
                <Caixa>
                    <Cabecalho colunas="md:grid-cols-[minmax(0,1.8fr)_110px_minmax(0,1fr)_150px_auto]" titulos={[tx('Pessoa'), tx('Papel'), tx('Unidade'), tx('Último login'), '']} />
                    {filtrar(contas.semAcesso).length ? filtrar(contas.semAcesso).map(l => (
                        <Linha key={l.email} colunas="md:grid-cols-[minmax(0,1.8fr)_110px_minmax(0,1fr)_150px_auto]">
                            <Pessoa l={l} />
                            <span><EtiquetaPapel role={l.role} posto={l.posto} /></span>
                            <span className="text-[13px] font-bold uppercase text-slate-700 dark:text-slate-200"><Rotulo>{tx('Unidade')}:</Rotulo>{l.unidade}</span>
                            <span className="text-[13px] font-black text-rose-600 dark:text-rose-400">{l.nunca ? tx('nunca entrou') : tx('há {qtd} dias', { qtd: l.dias })}</span>
                            {botoesLogin(l)}
                        </Linha>
                    )) : <Vazio />}
                </Caixa>
            )}

            {/* LÍDERES POR UNIDADE */}
            {aba === 'lideres' && (
                <Caixa>
                    <Cabecalho colunas="md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)_minmax(0,1.6fr)_minmax(0,1fr)]" titulos={[tx('Unidade'), tx('Líder'), tx('Aspira'), tx('Temporários')]} />
                    {contas.lideres.map(({ unidade, lideres }) => {
                        const temps = contas.tempPorUnidade?.get(unidade) || [];
                        return (
                            <Linha key={unidade} colunas="md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)_minmax(0,1.6fr)_minmax(0,1fr)] md:items-start" destaque={lideres.length || temps.length ? '' : 'bg-amber-50/60 dark:bg-amber-500/5'}>
                                <span className="text-[14px] font-black uppercase text-slate-800 dark:text-white">{unidade}</span>
                                {POSTOS_UNIDADE.map(([posto, rotuloPosto]) => {
                                    const doPosto = lideres.filter(l => postoDe(l) === posto);
                                    const chave = `${unidade}|${posto}`;
                                    return (
                                        <div key={posto} className="space-y-1.5 min-w-0">
                                            <span className="md:hidden text-[11px] font-black uppercase tracking-widest text-slate-400">{tx(rotuloPosto)}</span>
                                            {doPosto.length ? doPosto.map(l => (
                                                <div key={l.email} className="flex flex-wrap items-center gap-2">
                                                    <Pessoa l={l} />
                                                    <EtiquetaPapel role={l.role} posto={l.posto} />
                                                    {l.telefone && <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{telefoneBonito(l.telefone)}</span>}
                                                    <span className="text-[12px] font-semibold text-slate-400">{ha(l.ultimo_login)}</span>
                                                    {ehAdmin && <button type="button" onClick={() => tirarDoPosto(unidade, l)} className="h-7 px-2 rounded-md border border-rose-200 text-rose-600 text-[10px] font-black uppercase hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300">{tx('Tirar')}</button>}
                                                </div>
                                            )) : <span className={`text-[13px] font-black ${posto === 'TITULAR' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-400'}`}>{posto === 'TITULAR' ? tx('Sem líder') : tx('Sem aspira')}</span>}
                                            {ehAdmin && (
                                                <div className="flex gap-2">
                                                    <select value={escolhaLider[chave] || ''} onChange={e => setEscolhaLider(s => ({ ...s, [chave]: e.target.value }))}
                                                        className="flex-1 min-w-0 h-9 px-2 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold dark:bg-slate-900 dark:border-slate-700 dark:text-white" aria-label={tx('Escolher o {posto} de {unidade}', { unidade, posto: tx(rotuloPosto) })}>
                                                        <option value="">{doPosto.length ? tx('Trocar por...') : tx('Escolher...')}</option>
                                                        {candidatosLider.filter(l => papelDe(l) !== 'LIDER' || String(l.unidade || '').toUpperCase() === unidade).map(l => (
                                                            <option key={l.email} value={l.email}>{l.nome} · {papelDe(l) === 'LIDER' && postoDe(l) === 'ASPIRA' ? tx('Aspira') : tx(PAPEL[papelDe(l)] || l.role)}</option>
                                                        ))}
                                                    </select>
                                                    <button type="button" onClick={() => salvarLider(unidade, posto, doPosto)} className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest">{tx('Salvar')}</button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                <div className="space-y-1 min-w-0">
                                    <span className="md:hidden text-[11px] font-black uppercase tracking-widest text-slate-400">{tx('Temporários')}</span>
                                    {temps.length ? temps.map(t => (
                                        <p key={t.id} className="text-[12px] font-bold text-slate-700 dark:text-slate-200">
                                            {t.nome}
                                            <span className={`block text-[11px] font-black ${Number(t.dias_para_vencer) <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                                                {t.tipo === 'MENTOR' ? tx('Mentor') : tx('Líder')} · {tx('até {data}', { data: dataBr(t.vale_ate) })}
                                            </span>
                                        </p>
                                    )) : <span className="text-[12px] font-semibold text-slate-400">—</span>}
                                </div>
                            </Linha>
                        );
                    })}
                </Caixa>
            )}

            {/* TEMPORÁRIOS (13/11/2026) */}
            {aba === 'temporarios' && <AbaTemporarios contas={contas} ehAdmin={ehAdmin} unidades={unidades} podeLiberar={podeLiberar} onMudou={atualizar} />}

            {/* DADOS NÃO CONFIRMADOS */}
            {aba === 'dados' && (
                <Caixa>
                    <Cabecalho colunas="md:grid-cols-[minmax(0,1.8fr)_110px_minmax(0,1fr)_170px_150px]" titulos={[tx('Pessoa'), tx('Papel'), tx('Unidade'), tx('Telefone'), tx('Confirmado em')]} />
                    {filtrar(contas.naoConfirmados).length ? filtrar(contas.naoConfirmados).map(l => (
                        <Linha key={l.email} colunas="md:grid-cols-[minmax(0,1.8fr)_110px_minmax(0,1fr)_170px_150px]">
                            <Pessoa l={l} />
                            <span><EtiquetaPapel role={l.role} posto={l.posto} /></span>
                            <span className="text-[13px] font-bold uppercase text-slate-700 dark:text-slate-200">{l.unidade}</span>
                            <span className="text-[13px] font-semibold">{l.telefone ? telefoneBonito(l.telefone) : <span className="font-black text-rose-600 dark:text-rose-400">{tx('sem telefone')}</span>}</span>
                            <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">{l.dados_confirmados_em ? quando(l.dados_confirmados_em) : tx('nunca')}</span>
                        </Linha>
                    )) : <Vazio />}
                    <p className="px-4 py-2 text-[12px] font-semibold text-slate-400 border-t border-slate-100 dark:border-slate-800">{tx('A pessoa confirma sozinha na próxima vez que entrar (a janela é obrigatória).')}</p>
                </Caixa>
            )}

            {/* NÃO FUI EU */}
            {aba === 'alertas' && (
                <Caixa>
                    {contas.alertas.length ? contas.alertas.map(a => (
                        <Linha key={a.id} colunas="md:grid-cols-[minmax(0,1.6fr)_minmax(0,2fr)_auto]" destaque="bg-rose-50/60 dark:bg-rose-500/5">
                            <Pessoa l={a} />
                            <span className="text-[13px] font-semibold text-rose-900 dark:text-rose-200">
                                {tx('acesso de {quando} pelo {metodo} · {dispositivo}', { quando: quando(a.acesso_quando), metodo: a.acesso_metodo || '—', dispositivo: a.acesso_dispositivo || '—' })}
                                {a.texto && <span className="block font-bold">{a.texto}</span>}
                            </span>
                            <button type="button" onClick={async () => { try { await resolverAlerta(a.id); atualizar(); } catch (e) { avisar(e.message, 'erro'); } }}
                                className="h-9 px-3 rounded-lg bg-white border border-rose-200 text-rose-700 text-[11px] font-black uppercase dark:bg-slate-900 dark:border-rose-500/30 dark:text-rose-300">{tx('Resolvido')}</button>
                        </Linha>
                    )) : <Vazio />}
                </Caixa>
            )}

            {/* TODOS OS LOGINS */}
            {aba === 'logins' && (
                <Caixa>
                    <Cabecalho colunas="md:grid-cols-[minmax(0,1.8fr)_110px_minmax(0,1fr)_100px_170px_150px_auto]" titulos={[tx('Pessoa'), tx('Papel'), tx('Unidade'), tx('Situação'), tx('Telefone'), tx('Último login'), '']} />
                    {filtrar(logins).filter(l => !soSemGoogle || (String(l.status || 'ATIVO') === 'ATIVO' && l.ultimo_metodo !== 'google'))
                        .sort((a, b) => String(a.unidade).localeCompare(String(b.unidade)) || String(a.nome).localeCompare(String(b.nome))).map(l => {
                            const ativo = String(l.status || 'ATIVO') === 'ATIVO';
                            return (
                                <Linha key={l.email} colunas="md:grid-cols-[minmax(0,1.8fr)_110px_minmax(0,1fr)_100px_170px_150px_auto]" destaque={ativo ? '' : 'opacity-60'}>
                                    <Pessoa l={l} />
                                    <span><EtiquetaPapel role={l.role} posto={l.posto} /></span>
                                    <span className="text-[13px] font-bold uppercase text-slate-700 dark:text-slate-200">{l.unidade}</span>
                                    <span className={`text-[13px] font-black ${ativo ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} title={l.inativado_motivo || ''}>
                                        {ativo ? tx('Ativo') : tx('Inativo')}
                                        {l.emergencia_ate && new Date(l.emergencia_ate) > new Date() && <span className="block text-[11px] text-blue-600 dark:text-blue-400">{tx('senha até {quando}', { quando: quando(l.emergencia_ate) })}</span>}
                                    </span>
                                    <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">{l.telefone ? telefoneBonito(l.telefone) : '—'}</span>
                                    <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">{quando(l.ultimo_login)}{l.ultimo_metodo && <span className="block text-[11px] text-slate-400">{l.ultimo_metodo === 'google' ? 'Google' : tx('Senha')}</span>}</span>
                                    {botoesLogin(l)}
                                </Linha>
                            );
                        })}
                </Caixa>
            )}
        </div>
    );
};

export default PaginaAcessos;
