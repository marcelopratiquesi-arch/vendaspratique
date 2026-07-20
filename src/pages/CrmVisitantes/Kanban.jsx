import React, { useState, useMemo, useCallback, memo, useRef } from 'react';
import { formatarDataHora, STATUS_TOKENS, COLUNAS } from './utils';
import { PhoneCall, MessageCircle, CalendarClock, IdCard, Inbox, Trash2, Info, Send, Check } from 'lucide-react';

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
    isDeleting,
    isSendingNota,
    notaSalva
}) => {
    const [nota, setNota] = useState('');

    const handleSalvar = () => {
        if (!nota.trim() || isSendingNota) return;
        onSalvarNota(lead, nota);
        setNota('');
    };

    const handleDeletar = () => {
        if (isDeleting) return;
        const confirmado = window.confirm(
            `ATENÇÃO: Excluir "${lead.nome}" definitivamente do banco de dados?\n\nEsta ação libera o CPF mas NÃO pode ser desfeita.`
        );
        if (confirmado) onDeletar(lead.id);
    };

    return (
        <div 
            // Adicionado onMouseDown com stopPropagation para evitar que o clique no card arraste a tela sem querer
            onMouseDown={(e) => e.stopPropagation()} 
            className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all group flex flex-col relative shrink-0 cursor-default"
        >

            {/* TOPO: TIPO DE LEAD E LIXEIRA */}
            <div className="flex justify-between items-start mb-3 relative z-10">
                <span className={`inline-block px-2 py-1 rounded text-[9px] font-black tracking-widest uppercase border ${lead.tipo_lead === 'VISITANTE' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : lead.tipo_lead === 'CANCELADO/INATIVO' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {lead.tipo_lead || 'Não Informado'}
                </span>
                <button
                    onClick={handleDeletar}
                    disabled={isDeleting}
                    className="text-slate-300 hover:text-rose-600 transition-colors bg-white p-1.5 rounded-md hover:bg-rose-50 border border-transparent hover:border-rose-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Excluir Definitivamente do Banco"
                >
                    {isDeleting ? <i data-lucide="loader-2" className="w-4 h-4 animate-spin"></i> : <Trash2 className="w-4 h-4" />}
                </button>
            </div>

            {/* DADOS BÁSICOS DO LEAD */}
            <div className="space-y-1 mb-3 relative z-10">
                <h4
                    onClick={() => onDetalhe(lead)}
                    className="font-black text-slate-800 text-[15px] leading-tight uppercase cursor-pointer hover:text-blue-600 transition-colors pr-2"
                    title="Ver Ficha e Histórico Completo"
                >
                    {lead.nome}
                </h4>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{lead.telefone}</p>
            </div>

            {/* INFO METADADOS (Datas e Consultor) */}
            <div className="space-y-2 mb-4 relative z-10">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <CalendarClock className="w-3 h-3" /> {formatarDataHora(lead.puxado_em || lead.criado_em)}
                </div>
                {lead.cpf && (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 tracking-wider">
                        <IdCard className="w-3 h-3" /> {lead.cpf}
                    </div>
                )}
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 bg-slate-50 w-fit pr-3 py-1 rounded-full border border-slate-100 uppercase mt-1">
                    <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[8px] ml-1 border border-indigo-200">
                        {lead.vendedor ? lead.vendedor.charAt(0) : '?'}
                    </div>
                    {lead.vendedor}
                </div>
            </div>

            {/* RODAPÉ E AÇÕES VENDAS */}
            <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100 mt-auto shrink-0">

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onLigar(lead)}
                        disabled={!lead.telefone}
                        className="flex-1 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-100 h-9 rounded-lg flex items-center justify-center transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Ligar (MicroSIP)"
                    >
                        <PhoneCall className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onWpp(lead)}
                        disabled={!lead.telefone}
                        className="flex-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white border border-emerald-100 h-9 rounded-lg flex items-center justify-center transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Chamar no WhatsApp"
                    >
                        <MessageCircle className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onDetalhe(lead)}
                        className="flex-1 bg-slate-50 hover:bg-slate-800 text-slate-600 hover:text-white border border-slate-200 h-9 rounded-lg flex items-center justify-center transition-colors shadow-sm"
                        title="Ver Detalhes / Ficha"
                    >
                        <Info className="w-4 h-4" />
                    </button>
                </div>

                <select
                    value={lead.status}
                    onChange={(e) => onMoverStatus(lead.id, e.target.value)}
                    className="w-full text-[10px] font-black uppercase tracking-widest text-slate-600 border border-slate-200 rounded-lg h-9 px-2 bg-slate-50 hover:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors outline-none shadow-sm"
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
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 h-9 text-[10px] font-medium text-slate-700 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none shadow-inner disabled:opacity-60"
                    />
                    <button
                        onClick={handleSalvar}
                        disabled={!nota.trim() || isSendingNota}
                        className={`h-9 w-9 flex items-center justify-center rounded-lg transition-colors shadow-sm disabled:opacity-50 ${notaSalva ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-blue-500 hover:text-white disabled:hover:bg-slate-100 disabled:hover:text-slate-500'}`}
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
    registrarHistorico
}) => {
    const [deletingIds, setDeletingIds] = useState(() => new Set());
    const [sendingNotaIds, setSendingNotaIds] = useState(() => new Set());
    const [notasSalvasIds, setNotasSalvasIds] = useState(() => new Set());

    // ==========================================
    // SISTEMA DE SCROLL POR ARRASTE (DRAG TO SCROLL)
    // ==========================================
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
        e.preventDefault(); // Evita que selecione o texto enquanto arrasta
        const x = e.pageX - scrollContainerRef.current.offsetLeft;
        const walk = (x - startX.current) * 1.5; // Velocidade do arrasto (1.5x)
        scrollContainerRef.current.scrollLeft = scrollLeft.current - walk;
    };

    // ==========================================
    // AGRUPAMENTO DE ALTA PERFORMANCE
    // ==========================================
    const leadsPorColuna = useMemo(() => {
        const grupos = Object.fromEntries(COLUNAS.map(c => [c, []]));
        for (const v of visitantes) {
            if (grupos[v.status]) grupos[v.status].push(v);
        }
        for (const coluna of COLUNAS) {
            grupos[coluna].sort((a, b) => new Date(b.puxado_em || b.criado_em) - new Date(a.puxado_em || a.criado_em));
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
            // Refs e Eventos do DRAG TO SCROLL inseridos aqui
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
                    <div key={coluna} className={`rounded-[20px] border ${token.border} bg-slate-50/80 shadow-sm flex flex-col min-w-[310px] w-[310px] flex-shrink-0 cursor-default`}>

                        <div className={`p-4 border-b ${token.border} ${token.bg} rounded-t-[20px] flex justify-between items-center sticky top-0 backdrop-blur-sm z-10`}>
                            <h3 className={`font-black ${token.text} text-[11px] flex items-center gap-2 uppercase tracking-widest`}>
                                <span className={`w-2 h-2 rounded-full ${token.accent} shadow-sm`}></span>
                                {coluna}
                            </h3>
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-md shadow-sm border bg-white ${token.text} ${token.border}`}>
                                {leadsDaColuna.length}
                            </span>
                        </div>

                        {/* Corpo da Coluna com Scroll Vertical */}
                        <div 
                            // onMouseDown aqui previne que tentar selecionar um card ou usar a rolagem vertical ative o drag horizontal
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
                                    isDeleting={deletingIds.has(v.id)}
                                    isSendingNota={sendingNotaIds.has(v.id)}
                                    notaSalva={notasSalvasIds.has(v.id)}
                                />
                            ))}

                            {leadsDaColuna.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-10 opacity-40">
                                    <Inbox className="w-8 h-8 text-slate-400 mb-2" />
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Coluna Vazia</p>
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