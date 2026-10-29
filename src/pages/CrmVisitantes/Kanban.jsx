import React, { useState, useMemo, useCallback, memo, useRef } from 'react';
import { formatarDataHora, STATUS_TOKENS, COLUNAS, dataDoLead, classeTipoLead } from './utils';
import { PhoneCall, MessageCircle, CalendarClock, CalendarPlus, IdCard, Inbox, Trash2, Info, Send, Check, Loader2 } from 'lucide-react';
import { EtiquetaParado, EtiquetaProximo } from './EtiquetasCrm';

// ==========================================
// CARD DO LEAD (Memoizado para Alta Performance)
// ==========================================
const LeadCard = memo(({
    lead,
    onLigar,
    onWpp,
    onDetalhe,
    onMoverStatus,
    onDeletar,
    onSalvarNota,
    onProximo,
    isDeleting,
    isSendingNota,
    notaSalva,
    podeApagar
}) => {
    const [nota, setNota] = useState('');

    const handleSalvar = () => {
        if (!nota.trim() || isSendingNota) return;
        onSalvarNota(lead, nota);
        setNota('');
    };

    // A confirmação é feita uma vez só, em deletarLead (index.jsx)
    const handleDeletar = () => {
        if (isDeleting) return;
        onDeletar(lead.id);
    };

    return (
        <div
            onMouseDown={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border p-4 rounded-xl transition-all group flex flex-col relative shrink-0 cursor-default border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-500/30"
        >

            <div className="flex justify-between items-start mb-3 relative z-10">
                <div className="flex flex-wrap gap-2 items-center">
                    <span className={`inline-block px-2 py-1 rounded text-[10px] font-black tracking-widest uppercase border ${classeTipoLead(lead.tipo_lead)}`}>
                        {lead.tipo_lead || 'Não Informado'}
                    </span>
                    <EtiquetaProximo lead={lead} />
                    <EtiquetaParado lead={lead} />
                </div>

                {podeApagar && (
                    <button
                        onClick={handleDeletar}
                        disabled={isDeleting}
                        className="text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors bg-white dark:bg-slate-900 p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-transparent hover:border-rose-100 dark:hover:border-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Excluir Definitivamente do Banco"
                    >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                )}
            </div>

            <div className="space-y-1 mb-3 relative z-10">
                <h4
                    onClick={() => onDetalhe(lead)}
                    className="font-black text-slate-800 dark:text-white text-[15px] leading-tight uppercase cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors pr-2"
                    title="Ver Ficha e Histórico Completo"
                >
                    {lead.nome}
                </h4>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{lead.telefone}</p>
            </div>

            <div className="space-y-2 mb-4 relative z-10">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <CalendarClock className="w-3 h-3" /> {formatarDataHora(lead.puxado_em || dataDoLead(lead))}
                </div>
                {lead.cpf && (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 tracking-wider">
                        <IdCard className="w-3 h-3" /> {lead.cpf}
                    </div>
                )}
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 w-fit pr-3 py-1 rounded-full border border-slate-100 dark:border-slate-800 uppercase mt-1">
                    <div className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] ml-1 border border-blue-200 dark:border-blue-500/30">
                        {lead.vendedor ? lead.vendedor.charAt(0) : '?'}
                    </div>
                    {lead.vendedor}
                </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 mt-auto shrink-0">

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onLigar(lead)}
                        disabled={!lead.telefone}
                        className="flex-1 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-600 text-blue-600 dark:text-blue-400 hover:text-white border border-blue-100 dark:border-blue-500/20 h-9 rounded-lg flex items-center justify-center transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Ligar (MicroSIP)"
                    >
                        <PhoneCall className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onWpp(lead)}
                        disabled={!lead.telefone}
                        className="flex-1 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-600 text-emerald-600 dark:text-emerald-400 hover:text-white border border-emerald-100 dark:border-emerald-500/20 h-9 rounded-lg flex items-center justify-center transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Chamar no WhatsApp"
                    >
                        <MessageCircle className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onDetalhe(lead)}
                        className="flex-1 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-white border border-slate-200 dark:border-slate-800 h-9 rounded-lg flex items-center justify-center transition-colors shadow-sm"
                        title="Ver Detalhes / Ficha"
                    >
                        <Info className="w-4 h-4" />
                    </button>
                    {onProximo && (
                        <button
                            onClick={() => onProximo(lead)}
                            className="flex-1 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-600 text-blue-600 dark:text-blue-400 hover:text-white border border-blue-100 dark:border-blue-500/20 h-9 rounded-lg flex items-center justify-center transition-colors shadow-sm"
                            title="Marcar o próximo contato"
                        >
                            <CalendarPlus className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <select
                    value={lead.status}
                    onChange={(e) => onMoverStatus(lead.id, e.target.value)}
                    className="w-full text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg h-9 px-2 bg-slate-50 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-900 focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors outline-none shadow-sm"
                >
                    <option disabled value="">Mover fase...</option>
                    {COLUNAS.map(c => <option key={c} value={c}>Para: {c}</option>)}
                </select>

                <div className="w-full flex items-center gap-1.5 pt-1">
                    <input
                        type="text"
                        placeholder="Nota rápida..."
                        value={nota}
                        onChange={(e) => setNota(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSalvar(); }}
                        disabled={isSendingNota}
                        className="flex-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 h-9 text-[10px] font-medium text-slate-700 dark:text-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none shadow-inner disabled:opacity-60 dark:focus:bg-slate-900"
                    />
                    <button
                        onClick={handleSalvar}
                        disabled={!nota.trim() || isSendingNota}
                        className={`h-9 w-9 flex items-center justify-center rounded-lg transition-colors shadow-sm disabled:opacity-50 ${notaSalva ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-blue-500 hover:text-white disabled:hover:bg-slate-100 disabled:hover:text-slate-500 dark:disabled:hover:bg-slate-800 dark:disabled:hover:text-slate-400'}`}
                        title="Salvar Nota"
                    >
                        {notaSalva ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                    </button>
                </div>

            </div>
        </div>
    );
});
LeadCard.displayName = 'LeadCard';


