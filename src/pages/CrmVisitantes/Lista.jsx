import React, { useState } from 'react';
import { formatarDataHora, STATUS_TOKENS, COLUNAS_TELA, faseNaTela, dataDoLead, contatoCombinaComBusca, classeTipoLead, diasParado, DIAS_PARADO_AMARELO } from './utils';
import { PhoneCall, MessageCircle, Info, ArrowDownUp, Trash2, Snowflake, ListPlus, Search, X, Ban, CalendarPlus, Hourglass } from 'lucide-react';
import { EtiquetaParado, EtiquetaProximo, EtiquetaResultado } from './EtiquetasCrm';
import FichaAlunoPopup from './FichaAlunoPopup';
import { tx } from '../../i18n/traduzir.js';
import { ligarPara } from '../../components/celular/telefone.js';
import NumeroErrado from './TelefoneErrado.jsx';
import { numeroErrado } from './telefoneValido.js';
import { OrdenarCelular } from '../../components/celular/Cartao.jsx';

const Lista = ({ 
    visitantes, 
    alterarStatus, 
    deletarLead, 
    alterarStatusEmLote, 
    deletarLeadsEmLote,  
    setModalWpp, 
    setModalDetalhe, 
    carregarHistoricoLead,
    registrarHistorico,
    podeApagar = false,
    usuarioLogado,
    onNaoContatar,
    onProximoContato
}) => {
    const [sortConfig, setSortConfig] = useState({ key: 'puxado_em', direction: 'desc' });
    const [filtroStatus, setFiltroStatus] = useState('');
    const [busca, setBusca] = useState('');
    // "Só parados": contatos há 5 dias ou mais sem nenhuma ação
    const [soParados, setSoParados] = useState(false);
    // Contato cuja ficha de aluno está aberta no pop-up (o CRM fica aberto por baixo)
    const [contatoFicha, setContatoFicha] = useState(null);
    const [selecionados, setSelecionados] = useState([]);

    // Igual ao Kanban: a ligação fica registrada no histórico do contato
    const handleLigarMicroSip = async (lead) => {
        if (numeroErrado(lead)) return;
        if (registrarHistorico) await registrarHistorico(lead.id, 'Ligação', `Tentativa de contato telefônico (MicroSIP) para o número ${lead.telefone}`);
        ligarPara(lead.telefone); // computador: MicroSIP · celular: discador
    };

    const abrirModalWpp = (lead) => {
        if (numeroErrado(lead)) return;
        import('./utils').then(module => {
            const textoPadrao = module.gerarTextoWhatsApp(lead);
            setModalWpp({ show: true, lead: lead, texto: textoPadrao });
        });
    };

    const abrirFichaLead = (lead) => {
        setModalDetalhe({ show: true, lead: lead });
        carregarHistoricoLead(lead.id);
    };

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    let leadsExibidos = [...visitantes];

    if (filtroStatus) {
        leadsExibidos = leadsExibidos.filter(v => faseNaTela(v) === filtroStatus);
    }
    if (busca.trim()) {
        leadsExibidos = leadsExibidos.filter(v => contatoCombinaComBusca(v, busca));
    }
    if (soParados) {
        leadsExibidos = leadsExibidos.filter(v => v.ultima_acao_em !== undefined && (diasParado(v, v.ultima_acao_em) ?? -1) >= DIAS_PARADO_AMARELO);
    }

    leadsExibidos.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        if (sortConfig.key === 'puxado_em' || sortConfig.key === 'criado_em') {
            valA = new Date(valA || dataDoLead(a)).getTime();
            valB = new Date(valB || dataDoLead(b)).getTime();
        }

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

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
        setTimeout(() => setSelecionados([]), 500);
    };

    // CELULAR (26/11/2026): as mesmas ações da tabela, com nome embaixo do ícone
    const botaoCartao = (chave, Icone, rotulo, onClick, cor, desligado = false) => (
        <button key={chave} type="button" onClick={onClick} disabled={desligado} className={`disabled:opacity-40 min-h-12 px-1 py-1 rounded-xl border flex flex-col items-center justify-center gap-0.5 text-[10px] font-black uppercase tracking-wide text-center leading-tight ${cor}`}>
            <Icone className="w-4 h-4 shrink-0" />{rotulo}
        </button>
    );
    const azul = 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-500/20';
    const neutro = 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800';
    const opcoesOrdem = [
        { valor: 'puxado_em|desc', rotulo: `${tx("Entrada (Puxado)")} ↓` },
        { valor: 'puxado_em|asc', rotulo: `${tx("Entrada (Puxado)")} ↑` },
        { valor: 'nome|asc', rotulo: `${tx("Lead")} A→Z` },
        { valor: 'nome|desc', rotulo: `${tx("Lead")} Z→A` },
        { valor: 'status|asc', rotulo: tx("Fase do Funil") },
        { valor: 'status|desc', rotulo: `${tx("Fase do Funil")} ↓` },
        { valor: 'telefone|asc', rotulo: tx("Contato") },
        { valor: 'telefone|desc', rotulo: `${tx("Contato")} ↓` },
    ];

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-3 md:p-6 animate-[fadeIn_0.3s_ease-out] flex flex-col overflow-hidden md:min-h-[600px]">
            
            <div className="flex flex-wrap justify-between items-center mb-3 md:mb-6 gap-3 md:gap-4 border-b border-slate-100 dark:border-slate-800 pb-3 md:pb-6">
                <div>
                    <h3 className="text-lg md:text-xl font-black text-slate-800 dark:text-white tracking-tight flex flex-wrap items-center gap-2">
                        <ListPlus className="w-6 h-6 text-blue-500"/>{' '}{tx("Visão de Lista")}
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded border border-slate-200 dark:border-slate-800 ml-2 shadow-sm">{leadsExibidos.length}{' '}{tx("Filtrados")}</span>
                    </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:gap-3 max-md:w-full">
                    {selecionados.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 md:mr-4 max-md:w-full animate-[fadeIn_0.2s_ease-out] bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-500/30 shadow-sm">
                            <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-widest mr-2">{selecionados.length}{' '}{tx("Selecionados:")}</span>
                            
                            {podeApagar && (
                                <button onClick={() => limparEExecutar(deletarLeadsEmLote)} className="max-md:min-h-10 max-md:flex-1 max-md:justify-center bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 font-black px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 uppercase text-[10px] tracking-widest shadow-sm">
                                    <Trash2 className="w-3.5 h-3.5" />{' '}{tx("Excluir do Banco")}
                                </button>
                            )}

                            <button onClick={() => limparEExecutar(alterarStatusEmLote, 'Perdido')} className="max-md:min-h-10 max-md:flex-1 max-md:justify-center bg-cyan-500 hover:bg-cyan-600 text-white font-black px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 uppercase text-[10px] tracking-widest shadow-sm">
                                <Snowflake className="w-3.5 h-3.5" />{' '}{tx("Enviar p/ Geladeira")}
                            </button>
                        </div>
                    )}

                    <div className="relative max-md:w-full">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={busca}
                            onChange={(e) => { setBusca(e.target.value); setSelecionados([]); }}
                            placeholder={tx("Buscar por nome, CPF ou telefone")}
                            className="w-full sm:w-64 max-md:h-11 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 shadow-sm"
                        />
                        {busca && (
                            <button type="button" onClick={() => { setBusca(''); setSelecionados([]); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 max-md:right-0 max-md:p-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-white" title={tx("Limpar busca")}>
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => { setSoParados(v => !v); setSelecionados([]); }}
                        className={`flex items-center gap-1.5 max-md:h-11 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest shadow-sm transition-colors ${soParados ? 'bg-amber-500 border-amber-500 text-white' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-amber-300 dark:hover:border-amber-500/30'}`}
                        title={tx("Só os contatos há {DIAS_PARADO_AMARELO} dias ou mais sem nenhuma ação", { DIAS_PARADO_AMARELO: DIAS_PARADO_AMARELO })}
                    >
                        <Hourglass className="w-3.5 h-3.5" />{' '}{tx("Só parados")}
                    </button>

                    <div className="flex items-center gap-2 max-md:basis-full max-md:h-11 max-md:min-w-0 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-sm">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tx("Filtrar:")}</span>
                        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="bg-transparent max-md:flex-1 max-md:min-w-0 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer uppercase">
                            <option value="">{tx("TODOS OS STATUS")}</option>
                            {COLUNAS_TELA.map(c => <option key={c} value={c}>{tx(c)}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="md:hidden space-y-2">
                <OrdenarCelular valor={`${sortConfig.key}|${sortConfig.direction}`} opcoes={opcoesOrdem}
                    onChange={(v) => { const [key, direction] = v.split('|'); setSortConfig({ key, direction }); }} />
                {leadsExibidos.length === 0 ? (
                    <p className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-[10px]">{tx("Nenhum lead encontrado neste filtro.")}</p>
                ) : (
                    <>
                        <label className="flex items-center gap-3 min-h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                            <input type="checkbox" className="w-5 h-5 shrink-0 rounded border-slate-300 dark:border-slate-700 text-blue-600" checked={selecionados.length === leadsExibidos.length} onChange={toggleSelectAll} />
                            {tx("Selecionar todos")}
                        </label>
                        {leadsExibidos.map(v => {
                            const marcado = selecionados.includes(v.id);
                            const fase = faseNaTela(v);
                            const token = STATUS_TOKENS[fase] || STATUS_TOKENS['Novo'];
                            return (
                                <div key={v.id} className={`rounded-2xl border p-3 space-y-2 ${marcado ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                                    <div className="flex items-start gap-2">
                                        <label className="shrink-0 -m-2 p-2">
                                            <input type="checkbox" className="block w-5 h-5 rounded border-slate-300 dark:border-slate-700 text-blue-600" checked={marcado} onChange={() => toggleSelectRow(v.id)} aria-label={v.nome} />
                                        </label>
                                        <div className="min-w-0 flex-1">
                                            <button type="button" onClick={() => setContatoFicha(v)} className="text-left text-[13px] font-black uppercase break-words text-blue-700 dark:text-blue-400 underline underline-offset-2">{v.nome}</button>
                                            <p className="text-[13px] font-bold text-slate-600 dark:text-slate-300">{v.telefone}</p>
                                            {numeroErrado(v) && <NumeroErrado lead={v} className="mt-1" />}
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">{tx("Entrada (Puxado)")}: {formatarDataHora(v.puxado_em || dataDoLead(v))}</p>
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded inline-block border shadow-sm ${classeTipoLead(v.tipo_lead)}`}>{tx(v.tipo_lead || 'LEAD')}</span>
                                                <EtiquetaResultado lead={v} />
                                                <EtiquetaProximo lead={v} />
                                                <EtiquetaParado lead={v} />
                                            </div>
                                        </div>
                                    </div>
                                    <select value={fase} onChange={(e) => alterarStatus(v.id, e.target.value)} aria-label={tx("Fase do Funil")}
                                        className={`w-full h-11 text-[10px] font-black uppercase tracking-widest border rounded-xl px-2 outline-none ${token.bg} ${token.text} ${token.border}`}>
                                        {COLUNAS_TELA.map(c => <option key={c} value={c}>{tx(c)}</option>)}
                                    </select>
                                    <div className="grid grid-cols-3 gap-2">
                                        {botaoCartao('wpp', MessageCircle, tx("WhatsApp"), () => abrirModalWpp(v), 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-500/20', numeroErrado(v))}
                                        {botaoCartao('ligar', PhoneCall, tx("Ligar"), () => handleLigarMicroSip(v), azul, numeroErrado(v))}
                                        {botaoCartao('ficha', Info, tx("Ficha Completa"), () => abrirFichaLead(v), neutro)}
                                        {onProximoContato && botaoCartao('prox', CalendarPlus, tx("Próximo contato"), () => onProximoContato(v), azul)}
                                        {onNaoContatar && botaoCartao('nao', Ban, tx("Não contatar"), () => onNaoContatar(v), neutro)}
                                        {podeApagar && botaoCartao('apagar', Trash2, tx("Excluir"), () => deletarLead(v.id), 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20')}
                                    </div>
                                </div>
                            );
                        })}
                    </>
                )}
            </div>

            <div className="hidden md:block flex-1 overflow-auto custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 sticky top-0 z-10 shadow-sm border-b border-slate-200 dark:border-slate-800">
                        <tr>
                            <th className="px-4 py-4 text-center w-12">
                                <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 focus:ring-blue-500 cursor-pointer"
                                    checked={selecionados.length === leadsExibidos.length && leadsExibidos.length > 0}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group" onClick={() => requestSort('nome')}>
                                <div className="flex items-center gap-1">{tx("Lead")}{' '}<ArrowDownUp className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                            </th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group" onClick={() => requestSort('telefone')}>
                                {tx("Contato")}
                            </th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group" onClick={() => requestSort('status')}>
                                <div className="flex items-center gap-1">{tx("Fase do Funil")}{' '}<ArrowDownUp className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                            </th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group" onClick={() => requestSort('puxado_em')}>
                                <div className="flex items-center gap-1">{tx("Entrada (Puxado)")}{' '}<ArrowDownUp className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                            </th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{tx("Ações Individuais")}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {leadsExibidos.length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-[10px]">{tx("Nenhum lead encontrado neste filtro.")}</td></tr>
                        ) : (
                            leadsExibidos.map(v => {
                                const isSelected = selecionados.includes(v.id);
                                const fase = faseNaTela(v);
                                const token = STATUS_TOKENS[fase] || STATUS_TOKENS['Novo'];

                                return (
                                    <tr key={v.id} className={`transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/50 dark:bg-blue-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`} onClick={() => toggleSelectRow(v.id)}>
                                        <td className="px-4 py-3 text-center">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 focus:ring-blue-500 cursor-pointer" 
                                                checked={isSelected} 
                                                onChange={() => {}} 
                                            />
                                        </td>
                                        <td className="px-6 py-3">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setContatoFicha(v); }}
                                                className="text-sm font-black text-slate-800 dark:text-white uppercase flex items-center gap-2 text-left hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-2 transition-colors"
                                                title={tx("Abrir a ficha do aluno")}
                                            >
                                                {v.nome}
                                            </button>
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded mt-1 inline-block border shadow-sm ${classeTipoLead(v.tipo_lead)}`}>
                                                {tx(v.tipo_lead || 'LEAD')}
                                            </span>
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                <EtiquetaResultado lead={v} />
                                                <EtiquetaProximo lead={v} />
                                                <EtiquetaParado lead={v} />
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{v.telefone}</p>
                                            {numeroErrado(v) && <NumeroErrado lead={v} className="mt-1" />}
                                        </td>
                                        <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                                            <select 
                                                value={fase}
                                                onChange={(e) => alterarStatus(v.id, e.target.value)}
                                                className={`text-[10px] font-black uppercase tracking-widest border rounded-lg h-8 px-2 outline-none cursor-pointer shadow-sm transition-colors ${token.bg} ${token.text} ${token.border} focus:ring-2 focus:ring-blue-500`}
                                            >
                                                {COLUNAS_TELA.map(c => <option key={c} value={c}>{tx(c)}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-6 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                                            {formatarDataHora(v.puxado_em || dataDoLead(v))}
                                        </td>
                                        <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleLigarMicroSip(v)} disabled={numeroErrado(v)} className="disabled:opacity-40 disabled:pointer-events-none w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-colors shadow-sm border border-blue-100 dark:border-blue-500/20" title={tx("Ligar")}>
                                                    <PhoneCall className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => abrirModalWpp(v)} disabled={numeroErrado(v)} className="disabled:opacity-40 disabled:pointer-events-none w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-colors shadow-sm border border-emerald-100 dark:border-emerald-500/20" title={tx("WhatsApp")}>
                                                    <MessageCircle className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => abrirFichaLead(v)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-800 hover:text-white flex items-center justify-center transition-colors shadow-sm border border-slate-200 dark:border-slate-800" title={tx("Ficha Completa")}>
                                                    <Info className="w-4 h-4" />
                                                </button>
                                                {onProximoContato && (
                                                    <button onClick={() => onProximoContato(v)} className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-colors shadow-sm border border-blue-100 dark:border-blue-500/20" title={tx("Marcar o próximo contato")}>
                                                        <CalendarPlus className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {onNaoContatar && (
                                                    <button onClick={() => onNaoContatar(v)} className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-colors border border-transparent hover:border-rose-100 dark:hover:border-rose-500/20" title={tx("Não contatar (a pessoa pediu para não receber contato)")}>
                                                        <Ban className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {podeApagar && (
                                                    <button onClick={() => deletarLead(v.id)} className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-colors border border-transparent hover:border-rose-100 dark:hover:border-rose-500/20" title={tx("Excluir Definitivamente")}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {contatoFicha && (
                <FichaAlunoPopup contato={contatoFicha} usuarioLogado={usuarioLogado} onFechar={() => setContatoFicha(null)} />
            )}
        </div>
    );
};

export default Lista;