import React, { useEffect, useMemo, useState } from 'react';
import { Search, Lock, Check, Minus, RotateCcw, UserCog, Layers, AlertTriangle, Loader2, Info, Database, History, ListChecks, Copy } from 'lucide-react';
import { supabase } from '../supabaseClient.js';
import { avisar } from '../components/avisar.js';
import { tx } from '../i18n/traduzir.js';
import {
    CATALOGO_PERMISSOES, GRUPOS_PERMISSAO, PAPEIS, NOME_PAPEL, podeMudar, grupoDaPermissao,
} from './catalogoPermissoes.js';
import { verificarBancoPronto } from './usePermissoes.js';
import HistoricoPermissoes from './HistoricoPermissoes.jsx';
import DiferencasPadrao from './DiferencasPadrao.jsx';

// ==========================================
// CONFIGURAÇÕES → PERMISSÕES (só o Admin; decisão do dono, 06/11/2026)
// - "Por nível": uma linha por permissão (com número), uma coluna por nível; interruptor liga/desliga.
// - "Exceções por login": libera ou bloqueia uma permissão para UM login só (ex.: Recepção de uma unidade).
// Etapa 1: telas e abas. Etapa 2 (06/11/2026): ações; as marcadas com 'banco' também são conferidas pelo banco
// (função seg_pode). Sem essa função no banco, as ações com 'banco' ficam travadas no padrão.
// O banco guarda só o que foi mudado; voltar ao padrão apaga a linha. Histórico em permissoes_log.
// ==========================================

const papelDe = (u) => String(u?.role || '').toUpperCase().trim();
const emailDe = (u) => String(u?.email || '').toLowerCase().trim();

const Chave = ({ ligado, onClick, disabled, rotulo, alterado }) => (
    <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} title={rotulo} onClick={onClick} disabled={disabled}
        className={`relative w-10 h-6 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 ${ligado ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${ligado ? 'left-[18px]' : 'left-0.5'}`} />
        {alterado && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" aria-hidden="true" />}
    </button>
);

const Travado = ({ ligado, motivo }) => (
    <span title={motivo} className={`inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-black ${ligado ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}`}>
        {ligado ? <Check className="w-3 h-3" /> : <Minus className="w-3 h-3" />}<Lock className="w-3 h-3 opacity-60" />
    </span>
);

const motivoTrava = (p, papel, bancoPronto) => {
    if (papel === 'ADMIN') return tx('O Admin fica sempre no padrão (para ninguém se trancar fora do sistema).');
    if (p.travada) return tx('Travada: {motivo}', { motivo: p.descricao ? tx(p.descricao) : tx('fica sempre no padrão.') });
    if (p.banco && !bancoPronto) return tx('O banco também confere esta ação: rode no Supabase o SQL de sql/2026-11-06-permissoes-acoes/ para poder mudar.');
    if (p.rede) return tx('Só funciona com a visão de várias unidades (Admin e Mentor).');
    if (p.mudavelPara) return tx('Só vale para: {niveis}.', { niveis: p.mudavelPara.map(n => tx(NOME_PAPEL[n] || n)).join(', ') });
    return '';
};

