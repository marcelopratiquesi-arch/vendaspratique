import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { 
    PanelLeftClose, PanelLeftOpen, Plus, Building2, Check, Globe, ChevronsUpDown, Search, X, Settings, LogOut, Zap
} from 'lucide-react';

const useFecharAoClicarFora = (ref, aberto, fechar) => {
    useEffect(() => {
        if (!aberto) return;
        const aoClicar = (e) => { if (ref.current && !ref.current.contains(e.target)) fechar(); };
        const aoTeclar = (e) => { if (e.key === 'Escape') fechar(); };
        document.addEventListener('mousedown', aoClicar);
        document.addEventListener('keydown', aoTeclar);
        return () => {
            document.removeEventListener('mousedown', aoClicar);
            document.removeEventListener('keydown', aoTeclar);
        };
    }, [ref, aberto, fechar]);
};

const normalizarTexto = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

const traduzirRole = (role, t) => {
    const keys = {
        ADMIN: { chave: 'roles.admin', padrao: 'Administrador' },
        MENTOR: { chave: 'roles.mentor', padrao: 'Mentor' },
        LIDER: { chave: 'roles.leader', padrao: 'Líder de unidade' },
        RECEPCAO: { chave: 'roles.reception', padrao: 'Recepção' }
    };
    const c = keys[String(role).toUpperCase().trim()];
    if (!c) return role || '';
    
    const traduzido = t(c.chave);
    return (traduzido && traduzido !== c.chave) ? traduzido : c.padrao;
};

