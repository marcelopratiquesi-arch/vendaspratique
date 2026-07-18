import React, { useState } from 'react';
import { formatarDataHora, STATUS_TOKENS, COLUNAS } from './utils';
import { PhoneCall, MessageCircle, CalendarClock, IdCard, Inbox, Archive, Send } from 'lucide-react';

const Kanban = ({ 
    visitantes, 
    alterarStatus, 
    deletarLead, 
    setModalWpp, 
    setModalDetalhe,
    carregarHistoricoLead,
    registrarHistorico
}) => {
    // Estado local para gerenciar as "Notas Rápidas" de cada Card
    const [notasRapidas, setNotasRapidas] = useState({});

    // ==========================================
    // AÇÕES EXCLUSIVAS DO KANBAN
    // ==========================================
    const handleLigarMicroSip = async (lead) => {
        await registrarHistorico(lead.id, 'Ligação', `Tentativa de contato telefônico (MicroSIP) para o número ${lead.telefone}`);
        window.location.href = `sip:${lead.telefone.replace(/\D/g, '')}`;
    };

    const abrirModalWpp = (lead) => {
        import('./utils').then(module => {
            const textoPadrao = module.gerarTextoWhatsApp(lead);
            setModalWpp({ show: true, lead: lead, texto: textoPadrao });
        });
    };

    const abrirFichaLead = (lead) => {
        setModalDetalhe({ show: true, lead: lead });
        carregarHistoricoLead(lead.id);
    };

    // A MÁGICA 2: Função que salva a nota rápida e limpa a caixinha
    const handleAddNotaRapida = async (lead) => {
        const nota = notasRapidas[lead.id];
        if (!nota?.trim()) return;
        
        await registrarHistorico(lead.id, 'Observação', nota);
        
        setNotasRapidas(prev => ({ ...prev, [lead.id]: '' }));
        alert("Nota rápida salva no histórico com sucesso!");
    };

    // ==========================================
    // RENDERIZAÇÃO
    // ==========================================
    return (
        <div className="flex gap-5 overflow-x-auto pb-6 custom-scrollbar animate-[fadeIn_0.3s_ease-out] items-start min-h-[600px] px-1">
            {COLUNAS.map(coluna => {
                const leadsDaColuna = visitantes.filter(v => v.status === coluna);
                const token = STATUS_TOKENS[coluna] || STATUS_TOKENS['Novo']; 

                return (
                    <div key={coluna} className={`rounded-[20px] border ${token.border} bg-slate-50/80 shadow-sm flex flex-col min-w-[300px] max-w-[300px] flex-shrink-0`}>
                        
                        {/* HEADER DA COLUNA */}
                        <div className={`p-4 border-b ${token.border} ${token.bg} rounded-t-[20px] flex justify-between items-center sticky top-0 backdrop-blur-sm z-10`}>
                            <h3 className={`font-black ${token.text} text-[11px] flex items-center gap-2 uppercase tracking-widest`}>
                                <span className={`w-2 h-2 rounded-full ${token.accent} shadow-sm`}></span>
                                {coluna}
                            </h3>
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-md shadow-sm border bg-white ${token.text} ${token.border}`}>
                                {leadsDaColuna.length}
                            </span>
                        </div>

                        {/* ÁREA DOS CARTÕES */}
                        <div className="p-3 flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar" style={{ maxHeight: '65vh' }}>
                            {leadsDaColuna.map(v => (
                                <div key={v.id} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all group flex flex-col relative overflow-hidden">
                                    
                                    {/* TOPO: NOME E TIPO */}
                                    <div className="flex justify-between items-start mb-3 relative z-10">
                                        <div>
                                            <h4 
                                                onClick={() => abrirFichaLead(v)}
                                                className="font-black text-slate-800 text-sm leading-tight uppercase cursor-pointer hover:text-blue-600 hover:underline transition-colors pr-6"
                                                title="Ver Ficha e Histórico"
                                            >
                                                {v.nome}
                                            </h4>
                                            <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase border ${v.tipo_lead === 'VISITANTE' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : v.tipo_lead === 'CANCELADO/INATIVO' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                {v.tipo_lead || 'Não Informado'}
                                            </span>
                                        </div>
                                        
                                        {/* BOTÃO ARQUIVAR */}
                                        <button 
                                            onClick={() => deletarLead(v.id)} 
                                            className="absolute top-0 right-0 p-1.5 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title="Arquivar Lead"
                                        >
                                            <Archive className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* INFOS BÁSICAS */}
                                    <div className="space-y-2.5 mb-4 flex-1 relative z-10">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            <CalendarClock className="w-3 h-3" /> {formatarDataHora(v.criado_em) || v.data}
                                        </div>
                                        {v.cpf && (
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 tracking-wider">
                                                <IdCard className="w-3 h-3" /> {v.cpf}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 w-fit pr-3 py-1 rounded-full border border-slate-100 uppercase mt-1">
                                            <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] ml-1 border border-indigo-200">
                                                {v.vendedor ? v.vendedor.charAt(0) : '?'}
                                            </div>
                                            {v.vendedor}
                                        </div>
                                    </div>

                                    {/* RODAPÉ: BOTÕES, STATUS E OBSERVAÇÃO RÁPIDA */}
                                    <div className="flex flex-col gap-2 pt-3 border-t border-slate-100 mt-auto relative z-10">
                                        
                                        {/* Botões de Ação */}
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleLigarMicroSip(v)} className="flex-1 py-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg flex items-center justify-center gap-1.5 border border-blue-200 transition-colors text-[9px] font-black uppercase tracking-widest" title="Ligar via MicroSIP">
                                                <PhoneCall className="w-3.5 h-3.5" /> Ligar
                                            </button>
                                            
                                            <button type="button" onClick={() => abrirModalWpp(v)} className="flex-1 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg flex items-center justify-center gap-1.5 border border-emerald-200 transition-colors text-[9px] font-black uppercase tracking-widest">
                                                <MessageCircle className="w-3.5 h-3.5" /> Whats
                                            </button>
                                        </div>

                                        {/* Dropdown de Status */}
                                        <select value={v.status} onChange={(e) => alterarStatus(v.id, e.target.value)} className="w-full text-[9px] font-black uppercase tracking-widest text-slate-600 border border-slate-200 rounded-lg h-8 px-1.5 bg-slate-50 hover:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors outline-none">
                                            {COLUNAS.map(c => <option key={c} value={c}>Mover: {c}</option>)}
                                        </select>

                                        {/* Campo de Observação Rápida */}
                                        <div className="w-full mt-1 flex items-center gap-1.5">
                                            <input 
                                                type="text" 
                                                placeholder="Nota rápida..."
                                                value={notasRapidas[v.id] || ''}
                                                onChange={(e) => setNotasRapidas({...notasRapidas, [v.id]: e.target.value})}
                                                onKeyDown={(e) => { if(e.key === 'Enter') handleAddNotaRapida(v) }}
                                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-medium text-slate-700 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                            />
                                            <button 
                                                onClick={() => handleAddNotaRapida(v)}
                                                disabled={!notasRapidas[v.id]?.trim()}
                                                className="p-1.5 bg-slate-100 text-slate-500 hover:bg-blue-500 hover:text-white disabled:opacity-50 disabled:hover:bg-slate-100 disabled:hover:text-slate-500 rounded-lg transition-colors"
                                                title="Salvar Nota Rápida"
                                            >
                                                <Send className="w-3 h-3" />
                                            </button>
                                        </div>

                                    </div>
                                </div>
                            ))}

                            {/* PLACEHOLDER COLUNA VAZIA */}
                            {leadsDaColuna.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-10 opacity-40">
                                    <Inbox className="w-8 h-8 text-slate-400 mb-2" />
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Coluna Vazia</p>
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    );
};

export default Kanban;