// loginInicial (09/11/2026): o botão "Permissões deste login" da aba Logins abre já em "Exceções por login" com ele
const AbaPermissoes = ({ usuarios = [], loginInicial = '' }) => {
    const [modo, setModo] = useState(loginInicial ? 'login' : 'nivel'); // 'nivel' | 'login' | 'diferencas' (09/11/2026)
    const [origemCopia, setOrigemCopia] = useState(''); // Copiar exceções de outro login (09/11/2026)
    const [busca, setBusca] = useState('');
    const [tipoFiltro, setTipoFiltro] = useState('todas'); // 'todas' | 'ver' | 'fazer'
    const [regras, setRegras] = useState(() => new Map()); // 'PAPEL|codigo' -> bool
    const [excecoes, setExcecoes] = useState(() => new Map()); // 'email|codigo' -> bool
    const [carregando, setCarregando] = useState(true);
    const [semTabelas, setSemTabelas] = useState(false);
    const [gravando, setGravando] = useState('');
    const [loginEscolhido, setLoginEscolhido] = useState(String(loginInicial || '').toLowerCase().trim());
    const [bancoPronto, setBancoPronto] = useState(true);
    const [historicoAberto, setHistoricoAberto] = useState(false);

    useEffect(() => {
        let ativo = true;
        (async () => {
            const [r, e, pronto] = await Promise.all([
                supabase.from('permissoes_papel').select('papel, codigo, permitido'),
                supabase.from('permissoes_excecao').select('email, codigo, permitido'),
                verificarBancoPronto(),
            ]);
            if (!ativo) return;
            setBancoPronto(pronto);
            if (r.error || e.error) {
                console.warn('Permissões: tabelas não encontradas (rode sql/2026-11-06-permissoes/1_tabelas_permissoes.sql).', r.error || e.error);
                setSemTabelas(true);
            }
            setRegras(new Map((r.data || []).map(l => [`${String(l.papel).toUpperCase()}|${l.codigo}`, !!l.permitido])));
            setExcecoes(new Map((e.data || []).map(l => [`${String(l.email).toLowerCase()}|${l.codigo}`, !!l.permitido])));
            setCarregando(false);
        })();
        return () => { ativo = false; };
    }, []);

    const logins = useMemo(() => usuarios
        .filter(u => papelDe(u) && papelDe(u) !== 'ADMIN' && emailDe(u))
        .sort((a, b) => String(a.nome || a.email).localeCompare(String(b.nome || b.email), 'pt-BR')), [usuarios]);
    const login = logins.find(u => emailDe(u) === loginEscolhido) || null;
    const qtdExcecoes = (email) => [...excecoes.keys()].filter(k => k.startsWith(`${email}|`)).length;

    const termo = busca.trim().toLowerCase();
    const permissoesFiltradas = CATALOGO_PERMISSOES.filter(p => {
        if (tipoFiltro !== 'todas' && p.tipo !== tipoFiltro) return false;
        if (!termo) return true;
        return p.codigo.includes(termo) || p.nome.toLowerCase().includes(termo) || tx(p.nome).toLowerCase().includes(termo)
            || (grupoDaPermissao(p.codigo)?.nome || '').toLowerCase().includes(termo);
    });
    const grupos = GRUPOS_PERMISSAO.map(g => ({ ...g, itens: permissoesFiltradas.filter(p => grupoDaPermissao(p.codigo)?.centena === g.centena) })).filter(g => g.itens.length > 0);

    const valorNivel = (p, papel) => {
        const k = `${papel}|${p.codigo}`;
        return regras.has(k) ? regras.get(k) : p.padrao.includes(papel);
    };

    // Grava a mudança do nível. Igual ao padrão = apaga a linha (fica "no padrão").
    const mudarNivel = async (p, papel) => {
        if (semTabelas) { avisar(tx('Rode o SQL das permissões no Supabase antes de mudar (sql/2026-11-06-permissoes).'), 'erro'); return; }
        const novo = !valorNivel(p, papel);
        const k = `${papel}|${p.codigo}`;
        const antes = new Map(regras);
        const depois = new Map(regras);
        const voltaAoPadrao = novo === p.padrao.includes(papel);
        if (voltaAoPadrao) depois.delete(k); else depois.set(k, novo);
        setRegras(depois);
        setGravando(k);
        const { error } = voltaAoPadrao
            ? await supabase.from('permissoes_papel').delete().eq('papel', papel).eq('codigo', p.codigo)
            : await supabase.from('permissoes_papel').upsert({ papel, codigo: p.codigo, permitido: novo, atualizado_em: new Date().toISOString() });
        setGravando('');
        if (error) {
            setRegras(antes);
            avisar(tx('Não foi possível gravar a permissão: {erro}', { erro: error.message }), 'erro');
            return;
        }
        avisar(tx('{codigo} · {nome}: {estado} para {papel}.', { codigo: p.codigo, nome: tx(p.nome), estado: novo ? tx('ligada') : tx('desligada'), papel: tx(NOME_PAPEL[papel]) }), 'sucesso');
    };

    const voltarTudoAoPadrao = async () => {
        if (regras.size === 0) return;
        if (!window.confirm(tx('Voltar TODOS os níveis ao padrão do sistema? As {qtd} mudanças por nível serão desfeitas (as exceções por login continuam).', { qtd: regras.size }))) return;
        setGravando('tudo');
        const { error } = await supabase.from('permissoes_papel').delete().in('papel', ['MENTOR', 'LIDER', 'RECEPCAO']);
        setGravando('');
        if (error) { avisar(tx('Não foi possível voltar ao padrão: {erro}', { erro: error.message }), 'erro'); return; }
        setRegras(new Map());
        avisar(tx('Todos os níveis voltaram ao padrão do sistema.'), 'sucesso');
    };

    // Exceção de um login: 'padrao' (apaga), 'liberar' (true) ou 'bloquear' (false)
    const mudarExcecao = async (p, escolha) => {
        if (!login) return;
        if (semTabelas) { avisar(tx('Rode o SQL das permissões no Supabase antes de mudar (sql/2026-11-06-permissoes).'), 'erro'); return; }
        const email = emailDe(login);
        const k = `${email}|${p.codigo}`;
        const antes = new Map(excecoes);
        const depois = new Map(excecoes);
        if (escolha === 'padrao') depois.delete(k); else depois.set(k, escolha === 'liberar');
        setExcecoes(depois);
        setGravando(k);
        const { error } = escolha === 'padrao'
            ? await supabase.from('permissoes_excecao').delete().eq('email', email).eq('codigo', p.codigo)
            : await supabase.from('permissoes_excecao').upsert({ email, codigo: p.codigo, permitido: escolha === 'liberar', atualizado_em: new Date().toISOString() });
        setGravando('');
        if (error) {
            setExcecoes(antes);
            avisar(tx('Não foi possível gravar a exceção: {erro}', { erro: error.message }), 'erro');
        }
    };

    // "O que está diferente do padrão" (09/11/2026): voltar UMA mudança ao padrão = apagar a linha
    const voltarNivelPadrao = async (papel, codigo) => {
        const k = `${papel}|${codigo}`;
        setGravando(k);
        const { error } = await supabase.from('permissoes_papel').delete().eq('papel', papel).eq('codigo', codigo);
        setGravando('');
        if (error) { avisar(tx('Não foi possível voltar ao padrão: {erro}', { erro: error.message }), 'erro'); return; }
        setRegras(atual => { const n = new Map(atual); n.delete(k); return n; });
        avisar(tx('{codigo} voltou ao padrão para {papel}.', { codigo, papel: tx(NOME_PAPEL[papel] || papel) }), 'sucesso');
    };
    const voltarExcecaoPadrao = async (email, codigo) => {
        const k = `${email}|${codigo}`;
        setGravando(k);
        const { error } = await supabase.from('permissoes_excecao').delete().eq('email', email).eq('codigo', codigo);
        setGravando('');
        if (error) { avisar(tx('Não foi possível voltar ao padrão: {erro}', { erro: error.message }), 'erro'); return; }
        setExcecoes(atual => { const n = new Map(atual); n.delete(k); return n; });
        avisar(tx('{codigo} voltou ao padrão para {email}.', { codigo, email }), 'sucesso');
    };

    // Copiar as exceções de um login para outro (09/11/2026): o login escolhido fica com as MESMAS exceções da origem
    // (as que ele tinha antes são trocadas). Útil quando um Líder novo entra no lugar de outro.
    const copiarExcecoes = async () => {
        if (!login || !origemCopia) return;
        if (semTabelas) { avisar(tx('Rode o SQL das permissões no Supabase antes de mudar (sql/2026-11-06-permissoes).'), 'erro'); return; }
        const destino = emailDe(login);
        const origem = logins.find(u => emailDe(u) === origemCopia);
        const daOrigem = [...excecoes.entries()]
            .filter(([k]) => k.startsWith(`${origemCopia}|`))
            .map(([k, v]) => ({ codigo: k.slice(origemCopia.length + 1), permitido: v }));
        if (daOrigem.length === 0) return;
        const qtdHoje = qtdExcecoes(destino);
        const nivelDiferente = origem && papelDe(origem) !== papelDe(login);
        const partes = [tx('Copiar as {qtd} exceções de {origem} para {destino}?', { qtd: daOrigem.length, origem: origem?.nome || origemCopia, destino: login.nome || destino })];
        if (qtdHoje > 0) partes.push(tx('As {qtd} exceções que {destino} tem hoje serão trocadas.', { qtd: qtdHoje, destino: login.nome || destino }));
        if (nivelDiferente) partes.push(tx('Atenção: os níveis são diferentes ({de} → {para}). O que não vale para o nível de quem recebe fica sem efeito.', { de: tx(NOME_PAPEL[papelDe(origem)] || ''), para: tx(NOME_PAPEL[papelDe(login)] || '') }));
        if (!window.confirm(partes.join('\n\n'))) return;
        setGravando('copia');
        const agora = new Date().toISOString();
        const { error: erroApagar } = await supabase.from('permissoes_excecao').delete().eq('email', destino);
        const { error: erroGravar } = erroApagar
            ? { error: null }
            : await supabase.from('permissoes_excecao').insert(daOrigem.map(l => ({ email: destino, codigo: l.codigo, permitido: l.permitido, atualizado_em: agora })));
        // Relê do banco para a tela mostrar exatamente o que ficou gravado
        const { data } = await supabase.from('permissoes_excecao').select('email, codigo, permitido');
        if (data) setExcecoes(new Map(data.map(l => [`${String(l.email).toLowerCase()}|${l.codigo}`, !!l.permitido])));
        setGravando('');
        const erro = erroApagar || erroGravar;
        if (erro) { avisar(tx('Não foi possível copiar as exceções: {erro}', { erro: erro.message }), 'erro'); return; }
        setOrigemCopia('');
        avisar(tx('{qtd} exceções copiadas para {destino}.', { qtd: daOrigem.length, destino: login.nome || destino }), 'sucesso');
    };

    const qtdDiferencas = regras.size + excecoes.size;
    const th = 'px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap dark:text-slate-400';
    const qtdMudancas = regras.size;
    const qtdExcecoesTotal = excecoes.size;

    return (
        <div className="space-y-4">
            {/* Faixa do topo: modo, busca e filtro */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-3 justify-between dark:bg-slate-900 dark:border-slate-800">
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1 dark:bg-slate-800" role="tablist" aria-label={tx('Modo')}>
                    {[['nivel', tx('Por nível'), Layers], ['login', tx('Exceções por login'), UserCog], ['diferencas', tx('O que está diferente'), ListChecks]].map(([id, rotulo, Icone]) => (
                        <button key={id} type="button" role="tab" aria-selected={modo === id} onClick={() => setModo(id)}
                            className={`h-9 px-3 rounded-lg text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-2 transition-colors ${modo === id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
                            <Icone className="w-4 h-4" />{rotulo}
                            {id === 'diferencas' && qtdDiferencas > 0 && <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] flex items-center justify-center ${modo === id ? 'bg-white text-blue-700' : 'bg-amber-500 text-white'}`}>{qtdDiferencas}</span>}
                            {id === 'login' && qtdExcecoesTotal > 0 && <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] flex items-center justify-center ${modo === id ? 'bg-white text-blue-700' : 'bg-amber-500 text-white'}`}>{qtdExcecoesTotal}</span>}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={tx('Buscar por número ou nome...')}
                            className="h-9 w-[min(260px,70vw)] pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-[12px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800/60 dark:border-slate-700 dark:text-white" />
                    </div>
                    <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} aria-label={tx('Tipo de permissão')}
                        className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                        <option value="todas">{tx('Todas')}</option>
                        <option value="ver">{tx('Telas e abas')}</option>
                        <option value="fazer">{tx('Ações')}</option>
                    </select>
                    <button type="button" onClick={() => setHistoricoAberto(true)} disabled={semTabelas}
                        className="h-9 px-3 rounded-xl border border-slate-200 text-[11px] font-black uppercase tracking-widest text-slate-600 inline-flex items-center gap-1.5 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                        <History className="w-3.5 h-3.5" />{tx('Histórico')}
                    </button>
                    {modo === 'nivel' && qtdMudancas > 0 && (
                        <button type="button" onClick={voltarTudoAoPadrao} disabled={gravando === 'tudo'}
                            className="h-9 px-3 rounded-xl border border-slate-200 text-[11px] font-black uppercase tracking-widest text-slate-600 inline-flex items-center gap-1.5 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                            <RotateCcw className="w-3.5 h-3.5" />{tx('Voltar ao padrão')} ({qtdMudancas})
                        </button>
                    )}
                </div>
            </div>

            {historicoAberto && <HistoricoPermissoes usuarios={usuarios} fechar={() => setHistoricoAberto(false)} />}

            {semTabelas && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[12px] font-bold text-amber-800 flex items-start gap-2 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{tx('As tabelas de permissões ainda não existem no banco. A tela mostra o padrão do sistema; para gravar mudanças, rode no Supabase (SQL Editor) o arquivo sql/2026-11-06-permissoes/1_tabelas_permissoes.sql.')}</span>
                </div>
            )}

            {!semTabelas && !bancoPronto && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[12px] font-bold text-amber-800 flex items-start gap-2 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{tx('As telas e abas já podem ser mudadas. As ações que o banco também confere (ícone de banco) ficam travadas até rodar no Supabase (SQL Editor) os arquivos de sql/2026-11-06-permissoes-acoes/.')}</span>
                </div>
            )}

            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-[12px] font-semibold text-slate-600 flex items-start gap-2 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-slate-300">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                <span>
                    {modo === 'diferencas'
                        ? tx('Tudo o que foi mudado em relação ao padrão do sistema, por nível e por login. "Voltar ao padrão" desfaz só aquela mudança.')
                        : modo === 'nivel'
                        ? tx('Ligue ou desligue o que cada nível vê e faz. A permissão diz O QUE a pessoa pode; a unidade continua dizendo ONDE (o Mentor só nas unidades dele, o Líder e a Recepção só na deles). Bolinha amarela = mudado em relação ao padrão. O cadeado = travado. Ícone de banco = o banco também confere.')
                        : tx('Escolha um login para liberar ou bloquear uma permissão só para ele, sem mudar o nível inteiro. "Padrão" segue o que está marcado para o nível dele.')}
                </span>
            </div>

            {modo === 'login' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-3 dark:bg-slate-900 dark:border-slate-800">
                    <label htmlFor="perm-login" className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{tx('Login')}</label>
                    <select id="perm-login" value={loginEscolhido} onChange={(e) => setLoginEscolhido(e.target.value)}
                        className="h-10 min-w-[min(360px,100%)] px-3 rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white">
                        <option value="">{tx('Selecione um login...')}</option>
                        {logins.map(u => {
                            const qtd = qtdExcecoes(emailDe(u));
                            return (
                                <option key={emailDe(u)} value={emailDe(u)}>
                                    {(u.nome || u.email)} · {tx(NOME_PAPEL[papelDe(u)] || papelDe(u))}{u.unidade ? ` · ${u.unidade}` : ''}{qtd > 0 ? ` · ${tx('{qtd} exceções', { qtd })}` : ''}
                                </option>
                            );
                        })}
                    </select>
                    {login && <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{login.email}</span>}
                    {login && (
                        <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-2">
                            <Copy className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                            <select value={origemCopia} onChange={(e) => setOrigemCopia(e.target.value)} aria-label={tx('Copiar exceções de outro login')}
                                className="h-9 min-w-[min(260px,100%)] px-3 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                                <option value="">{tx('Copiar exceções de outro login...')}</option>
                                {logins.filter(u => emailDe(u) !== emailDe(login) && qtdExcecoes(emailDe(u)) > 0).map(u => (
                                    <option key={emailDe(u)} value={emailDe(u)}>{(u.nome || u.email)} · {tx(NOME_PAPEL[papelDe(u)] || papelDe(u))} · {tx('{qtd} exceções', { qtd: qtdExcecoes(emailDe(u)) })}</option>
                                ))}
                            </select>
                            <button type="button" onClick={copiarExcecoes} disabled={!origemCopia || gravando === 'copia'}
                                className="h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 disabled:opacity-40">
                                {gravando === 'copia' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}{tx('Copiar')}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {carregando ? (
                <div className="py-16 flex items-center justify-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : modo === 'diferencas' ? (
                <DiferencasPadrao regras={regras} excecoes={excecoes} usuarios={usuarios} termo={termo} bancoPronto={bancoPronto} gravando={gravando}
                    onVoltarNivel={voltarNivelPadrao} onVoltarExcecao={voltarExcecaoPadrao} />
            ) : modo === 'login' && !login ? (
                <p className="py-10 text-center text-[11px] font-black uppercase tracking-widest text-slate-400">{tx('Escolha um login acima.')}</p>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full min-w-[720px] text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-800">
                                <tr>
                                    <th className={`${th} w-16`}>{tx('Nº')}</th>
                                    <th className={th}>{tx('Permissão')}</th>
                                    <th className={th}>{tx('Tipo')}</th>
                                    {modo === 'nivel'
                                        ? PAPEIS.map(papel => <th key={papel} className={`${th} text-center`}>{tx(NOME_PAPEL[papel])}</th>)
                                        : <th className={`${th} text-center`}>{tx('Para {nome}', { nome: login?.nome || login?.email || '' })}</th>}
                                </tr>
                            </thead>
                            {grupos.map(g => (
                                <tbody key={g.centena}>
                                    <tr className="bg-slate-50/70 dark:bg-slate-800/40">
                                        <td colSpan={modo === 'nivel' ? 3 + PAPEIS.length : 4} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">
                                            {String(g.centena).padStart(1, '0')}xx · {tx(g.nome)}
                                        </td>
                                    </tr>
                                    {g.itens.map(p => (
                                        <tr key={p.codigo} className="border-t border-slate-100 dark:border-slate-800">
                                            <td className="px-3 py-2"><span className="font-mono text-[12px] font-black text-slate-700 dark:text-slate-200">{p.codigo}</span></td>
                                            <td className="px-3 py-2">
                                                <p className="text-[13px] font-bold text-slate-800 dark:text-white">{tx(p.nome)}</p>
                                                {p.descricao && <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tx(p.descricao)}</p>}
                                            </td>
                                            <td className="px-3 py-2">
                                                {p.tipo === 'ver'
                                                    ? <span className="h-5 px-2 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-black uppercase tracking-wide inline-flex items-center dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30">{tx('Tela/aba')}</span>
                                                    : <span className="h-5 px-2 rounded-md bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-black uppercase tracking-wide inline-flex items-center dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700" title={p.banco ? tx('O banco também confere esta ação.') : undefined}>{tx('Ação')}{p.banco && <Database className="w-3 h-3 ml-1 opacity-70" aria-label={tx('O banco também confere esta ação.')} />}</span>}
                                            </td>
                                            {modo === 'nivel' ? PAPEIS.map(papel => {
                                                const ligado = valorNivel(p, papel);
                                                const k = `${papel}|${p.codigo}`;
                                                return (
                                                    <td key={papel} className="px-3 py-2 text-center">
                                                        {podeMudar(p, papel, bancoPronto)
                                                            ? <Chave ligado={ligado} alterado={regras.has(k)} disabled={gravando === k}
                                                                rotulo={tx('{codigo} para {papel}: {estado}', { codigo: p.codigo, papel: tx(NOME_PAPEL[papel]), estado: ligado ? tx('ligada') : tx('desligada') })}
                                                                onClick={() => mudarNivel(p, papel)} />
                                                            : <Travado ligado={p.padrao.includes(papel)} motivo={motivoTrava(p, papel, bancoPronto)} />}
                                                    </td>
                                                );
                                            }) : (() => {
                                                const papel = papelDe(login);
                                                const k = `${emailDe(login)}|${p.codigo}`;
                                                const doNivel = valorNivel(p, papel);
                                                if (!podeMudar(p, papel, bancoPronto)) return <td className="px-3 py-2 text-center"><Travado ligado={p.padrao.includes(papel)} motivo={motivoTrava(p, papel, bancoPronto)} /></td>;
                                                const atual = excecoes.has(k) ? (excecoes.get(k) ? 'liberar' : 'bloquear') : 'padrao';
                                                return (
                                                    <td className="px-3 py-2">
                                                        <div className="flex justify-center">
                                                            <div className="inline-flex bg-slate-100 p-0.5 rounded-lg gap-0.5 dark:bg-slate-800" role="group" aria-label={tx('Exceção para {codigo}', { codigo: p.codigo })}>
                                                                {[
                                                                    ['padrao', `${tx('Padrão')} (${doNivel ? tx('sim') : tx('não')})`, 'bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-white'],
                                                                    ['liberar', tx('Liberar'), 'bg-emerald-600 text-white shadow-sm'],
                                                                    ['bloquear', tx('Bloquear'), 'bg-rose-600 text-white shadow-sm'],
                                                                ].map(([id, rotulo, corAtiva]) => (
                                                                    <button key={id} type="button" aria-pressed={atual === id} disabled={gravando === k}
                                                                        onClick={() => atual !== id && mudarExcecao(p, id)}
                                                                        className={`h-7 px-2.5 rounded-md text-[10px] font-black uppercase tracking-wide whitespace-nowrap transition-colors ${atual === id ? corAtiva : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
                                                                        {rotulo}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                );
                                            })()}
                                        </tr>
                                    ))}
                                </tbody>
                            ))}
                        </table>
                    </div>
                    {grupos.length === 0 && <p className="py-10 text-center text-[11px] font-black uppercase tracking-widest text-slate-400">{tx('Nenhuma permissão encontrada.')}</p>}
                </div>
            )}
        </div>
    );
};

export default AbaPermissoes;
