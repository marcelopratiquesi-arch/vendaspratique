import React, { useState, useEffect, useRef } from 'react';
import { formatarDataHora, STATUS_TOKENS, COLUNAS, dataDoLead, mesmoNome, contarPessoasDaMeta, linkWhatsApp as montarLinkWhatsApp, situacaoProximoContato, formatarDiaCurto } from './utils';
import { carregarResumoDoDia } from './contatosFeitos';
import { 
    MessageCircle, X, Copy, Send, Phone, IdCard, Info, 
    PenTool, History, Loader2, Trophy, Target, UserPlus, MoveRight, 
    CheckCircle2, PhoneCall, Save, Calendar, User, AlignLeft, CreditCard, Ban, CalendarClock, Snowflake
} from 'lucide-react';
import { avisar } from '../../components/avisar.js';

const Modais = ({
    modalWpp, setModalWpp,
    modalDetalhe, setModalDetalhe,
    historicoLead, loadingHistorico, registrarHistorico, alterarStatus,
    mostrarRelatorio, setMostrarRelatorio, progressoHoje = [], 
    consultorAtivo, usuarioLogado, META_DIARIA = 150,
    visitantes = [], setConsultorAtivo,
    onNaoContatar,
    onProximoContato,
    aoEnviarWhatsApp
}) => {
    const [novaNota, setNovaNota] = useState('');
    const [textoRelatorio, setTextoRelatorio] = useState('');

    // ==========================================
    // DRAG & DROP (JANELAS FLUTUANTES)
    // ==========================================
    const [posWpp, setPosWpp] = useState({ x: 0, y: 0 });
    const [isDraggingWpp, setIsDraggingWpp] = useState(false);
    const dragInfoWpp = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDraggingWpp) return;
            setPosWpp({ x: dragInfoWpp.current.initialX + (e.clientX - dragInfoWpp.current.startX), y: dragInfoWpp.current.initialY + (e.clientY - dragInfoWpp.current.startY) });
        };
        const handleMouseUp = () => setIsDraggingWpp(false);
        if (isDraggingWpp) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); }
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }, [isDraggingWpp]);

    const handleMouseDownWpp = (e) => { setIsDraggingWpp(true); dragInfoWpp.current = { startX: e.clientX, startY: e.clientY, initialX: posWpp.x, initialY: posWpp.y }; };

    const [posDetalhe, setPosDetalhe] = useState({ x: 0, y: 0 });
    const [isDraggingDetalhe, setIsDraggingDetalhe] = useState(false);
    const dragInfoDetalhe = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDraggingDetalhe) return;
            setPosDetalhe({ x: dragInfoDetalhe.current.initialX + (e.clientX - dragInfoDetalhe.current.startX), y: dragInfoDetalhe.current.initialY + (e.clientY - dragInfoDetalhe.current.startY) });
        };
        const handleMouseUp = () => setIsDraggingDetalhe(false);
        if (isDraggingDetalhe) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); }
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }, [isDraggingDetalhe]);

    const handleMouseDownDetalhe = (e) => { setIsDraggingDetalhe(true); dragInfoDetalhe.current = { startX: e.clientX, startY: e.clientY, initialX: posDetalhe.x, initialY: posDetalhe.y }; };

    const [posRelatorio, setPosRelatorio] = useState({ x: 0, y: 0 });
    const [isDraggingRelatorio, setIsDraggingRelatorio] = useState(false);
    const dragInfoRelatorio = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDraggingRelatorio) return;
            setPosRelatorio({ x: dragInfoRelatorio.current.initialX + (e.clientX - dragInfoRelatorio.current.startX), y: dragInfoRelatorio.current.initialY + (e.clientY - dragInfoRelatorio.current.startY) });
        };
        const handleMouseUp = () => setIsDraggingRelatorio(false);
        if (isDraggingRelatorio) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); }
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }, [isDraggingRelatorio]);

    const handleMouseDownRelatorio = (e) => { setIsDraggingRelatorio(true); dragInfoRelatorio.current = { startX: e.clientX, startY: e.clientY, initialX: posRelatorio.x, initialY: posRelatorio.y }; };

    // ==========================================
    // AÇÕES DE VENDAS E HISTÓRICO
    // ==========================================
    const handleLigarMicroSip = async (lead) => {
        if(!lead || !lead.telefone) return;
        await registrarHistorico(lead.id, 'Ligação', `Tentativa de contato telefônico direto da Ficha (MicroSIP) para o número ${lead.telefone}`);
        window.location.href = `sip:${lead.telefone.replace(/\D/g, '')}`;
    };

    const enviarWppDireto = async () => {
        if (!modalWpp.lead) return;
        await registrarHistorico(modalWpp.lead.id, 'WhatsApp', `Mensagem enviada: "${modalWpp.texto}"`);
        const linkWhatsApp = montarLinkWhatsApp(modalWpp.lead.telefone, modalWpp.texto);
        window.open(linkWhatsApp, '_blank');
        const leadContatado = modalWpp.lead;
        setModalWpp({ show: false, lead: null, texto: '' });
        // Contato marcado para hoje (ou atrasado): o CRM já pergunta quando é o próximo
        if (aoEnviarWhatsApp) aoEnviarWhatsApp(leadContatado);
    };

    const adicionarNotaManual = async (e) => {
        if(e) e.preventDefault();
        if (!novaNota.trim() || !modalDetalhe.lead) return;
        const texto = novaNota;
        setNovaNota('');
        await registrarHistorico(modalDetalhe.lead.id, 'Observação', texto);
    };

    const abrirWhatsAppPelaFicha = (lead) => {
        import('./utils').then(module => {
            setModalWpp({ show: true, lead: lead, texto: module.gerarTextoWhatsApp(lead) });
        });
    };

    // ==========================================
    // GERADOR DE RELATÓRIO DO TURNO
    // ==========================================
    const gerarRelatorioWhatsApp = (resumoDia = null) => {
        const validos = progressoHoje.filter(p => p && p.data_contato);
        const nomeGerador = consultorAtivo ? consultorAtivo.nome : (usuarioLogado?.nome || 'Equipe');

        let hrs = 0, mins = 0, primeiroTexto = '--:--', ultimoTexto = '--:--';
        const contadores = {
            '👤 Capturas (Novos Leads)': 0,
            '💬 WhatsApp Enviados': 0,
            '📞 Ligações Realizadas': 0,
            '📝 Fichas Atualizadas': 0,
            '➡️ Moveu p/ Em Contato': 0,
            '🏆 Vendas Concluídas': 0,
            '❌ Moveu p/ Perdido': 0,
        };
        let outrasAcoes = 0;

        if (validos.length > 0) {
            const progressoOrdenado = [...validos].sort((a, b) => new Date(a.data_contato).getTime() - new Date(b.data_contato).getTime());
            const primeiro = new Date(progressoOrdenado[0].data_contato);
            const ultimo = new Date(progressoOrdenado[progressoOrdenado.length - 1].data_contato);
            const diffMs = ultimo.getTime() - primeiro.getTime();
            hrs = Math.floor(diffMs / 3600000);
            mins = Math.floor((diffMs % 3600000) / 60000);
            primeiroTexto = primeiro.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
            ultimoTexto = ultimo.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

            progressoOrdenado.forEach(p => {
                if (p.tipo === 'Captura') contadores['👤 Capturas (Novos Leads)']++;
                else if (p.tipo === 'Ligação') contadores['📞 Ligações Realizadas']++;
                else if (p.tipo === 'WhatsApp') contadores['💬 WhatsApp Enviados']++;
                else if (p.tipo === 'Observação') contadores['📝 Fichas Atualizadas']++;
                else if (p.tipo === 'Mudança de Fase') {
                    if (p.observacao?.includes('para "Em Contato"')) contadores['➡️ Moveu p/ Em Contato']++;
                    else if (p.observacao?.includes('para "Fechado"')) contadores['🏆 Vendas Concluídas']++;
                    else if (p.observacao?.includes('para "Perdido"')) contadores['❌ Moveu p/ Perdido']++;
                    else outrasAcoes++;
                }
            });
        }

        // "visitantes" já chega só com a carteira de quem opera (inclusive os perdidos da Geladeira)
        const meusLeads = visitantes.filter(v => mesmoNome(v.puxado_por || v.vendedor, nomeGerador));
        const snapshotFunil = {
            'Novo': meusLeads.filter(v => v.status === 'Novo').length,
            'Em Contato': meusLeads.filter(v => v.status === 'Em Contato').length,
            'Fechado': meusLeads.filter(v => v.status === 'Fechado').length,
            'Perdido': meusLeads.filter(v => v.status === 'Perdido').length,
        };

        let texto = `📊 *RELATÓRIO DE FECHAMENTO - PRATIQUE*\n`;
        texto += `👤 Consultor(a): *${nomeGerador}*\n`;
        texto += `🎯 Meta Atingida: *${contarPessoasDaMeta(validos)} / ${META_DIARIA} Pessoas contatadas* (${validos.length} ações)\n`;
        texto += `⏱️ Turno Focado: *${hrs}h ${mins}m* (Das ${primeiroTexto} às ${ultimoTexto})\n\n`;
        
        texto += `*🔥 PRODUTIVIDADE HOJE:*\n`;
        let teveAcao = false;
        Object.keys(contadores).forEach(k => { 
            if (contadores[k] > 0) { texto += `${k}: *${contadores[k]}*\n`; teveAcao = true; }
        });
        if (outrasAcoes > 0) texto += `🔄 Outras Movimentações: *${outrasAcoes}*\n`;
        if (!teveAcao && outrasAcoes === 0) texto += `Nenhuma interação registrada neste turno.\n`;

        // Contatos do dia (pop-up "Contatos de hoje", Migração e Não contatar), lidos do banco
        if (resumoDia) {
            const linhaTipo = (tipo) => {
                const doTipo = resumoDia.feitos.filter(f => f.tipo === tipo);
                const viaWpp = doTipo.filter(f => f.canal === 'WHATSAPP').length;
                const semWpp = doTipo.length - viaWpp;
                return `*${doTipo.length}* (${viaWpp} WhatsApp${semWpp > 0 ? ` · ${semWpp} sem WhatsApp ⚠️` : ''})`;
            };
            texto += `\n*📅 CONTATOS DO DIA:*\n`;
            texto += `🎂 Aniversários: ${linhaTipo('ANIVERSARIO')}\n`;
            texto += `👋 Visitantes 24h: ${linhaTipo('VISITANTE_24H')}\n`;
            texto += `🔁 Visitantes 48h: ${linhaTipo('VISITANTE_48H')}\n`;
            texto += `🥗 Migração: ${linhaTipo('MIGRACAO')} · *${resumoDia.interessados}* interessado(s)\n`;
            texto += `🚫 Não contatar: *${resumoDia.naoContatar}*\n`;
        }

        texto += `\n*📸 FOTO DA MINHA CARTEIRA:*\n`;
        texto += `⭐ Novos (Aguardando): *${snapshotFunil['Novo']}*\n`;
        texto += `📲 Em Contato: *${snapshotFunil['Em Contato']}*\n`;
        texto += `✅ Fechados (Total): *${snapshotFunil['Fechado']}*\n`;
        texto += `❌ Perdidos: *${snapshotFunil['Perdido']}*\n`;
        
        return texto;
    };

    useEffect(() => {
        if (mostrarRelatorio) {
            setTextoRelatorio(gerarRelatorioWhatsApp(null));
            setPosRelatorio({ x: 0, y: 0 });
            // Completa com os contatos do dia assim que o resumo chega do banco
            let ativo = true;
            const nomeGerador = consultorAtivo ? consultorAtivo.nome : (usuarioLogado?.nome || 'Equipe');
            carregarResumoDoDia(nomeGerador).then(resumo => {
                if (ativo && resumo) setTextoRelatorio(gerarRelatorioWhatsApp(resumo));
            });
            return () => { ativo = false; };
        }
        return undefined;
    }, [mostrarRelatorio, progressoHoje, consultorAtivo, visitantes, usuarioLogado?.nome]);

    return (
        <>
            {/* ==========================================
                1. MODAL: WHATSAPP (ENVIO RÁPIDO)
                ========================================== */}
            {modalWpp.show && modalWpp.lead && (
                <div className="fixed inset-0 z-[250] pointer-events-none flex items-center justify-center p-4">
                    <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-[0_15px_50px_rgba(0,0,0,0.2)] flex flex-col border border-slate-300 dark:border-slate-700 pointer-events-auto overflow-hidden animate-[zoomIn_0.2s_ease-out]" style={{ width: 'min(550px, 100%)', minHeight: 'min(400px, 85vh)', maxHeight: '90vh', transform: `translate(${posWpp.x}px, ${posWpp.y}px)`, resize: 'both', overflow: 'hidden' }}>
                        <div onMouseDown={handleMouseDownWpp} className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60 cursor-move hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0">
                            <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase tracking-widest flex items-center gap-2 pointer-events-none">
                                <MessageCircle className="w-5 h-5 text-emerald-500" /> Revisão de Mensagem
                            </h3>
                            <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setModalWpp({ show: false, lead: null, texto: '' })} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 p-6 flex flex-col overflow-hidden">
                            <div className="flex items-center gap-3 mb-4 shrink-0">
                                <span className={`inline-block px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase border shadow-sm ${STATUS_TOKENS[modalWpp.lead.status]?.bg} ${STATUS_TOKENS[modalWpp.lead.status]?.text} ${STATUS_TOKENS[modalWpp.lead.status]?.border}`}>Fase: {modalWpp.lead.status}</span>
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Enviando para: <strong className="text-slate-800 dark:text-white">{modalWpp.lead.nome}</strong></span>
                            </div>
                            <textarea value={modalWpp.texto} onChange={(e) => setModalWpp({ ...modalWpp, texto: e.target.value })} className="flex-1 w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-sm font-medium text-slate-700 dark:text-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none transition-all custom-scrollbar leading-relaxed shadow-inner dark:focus:bg-slate-900"></textarea>
                        </div>
                        <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex gap-4 shrink-0">
                            <button onClick={() => { navigator.clipboard.writeText(modalWpp.texto); avisar("Texto copiado!"); }} className="flex-1 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white font-black uppercase tracking-widest text-[11px] rounded-xl transition-all shadow-sm flex items-center justify-center gap-2">
                                <Copy className="w-4 h-4" /> Copiar
                            </button>
                            <button onClick={enviarWppDireto} className="flex-[2] py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest text-[11px] rounded-xl transition-all shadow-[0_4px_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2">
                                <Send className="w-4 h-4" /> Enviar Mensagem
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                2. MODAL: FICHA COMPLETA DO LEAD (Aumentado para 1100x650)
                ========================================== */}
            {modalDetalhe.show && modalDetalhe.lead && (
                <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center p-4 lg:p-10">
                    <div className="relative bg-white dark:bg-slate-900 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.4)] flex flex-col pointer-events-auto border-2 border-slate-300 dark:border-slate-700 overflow-hidden animate-[scaleIn_0.2s_ease-out]" style={{ width: 'min(1100px, 100%)', minHeight: 'min(650px, 85vh)', maxHeight: '90vh', transform: `translate(${posDetalhe.x}px, ${posDetalhe.y}px)`, resize: 'both', overflow: 'hidden' }}>
                        
                        {/* CABEÇALHO ARRASTÁVEL ESCURO */}
                        <div onMouseDown={handleMouseDownDetalhe} className="bg-slate-900 p-6 lg:px-8 flex justify-between items-start shrink-0 cursor-move hover:bg-slate-800 transition-colors">
                            <div className="pointer-events-none">
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                    <h2 className="text-xl md:text-3xl font-black text-white tracking-tight uppercase break-words">{modalDetalhe.lead.nome}</h2>
                                    <span className={`px-2.5 py-1 rounded text-[10px] font-black tracking-widest uppercase border ${modalDetalhe.lead.tipo_lead === 'VISITANTE' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : String(modalDetalhe.lead.tipo_lead || '').toUpperCase() === 'CANCELADO' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-orange-500/20 text-orange-300 border-orange-500/30'}`}>{modalDetalhe.lead.tipo_lead || 'LEAD'}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm font-bold text-slate-400">
                                    <span className="flex items-center gap-2 text-blue-300"><Phone className="w-4 h-4" /> {modalDetalhe.lead.telefone}</span>
                                    {modalDetalhe.lead.cpf && <span className="flex items-center gap-2"><IdCard className="w-4 h-4" /> {modalDetalhe.lead.cpf}</span>}
                                </div>
                            </div>
                            <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setModalDetalhe({ show: false, lead: null })} className="w-12 h-12 bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white rounded-xl flex items-center justify-center transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-800/60">
                            
                            {/* COLUNA ESQUERDA (Ações e Metadados) */}
                            <div className="w-full lg:w-[380px] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-y-auto custom-scrollbar shrink-0">
                                
                                {/* BOTÕES GIGANTES DE AÇÃO DIRETA */}
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/60 flex gap-4 shrink-0">
                                    <button 
                                        onClick={() => handleLigarMicroSip(modalDetalhe.lead)} 
                                        className="flex-1 flex flex-col items-center justify-center gap-2.5 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-600 text-blue-600 dark:text-blue-400 hover:text-white border border-blue-200 dark:border-blue-500/30 py-4 rounded-2xl transition-all shadow-sm group"
                                    >
                                        <PhoneCall className="w-6 h-6" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Ligar</span>
                                    </button>
                                    <button 
                                        onClick={() => abrirWhatsAppPelaFicha(modalDetalhe.lead)} 
                                        className="flex-1 flex flex-col items-center justify-center gap-2.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-600 text-emerald-600 dark:text-emerald-400 hover:text-white border border-emerald-200 dark:border-emerald-500/30 py-4 rounded-2xl transition-all shadow-sm group"
                                    >
                                        <MessageCircle className="w-6 h-6" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">WhatsApp</span>
                                    </button>
                                </div>

                                {onNaoContatar && (
                                    <button type="button" onClick={() => onNaoContatar(modalDetalhe.lead)} className="mx-6 mt-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors" title="A pessoa pediu para não receber contato">
                                        <Ban className="w-4 h-4" /> Não contatar
                                    </button>
                                )}

                                <div className="p-6 space-y-6 flex-1">
                                    {/* MUDAR FASE */}
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-2"><AlignLeft className="w-4 h-4"/> Fase Atual no Funil</label>
                                        <select 
                                            value={modalDetalhe.lead.status} 
                                            onChange={(e) => alterarStatus(modalDetalhe.lead.id, e.target.value)}
                                            className={`w-full text-xs font-black uppercase tracking-widest border-2 rounded-xl p-4 outline-none cursor-pointer shadow-sm transition-all focus:ring-4 focus:ring-blue-500/20 ${STATUS_TOKENS[modalDetalhe.lead.status]?.bg} ${STATUS_TOKENS[modalDetalhe.lead.status]?.text} ${STATUS_TOKENS[modalDetalhe.lead.status]?.border}`}
                                        >
                                            {COLUNAS.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        {modalDetalhe.lead.status === 'Perdido' && modalDetalhe.lead.motivo_perda && (
                                            <p className="mt-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl px-3 py-2">
                                                <Snowflake className="w-3.5 h-3.5 shrink-0" /> Motivo da perda: {modalDetalhe.lead.motivo_perda}
                                            </p>
                                        )}
                                    </div>

                                    {/* PRÓXIMO CONTATO (Bloco 4) */}
                                    {onProximoContato && ['Novo', 'Em Contato'].includes(modalDetalhe.lead.status) && (() => {
                                        const situacao = situacaoProximoContato(modalDetalhe.lead);
                                        const cor = situacao === 'atrasado' ? 'text-rose-600 dark:text-rose-400' : situacao === 'hoje' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200';
                                        return (
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-2"><CalendarClock className="w-4 h-4"/> Próximo contato</label>
                                                <button type="button" onClick={() => onProximoContato(modalDetalhe.lead)} className="w-full flex items-center justify-between gap-3 border-2 border-blue-100 dark:border-blue-500/20 hover:border-blue-300 dark:hover:border-blue-500/40 bg-blue-50/50 dark:bg-blue-500/5 rounded-xl px-4 py-3 transition-colors">
                                                    <span className={`text-xs font-black uppercase tracking-widest ${cor}`}>
                                                        {situacao ? `${situacao === 'atrasado' ? 'Atrasado · ' : situacao === 'hoje' ? 'Hoje · ' : ''}${formatarDiaCurto(modalDetalhe.lead.proximo_contato)}` : 'Sem data marcada'}
                                                    </span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">{situacao ? 'Mudar' : 'Marcar'}</span>
                                                </button>
                                            </div>
                                        );
                                    })()}

                                    {/* INFORMAÇÕES DE CADASTRO */}
                                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                                        <div className="flex items-center gap-4 text-sm">
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-100 dark:border-blue-500/20 shrink-0">
                                                <User className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Consultor Responsável</p>
                                                <p className="font-black text-slate-700 dark:text-slate-200 uppercase leading-tight">{modalDetalhe.lead.vendedor || 'Não Atribuído'}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 text-sm">
                                            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-500 flex items-center justify-center border border-orange-100 dark:border-orange-500/20 shrink-0">
                                                <Calendar className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Data de Captura</p>
                                                <p className="font-bold text-slate-700 dark:text-slate-200 leading-tight">{formatarDataHora(modalDetalhe.lead.puxado_em || dataDoLead(modalDetalhe.lead))}</p>
                                            </div>
                                        </div>

                                        {modalDetalhe.lead.cpf && (
                                            <div className="flex items-center gap-4 text-sm">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center border border-slate-200 dark:border-slate-800 shrink-0">
                                                    <CreditCard className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Golden Record (CPF)</p>
                                                    <p className="font-black text-slate-700 dark:text-slate-200 leading-tight">{modalDetalhe.lead.cpf}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* COLUNA DIREITA (Histórico e Anotações) */}
                            <div className="flex-1 p-0 flex flex-col bg-white dark:bg-slate-900 overflow-hidden relative">
                                <div className="p-6 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 shrink-0">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-2">
                                        <History className="w-5 h-5 text-blue-500" /> Linha do Tempo e Anotações
                                    </h3>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8 relative bg-slate-50/50 dark:bg-slate-800/60">
                                    <div className="absolute left-[35px] lg:left-[43px] top-6 bottom-6 w-px bg-slate-200 dark:bg-slate-800"></div>
                                    {loadingHistorico ? (
                                        <div className="flex items-center justify-center h-full text-slate-400"><Loader2 className="w-8 h-8 animate-spin" /></div>
                                    ) : historicoLead.length === 0 ? (
                                        <p className="text-center text-slate-400 font-bold text-sm mt-10 uppercase tracking-widest">Nenhum histórico registrado.</p>
                                    ) : (
                                        <div className="space-y-6 relative">
                                            {historicoLead.map(h => {
                                                let IconeAcao = Info; let corAcao = 'bg-slate-500';
                                                if(h.tipo_acao === 'Captura') { IconeAcao = UserPlus; corAcao = 'bg-emerald-500'; }
                                                else if(h.tipo_acao === 'WhatsApp') { IconeAcao = MessageCircle; corAcao = 'bg-emerald-500'; }
                                                else if(h.tipo_acao === 'Ligação') { IconeAcao = Phone; corAcao = 'bg-blue-500'; }
                                                else if(h.tipo_acao === 'Mudança de Fase') { IconeAcao = MoveRight; corAcao = 'bg-orange-500'; }
                                                else if(h.tipo_acao === 'Observação') { IconeAcao = PenTool; corAcao = 'bg-purple-500'; }
                                                else if(h.tipo_acao === 'Agendamento') { IconeAcao = CalendarClock; corAcao = 'bg-blue-500'; }
                                                // Contato feito SEM WhatsApp: em vermelho, para o Líder conferir
                                                const semWhatsApp = /SEM WhatsApp/.test(String(h.observacao || ''));
                                                if (semWhatsApp) corAcao = 'bg-rose-600';
                                                
                                                return (
                                                    <div key={h.id} className="flex gap-4 relative animate-[fadeIn_0.3s_ease-out]">
                                                        <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center text-white border-4 border-slate-50 dark:border-slate-800 shadow-sm relative z-10 ${corAcao}`}>
                                                            <IconeAcao className="w-5 h-5" />
                                                        </div>
                                                        <div className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm flex-1 mb-2 hover:shadow-md transition-shadow ${semWhatsApp ? 'border-rose-300 dark:border-rose-500/40' : 'border-slate-200 dark:border-slate-800'}`}>
                                                            <div className="flex justify-between items-start mb-3 border-b border-slate-50 dark:border-slate-800 pb-3">
                                                                <span className="text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{h.tipo_acao}</span>
                                                                <span className="text-[11px] font-bold text-slate-400">{formatarDataHora(h.data_registro)}</span>
                                                            </div>
                                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">{h.observacao}</p>
                                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-4 text-right">— Por: {h.consultor}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* CAIXA DE ANOTAÇÃO (Fixa no rodapé da direita) */}
                                <form onSubmit={adicionarNotaManual} className="p-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] shrink-0">
                                    <div className="flex gap-3">
                                        <input 
                                            type="text" 
                                            value={novaNota} 
                                            onChange={(e) => setNovaNota(e.target.value)} 
                                            placeholder="Descreva o que aconteceu neste contato..." 
                                            className="flex-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 text-sm font-medium text-slate-700 dark:text-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner dark:focus:bg-slate-900"
                                        />
                                        <button type="submit" disabled={!novaNota.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black px-8 py-4 rounded-xl transition-all shadow-[0_4px_15px_rgba(37,99,235,0.3)] flex items-center justify-center gap-2 uppercase text-[11px] tracking-widest shrink-0">
                                            <Save className="w-5 h-5" /> Salvar Nota
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                3. MODAL: RELATÓRIO DO DIA (FECHAMENTO)
                ========================================== */}
            {mostrarRelatorio && (
                <div className="fixed inset-0 z-[300] pointer-events-none flex items-center justify-center p-4">
                    <div 
                        className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-[0_15px_50px_rgba(0,0,0,0.2)] flex flex-col pointer-events-auto border border-slate-300 dark:border-slate-700 overflow-hidden animate-[zoomIn_0.2s_ease-out]" 
                        style={{ 
                            width: 'min(450px, 100%)', minHeight: 'min(520px, 85vh)', maxHeight: '90vh', 
                            transform: `translate(${posRelatorio.x}px, ${posRelatorio.y}px)`, 
                            resize: 'both', overflow: 'hidden' 
                        }}
                    >
                        <div onMouseDown={handleMouseDownRelatorio} className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60 cursor-move hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0">
                            <div className="flex items-center gap-3 pointer-events-none">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${contarPessoasDaMeta(progressoHoje) >= META_DIARIA ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500' : 'bg-orange-100 dark:bg-orange-500/20 text-orange-500'}`}>
                                    {contarPessoasDaMeta(progressoHoje) >= META_DIARIA ? <Trophy className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase tracking-widest leading-none">Fechamento de Turno</h3>
                                </div>
                            </div>
                            <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setMostrarRelatorio(false)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="flex-1 p-5 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 shrink-0">Edite as informações adicionais antes de enviar:</p>
                            <textarea 
                                value={textoRelatorio} 
                                onChange={(e) => setTextoRelatorio(e.target.value)} 
                                className="flex-1 w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 font-mono text-[11px] text-slate-700 dark:text-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none transition-all custom-scrollbar leading-relaxed shadow-inner dark:focus:bg-slate-900"
                            />
                        </div>
                        
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex gap-3 shrink-0 flex-col">
                            <div className="flex gap-2 w-full">
                                <button 
                                    onClick={() => { navigator.clipboard.writeText(textoRelatorio); avisar("Relatório copiado!"); }} 
                                    className="flex-1 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-sm flex items-center justify-center gap-2"
                                >
                                    <Copy className="w-4 h-4" /> Copiar 
                                </button>
                                
                                <button 
                                    onClick={() => { 
                                        navigator.clipboard.writeText(textoRelatorio); 
                                        avisar("Turno finalizado! Relatório copiado para a área de transferência.");
                                        setMostrarRelatorio(false);
                                        if(setConsultorAtivo) setConsultorAtivo(null); 
                                    }} 
                                    className="flex-[2] py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-md flex items-center justify-center gap-2"
                                >
                                    <CheckCircle2 className="w-4 h-4" /> Finalizar Trampo
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Modais;