import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, Bell, Sun, Moon, Monitor, Menu, Globe, Building2, ChevronDown, Check } from 'lucide-react';
import LanguageSwitcher from '../LanguageSwitcher.jsx';
import CommandPalette from './CommandPalette.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { tx } from '../../i18n/traduzir.js';

// ---------- Textos (com português de reserva: nunca aparece chave crua na tela) ----------
const TITULOS = {
    lancamento: ['navigation.newSale', 'Nova Venda', 'Lançamento e atribuição'],
    assinaturas: ['navigation.history', 'Histórico', 'Vendas realizadas'],
    analise: ['navigation.dashboard', 'Dashboard', 'Métricas e resultados'],
    fechamento: ['navigation.closing', 'Fechamento', 'Conferência de caixa'],
    crm: ['navigation.crm', 'CRM', 'Gestão de visitantes e contatos'],
    alunos: ['navigation.students', 'Alunos', 'Gerencie sua base de alunos'],
    avaliacao: ['navigation.assessment', 'Avaliação', 'Módulo de bioimpedância'],
    cadastros: ['navigation.management', 'Cadastros', 'Gestão de planos e produtos'],
    comunicados: ['navigation.communications', 'Comunicados', 'Comunicação corporativa'],
    config: ['navigation.settings', 'Configurações', 'Ajustes do sistema'],
};

const TEMAS = [
    { id: 'light', icone: Sun, chave: 'sidebar.lightMode', padrao: 'Claro' },
    { id: 'dark', icone: Moon, chave: 'sidebar.darkMode', padrao: 'Escuro' },
    { id: 'system', icone: Monitor, chave: 'topbar.themeSystem', padrao: 'Automático' },
];
const PROXIMO_TEMA = { light: 'dark', dark: 'system', system: 'light' };

const normalizar = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
const ehCampoDeTexto = (el) => !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