// ==========================================
// KANBAN PRINCIPAL
// ==========================================
const Kanban = ({
    visitantes,
    alterarStatus,
    deletarLead,
    setModalWpp,
    setModalDetalhe,
    carregarHistoricoLead,
    registrarHistorico,
    podeApagar = false,
    onProximoContato
}) => {
    const [deletingIds, setDeletingIds] = useState(() => new Set());
    const [sendingNotaIds, setSendingNotaIds] = useState(() => new Set());
    const [notasSalvasIds, setNotasSalvasIds] = useState(() => new Set());

    const scrollContainerRef = useRef(null);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);

    const handleMouseDown = (e) => {
        isDragging.current = true;
        scrollContainerRef.current.classList.add('cursor-grabbing');
        scrollContainerRef.current.classList.remove('cursor-grab');
        startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
        scrollLeft.current = scrollContainerRef.current.scrollLeft;
    };

    const handleMouseLeaveOrUp = () => {
        isDragging.current = false;
        if (scrollContainerRef.current) {
            scrollContainerRef.current.classList.remove('cursor-grabbing');
            scrollContainerRef.current.classList.add('cursor-grab');
        }
    };

    const handleMouseMove = (e) => {
        if (!isDragging.current) return;
        e.preventDefault(); 
        const x = e.pageX - scrollContainerRef.current.offsetLeft;
        const walk = (x - startX.current) * 1.5; 
        scrollContainerRef.current.scrollLeft = scrollLeft.current - walk;
    };

    const leadsPorColuna = useMemo(() => {
        const grupos = Object.fromEntries(COLUNAS.map(c => [c, []]));
        for (const v of visitantes) {
            if (grupos[v.status]) grupos[v.status].push(v);
        }
        for (const coluna of COLUNAS) {
            grupos[coluna].sort((a, b) => new Date(b.puxado_em || dataDoLead(b)) - new Date(a.puxado_em || dataDoLead(a)));
        }
        return grupos;
    }, [visitantes]);

    const handleLigarMicroSip = useCallback(async (lead) => {
        if (!lead.telefone) return;
        await registrarHistorico(lead.id, 'Ligação', `Tentativa de contato telefônico (MicroSIP) para o número ${lead.telefone}`);
        window.location.href = `sip:${lead.telefone.replace(/\D/g, '')}`;
    }, [registrarHistorico]);

    const abrirModalWpp = useCallback((lead) => {
        if (!lead.telefone) return;
        import('./utils').then(module => {
            const textoPadrao = module.gerarTextoWhatsApp(lead);
            setModalWpp({ show: true, lead, texto: textoPadrao });
        });
    }, [setModalWpp]);

    const abrirFichaLead = useCallback((lead) => {
        setModalDetalhe({ show: true, lead });
        carregarHistoricoLead(lead.id);
    }, [setModalDetalhe, carregarHistoricoLead]);

    const handleDeletar = useCallback(async (leadId) => {
        setDeletingIds(prev => new Set(prev).add(leadId));
        try {
            await deletarLead(leadId);
        } finally {
            setDeletingIds(prev => {
                const next = new Set(prev);
                next.delete(leadId);
                return next;
            });
        }
    }, [deletarLead]);

    const handleSalvarNota = useCallback(async (lead, nota) => {
        if (sendingNotaIds.has(lead.id)) return; 
        setSendingNotaIds(prev => new Set(prev).add(lead.id));
        try {
            await registrarHistorico(lead.id, 'Observação', nota);
            setNotasSalvasIds(prev => new Set(prev).add(lead.id));
            setTimeout(() => {
                setNotasSalvasIds(prev => {
                    const next = new Set(prev);
                    next.delete(lead.id);
                    return next;
                });
            }, 2000);
        } finally {
            setSendingNotaIds(prev => {
                const next = new Set(prev);
                next.delete(lead.id);
                return next;
            });
        }
    }, [registrarHistorico, sendingNotaIds]);

    return (
        <div 
            ref={scrollContainerRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeaveOrUp}
            onMouseUp={handleMouseLeaveOrUp}
            onMouseMove={handleMouseMove}
            className="flex gap-5 overflow-x-auto pb-6 custom-scrollbar items-start min-h-[70vh] w-full px-2 cursor-grab"
        >
            {COLUNAS.map(coluna => {
                const leadsDaColuna = leadsPorColuna[coluna] || [];
                const token = STATUS_TOKENS[coluna] || STATUS_TOKENS['Novo'];

                return (
                    <div key={coluna} className={`rounded-[20px] border ${token.border} bg-slate-50/80 dark:bg-slate-800/60 shadow-sm flex flex-col min-w-[310px] w-[310px] flex-shrink-0 cursor-default`}>

                        <div className={`p-4 border-b ${token.border} ${token.bg} rounded-t-[20px] flex justify-between items-center sticky top-0 backdrop-blur-sm z-10`}>
                            <h3 className={`font-black ${token.text} text-[11px] flex items-center gap-2 uppercase tracking-widest`}>
                                <span className={`w-2 h-2 rounded-full ${token.accent} shadow-sm`}></span>
                                {coluna}
                            </h3>
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-md shadow-sm border bg-white dark:bg-slate-900 ${token.text} ${token.border}`}>
                                {leadsDaColuna.length}
                            </span>
                        </div>

                        <div 
                            onMouseDown={(e) => e.stopPropagation()} 
                            className="p-3 flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar" 
                            style={{ maxHeight: '68vh' }}
                        >
                            {leadsDaColuna.map(v => (
                                <LeadCard
                                    key={v.id}
                                    lead={v}
                                    onLigar={handleLigarMicroSip}
                                    onWpp={abrirModalWpp}
                                    onDetalhe={abrirFichaLead}
                                    onMoverStatus={alterarStatus}
                                    onDeletar={handleDeletar}
                                    onSalvarNota={handleSalvarNota}
                                    onProximo={onProximoContato}
                                    isDeleting={deletingIds.has(v.id)}
                                    isSendingNota={sendingNotaIds.has(v.id)}
                                    notaSalva={notasSalvasIds.has(v.id)}
                                    podeApagar={podeApagar}
                                />
                            ))}

                            {leadsDaColuna.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-10 opacity-40">
                                    <Inbox className="w-8 h-8 text-slate-400 mb-2" />
                                    <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Coluna Vazia</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default Kanban;