const SeletorUnidade = ({ unidadeGlobal, setUnidadeGlobal, unidades, recolhido, mostrarDica, esconderDica }) => {
    const { t } = useI18n();
    const [aberto, setAberto] = useState(false);
    const [busca, setBusca] = useState('');
    const ref = useRef(null);

    const fechar = useCallback(() => { setAberto(false); setBusca(''); }, []);
    useFecharAoClicarFora(ref, aberto, fechar);

    const filtradas = useMemo(() => {
        const termo = normalizarTexto(busca);
        const lista = (unidades || []).filter((u) => u && u.nome);
        if (!termo) return lista;
        return lista.filter((u) => normalizarTexto(u.nome).includes(termo));
    }, [busca, unidades]);

    const ehGlobal = unidadeGlobal === 'TODAS';
    const rotuloGlobal = 'Visão Global';
    const rotuloAtual = ehGlobal ? rotuloGlobal : unidadeGlobal;
    const mostrarOpcaoGlobal = !busca.trim();
    const IconeAtual = ehGlobal ? Globe : Building2;

    return (
        <div className="relative mb-4" ref={ref}>
            {recolhido ? (
                <button
                    onClick={() => { esconderDica(); setAberto(!aberto); }}
                    onMouseEnter={(e) => { if (!aberto) mostrarDica(e, rotuloAtual); }}
                    onMouseLeave={esconderDica}
                    className="w-11 h-11 mx-auto rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                    <IconeAtual className="w-[18px] h-[18px]" />
                </button>
            ) : (
                <button onClick={() => setAberto(!aberto)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 px-3 py-2.5 flex items-center justify-between gap-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-slate-900 dark:text-white truncate">{rotuloAtual}</span>
                    </span>
                    <ChevronsUpDown className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
            )}

            {aberto && (
                <div className={`absolute z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden ${recolhido ? 'left-full top-0 ml-3 w-64' : 'left-0 right-0 top-full mt-2'}`}>
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar unidade..." className="w-full pl-8 pr-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[13px] text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto custom-scrollbar p-1.5">
                        {mostrarOpcaoGlobal && (
                            <button onClick={() => { setUnidadeGlobal('TODAS'); fechar(); }} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-[13px] font-semibold transition-colors ${ehGlobal ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                                <Globe className="w-4 h-4 shrink-0" />
                                <span className="flex-1 truncate">{rotuloGlobal}</span>
                                {ehGlobal && <Check className="w-4 h-4 shrink-0" strokeWidth={2.5} />}
                            </button>
                        )}
                        {mostrarOpcaoGlobal && filtradas.length > 0 && <div className="h-px bg-slate-100 dark:bg-slate-700 my-1.5 mx-1" />}
                        {filtradas.map((u) => {
                            const selecionada = !ehGlobal && u.nome === unidadeGlobal;
                            return (
                                <button key={u.id ?? u.nome} onClick={() => { setUnidadeGlobal(u.nome); fechar(); }} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-[13px] font-medium transition-colors ${selecionada ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                                    <Building2 className="w-4 h-4 shrink-0 text-slate-400" />
                                    <span className="flex-1 truncate">{u.nome}</span>
                                    {selecionada && <Check className="w-4 h-4 shrink-0" strokeWidth={2.5} />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const ItemMenu = ({ tab, ativo, recolhido, onClick, mostrarDica, esconderDica }) => {
    const Icone = tab.icon;
    const qtdBadge = Number(tab.badge) || 0;
    const temBadge = qtdBadge > 0;
    const textoBadge = qtdBadge > 99 ? '99+' : String(qtdBadge);
    
    return (
        <button 
            onClick={onClick} 
            onMouseEnter={(e) => mostrarDica(e, temBadge ? `${tab.label} (${textoBadge})` : tab.label)} 
            onMouseLeave={esconderDica} 
            className={`relative flex items-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                recolhido 
                ? 'justify-center w-10 h-10 mx-auto rounded-xl' 
                : `w-full gap-3 pl-[9px] pr-3 py-2 text-left border-l-[3px] ${ativo ? 'rounded-r-xl border-blue-600 dark:border-blue-400' : 'rounded-xl border-transparent'}`
            } ${ativo ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}`}
        >
            <Icone className="w-[18px] h-[18px] shrink-0" strokeWidth={ativo ? 2.4 : 2} />
            {!recolhido && (
                <>
                    <span className="flex-1 truncate text-[13px] font-semibold">{tab.label}</span>
                    {temBadge && <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center shadow-sm">{textoBadge}</span>}
                </>
            )}
            {recolhido && temBadge && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900">{textoBadge}</span>}
        </button>
    );
};

const BotaoNovaVenda = ({ tab, ativo, recolhido, onClick, mostrarDica, esconderDica }) => (
    <button 
        onClick={onClick} 
        onMouseEnter={(e) => mostrarDica(e, tab.label)} 
        onMouseLeave={esconderDica} 
        className={`flex items-center justify-center gap-2 mb-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 dark:focus-visible:ring-offset-slate-900 ${
            recolhido ? 'w-10 h-10 mx-auto rounded-xl' : 'w-full h-10 rounded-xl text-[13px]'
        } ${ativo ? 'ring-2 ring-blue-300 dark:ring-blue-500/50' : ''}`}
    >
        <Plus className="w-[18px] h-[18px]" strokeWidth={2.5} />
        {!recolhido && <span>{tab.label}</span>}
    </button>
);

const ConteudoSidebar = ({ modo, recolhido, podeRecolher, setIsCollapsed, onFecharMobile, abasPermitidas = [], activeTab, setActiveTab, ehChefe, unidadeGlobal, setUnidadeGlobal, unidades, usuarioLogado, handleLogout }) => {
    const { t } = useI18n();
    const [dica, setDica] = useState(null);
    
    const mostrarDica = useCallback((e, texto) => { if (!recolhido || !texto) return; const r = e.currentTarget.getBoundingClientRect(); setDica({ texto, top: r.top + r.height / 2, left: r.right + 12 }); }, [recolhido]);
    const esconderDica = useCallback(() => setDica(null), []);
    useEffect(() => { if (!recolhido) setDica(null); }, [recolhido]);

    const navegar = (id) => { esconderDica(); setActiveTab(id); if (modo === 'mobile' && onFecharMobile) onFecharMobile(); };

    const abaDestaque = abasPermitidas.find(a => a.id === 'lancamento');
    const abaConfig = abasPermitidas.find(a => a.id === 'config');
    const abasRestantes = abasPermitidas.filter(a => a.id !== 'lancamento' && a.id !== 'config');

    const grupos = [
        { id: 'op', nome: 'Operação', abas: abasRestantes.filter(a => ['assinaturas', 'fechamento'].includes(a.id)) },
        { id: 'rel', nome: 'Relacionamento', abas: abasRestantes.filter(a => ['crm', 'alunos', 'avaliacao'].includes(a.id)) },
        { id: 'ges', nome: 'Gestão', abas: abasRestantes.filter(a => ['analise', 'comunicados', 'cadastros'].includes(a.id)) }
    ];

    const papel = traduzirRole(usuarioLogado?.role, t);
    const inicial = String(usuarioLogado?.nome || 'U').charAt(0).toUpperCase();

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#0c101a]">
            
            <div className={`shrink-0 ${recolhido ? 'px-2 pt-4 pb-4 flex flex-col items-center gap-3' : 'px-4 pt-4 pb-4 flex items-center justify-between gap-2'}`}>
                
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-[11px] bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                        <Zap className="w-[20px] h-[20px]" fill="currentColor" strokeWidth={1} />
                    </div>
                    {!recolhido && (
                        <div className="flex flex-col min-w-0 mt-0.5">
                            <h1 className="text-[18px] font-black text-slate-900 dark:text-white leading-none tracking-[-0.02em] uppercase">Pratique</h1>
                            <h2 className="text-[10.5px] font-black text-blue-600 dark:text-blue-400 tracking-[0.22em] mt-1.5 leading-none">VENDAS</h2>
                        </div>
                    )}
                </div>

                {modo === 'desktop' && podeRecolher && (
                    <button onClick={() => { esconderDica(); setIsCollapsed(!recolhido); }} onMouseEnter={(e) => recolhido && mostrarDica(e, 'Expandir menu')} onMouseLeave={esconderDica} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        {recolhido ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
                    </button>
                )}
                {modo === 'mobile' && (
                    <button onClick={onFecharMobile} className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className={`shrink-0 flex-1 overflow-y-auto custom-scrollbar pb-4 ${recolhido ? 'px-2' : 'px-3'}`} onScroll={esconderDica}>
                
                {/* No computador o seletor de unidade agora fica no TopBar. No celular continua aqui, porque o topo não tem espaço. */}
                {ehChefe && modo === 'mobile' && (
                    <SeletorUnidade unidadeGlobal={unidadeGlobal} setUnidadeGlobal={setUnidadeGlobal} unidades={unidades} recolhido={recolhido} mostrarDica={mostrarDica} esconderDica={esconderDica} />
                )}

                {abaDestaque && (
                    <BotaoNovaVenda tab={abaDestaque} ativo={activeTab === abaDestaque.id} recolhido={recolhido} onClick={() => navegar(abaDestaque.id)} mostrarDica={mostrarDica} esconderDica={esconderDica} />
                )}

                {grupos.map((grupo, idx) => {
                    if (grupo.abas.length === 0) return null;
                    return (
                        <div key={grupo.id} className={idx === 0 ? '' : 'pt-2'}>
                            {recolhido ? (
                                idx > 0 && <div className="h-px bg-slate-200 dark:bg-slate-800 mx-2 mb-3" />
                            ) : (
                                <p className="px-3 pb-1.5 text-[10px] font-bold tracking-widest uppercase text-slate-400 dark:text-slate-500">{grupo.nome}</p>
                            )}
                            <div className="space-y-1">
                                {grupo.abas.map(tab => (
                                    <ItemMenu key={tab.id} tab={tab} ativo={activeTab === tab.id} recolhido={recolhido} onClick={() => navegar(tab.id)} mostrarDica={mostrarDica} esconderDica={esconderDica} />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className={`shrink-0 border-t border-slate-200 dark:border-slate-800 ${recolhido ? 'px-2 py-3' : 'px-3 py-3'}`}>
                {abaConfig && (
                    <div className="mb-2">
                        <ItemMenu tab={abaConfig} ativo={activeTab === abaConfig.id} recolhido={recolhido} onClick={() => navegar(abaConfig.id)} mostrarDica={mostrarDica} esconderDica={esconderDica} />
                    </div>
                )}
                
                <div className={`flex items-center gap-3 ${recolhido ? 'justify-center flex-col' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-sm font-black border border-slate-200 dark:border-slate-700 shrink-0 shadow-sm">
                        {inicial}
                    </div>
                    
                    {!recolhido && (
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <span className="text-[13px] font-bold text-slate-900 dark:text-white uppercase truncate">{usuarioLogado?.nome}</span>
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">{papel}</span>
                        </div>
                    )}
                    
                    <button 
                        onClick={handleLogout}
                        title="Sair do sistema"
                        className={`text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 outline-none focus-visible:ring-2 focus-visible:ring-rose-500 shrink-0 ${recolhido ? 'mt-2' : ''}`}
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {dica && (
                <div className="fixed z-[200] -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold shadow-lg pointer-events-none whitespace-nowrap" style={{ top: dica.top, left: dica.left }}>
                    {dica.texto}
                </div>
            )}
        </div>
    );
};

export function SidebarDesktop(props) {
    const [telaMedia, setTelaMedia] = useState(false);
    useEffect(() => {
        const mql = window.matchMedia('(min-width: 1024px) and (max-width: 1279px)');
        setTelaMedia(mql.matches);
        const handler = (e) => setTelaMedia(e.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, []);

    const recolhido = Boolean(props.isCollapsed) || telaMedia;
    return (
        <aside className={`hidden lg:flex flex-col h-full shrink-0 relative z-30 bg-white dark:bg-[#0c101a] border-r border-slate-200 dark:border-slate-800 transition-[width] duration-200 ease-out ${recolhido ? 'w-[72px]' : 'w-[232px]'}`}>
            <ConteudoSidebar {...props} modo="desktop" recolhido={recolhido} podeRecolher={!telaMedia} />
        </aside>
    );
}

export function SidebarMobile(props) {
    if (!props.isMobileMenuOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] lg:hidden">
            <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/60 animate-[fadeIn_0.2s_ease-out]" onClick={props.fecharMobile} />
            <aside className="fixed top-0 left-0 w-[280px] max-w-[85vw] h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl animate-[slideRight_0.25s_ease-out]">
                <ConteudoSidebar {...props} modo="mobile" recolhido={false} podeRecolher={false} onFecharMobile={props.fecharMobile} />
            </aside>
        </div>
    );
}