// ---------- Seletor de unidade (mesmo comportamento do que estava na Sidebar) ----------
function SeletorUnidadeTopo({ unidadeGlobal, setUnidadeGlobal, unidades, tr, rotuloTodas }) {
    const [aberto, setAberto] = useState(false);
    const [busca, setBusca] = useState('');
    const ref = useRef(null);
    const inputRef = useRef(null);

    const fechar = useCallback(() => { setAberto(false); setBusca(''); }, []);

    useEffect(() => {
        if (!aberto) return undefined;
        const aoClicar = (e) => { if (ref.current && !ref.current.contains(e.target)) fechar(); };
        const aoTeclar = (e) => { if (e.key === 'Escape') fechar(); };
        document.addEventListener('mousedown', aoClicar);
        document.addEventListener('keydown', aoTeclar);
        const raf = requestAnimationFrame(() => inputRef.current?.focus());
        return () => {
            cancelAnimationFrame(raf);
            document.removeEventListener('mousedown', aoClicar);
            document.removeEventListener('keydown', aoTeclar);
        };
    }, [aberto, fechar]);

    const filtradas = useMemo(() => {
        const termo = normalizar(busca);
        const lista = (unidades || []).filter((u) => u && u.nome);
        return termo ? lista.filter((u) => normalizar(u.nome).includes(termo)) : lista;
    }, [busca, unidades]);

    const ehGlobal = !unidadeGlobal || unidadeGlobal === 'TODAS';
    // Mentor vê "Todas as minhas unidades" (só as dele); Admin vê "Visão Global"
    const rotuloGlobal = rotuloTodas || tr('topbar.globalView', 'Visão Global');
    const rotuloAtual = ehGlobal ? rotuloGlobal : unidadeGlobal;
    const IconeAtual = ehGlobal ? Globe : Building2;
    const mostrarOpcaoGlobal = !busca.trim();

    const escolher = (valor) => { setUnidadeGlobal(valor); fechar(); };

    // Enter na busca escolhe a primeira unidade encontrada
    const aoTeclarNaBusca = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (filtradas[0]) escolher(filtradas[0].nome);
        }
    };

    const itemBase = 'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
    const itemAtivo = 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300';
    const itemNormal = 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5';

    return (
        <div className="relative mt-0.5" ref={ref}>
            <button
                type="button"
                onClick={() => setAberto((a) => !a)}
                aria-haspopup="listbox"
                aria-expanded={aberto}
                title={tr('topbar.changeUnit', 'Trocar unidade')}
                className="inline-flex items-center gap-1 max-w-[220px] px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
                <IconeAtual className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{rotuloAtual}</span>
                <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {aberto && (
                <div className="absolute left-0 top-full mt-2 w-72 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden motion-safe:animate-[fadeIn_0.12s_ease-out]">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                onKeyDown={aoTeclarNaBusca}
                                placeholder={tr('topbar.searchUnit', 'Buscar unidade...')}
                                className="w-full pl-8 pr-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[13px] text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto custom-scrollbar p-1.5" role="listbox">
                        {mostrarOpcaoGlobal && (
                            <button type="button" role="option" aria-selected={ehGlobal} onClick={() => escolher('TODAS')} className={`${itemBase} font-semibold ${ehGlobal ? itemAtivo : itemNormal}`}>
                                <Globe className="w-4 h-4 shrink-0" aria-hidden="true" />
                                <span className="flex-1 truncate">{rotuloGlobal}</span>
                                {ehGlobal && <Check className="w-4 h-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />}
                            </button>
                        )}
                        {mostrarOpcaoGlobal && filtradas.length > 0 && <div className="h-px bg-slate-100 dark:bg-slate-700 my-1.5 mx-1" />}
                        {filtradas.map((u) => {
                            const selecionada = !ehGlobal && u.nome === unidadeGlobal;
                            return (
                                <button key={u.id ?? u.nome} type="button" role="option" aria-selected={selecionada} onClick={() => escolher(u.nome)} className={`${itemBase} font-medium ${selecionada ? itemAtivo : itemNormal}`}>
                                    <Building2 className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
                                    <span className="flex-1 truncate">{u.nome}</span>
                                    {selecionada && <Check className="w-4 h-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />}
                                </button>
                            );
                        })}
                        {filtradas.length === 0 && (
                            <p className="px-3 py-4 text-center text-[12px] font-medium text-slate-400">{tr('topbar.noUnit', 'Nenhuma unidade encontrada')}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ---------- TopBar ----------
export default function TopBar({
    activeTab,
    usuarioLogado,
    theme,
    setTheme,
    onAbrirMenuMobile,
    onSelecionarAlunoGlobal,
    pendentesTotais = 0,
    onNavigate,
    // Novas (opcionais) — vêm do App, as mesmas que já vão para a Sidebar:
    podeTrocarUnidade,
    unidadeGlobal,
    setUnidadeGlobal,
    unidades = [],
    rotuloTodas,
}) {
    const { t } = useI18n();

    // Tradução com reserva: se a chave não existir no arquivo de idiomas, mostra o texto em português
    const tr = useCallback((chave, padrao) => {
        const res = t(chave);
        return res && res !== chave && String(res).trim() !== '' ? res : padrao;
    }, [t]);

    const [searchOpen, setSearchOpen] = useState(false);

    const isMac = useMemo(() => {
        if (typeof navigator === 'undefined') return false;
        const p = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
        return /mac|iphone|ipad/i.test(p);
    }, []);

    useEffect(() => {
        const aoTeclar = (e) => {
            if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setSearchOpen((aberto) => !aberto);
                return;
            }
            if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !ehCampoDeTexto(document.activeElement)) {
                e.preventDefault();
                setSearchOpen(true);
            }
        };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, []);

    const info = TITULOS[activeTab];
    const titulo = info ? tr(info[0], info[1]) : tr('topbar.defaultTitle', 'Pratique Vendas');
    const subtitulo = info ? tr(`topbar.subtitle.${activeTab}`, info[2]) : tr('topbar.defaultSubtitle', 'Sistema operacional');

    // Quem pode trocar de unidade vem do App (cargo real). Reserva: calcula pelo cargo recebido.
    const roleRecebida = String(usuarioLogado?.role || '').toUpperCase().trim();
    const mostrarSeletor = (podeTrocarUnidade ?? (roleRecebida === 'ADMIN' || roleRecebida === 'MENTOR')) && typeof setUnidadeGlobal === 'function';

    const temaAtual = TEMAS.find((x) => x.id === theme) || TEMAS[2];
    const IconeTemaAtual = temaAtual.icone;
    const rotuloTema = tr('topbar.theme', 'Tema');

    const fecharBusca = useCallback(() => setSearchOpen(false), []);

    const tituloSino = pendentesTotais > 0
        ? `${pendentesTotais} ${tr('topbar.pendingCommunications', 'comunicados pendentes')}`
        : tr('topbar.noPendingCommunications', 'Nenhum comunicado pendente');

    const botaoIcone = 'w-8 h-8 flex items-center justify-center rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

    return (
        <>
            <header className="shrink-0 h-[60px] bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 px-4 lg:px-6 z-20 transition-colors">

                {/* Esquerda: menu mobile + título + seletor de unidade */}
                <div className="flex items-center gap-4 sm:min-w-[200px]">
                    <button
                        type="button"
                        onClick={onAbrirMenuMobile}
                        aria-label={tr('header.mainMenu', 'Menu Principal')}
                        className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <div className="hidden sm:flex flex-col min-w-0">
                        <h2 className="text-[16px] font-black text-slate-800 dark:text-white leading-none tracking-tight truncate">{tx(titulo)}</h2>
                        {mostrarSeletor ? (
                            <SeletorUnidadeTopo
                                unidadeGlobal={unidadeGlobal}
                                setUnidadeGlobal={setUnidadeGlobal}
                                unidades={unidades}
                                tr={tr}
                                rotuloTodas={rotuloTodas}
                            />
                        ) : (
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 truncate">{tx(subtitulo)}</span>
                        )}
                    </div>
                </div>

                {/* Centro: abre a busca (Ctrl+K) */}
                <div className="flex-1 max-w-xl px-1 sm:px-2 xl:px-12">
                    <button
                        type="button"
                        onClick={() => setSearchOpen(true)}
                        aria-label={tr('topbar.searchOpen', 'Abrir busca')}
                        aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
                        className="w-full flex items-center justify-between px-3 sm:px-4 py-2 bg-slate-100/70 dark:bg-slate-800/50 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 transition-colors border border-slate-200/50 dark:border-slate-700/50 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 shadow-inner"
                    >
                        <span className="flex items-center gap-2.5 min-w-0">
                            <Search className="w-4 h-4 shrink-0" />
                            <span className="text-[13px] font-semibold truncate hidden sm:inline">{tr('topbar.searchPlaceholder', 'Buscar aluno por nome, CPF ou matrícula...')}</span>
                            <span className="text-[13px] font-semibold truncate sm:hidden">{tr('topbar.searchShort', 'Buscar...')}</span>
                        </span>
                        <span className="hidden lg:flex items-center gap-1 shrink-0">
                            <kbd className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-[10px] font-black border border-slate-200 dark:border-slate-700 shadow-sm">{isMac ? '⌘' : tx("Ctrl")}</kbd>
                            <kbd className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-[10px] font-black border border-slate-200 dark:border-slate-700 shadow-sm">K</kbd>
                        </span>
                    </button>
                </div>

                {/* Direita: idioma, tema, comunicados */}
                <div className="flex items-center justify-end gap-1.5 sm:gap-2 sm:min-w-[120px]">
                    <div className="flex items-center justify-center">
                        <LanguageSwitcher compact={true} posicao="abaixo-direita" />
                    </div>

                    <div role="group" aria-label={rotuloTema} className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                        {TEMAS.map(({ id, icone: Icone, chave, padrao }) => {
                            const ativo = theme === id;
                            const rotulo = tr(chave, padrao);
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setTheme?.(id)}
                                    aria-pressed={ativo}
                                    title={rotulo}
                                    aria-label={rotulo}
                                    className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${ativo
                                        ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                                >
                                    <Icone className="w-3.5 h-3.5" strokeWidth={2.5} />
                                </button>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        onClick={() => setTheme?.(PROXIMO_TEMA[theme] || 'light')}
                        title={`${rotuloTema}: ${tr(temaAtual.chave, temaAtual.padrao)}`}
                        aria-label={`${rotuloTema}: ${tr(temaAtual.chave, temaAtual.padrao)}`}
                        className={`md:hidden ${botaoIcone}`}
                    >
                        <IconeTemaAtual className="w-[18px] h-[18px]" strokeWidth={2.5} />
                    </button>

                    <button type="button" onClick={() => onNavigate?.('comunicados')} title={tituloSino} aria-label={tituloSino} className={`relative ${botaoIcone}`}>
                        <Bell className="w-[18px] h-[18px]" strokeWidth={2.5} />
                        {pendentesTotais > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center" aria-hidden="true">
                                {pendentesTotais > 99 ? '99+' : pendentesTotais}
                            </span>
                        )}
                    </button>
                </div>
            </header>

            {/* Mesmas props que o seu CommandPalette atual já usa: nada muda na busca */}
            <CommandPalette
                isOpen={searchOpen}
                onClose={fecharBusca}
                onSelectAluno={onSelecionarAlunoGlobal}
                usuarioLogado={usuarioLogado}
            />
        </>
    );
}