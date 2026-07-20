import React, { useState } from 'react';
import { formatarDataHora, STATUS_TOKENS, COLUNAS } from './utils';
import { PhoneCall, MessageCircle, Info, ArrowDownUp, Trash2, Snowflake, Archive, ListPlus } from 'lucide-react';

const Lista = ({ 
    visitantes, 
    alterarStatus, 
    deletarLead, 
    alterarStatusEmLote, 
    deletarLeadsEmLote,  
    setModalWpp, 
    setModalDetalhe, 
    carregarHistoricoLead 
}) => {
    // ESTADOS DE CONTROLE DA TABELA
    const [sortConfig, setSortConfig] = useState({ key: 'puxado_em', direction: 'desc' });
    const [filtroStatus, setFiltroStatus] = useState('');
    const [selecionados, setSelecionados] = useState([]);

    // FUNÇÕES DE AÇÃO INDIVIDUAL
    const handleLigarMicroSip = (telefone) => {
        if (!telefone) return;
        window.location.href = `sip:${telefone.replace(/\D/g, '')}`;
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

    // LÓGICA DE ORDENAÇÃO (De A a Z, Decrescente, etc)
    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    // APLICAR FILTRO E ORDENAÇÃO NA LISTA
    let leadsExibidos = [...visitantes];

    if (filtroStatus) {
        leadsExibidos = leadsExibidos.filter(v => v.status === filtroStatus);
    }

    leadsExibidos.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        // Fallback de ordenação se a chave for data
        if (sortConfig.key === 'puxado_em' || sortConfig.key === 'criado_em') {
            valA = new Date(valA || a.criado_em).getTime();
            valB = new Date(valB || b.criado_em).getTime();
        }

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // LÓGICA DE SELEÇÃO EM LOTE
    const toggleSelectAll = (e) => {
        if (e.target.checked) setSelecionados(leadsExibidos.map(l => l.id));
        else setSelecionados([]);
    };

    const toggleSelectRow = (id) => {
        if (selecionados.includes(id)) setSelecionados(prev => prev.filter(i => i !== id));
        else setSelecionados(prev => [...prev, id]);
    };

    const limparEExecutar = (funcaoDeLote, acaoParam) => {
        if(acaoParam) funcaoDeLote(selecionados, acaoParam);
        else funcaoDeLote(selecionados);
        
        // Limpa as caixinhas após a execução
        setTimeout(() => setSelecionados([]), 500);
    };

    return (
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 animate-[fadeIn_0.3s_ease-out] flex flex-col overflow-hidden min-h-[600px]">
            
            {/* CABEÇALHO COM FILTROS E AÇÕES EM LOTE */}
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4 border-b border-slate-100 pb-6">
                <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <ListPlus className="w-6 h-6 text-blue-500"/> Visão de Lista
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200 ml-2 shadow-sm">{leadsExibidos.length} Filtrados</span>
                    </h3>
                </div>

                <div className="flex items-center gap-3">
                    {/* BARRA DE AÇÕES EM LOTE (Só aparece se alguém estiver selecionado) */}
                    {selecionados.length > 0 && (
                        <div className="flex items-center gap-2 mr-4 animate-[fadeIn_0.2s_ease-out] bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 shadow-sm">
                            <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest mr-2">{selecionados.length} Selecionados:</span>
                            
                            <button onClick={() => limparEExecutar(deletarLeadsEmLote)} className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-black px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 uppercase text-[9px] tracking-widest shadow-sm">
                                <Trash2 className="w-3.5 h-3.5" /> Excluir do Banco
                            </button>

                            <button onClick={() => limparEExecutar(alterarStatusEmLote, 'Perdido')} className="bg-cyan-500 hover:bg-cyan-600 text-white font-black px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 uppercase text-[9px] tracking-widest shadow-sm">
                                <Snowflake className="w-3.5 h-3.5" /> Enviar p/ Geladeira
                            </button>
                        </div>
                    )}

                    {/* FILTRO DE STATUS */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Filtrar:</span>
                        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer uppercase">
                            <option value="">TODOS OS STATUS</option>
                            {COLUNAS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* TABELA DE ALTA PERFORMANCE */}
            <div className="flex-1 overflow-auto custom-scrollbar border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-4 text-center w-12">
                                <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    checked={selecionados.length === leadsExibidos.length && leadsExibidos.length > 0}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => requestSort('nome')}>
                                <div className="flex items-center gap-1">Lead <ArrowDownUp className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                            </th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => requestSort('telefone')}>
                                Contato
                            </th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => requestSort('status')}>
                                <div className="flex items-center gap-1">Fase do Funil <ArrowDownUp className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                            </th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => requestSort('puxado_em')}>
                                <div className="flex items-center gap-1">Entrada (Puxado) <ArrowDownUp className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                            </th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações Individuais</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {leadsExibidos.length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-[10px]">Nenhum lead encontrado neste filtro.</td></tr>
                        ) : (
                            leadsExibidos.map(v => {
                                const isSelected = selecionados.includes(v.id);
                                const token = STATUS_TOKENS[v.status] || STATUS_TOKENS['Novo'];
                                
                                return (
                                    <tr key={v.id} className={`transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`} onClick={() => toggleSelectRow(v.id)}>
                                        <td className="px-4 py-3 text-center">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                                                checked={isSelected} 
                                                onChange={() => {}} // O onClick na linha <tr> cuida da mudança
                                            />
                                        </td>
                                        <td className="px-6 py-3">
                                            <p className="text-sm font-black text-slate-800 uppercase">{v.nome}</p>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-1.5 py-0.5 rounded mt-1 inline-block border border-slate-200 shadow-sm">
                                                {v.tipo_lead || 'LEAD'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            <p className="text-xs font-bold text-slate-600">{v.telefone}</p>
                                        </td>
                                        <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                                            <select 
                                                value={v.status} 
                                                onChange={(e) => alterarStatus(v.id, e.target.value)} 
                                                className={`text-[10px] font-black uppercase tracking-widest border rounded-lg h-8 px-2 outline-none cursor-pointer shadow-sm transition-colors ${token.bg} ${token.text} ${token.border} focus:ring-2 focus:ring-blue-500`}
                                            >
                                                {COLUNAS.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase">
                                            {formatarDataHora(v.puxado_em || v.criado_em)}
                                        </td>
                                        <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleLigarMicroSip(v.telefone)} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-colors shadow-sm border border-blue-100" title="Ligar">
                                                    <PhoneCall className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => abrirModalWpp(v)} className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-colors shadow-sm border border-emerald-100" title="WhatsApp">
                                                    <MessageCircle className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => abrirFichaLead(v)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-800 hover:text-white flex items-center justify-center transition-colors shadow-sm border border-slate-200" title="Ficha Completa">
                                                    <Info className="w-4 h-4" />
                                                </button>
                                                {/* Exclusão individual chama a função Hard Delete do index */}
                                                <button onClick={() => deletarLead(v.id)} className="w-8 h-8 rounded-lg bg-white text-slate-300 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors border border-transparent hover:border-rose-100" title="Excluir Definitivamente">
                                                    <Archive className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Lista;