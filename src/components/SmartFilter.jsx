import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, Search, CheckSquare, Square } from 'lucide-react';

export const SmartFilter = ({ 
    options = [], 
    ocultos = [], 
    setOcultos, 
    label = "Filtro", 
    Icone, 
    iconColor = "text-slate-500" 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const containerRef = useRef(null);
    const searchInputRef = useRef(null);

    // Controle de Clique Fora (UX: Fecha a caixa ao clicar fora)
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm(""); // Limpa a busca ao fechar para evitar estados fantasmas
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Auto-focus para alta produtividade (UX: Ao abrir, o teclado foca na lupa)
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    // Filtro em tempo real (UX: Cognitive Ease)
    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        return options.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [options, searchTerm]);

    const toggleOption = (opt) => {
        if (ocultos.includes(opt)) {
            // Mostra novamente
            setOcultos(prev => prev.filter(i => i !== opt)); 
        } else {
            // Oculta
            setOcultos(prev => [...prev, opt]); 
        }
    };

    // Seleção em Lote Inteligente: Age APENAS sobre o resultado da busca atual
    const toggleFilteredAll = () => {
        const visibleOcultos = filteredOptions.filter(opt => ocultos.includes(opt));
        
        if (visibleOcultos.length === 0) {
            // Se tudo na tela estiver selecionado, vamos ocultar todos eles
            setOcultos(prev => {
                const newOcultos = new Set(prev);
                filteredOptions.forEach(opt => newOcultos.add(opt));
                return Array.from(newOcultos);
            });
        } else {
            // Se houver pelo menos um item oculto na tela, vamos mostrar todos eles
            setOcultos(prev => prev.filter(opt => !filteredOptions.includes(opt)));
        }
    };

    // Validação de segurança se os arrays estiverem vazios
    const optionsSafe = options || [];
    const ocultosSafe = ocultos || [];

    const isAllFilteredSelected = filteredOptions.length > 0 && filteredOptions.every(opt => !ocultosSafe.includes(opt));
    const qtdSelecionados = optionsSafe.length - ocultosSafe.length;
    
    // Label Dinâmica do Fechamento da Caixa
    let textoResumo = `${qtdSelecionados} selecionado${qtdSelecionados !== 1 ? 's' : ''}`;
    if (qtdSelecionados === optionsSafe.length && optionsSafe.length > 0) textoResumo = 'TODOS';
    if (qtdSelecionados === 0) textoResumo = 'NENHUM';
    if (optionsSafe.length === 0) textoResumo = 'VAZIO';

    return (
        <div className="relative flex flex-col gap-1.5 min-w-[200px] flex-1" ref={containerRef}>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
               {Icone && <Icone className={`w-3 h-3 ${iconColor}`} />} {label}
            </label>
            <div 
                onClick={() => {
                    if (optionsSafe.length > 0) setIsOpen(!isOpen);
                }}
                className={`bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none flex justify-between items-center select-none shadow-sm h-[46px] transition-colors ${optionsSafe.length === 0 ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:border-blue-400 text-slate-700'}`}
            >
                <span className="truncate pr-2 uppercase">{textoResumo}</span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
            </div>
            
            {isOpen && optionsSafe.length > 0 && (
                <div className="absolute top-[100%] left-0 right-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-xl z-50 flex flex-col py-1 overflow-hidden" style={{ maxHeight: '350px' }}>
                    
                    {/* INPUT DE BUSCA */}
                    <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                ref={searchInputRef}
                                type="text"
                                placeholder={`Buscar...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    {filteredOptions.length > 0 && (
                        <div 
                            className={`px-4 py-3 border-b flex items-center gap-3 cursor-pointer select-none transition-colors ${isAllFilteredSelected ? 'bg-rose-50/50 hover:bg-rose-50 border-rose-100' : 'bg-blue-50/50 hover:bg-blue-50 border-blue-100'}`}
                            onClick={toggleFilteredAll}
                        >
                            {isAllFilteredSelected ? (
                                <>
                                    <Square className="w-4 h-4 text-rose-500 shrink-0" />
                                    <span className="text-[11px] font-black text-rose-600 uppercase tracking-wider">Desmarcar {searchTerm ? 'Buscados' : 'Todos'}</span>
                                </>
                            ) : (
                                <>
                                    <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                                    <span className="text-[11px] font-black text-blue-700 uppercase tracking-wider">Selecionar {searchTerm ? 'Buscados' : 'Todos'}</span>
                                </>
                            )}
                        </div>
                    )}

                    <div className="overflow-y-auto custom-scrollbar">
                        {filteredOptions.map(opt => {
                            const isChecked = !ocultosSafe.includes(opt);
                            return (
                                <div 
                                    key={opt} 
                                    className="px-4 py-3 hover:bg-slate-50 flex items-center gap-3 cursor-pointer select-none border-b border-slate-50 last:border-0 transition-colors"
                                    onClick={() => toggleOption(opt)}
                                >
                                    {isChecked ? <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                                    <span className={`text-[11px] font-bold uppercase truncate tracking-wide ${isChecked ? 'text-slate-700' : 'text-slate-400'}`} title={opt}>{opt}</span>
                                </div>
                            );
                        })}
                        {filteredOptions.length === 0 && <p className="px-4 py-6 text-xs font-bold text-slate-400 text-center uppercase tracking-widest">Nenhum item encontrado</p>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SmartFilter;