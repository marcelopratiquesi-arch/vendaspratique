import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { buscarAlunosPaginado } from '../../pages/Alunos/utils.js';
import { getRecentes, addRecente, removerRecente, limparRecentes } from './recentesAlunos.js';
import { getCachedSearch, setCachedSearch, highlightText, mascararCpfExibicao } from './commandUtils.js';

const HighlightedText = ({ text, query }) => {
    const parts = highlightText(text, query);
    return (
        <span>
            {parts.map((p, i) => p.highlight ? <strong key={i} className="text-blue-600 dark:text-blue-400">{p.text}</strong> : p.text)}
        </span>
    );
};

export default function CommandPalette({ isOpen, onClose, onSelectAluno, usuarioLogado, unidadeGlobal }) {
    const { t } = useI18n();
    
    const safeT = useCallback((chave, padrao) => {
        const res = t(chave);
        return (res && String(res).trim() !== '' && res !== chave) ? res : padrao;
    }, [t]);

    const [termo, setTermo] = useState('');
    const [resultados, setResultados] = useState([]);
    const [recentes, setRecentes] = useState([]);
    const [buscando, setBuscando] = useState(false);
    const [erro, setErro] = useState('');
    const [indexFocado, setIndexFocado] = useState(0);
    
    const inputRef = useRef(null);
    const modalRef = useRef(null);
    const abortRef = useRef(null);
    const listaRef = useRef(null);

    const emailUsuario = usuarioLogado?.email || usuarioLogado?.user?.email || usuarioLogado?.id || 'local_user';
    const roleUsuario = String(usuarioLogado?.role || '').toUpperCase().trim();
    
    // 🔥 CORREÇÃO DA VISÃO GLOBAL: Se for chefe, respeita o filtro global do TopBar.
    const ehChefe = roleUsuario === 'ADMIN' || roleUsuario === 'MENTOR';
    const unidadeFiltroAtivo = ehChefe ? (unidadeGlobal || 'TODAS') : (usuarioLogado?.unidade || 'TODAS');
    const exibirBaloesUnidade = ehChefe && unidadeFiltroAtivo === 'TODAS';

    useEffect(() => {
        if (isOpen) {
            setTermo('');
            setIndexFocado(0);
            document.body.style.overflow = 'hidden';
            setRecentes(getRecentes(emailUsuario));
            setTimeout(() => inputRef.current?.focus(), 50);
        } else {
            document.body.style.overflow = '';
            if (abortRef.current) abortRef.current.abort();
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen, emailUsuario]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
        const handleClickOutside = (e) => {
            if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) return;
        const termoReal = termo.trim();
        
        if (termoReal.length < 2) {
            setResultados([]);
            setBuscando(false);
            setErro('');
            return;
        }

        const buscarBD = async () => {
            const cacheKey = `${termoReal}_${unidadeFiltroAtivo}_${roleUsuario}`;
            const cached = getCachedSearch(cacheKey);
            
            if (cached) setResultados(cached);
            else setBuscando(true);
            setErro('');

            if (abortRef.current) abortRef.current.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            try {
                const { alunos: rows } = await buscarAlunosPaginado({
                    busca: termoReal,
                    unidade: unidadeFiltroAtivo, 
                    plano: 'TODOS', dataInicio: '', dataFim: '', ordemColuna: 'nome', ordemDirecao: 'ASC', pagina: 1, limite: 8,
                    roleUsuario, unidadeUsuario: unidadeFiltroAtivo, signal: controller.signal
                });

                if (!controller.signal.aborted) {
                    setResultados(rows || []);
                    setCachedSearch(cacheKey, rows || []);
                    setErro(''); 
                }
            } catch (err) {
                if (controller.signal.aborted || err?.name === 'AbortError' || err?.message?.includes('abort')) {
                    return;
                }
                console.error("Erro na busca:", err);
                setErro(safeT('search.error', 'Não foi possível buscar agora. Tente novamente.'));
            } finally {
                if (!controller.signal.aborted) setBuscando(false);
            }
        };

        const timer = setTimeout(buscarBD, 200);
        return () => clearTimeout(timer);
    }, [termo, isOpen, unidadeFiltroAtivo, roleUsuario, safeT]);

    const itensNavegaveis = useMemo(() => {
        let list = [];
        if (!termo.trim()) {
            if (recentes.length > 0) {
                list.push({ type: 'header', label: 'Alunos recentes' });
                list.push(...recentes.map(r => ({ type: 'recente', data: r })));
            }
            return list;
        }

        if (resultados.length > 0) {
            list.push({ type: 'header', label: safeT('search.students', 'Resultados da Busca') });
            list.push(...resultados.map(r => ({ type: 'aluno', data: r })));
        }

        return list;
    }, [termo, recentes, resultados, safeT]);

    const handleKeyDown = (e) => {
        const selectableItens = itensNavegaveis.filter(i => i.type !== 'header');
        if (selectableItens.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIndexFocado(prev => (prev < selectableItens.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIndexFocado(prev => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const item = selectableItens[Math.max(0, indexFocado)];
            if (item) executarAcao(item);
        }
    };

    const executarAcao = (item) => {
        addRecente(emailUsuario, item.data, 'Visitado recentemente');
        onSelectAluno(item.data);
        onClose();
    };

    useEffect(() => {
        if (indexFocado >= 0 && listaRef.current) {
            const el = document.getElementById(`cp-item-${indexFocado}`);
            if (el) el.scrollIntoView({ block: 'nearest' });
        }
    }, [indexFocado, itensNavegaveis]);

    const handleRemoverRecente = (e, id) => {
        e.stopPropagation();
        removerRecente(emailUsuario, id); 
        setRecentes(getRecentes(emailUsuario));
    };

    if (!isOpen) return null;

    const termoReal = termo.trim();
    const mostrarVazio = termoReal.length >= 2 && !buscando && resultados.length === 0 && !erro;

    let idxCounter = -1;

    return (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-0 sm:pt-[12vh] px-0 sm:px-4" role="dialog" aria-modal="true">
            <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm motion-safe:animate-[fadeIn_0.15s_ease-out]" />
            
            <div ref={modalRef} className="relative w-full h-full sm:h-auto sm:max-h-[80vh] sm:max-w-2xl bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col motion-safe:animate-[slideDown_0.2s_ease-out]">
                
                <div className="flex items-center px-4 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 relative shrink-0">
                    <Search className={`w-5 h-5 transition-colors ${buscando ? 'text-slate-400' : 'text-blue-600 dark:text-blue-400'}`} />
                    <input 
                        ref={inputRef}
                        type="text"
                        value={termo}
                        onChange={e => { setTermo(e.target.value); setIndexFocado(0); }}
                        onKeyDown={handleKeyDown}
                        role="combobox"
                        aria-expanded="true"
                        aria-controls="cp-listbox"
                        aria-activedescendant={`cp-item-${indexFocado}`}
                        placeholder={safeT('search.placeholder', 'Buscar aluno por nome, CPF ou matrícula...')}
                        className="flex-1 bg-transparent border-none outline-none px-4 py-1 text-[16px] font-semibold text-slate-800 dark:text-white placeholder-slate-400"
                    />
                    {buscando && <Loader2 className="w-5 h-5 text-slate-400 animate-spin absolute right-12" />}
                    <kbd className="hidden sm:flex items-center justify-center h-6 px-2 text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 rounded shadow-sm border border-slate-200 dark:border-slate-700">ESC</kbd>
                    <button onClick={onClose} className="sm:hidden p-2 text-slate-400"><X className="w-5 h-5"/></button>
                </div>

                <div ref={listaRef} id="cp-listbox" role="listbox" className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {erro && <p className="px-4 py-8 text-center text-[13px] font-bold text-rose-500">{erro}</p>}
                    
                    {mostrarVazio && (
                        <div className="px-4 py-12 text-center flex flex-col items-center gap-3">
                            <Search className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                            <p className="text-[14px] font-medium text-slate-500">
                                Nenhum aluno encontrado para "{termo}"
                            </p>
                        </div>
                    )}

                    {!erro && !mostrarVazio && itensNavegaveis.map((item, mapIdx) => {
                        if (item.type === 'header') {
                            return (
                                <div key={`header-${mapIdx}`} className="flex items-center justify-between px-3 py-2 mt-1 first:mt-0">
                                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                        {item.label}
                                    </span>
                                </div>
                            );
                        }

                        idxCounter++;
                        const isSelected = indexFocado === idxCounter;
                        const aluno = item.data;
                        const isRecente = item.type === 'recente';
                        
                        return (
                            <div 
                                key={`${item.type}-${aluno.id || mapIdx}`} 
                                id={`cp-item-${idxCounter}`} 
                                role="option" 
                                aria-selected={isSelected} 
                                onMouseEnter={() => setIndexFocado(idxCounter)} 
                                onClick={() => executarAcao(item)} 
                                className={`group relative flex items-center min-h-[64px] p-3 rounded-xl cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 dark:bg-slate-800/80 ring-1 ring-blue-200 dark:ring-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                            >
                                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-sm font-black shrink-0 border border-slate-300 dark:border-slate-600 overflow-hidden mr-3.5">
                                    {aluno.foto_url || aluno.foto ? (
                                        <img src={aluno.foto_url || aluno.foto} alt={aluno.nome} className="w-full h-full object-cover" />
                                    ) : (
                                        aluno.nome.charAt(0).toUpperCase()
                                    )}
                                </div>

                                <div className="flex flex-col min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[14px] font-bold truncate uppercase ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                                            {isRecente ? aluno.nome : <HighlightedText text={aluno.nome} query={termoReal} />}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                        {isRecente ? (
                                            <span>{aluno.acao_label || 'Visitado recentemente'}</span>
                                        ) : (
                                            <>
                                                {aluno.matricula && <span className="text-blue-600 dark:text-blue-400">#<HighlightedText text={aluno.matricula} query={termoReal} /></span>}
                                                {aluno.cpf && <span><HighlightedText text={mascararCpfExibicao(aluno.cpf)} query={termoReal} /></span>}
                                                {exibirBaloesUnidade && aluno.unidade && <span className="px-1.5 py-px bg-slate-200 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">{aluno.unidade}</span>}
                                            </>
                                        )}
                                    </div>
                                </div>
                                
                                {isRecente && (
                                    <button onClick={(e) => handleRemoverRecente(e, aluno.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all" title="Remover histórico"><X className="w-4 h-4" /></button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}