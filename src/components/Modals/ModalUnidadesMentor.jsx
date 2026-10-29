import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Building2, Search, X, Check, Loader2, CheckSquare, Eraser } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';

// ==========================================
// JANELA "UNIDADES DO MENTOR" (Configurações → Acessos, só Admin)
// O Admin marca as unidades que o Mentor pode ver. Sem nenhuma marcada, o Mentor não vê nada.
// A busca e as caixinhas funcionam só na memória (rápido mesmo com 200 unidades);
// o banco só é chamado ao Salvar (onSalvar recebe a lista de nomes marcados).
// ==========================================

const normalizar = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

const ModalUnidadesMentor = ({ mentor, unidades = [], marcadasIniciais = [], onCancelar, onSalvar }) => {
    const [busca, setBusca] = useState('');
    const [marcadas, setMarcadas] = useState(() => new Set(marcadasIniciais.map(normalizar)));
    const [salvando, setSalvando] = useState(false);
    const buscaRef = useRef(null);

    useEffect(() => { buscaRef.current?.focus(); }, []);
    useEffect(() => {
        const aoTeclar = (e) => { if (e.key === 'Escape' && !salvando) onCancelar(); };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [onCancelar, salvando]);

    const ordenadas = useMemo(
        () => [...unidades].filter(u => u && u.nome).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR', { numeric: true })),
        [unidades]
    );
    const termo = normalizar(busca);
    const visiveis = useMemo(
        () => (termo ? ordenadas.filter(u => normalizar(u.nome).includes(termo) || String(u.id).includes(termo)) : ordenadas),
        [ordenadas, termo]
    );

    const alternar = (nome) => setMarcadas(atual => {
        const novo = new Set(atual);
        const chave = normalizar(nome);
        if (novo.has(chave)) novo.delete(chave); else novo.add(chave);
        return novo;
    });
    // "Marcar todas" marca as que estão aparecendo (com busca, só as encontradas)
    const marcarTodas = () => setMarcadas(atual => new Set([...atual, ...visiveis.map(u => normalizar(u.nome))]));
    const limpar = () => setMarcadas(new Set());

    const salvar = async () => {
        if (salvando) return;
        setSalvando(true);
        const nomes = ordenadas.filter(u => marcadas.has(normalizar(u.nome))).map(u => u.nome);
        const ok = await onSalvar(nomes);
        if (!ok) setSalvando(false);
    };

    const total = ordenadas.filter(u => marcadas.has(normalizar(u.nome))).length;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !salvando) onCancelar(); }}>
            <div className="w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out]" role="dialog" aria-modal="true" aria-labelledby="titulo-unidades-mentor">

                <div className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 id="titulo-unidades-mentor" className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />{' '}{tx("Unidades do Mentor")}
                            </h3>
                            <p className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase truncate mt-1.5">{mentor?.nome}</p>
                            <p className="text-[11px] font-semibold text-slate-400 lowercase truncate">{mentor?.email}</p>
                        </div>
                        <button type="button" onClick={onCancelar} disabled={salvando} aria-label={tx("Fechar")} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="relative mt-4">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            ref={buscaRef}
                            type="text"
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            placeholder={tx("Buscar unidade por nome ou número")}
                            className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {busca && (
                            <button type="button" onClick={() => setBusca('')} aria-label={tx("Limpar busca")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${total === 0 ? 'text-rose-600 dark:text-rose-300' : 'text-blue-600 dark:text-blue-300'}`}>
                            {total} {total === 1 ? tx("unidade selecionada") : tx("unidades selecionadas")}
                        </span>
                        <div className="flex gap-2">
                            <button type="button" onClick={marcarTodas} disabled={salvando || visiveis.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                                <CheckSquare className="w-3.5 h-3.5" />{' '}{tx("Marcar todas")}
                            </button>
                            <button type="button" onClick={limpar} disabled={salvando || total === 0} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                                <Eraser className="w-3.5 h-3.5" />{' '}{tx("Limpar")}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {visiveis.length === 0 ? (
                        <p className="text-center py-10 text-xs font-bold text-slate-400 uppercase tracking-widest">{tx("Nenhuma unidade encontrada.")}</p>
                    ) : visiveis.map(u => {
                        const marcada = marcadas.has(normalizar(u.nome));
                        return (
                            <label key={u.id ?? u.nome} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${marcada ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}>
                                <input type="checkbox" checked={marcada} onChange={() => alternar(u.nome)} disabled={salvando} className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 dark:text-blue-400" />
                                <span className={`flex-1 text-sm font-bold uppercase truncate ${marcada ? 'text-blue-700 dark:text-blue-200' : 'text-slate-700 dark:text-slate-200'}`}>{u.nome}</span>
                            </label>
                        );
                    })}
                </div>

                <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {total === 0 ? tx("Sem unidades: este mentor não verá nada.") : tx("O acesso muda na hora para o mentor.")}
                    </p>
                    <div className="flex gap-2">
                        <button type="button" onClick={onCancelar} disabled={salvando} className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                            {tx("Cancelar")}
                        </button>
                        <button type="button" onClick={salvar} disabled={salvando} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest shadow-sm disabled:opacity-60">
                            {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}{' '}{tx("Salvar")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModalUnidadesMentor;
