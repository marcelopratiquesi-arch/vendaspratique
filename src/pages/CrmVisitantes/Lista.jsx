import React from 'react';
import { formatarDataHora, gerarTextoWhatsApp, STATUS_TOKENS, COLUNAS } from './utils';

const Lista = ({ 
    visitantes, 
    alterarStatus, 
    deletarLead, 
    setModalWpp, 
    setModalDetalhe,
    carregarHistoricoLead,
    registrarHistorico
}) => {

    // ==========================================
    // AÇÕES EXCLUSIVAS DA LISTA
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
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden animate-[fadeIn_0.3s_ease-out]">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <i data-lucide="list-checks" className="w-5 h-5 text-blue-500"></i> Relatório Geral de Leads
                </h3>
                <span className="text-[10px] font-black text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
                    {visitantes.length} Registros
                </span>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-slate-50/50">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Data e Hora</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Aluno / Lead</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Origem</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Contato</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Consultor</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 w-48 text-center">Fase Funil</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {visitantes.length > 0 ? visitantes.map(v => {
                            const token = STATUS_TOKENS[v.status] || STATUS_TOKENS['Novo'];
                            
                            return (
                                <tr key={v.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase align-middle">
                                        {formatarDataHora(v.criado_em) || v.data}
                                    </td>
                                    <td className="px-6 py-4 align-middle">
                                        <p 
                                            onClick={() => abrirFichaLead(v)}
                                            className="text-xs font-black text-slate-800 uppercase cursor-pointer hover:text-blue-600 hover:underline transition-colors"
                                            title="Ver Ficha e Histórico"
                                        >
                                            {v.nome}
                                        </p>
                                        {v.cpf && <p className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-wider">CPF: {v.cpf}</p>}
                                    </td>
                                    <td className="px-6 py-4 align-middle">
                                        <span className={`px-2 py-1 rounded text-[9px] font-black tracking-widest uppercase border ${v.tipo_lead === 'VISITANTE' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : v.tipo_lead === 'CANCELADO/INATIVO' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                            {v.tipo_lead || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 align-middle">
                                        <p className="text-xs font-bold text-slate-600">{v.telefone}</p>
                                    </td>
                                    <td className="px-6 py-4 align-middle">
                                        <span className="text-[10px] font-black uppercase text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                            {v.vendedor}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 align-middle">
                                        <select
                                            value={v.status}
                                            onChange={(e) => alterarStatus(v.id, e.target.value)}
                                            className={`w-full text-[10px] font-black uppercase tracking-widest border rounded-lg h-9 px-2 cursor-pointer transition-all outline-none focus:ring-2 focus:ring-blue-500 ${token.bg} ${token.text} ${token.border}`}
                                        >
                                            {COLUNAS.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 text-center align-middle">
                                        <div className="flex items-center justify-center gap-2">
                                            <button 
                                                onClick={() => handleLigarMicroSip(v)} 
                                                className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg flex items-center justify-center gap-1.5 border border-blue-200 transition-colors text-[10px] font-black uppercase tracking-widest"
                                                title="Ligar via MicroSIP"
                                            >
                                                <i data-lucide="phone-call" className="w-3.5 h-3.5"></i> Ligar
                                            </button>
                                            
                                            <button 
                                                onClick={() => abrirModalWpp(v)}
                                                className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg flex items-center justify-center gap-1.5 border border-emerald-200 transition-colors text-[10px] font-black uppercase tracking-widest"
                                                title="Chamar no WhatsApp"
                                            >
                                                <i data-lucide="message-circle" className="w-3.5 h-3.5"></i> Whats
                                            </button>
                                            
                                            <button 
                                                onClick={() => deletarLead(v.id)} 
                                                className="px-3 py-1.5 bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white rounded-lg flex items-center justify-center gap-1.5 border border-rose-200 transition-colors text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100"
                                                title="Excluir"
                                            >
                                                <i data-lucide="trash-2" className="w-3.5 h-3.5"></i> Excluir
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan="7" className="text-center py-16 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                    Nenhum visitante ou lead encontrado.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Lista;