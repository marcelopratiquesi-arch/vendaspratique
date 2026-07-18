import React, { useState, useEffect, useRef } from 'react';
import { formatarDataHora, STATUS_TOKENS, COLUNAS } from './utils';
import { 
    MessageCircle, X, Copy, Send, Phone, IdCard, Info, 
    PenTool, History, Loader2, Trophy, Target, UserPlus, MoveRight 
} from 'lucide-react';

const Modais = ({
    modalWpp, setModalWpp,
    modalDetalhe, setModalDetalhe,
    historicoLead, loadingHistorico, registrarHistorico, alterarStatus,
    mostrarRelatorio, setMostrarRelatorio, progressoHoje = [], usuarioLogado, META_DIARIA = 150
}) => {
    const [novaNota, setNovaNota] = useState('');
    const [textoRelatorio, setTextoRelatorio] = useState('');

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [modalWpp.show, modalDetalhe.show, historicoLead, mostrarRelatorio]);

    // ==========================================
    // SISTEMA DE DRAG & DROP: WHATSAPP
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

    // ==========================================
    // SISTEMA DE DRAG & DROP: FICHA DO LEAD
    // ==========================================
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

    // ==========================================
    // SISTEMA DE DRAG & DROP: RELATÓRIO
    // ==========================================
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
    // AÇÕES LOCAIS
    // ==========================================
    const enviarWppDireto = async () => {
        if (!modalWpp.lead) return;
        await registrarHistorico(modalWpp.lead.id, 'WhatsApp', `Mensagem enviada: "${modalWpp.texto}"`);
        const linkWhatsApp = `https://wa.me/55${modalWpp.lead.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(modalWpp.texto)}`;
        window.open(linkWhatsApp, '_blank');
        setModalWpp({ show: false, lead: null, texto: '' });
    };

    const adicionarNotaManual = async () => {
        if (!novaNota.trim() || !modalDetalhe.lead) return;
        const texto = novaNota;
        setNovaNota('');
        await registrarHistorico(modalDetalhe.lead.id, 'Observação', texto);
    };

    // ==========================================
    // O GERADOR DE RELATÓRIO CIRÚRGICO
    // ==========================================
    const gerarRelatorioWhatsApp = () => {
        const validos = progressoHoje.filter(p => p && p.data_contato);
        if (validos.length === 0) return "Nenhum contato feito hoje.";

        const progressoOrdenado = [...validos].sort((a, b) => new Date(a.data_contato).getTime() - new Date(b.data_contato).getTime());
        
        const primeiro = new Date(progressoOrdenado[0].data_contato);
        const ultimo = new Date(progressoOrdenado[progressoOrdenado.length - 1].data_contato);
        const diffMs = ultimo.getTime() - primeiro.getTime();
        const hrs = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        
        // Dicionário com Emojis Bonitos para a Liderança
        const contadores = {
            '👤 Capturas (Novos Leads)': 0,
            '💬 WhatsApp Enviados': 0,
            '📞 Ligações (MicroSIP)': 0,
            '📝 Anotações em Ficha': 0,
            '➡️ Moveu p/ Em Contato': 0,
            '🎟️ Moveu p/ Day Use': 0,
            '🏆 Fechamentos (Venda)': 0,
            '❌ Moveu p/ Perdido': 0,
        };
        
        let outrasAcoes = 0;

        progressoOrdenado.forEach(p => {
            if (p.tipo === 'Captura') contadores['👤 Capturas (Novos Leads)']++;
            else if (p.tipo === 'Ligação') contadores['📞 Ligações (MicroSIP)']++;
            else if (p.tipo === 'WhatsApp') contadores['💬 WhatsApp Enviados']++;
            else if (p.tipo === 'Observação') contadores['📝 Anotações em Ficha']++;
            else if (p.tipo === 'Mudança de Fase') {
                // Lendo a observação para descobrir o destino exato!
                if (p.observacao?.includes('para "Em Contato"')) contadores['➡️ Moveu p/ Em Contato']++;
                else if (p.observacao?.includes('para "Day Use (3 Dias)"')) contadores['🎟️ Moveu p/ Day Use']++;
                else if (p.observacao?.includes('para "Fechado"')) contadores['🏆 Fechamentos (Venda)']++;
                else if (p.observacao?.includes('para "Perdido"')) contadores['❌ Moveu p/ Perdido']++;
                else outrasAcoes++;
            }
        });

        let texto = `📊 *RELATÓRIO DE CRM - PRATIQUE*\n`;
        texto += `👤 Consultor(a): *${usuarioLogado?.nome || 'Equipe'}*\n`;
        texto += `🎯 Total de Interações: *${progressoOrdenado.length} / ${META_DIARIA}*\n`;
        texto += `\n⏱️ Primeiro Registro: ${primeiro.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}\n`;
        texto += `🏁 Último Registro: ${ultimo.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}\n`;
        texto += `⏳ Tempo Focado: *${hrs}h ${mins}m*\n\n`;
        texto += `*🔥 Produtividade e Conversão:* \n`;
        
        Object.keys(contadores).forEach(k => { 
            if (contadores[k] > 0) {
                texto += `${k}: *${contadores[k]}*\n`; 
            }
        });

        if (outrasAcoes > 0) {
            texto += `🔄 Outras Movimentações: *${outrasAcoes}*\n`;
        }
        
        return texto;
    };

    // Atualiza o texto do relatório editável sempre que abrir o modal
    useEffect(() => {
        if (mostrarRelatorio) {
            setTextoRelatorio(gerarRelatorioWhatsApp());
            setPosRelatorio({ x: 0, y: 0 }); // Centraliza ao abrir
        }
    }, [mostrarRelatorio, progressoHoje]);

    return (
        <>
            {/* JANELA: WHATSAPP */}
            {modalWpp.show && modalWpp.lead && (
                <div className="fixed inset-0 z-[250] pointer-events-none flex items-center justify-center p-4">
                    <div className="relative bg-white rounded-3xl shadow-[0_15px_50px_rgba(0,0,0,0.2)] flex flex-col border border-slate-300 pointer-events-auto overflow-hidden animate-[zoomIn_0.2s_ease-out]" style={{ width: '500px', minHeight: '350px', maxHeight: '90vh', transform: `translate(${posWpp.x}px, ${posWpp.y}px)`, resize: 'both', overflow: 'hidden' }}>
                        <div onMouseDown={handleMouseDownWpp} className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 cursor-move hover:bg-slate-100 transition-colors shrink-0">
                            <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2 pointer-events-none">
                                <MessageCircle className="w-5 h-5 text-emerald-500" /> Revisão de Mensagem
                            </h3>
                            <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setModalWpp({ show: false, lead: null, texto: '' })} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 p-5 flex flex-col overflow-hidden">
                            <div className="flex items-center gap-2 mb-4 shrink-0">
                                <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase border ${STATUS_TOKENS[modalWpp.lead.status]?.bg} ${STATUS_TOKENS[modalWpp.lead.status]?.text} ${STATUS_TOKENS[modalWpp.lead.status]?.border}`}>Fase: {modalWpp.lead.status}</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enviando para: <strong className="text-slate-700">{modalWpp.lead.nome}</strong></span>
                            </div>
                            <textarea value={modalWpp.texto} onChange={(e) => setModalWpp({ ...modalWpp, texto: e.target.value })} className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none transition-all custom-scrollbar leading-relaxed"></textarea>
                        </div>
                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-3 shrink-0">
                            <button onClick={() => { navigator.clipboard.writeText(modalWpp.texto); alert("Texto copiado!"); }} className="flex-1 py-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-sm flex items-center justify-center gap-2">
                                <Copy className="w-4 h-4" /> Copiar
                            </button>
                            <button onClick={enviarWppDireto} className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-[0_4px_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2">
                                <Send className="w-4 h-4" /> Enviar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* JANELA: FICHA DO LEAD */}
            {modalDetalhe.show && modalDetalhe.lead && (
                <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center p-4">
                    <div className="relative bg-white rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.3)] flex flex-col pointer-events-auto border-2 border-slate-300 overflow-hidden animate-[slideUp_0.3s_ease-out]" style={{ width: '900px', minHeight: '550px', maxHeight: '90vh', transform: `translate(${posDetalhe.x}px, ${posDetalhe.y}px)`, resize: 'both', overflow: 'hidden' }}>
                        <div onMouseDown={handleMouseDownDetalhe} className="bg-slate-900 p-6 flex justify-between items-start shrink-0 cursor-move hover:bg-slate-800 transition-colors">
                            <div className="pointer-events-none">
                                <div className="flex items-center gap-3 mb-2">
                                    <h2 className="text-2xl font-black text-white tracking-tight uppercase">{modalDetalhe.lead.nome}</h2>
                                    <span className={`px-2 py-1 rounded text-[10px] font-black tracking-widest uppercase border ${modalDetalhe.lead.tipo_lead === 'VISITANTE' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-orange-500/20 text-orange-300 border-orange-500/30'}`}>{modalDetalhe.lead.tipo_lead || 'LEAD'}</span>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                                    <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {modalDetalhe.lead.telefone}</span>
                                    <span className="flex items-center gap-1.5"><IdCard className="w-3.5 h-3.5" /> {modalDetalhe.lead.cpf}</span>
                                </div>
                            </div>
                            <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setModalDetalhe({ show: false, lead: null })} className="w-10 h-10 bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white rounded-xl flex items-center justify-center transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row bg-slate-50">
                            <div className="w-full lg:w-1/3 border-r border-slate-200 bg-white p-6 flex flex-col overflow-y-auto custom-scrollbar shrink-0">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2 shrink-0">
                                    <Info className="w-4 h-4" /> Status Operacional
                                </h3>
                                <div className="space-y-4 mb-8 shrink-0">
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Fase no Funil</p>
                                        <select value={modalDetalhe.lead.status} onChange={(e) => alterarStatus(modalDetalhe.lead.id, e.target.value)} className={`w-full px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest border cursor-pointer outline-none transition-all focus:ring-2 focus:ring-blue-500 shadow-sm ${STATUS_TOKENS[modalDetalhe.lead.status]?.bg} ${STATUS_TOKENS[modalDetalhe.lead.status]?.text} ${STATUS_TOKENS[modalDetalhe.lead.status]?.border}`}>
                                            {COLUNAS.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Consultor Dono</p>
                                        <p className="text-sm font-black text-slate-700 uppercase">{modalDetalhe.lead.vendedor}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Data Captura</p>
                                        <p className="text-sm font-bold text-slate-600">{formatarDataHora(modalDetalhe.lead.criado_em) || modalDetalhe.lead.data}</p>
                                    </div>
                                </div>
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2 shrink-0">
                                    <PenTool className="w-4 h-4" /> Adicionar Nota
                                </h3>
                                <div className="flex flex-col gap-2 flex-1">
                                    <textarea value={novaNota} onChange={(e) => setNovaNota(e.target.value)} placeholder="O que foi conversado?" className="w-full flex-1 min-h-[80px] bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none custom-scrollbar"></textarea>
                                    <button onClick={adicionarNotaManual} disabled={!novaNota.trim()} className="w-full py-3 bg-slate-800 hover:bg-black disabled:opacity-50 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-sm shrink-0">Gravar no Histórico</button>
                                </div>
                            </div>
                            <div className="w-full lg:w-2/3 p-6 lg:p-8 flex flex-col bg-slate-50 overflow-hidden">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-6 flex items-center gap-2 shrink-0">
                                    <History className="w-5 h-5 text-blue-500" /> Linha do Tempo
                                </h3>
                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 relative">
                                    <div className="absolute left-[19px] top-4 bottom-4 w-px bg-slate-200"></div>
                                    {loadingHistorico ? (
                                        <div className="flex items-center justify-center h-full text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
                                    ) : historicoLead.length === 0 ? (
                                        <p className="text-center text-slate-400 font-bold text-xs mt-10">Nenhum histórico registrado.</p>
                                    ) : (
                                        <div className="space-y-6 relative">
                                            {historicoLead.map(h => {
                                                let IconeAcao = Info; let corAcao = 'bg-slate-500';
                                                if(h.tipo_acao === 'Captura') { IconeAcao = UserPlus; corAcao = 'bg-emerald-500'; }
                                                else if(h.tipo_acao === 'WhatsApp') { IconeAcao = MessageCircle; corAcao = 'bg-emerald-500'; }
                                                else if(h.tipo_acao === 'Ligação') { IconeAcao = Phone; corAcao = 'bg-blue-500'; }
                                                else if(h.tipo_acao === 'Mudança de Fase') { IconeAcao = MoveRight; corAcao = 'bg-orange-500'; }
                                                else if(h.tipo_acao === 'Observação') { IconeAcao = PenTool; corAcao = 'bg-purple-500'; }
                                                return (
                                                    <div key={h.id} className="flex gap-4 relative animate-[fadeIn_0.3s_ease-out]">
                                                        <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white border-4 border-slate-50 shadow-sm relative z-10 ${corAcao}`}>
                                                            <IconeAcao className="w-4 h-4" />
                                                        </div>
                                                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex-1 mb-2 hover:shadow-md transition-shadow">
                                                            <div className="flex justify-between items-start mb-2 border-b border-slate-50 pb-2">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">{h.tipo_acao}</span>
                                                                <span className="text-[10px] font-bold text-slate-400">{formatarDataHora(h.data_registro)}</span>
                                                            </div>
                                                            <p className="text-xs font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">{h.observacao}</p>
                                                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-3 text-right">Por: {h.consultor}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* JANELA: RELATÓRIO DO DIA (AGORA DETALHADO) */}
            {mostrarRelatorio && (
                <div className="fixed inset-0 z-[300] pointer-events-none flex items-center justify-center p-4">
                    <div 
                        className="relative bg-white rounded-3xl shadow-[0_15px_50px_rgba(0,0,0,0.2)] flex flex-col pointer-events-auto border border-slate-300 overflow-hidden animate-[zoomIn_0.2s_ease-out]" 
                        style={{ 
                            width: '450px', minHeight: '480px', maxHeight: '90vh', 
                            transform: `translate(${posRelatorio.x}px, ${posRelatorio.y}px)`, 
                            resize: 'both', overflow: 'hidden' 
                        }}
                    >
                        <div onMouseDown={handleMouseDownRelatorio} className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 cursor-move hover:bg-slate-100 transition-colors shrink-0">
                            <div className="flex items-center gap-3 pointer-events-none">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${progressoHoje.length >= META_DIARIA ? 'bg-emerald-100 text-emerald-500' : 'bg-orange-100 text-orange-500'}`}>
                                    {progressoHoje.length >= META_DIARIA ? <Trophy className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest leading-none">Resumo do Turno</h3>
                                </div>
                            </div>
                            <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setMostrarRelatorio(false)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="flex-1 p-5 flex flex-col overflow-hidden bg-white">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 shrink-0">Você pode editar o relatório antes de copiar:</p>
                            <textarea 
                                value={textoRelatorio} 
                                onChange={(e) => setTextoRelatorio(e.target.value)} 
                                className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none transition-all custom-scrollbar leading-relaxed shadow-inner"
                            />
                        </div>
                        
                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-3 shrink-0">
                            <button 
                                onClick={() => { navigator.clipboard.writeText(textoRelatorio); alert("Relatório copiado com sucesso!"); }} 
                                className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-[0_4px_15px_rgba(0,0,0,0.2)] flex items-center justify-center gap-2"
                            >
                                <Copy className="w-4 h-4" /> Copiar para Área de Transferência
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Modais;