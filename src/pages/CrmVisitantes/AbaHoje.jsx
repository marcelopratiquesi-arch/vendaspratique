import React, { useState, useMemo } from 'react';
import { CalendarCheck, AlarmClock, MessageCircle, Info, Ban, CalendarClock, Loader2, PhoneCall } from 'lucide-react';
import { ligarPeloSip } from './contatosFeitos';
import { JanelaJustificativa } from './JanelasContato';
import { EtiquetaParado } from './EtiquetasCrm';
import { situacaoProximoContato, formatarDiaCurto, gerarTextoWhatsApp, abrirNoWhatsApp, classeTipoLead, textoMensagemEnviada, rotuloMensagemDoLead } from './utils';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';

// ==========================================
// ABA "HOJE" (Bloco 4): contatos com o próximo contato marcado para hoje ou já atrasado.
// Só a carteira de quem opera (Kanban). WhatsApp já registra o contato (anti-golpe);
// "Feito sem WhatsApp" saiu daqui (decisão do dono, 10/11/2026). Depois do contato, o CRM pergunta a próxima data.
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
        if (!lead.telefone) return avisar(tx("Este contato está sem telefone cadastrado."));
        const texto = gerarTextoWhatsApp(lead);
        abrirNoWhatsApp(lead.telefone, texto);
        setRegistrando(lead.id);
        await registrarHistorico(lead.id, 'WhatsApp', textoMensagemEnviada(texto, rotuloMensagemDoLead(lead)));
        setRegistrando(null);
        onPedirProximo(lead);
    };

    // Ligar (MicroSIP): registra a ligação (conta na meta) e pergunta o próximo contato
    const ligar = async (lead) => {
        if (!lead.telefone) return avisar(tx("Este contato está sem telefone cadastrado."));
        ligarPeloSip(lead.telefone);
        setRegistrando(lead.id);
        await registrarHistorico(lead.id, 'Ligação', `Tentativa de contato telefônico (MicroSIP) para o número ${lead.telefone}`);
        setRegistrando(null);
        onPedirProximo(lead);
    };

    const feitoSemWhatsApp = async (lead, justificativa) => {
        await registrarHistorico(lead.id, 'Observação', `Próximo contato feito SEM WhatsApp: ${justificativa}.`);
        onPedirProximo(lead);
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-[fadeIn_0.3s_ease-out]">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 px-4 py-3">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center">
                    <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-base font-black uppercase tracking-widest text-slate-800 dark:text-white">{tx("Contatos marcados para hoje")}</h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {tx("Quem tem o \"próximo contato\" para hoje ou atrasado.")}{' '}{futuros > 0 && <span className="font-bold">{futuros}{' '}{tx("marcado(s) para os próximos dias.")}</span>}
                    </p>
                </div>
            </div>

            <div className="p-4 space-y-5">
            {GRUPOS.map(g => {
                const Icone = g.icone;
                const lista = grupos[g.chave];
                return (
                    <div key={g.chave}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${g.cor}`}><Icone className="w-4 h-4" /></div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">{tx(g.titulo)} <span className="text-slate-400">({lista.length})</span></p>
                                <p className="text-[10px] font-bold text-slate-400">{tx(g.sub)}</p>
                            </div>
                        </div>
                        {lista.length === 0 ? (
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600 pl-10">{tx("Nenhum pendente")}</p>
                        ) : (
                            <div className="space-y-2">
                                {lista.map(v => (
                                    <div key={v.id} className={`flex flex-col md:flex-row md:items-center justify-between gap-3 border rounded-xl px-4 py-3 ${g.chave === 'atrasado' ? 'bg-rose-50/40 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/30' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800'}`}>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <button type="button" onClick={() => abrirFicha(v)} className="text-sm font-black text-slate-800 dark:text-white uppercase truncate hover:text-blue-600 dark:hover:text-blue-400 text-left" title={tx("Ver ficha e histórico")}>{v.nome}</button>
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${classeTipoLead(v.tipo_lead)}`}>{tx(v.tipo_lead || 'LEAD')}</span>
                                                <EtiquetaParado lead={v} />
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
                                                {v.telefone || tx("Sem telefone")} · {tx(v.status)}
                                                {g.chave === 'atrasado' && <span className="text-rose-600 dark:text-rose-400">{' '}{tx("· marcado para")}{' '}{formatarDiaCurto(v.proximo_contato)}</span>}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                                            <button type="button" onClick={() => abrirWhatsApp(v)} disabled={registrando === v.id} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors" title={tx("Abre o WhatsApp e já registra o contato")}>
                                                {registrando === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}{' '}{tx("WhatsApp")}
                                            </button>
                                            <button type="button" onClick={() => ligar(v)} disabled={registrando === v.id || !v.telefone} className="px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white disabled:opacity-60 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors" title={tx("Ligar (MicroSIP) e já registrar o contato")}>
                                                <PhoneCall className="w-3.5 h-3.5" />{' '}{tx("Ligar")}
                                            </button>
                                            {/* "Feito sem WhatsApp" saiu da aba Hoje (decisão do dono, 10/11/2026: "senão o pessoal vai tudo usar ele") */}
                                            <button type="button" onClick={() => onRemarcar(v)} className="p-2 rounded-lg border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors" title={tx("Mudar a data do próximo contato")}>
                                                <CalendarClock className="w-4 h-4" />
                                            </button>
                                            <button type="button" onClick={() => abrirFicha(v)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900 transition-colors" title={tx("Ver ficha")}>
                                                <Info className="w-4 h-4" />
                                            </button>
                                            {onNaoContatar && (
                                                <button type="button" onClick={() => onNaoContatar(v)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors dark:hover:text-rose-400" title={tx("Não contatar (a pessoa pediu para não receber contato)")}>
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
            </div>

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
