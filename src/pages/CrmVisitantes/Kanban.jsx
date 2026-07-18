import React from 'react';
import { formatarDataHora, gerarTextoWhatsApp, STATUS_TOKENS, COLUNAS } from './utils';

const Kanban = ({ 
    visitantes, 
    alterarStatus, 
    deletarLead, 
    setModalWpp, 
    setModalDetalhe,
    carregarHistoricoLead,
    registrarHistorico
}) => {

    // ==========================================
    // AÇÕES EXCLUSIVAS DO KANBAN
    // ==========================================
    const handleLigarMicroSip = async (lead) => {
        await registrarHistorico(lead.id, 'Ligação', `Tentativa de contato telefônico (MicroSIP) para o número ${lead.telefone}`);
        window.location.href = `sip:${lead.telefone.replace(/\D/g, '')}`;
    };

    const abrirModalWpp = (lead) => {
        setModalWpp({ show: true, lead: lead, texto: gerarTextoWhatsApp(lead) });
    };

    const abrirFichaLead = (lead) => {
        setModalDetalhe({ show: true, lead: lead });
        carregarHistoricoLead(lead.id);
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
                                    
                                    {/* ÍCONE DE FUNDO DECORATIVO (MARCA D'ÁGUA) */}
                                    <div className={`absolute -right-4 -bottom-4 opacity-[0.03] pointer-events-none ${token.text}`}>
                                        <i data-lucide={token.icone} className="w-32 h-32"></i>
                                    </div>

                                    {/* TOPO: NOME E TIPO */}
                                    <div className="flex justify-between items-start mb-3 relative z-10">
                                        <div>
                                            <h4 
                                                onClick={() => abrirFichaLead(v)}
                                                className="font-black text-slate-800 text-sm leading-tight uppercase cursor-pointer hover:text-blue-600 hover:underline transition-colors"
                                                title="Ver Ficha e Histórico"
                                            >
                                                {v.nome}
                                            </h4>
                                            <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase border ${v.tipo_lead === 'VISITANTE' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : v.tipo_lead === 'CANCELADO/INATIVO' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                {v.tipo_lead || 'Não Informado'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* INFOS BÁSICAS */}
                                    <div className="space-y-2.5 mb-4 flex-1 relative z-10">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            <i data-lucide="calendar-clock" className="w-3 h-3"></i> {formatarDataHora(v.criado_em) || v.data}
                                        </div>
                                        {v.cpf && (
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 tracking-wider">
                                                <i data-lucide="id-card" className="w-3 h-3"></i> {v.cpf}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 w-fit pr-3 py-1 rounded-full border border-slate-100 uppercase">
                                            <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] ml-1 border border-indigo-200">
                                                {v.vendedor ? v.vendedor.charAt(0) : '?'}
                                            </div>
                                            {v.vendedor}
                                        </div>
                                    </div>

                                    {/* RODAPÉ: BOTÕES E MUDANÇA DE STATUS */}
                                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100 mt-auto flex-wrap relative z-10">
                                        <button onClick={() => handleLigarMicroSip(v)} className="flex-1 py-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg flex items-center justify-center gap-1.5 border border-blue-200 transition-colors text-[9px] font-black uppercase tracking-widest" title="Ligar via MicroSIP">
                                            <i data-lucide="phone-call" className="w-3.5 h-3.5"></i> Ligar
                                        </button>
                                        
                                        <button type="button" onClick={() => abrirModalWpp(v)} className="flex-1 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg flex items-center justify-center gap-1.5 border border-emerald-200 transition-colors text-[9px] font-black uppercase tracking-widest">
                                            <i data-lucide="message-circle" className="w-3.5 h-3.5"></i> Whats
                                        </button>
                                        
                                        <select value={v.status} onChange={(e) => alterarStatus(v.id, e.target.value)} className="w-full mt-2 text-[9px] font-black uppercase tracking-widest text-slate-600 border border-slate-200 rounded-lg h-8 px-1.5 bg-slate-50 hover:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors outline-none">
                                            {COLUNAS.map(c => <option key={c} value={c}>Mover: {c}</option>)}
                                        </select>
                                    </div>
                                </div>
                            ))}

                            {/* PLACEHOLDER COLUNA VAZIA */}
                            {leadsDaColuna.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-10 opacity-40">
                                    <i data-lucide="inbox" className="w-8 h-8 text-slate-400 mb-2"></i>
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