import React, { useState, useMemo } from 'react';
import { CalendarCheck, AlarmClock, MessageCircle, Check, Info, Ban, CalendarClock, Loader2 } from 'lucide-react';
import { JanelaJustificativa } from './JanelasContato';
import { EtiquetaParado } from './EtiquetasCrm';
import { situacaoProximoContato, formatarDiaCurto, gerarTextoWhatsApp, linkWhatsApp, classeTipoLead } from './utils';

// ==========================================
// ABA "HOJE" (Bloco 4): contatos com o próximo contato marcado para hoje ou já atrasado.
// Só a carteira de quem opera (Kanban). WhatsApp já registra o contato (anti-golpe);
// "Feito sem WhatsApp" pede justificativa. Depois do contato, o CRM pergunta a próxima data.
// ==========================================

const GRUPOS = [
    { chave: 'atrasado', titulo: 'Atrasados', sub: 'A data marcada já passou', icone: AlarmClock, cor: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15' },
    { chave: 'hoje', titulo: 'Para hoje', sub: 'Marcados para hoje', icone: CalendarCheck, cor: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15' }
];

const AbaHoje = ({ visitantes = [], registrarHistorico, abrirFicha, onPedirProximo, onRemarcar, onNaoContatar }) => {
    const [justificando, setJustificando] = useState(null);
    const [registrando, setRegistrando] = useState(null);

    const { grupos, futuros } = useMemo(() => {
        const g = { atrasado: [], hoje: [] };
        let qtdFuturos = 0;
        visitantes.forEach(v => {
            const s = situacaoProximoContato(v);
            if (s === 'futuro') qtdFuturos++;
            else if (s && g[s]) g[s].push(v);
        });
        g.atrasado.sort((a, b) => String(a.proximo_contato).localeCompare(String(b.proximo_contato)));
        g.hoje.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
        return { grupos: g, futuros: qtdFuturos };
    }, [visitantes]);

    const abrirWhatsApp = async (lead) => {
        if (!lead.telefone) return alert('Este contato está sem telefone cadastrado.');
        const texto = gerarTextoWhatsApp(lead);
        window.open(linkWhatsApp(lead.telefone, texto), '_blank');
        setRegistrando(lead.id);
        await registrarHistorico(lead.id, 'WhatsApp', `Mensagem enviada: "${texto}"`);
        setRegistrando(null);
        onPedirProximo(lead);
    };

    const feitoSemWhatsApp = async (lead, justificativa) => {
        await registrarHistorico(lead.id, 'Observação', `Próximo contato feito SEM WhatsApp: ${justificativa}.`);
        onPedirProximo(lead);
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 lg:p-8 animate-[fadeIn_0.3s_ease-out] space-y-8">
            <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
                <div className="w-14 h-14 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shadow-inner">
                    <CalendarCheck className="w-7 h-7" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Contatos marcados para hoje</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        Quem tem o "próximo contato" para hoje ou atrasado. {futuros > 0 && <span className="font-bold">{futuros} marcado(s) para os próximos dias.</span>}
                    </p>
                </div>
            </div>

            {GRUPOS.map(g => {
                const Icone = g.icone;
                const lista = grupos[g.chave];
                return (
                    <div key={g.chave}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${g.cor}`}><Icone className="w-4 h-4" /></div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">{g.titulo} <span className="text-slate-400">({lista.length})</span></p>
                                <p className="text-[10px] font-bold text-slate-400">{g.sub}</p>
                            </div>
                        </div>
                        {lista.length === 0 ? (
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600 pl-10">Nenhum pendente</p>
                        ) : (
                            <div className="space-y-2">
                                {lista.map(v => (
                                    <div key={v.id} className={`flex flex-col md:flex-row md:items-center justify-between gap-3 border rounded-xl px-4 py-3 ${g.chave === 'atrasado' ? 'bg-rose-50/40 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/30' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800'}`}>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <button type="button" onClick={() => abrirFicha(v)} className="text-sm font-black text-slate-800 dark:text-white uppercase truncate hover:text-blue-600 dark:hover:text-blue-400 text-left" title="Ver ficha e histórico">{v.nome}</button>
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${classeTipoLead(v.tipo_lead)}`}>{v.tipo_lead || 'LEAD'}</span>
                                                <EtiquetaParado lead={v} />
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
                                                {v.telefone || 'Sem telefone'} · {v.status}
                                                {g.chave === 'atrasado' && <span className="text-rose-600 dark:text-rose-400"> · marcado para {formatarDiaCurto(v.proximo_contato)}</span>}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                                            <button type="button" onClick={() => abrirWhatsApp(v)} disabled={registrando === v.id} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors" title="Abre o WhatsApp e já registra o contato">
                                                {registrando === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />} WhatsApp
                                            </button>
                                            <button type="button" onClick={() => setJustificando(v)} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors" title="Para contato feito por ligação ou pessoalmente (fica em vermelho para o Líder)">
                                                <Check className="w-3.5 h-3.5" /> Feito sem WhatsApp
                                            </button>
                                            <button type="button" onClick={() => onRemarcar(v)} className="p-2 rounded-lg border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors" title="Mudar a data do próximo contato">
                                                <CalendarClock className="w-4 h-4" />
                                            </button>
                                            <button type="button" onClick={() => abrirFicha(v)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900 transition-colors" title="Ver ficha">
                                                <Info className="w-4 h-4" />
                                            </button>
                                            {onNaoContatar && (
                                                <button type="button" onClick={() => onNaoContatar(v)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors" title="Não contatar (a pessoa pediu para não receber contato)">
                                                    <Ban className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}

            {justificando && (
                <JanelaJustificativa
                    pessoa={justificando}
                    onFechar={() => setJustificando(null)}
                    onConfirmar={(justificativa) => feitoSemWhatsApp(justificando, justificativa)}
                />
            )}
        </div>
    );
};

export default AbaHoje;
