import React from 'react';
import LanguageSwitcher from '../LanguageSwitcher.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { Zap, PanelLeftClose, PanelLeftOpen, Sun, Moon, LogOut, X } from 'lucide-react';

export function SidebarDesktop({
    isCollapsed, setIsCollapsed, theme, toggleTheme,
    usuarioLogado, handleLogout, abasPermitidas, activeTab, setActiveTab
}) {
    const { t } = useI18n();

    return (
        <aside className={`hidden xl:flex flex-col bg-white/60 dark:bg-[#0c101a]/70 backdrop-blur-3xl border-r border-slate-200/50 dark:border-white/5 h-full relative z-30 shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-2xl shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-[80px]' : 'w-[260px]'}`}>
            <div className={`h-[88px] flex items-center ${isCollapsed ? 'justify-center flex-col pt-2 gap-2' : 'justify-between px-5'} shrink-0 transition-all`}>
                {isCollapsed ? (
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0 mt-3 mb-1">
                        <Zap className="w-5 h-5" strokeWidth={2.5} />
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                            <Zap className="w-5 h-5" strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col pt-1">
                            <h1 className="text-[17px] font-black text-slate-900 dark:text-white tracking-tight leading-none">PRATIQUE</h1>
                            <h2 className="text-[11px] font-bold text-blue-600 dark:text-blue-500 tracking-[0.2em] mt-1">VENDAS</h2>
                        </div>
                    </div>
                )}
                {!isCollapsed && (
                    <button onClick={() => setIsCollapsed(true)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                        <PanelLeftClose className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className={`pt-2 pb-5 border-b border-slate-200/50 dark:border-white/5 flex shrink-0 ${isCollapsed ? 'justify-center px-0' : 'px-5'}`}>
                <LanguageSwitcher compact={isCollapsed} placement={isCollapsed ? 'right-top' : 'bottom-right'} />
            </div>

            <nav className="flex-1 overflow-y-auto custom-scrollbar py-6 px-3 space-y-1.5">
                {isCollapsed && (
                     <div className="flex justify-center mb-4">
                        <button onClick={() => setIsCollapsed(false)} className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" title="Expandir">
                            <PanelLeftOpen className="w-5 h-5" />
                        </button>
                     </div>
                )}
                {!isCollapsed && <p className="text-[10px] font-bold text-slate-500/80 dark:text-slate-500 uppercase tracking-widest mb-4 ml-3">Módulos</p>}
                
                {abasPermitidas.map(tab => {
                    const isActive = activeTab === tab.id;
                    const Icone = tab.icon;
                    const isConfig = tab.id === 'config';
                    return (
                        <React.Fragment key={tab.id}>
                            {isConfig && <div className="h-px bg-slate-200/50 dark:bg-white/5 my-4 mx-3"></div>}
                            <button 
                                onClick={() => setActiveTab(tab.id)} 
                                title={isCollapsed ? (tab.badge ? `${tab.label} (${tab.badge} pendentes)` : tab.label) : ''}
                                className={`flex items-center relative transition-all duration-200 group ${isCollapsed ? 'justify-center w-12 h-12 mx-auto rounded-xl' : 'gap-3.5 px-4 py-3.5 rounded-xl w-full text-left'} ${isActive ? 'bg-white dark:bg-blue-600/10 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-none border border-slate-200/50 dark:border-white/5 dark:border-l-2 dark:border-l-blue-500' : 'hover:bg-slate-200/50 dark:hover:bg-white/[0.03] border border-transparent'}`}
                            >
                                <Icone className={`w-[18px] h-[18px] shrink-0 transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} strokeWidth={isActive ? 2.5 : 2} />
                                
                                {/* Badge quando a Sidebar está RECOLHIDA */}
                                {isCollapsed && tab.badge && (
                                    <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                                    </span>
                                )}

                                {/* Label + Badge quando a Sidebar está ABERTA */}
                                {!isCollapsed && (
                                    <div className="flex items-center justify-between flex-1 truncate">
                                        <span className={`text-[13px] font-bold tracking-wide truncate ${isActive ? 'text-blue-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200'}`}>{tab.label}</span>
                                        {tab.badge && (
                                            <span className="ml-2 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                                                {tab.badge > 99 ? '99+' : tab.badge}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </button>
                        </React.Fragment>
                    );
                })}
            </nav>

            <div className={`p-4 border-t border-slate-200/50 dark:border-white/5 bg-slate-100/50 dark:bg-black/10 shrink-0 flex flex-col gap-3 transition-all`}>
                <div className="flex justify-center w-full">
                     <button onClick={toggleTheme} className={`flex items-center transition-all bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/5 shadow-sm rounded-xl overflow-hidden ${isCollapsed ? 'w-10 h-10 p-0 justify-center' : 'w-full p-1'}`} title="Trocar tema">
                        {!isCollapsed && (
                            <div className="flex w-full relative z-0">
                                <div className={`w-1/2 flex items-center justify-center py-1.5 rounded-lg z-10 transition-colors ${theme === 'light' ? 'bg-slate-100 text-slate-800 font-bold' : 'text-slate-500 hover:text-white'}`}>
                                    <Sun className="w-4 h-4 mr-1.5" /> <span className="text-[10px] uppercase tracking-wider">Claro</span>
                                </div>
                                <div className={`w-1/2 flex items-center justify-center py-1.5 rounded-lg z-10 transition-colors ${theme === 'dark' ? 'bg-slate-800 text-white font-bold' : 'text-slate-500 hover:text-slate-800'}`}>
                                    <Moon className="w-4 h-4 mr-1.5" /> <span className="text-[10px] uppercase tracking-wider">Escuro</span>
                                </div>
                            </div>
                        )}
                        {isCollapsed && (theme === 'light' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-blue-400" />)}
                    </button>
                </div>
                <div className={`flex items-center gap-3 mt-1 ${isCollapsed ? 'justify-center flex-col' : 'justify-between'}`}>
                    <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-slate-300 flex items-center justify-center font-black text-sm border border-slate-300 dark:border-white/10 shrink-0 shadow-inner" title={isCollapsed ? usuarioLogado.nome : ''}>
                        {usuarioLogado.nome.charAt(0)}
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-black text-slate-900 dark:text-white truncate" title={usuarioLogado.nome}>{usuarioLogado.nome}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">{usuarioLogado.role}</p>
                        </div>
                    )}
                    <button onClick={handleLogout} className={`text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors p-2.5 rounded-xl shrink-0 ${isCollapsed ? 'bg-slate-200/50 dark:bg-white/5' : ''}`} title={t('header.signOut')}>
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
}

export function SidebarMobile({
    isMobileMenuOpen, setIsMobileMenuOpen, theme, toggleTheme,
    usuarioLogado, handleLogout, abasPermitidas, activeTab, setActiveTab
}) {
    const { t } = useI18n();

    if (!isMobileMenuOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] xl:hidden">
            <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={() => setIsMobileMenuOpen(false)}></div>
            <aside className="fixed top-0 left-0 w-[280px] h-full bg-white/90 dark:bg-[#111827]/90 backdrop-blur-2xl border-r border-slate-200 dark:border-white/10 shadow-2xl flex flex-col animate-[slideRight_0.3s_ease-out] z-10">
                <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-[#090b11]/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-50 dark:bg-white/5 border border-blue-100 dark:border-white/10 rounded-lg flex items-center justify-center">
                            <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h1 className="text-sm font-black text-slate-900 dark:text-white tracking-widest">PRATIQUE</h1>
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="w-8 h-8 flex items-center justify-center bg-slate-200 dark:bg-white/5 text-slate-500 dark:text-slate-400 rounded-full hover:bg-rose-100 dark:hover:bg-rose-500/10 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="px-4 pt-4 pb-2">
                    <LanguageSwitcher />
                </div>
                <nav className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 ml-2">Menu</p>
                    {abasPermitidas.map(tab => {
                        const isActive = activeTab === tab.id;
                        const Icone = tab.icon;
                        return (
                            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${isActive ? 'bg-blue-50 text-blue-700 dark:bg-blue-600/10 dark:text-white border-l-2 border-blue-500' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 border-l-2 border-transparent'}`}>
                                <Icone className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                                <div className="flex items-center justify-between flex-1 truncate">
                                    <span>{tab.label}</span>
                                    {tab.badge && (
                                        <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                                            {tab.badge > 99 ? '99+' : tab.badge}
                                        </span>
                                    )}
                                </div>
                            </button>
                        )
                    })}
                </nav>
                <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-[#090b11]/50 flex items-center gap-3">
                    <button onClick={toggleTheme} className="p-3 bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/5 shadow-sm rounded-xl text-slate-500 hover:text-blue-500 transition-colors">
                        {theme === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0 ml-2">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{usuarioLogado.nome}</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{usuarioLogado.role}</p>
                    </div>
                    <button onClick={handleLogout} className="p-3 text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 bg-slate-200 dark:bg-white/5 rounded-xl">
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </aside>
        </div>
    );
}