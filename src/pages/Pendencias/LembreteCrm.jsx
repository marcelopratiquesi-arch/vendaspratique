// ==========================================
// LEMBRETE DO CRM — só no login da RECEPÇÃO (decisão do dono, 06/11/2026)
// Nos horários abaixo abre uma janela no meio da tela (mesmo em outra tela) pedindo para fazer o CRM
// (lista de contatos do dia). Botões:
//   "Ir para o CRM"   → abre o CRM e não mostra mais este horário;
//   "Lembrar depois"  → fecha e volta em 15 minutos;
//   "Não lembrar"     → fecha e só volta no próximo horário.
// Quem entra depois do horário vê a janela na hora. Cada horário aparece uma vez (guardado no computador).
// Permissão 909 (Configurações → Permissões).
// ==========================================
import React, { useEffect, useState } from 'react';
import { Users, X } from 'lucide-react';
import { tx } from '../../i18n/traduzir.js';
import { tipoDoDia } from '../AnaliseVendas/feriados.js';
import { podeFazer } from '../../permissoes/catalogoPermissoes.js';

// Horários (hh:mm). Sábado, domingo e feriado nacional: a academia funciona só até 13h.
const HORARIOS_LEMBRETE_CRM_SEMANA = ['08:00', '10:00', '12:00', '14:30', '15:30', '17:30', '19:30'];
const HORARIOS_LEMBRETE_CRM_FIM_DE_SEMANA = ['09:00', '11:00'];

const QUINZE_MIN = 15 * 60 * 1000;
const paraIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const minutosDe = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const textoHora = (hhmm) => hhmm.endsWith(':00') ? `${Number(hhmm.slice(0, 2))}h` : `${Number(hhmm.slice(0, 2))}h${hhmm.slice(3)}`;

const lerFeito = (chave) => { try { return localStorage.getItem(chave) === '1'; } catch { return false; } };
const gravarFeito = (chave) => { try { localStorage.setItem(chave, '1'); } catch { /* sem armazenamento: some só nesta tela */ } };

const LembreteCrm = ({ usuario, aoIrCrm }) => {
    const ehRecepcao = String(usuario?.role || '').toUpperCase() === 'RECEPCAO' && podeFazer(usuario, '909');
    const unidade = String(usuario?.unidade || '').trim();
    const [agora, setAgora] = useState(() => new Date());
    const [adiadoAte, setAdiadoAte] = useState(0);
    const [fechados, setFechados] = useState(() => new Set()); // horários fechados nesta tela (caso o computador não guarde)

    useEffect(() => {
        if (!ehRecepcao) return undefined;
        const relogio = setInterval(() => setAgora(new Date()), 30 * 1000);
        return () => clearInterval(relogio);
    }, [ehRecepcao]);

    if (!ehRecepcao || !unidade) return null;

    const hojeIso = paraIso(agora);
    const horarios = tipoDoDia(hojeIso) ? HORARIOS_LEMBRETE_CRM_FIM_DE_SEMANA : HORARIOS_LEMBRETE_CRM_SEMANA;
    const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
    const horario = horarios.filter(h => minutosDe(h) <= minutosAgora).pop(); // o horário mais recente que já passou
    if (!horario) return null;
    const chave = `crm_lembrete_${unidade}_${hojeIso}_${horario}`;
    if (fechados.has(chave) || lerFeito(chave) || Date.now() < adiadoAte) return null;

    const encerrar = () => { gravarFeito(chave); setFechados(prev => new Set(prev).add(chave)); };
    const ir = () => { encerrar(); aoIrCrm?.(); };
    const lembrarDepois = () => setAdiadoAte(Date.now() + QUINZE_MIN);
    const proximo = horarios.find(h => minutosDe(h) > minutosAgora);

    return (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]" role="dialog" aria-modal="true" aria-labelledby="lembrete-crm-titulo">
            <div className="bg-white rounded-2xl shadow-2xl w-[min(480px,100%)] overflow-hidden border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                <div className="px-6 py-5 flex items-start gap-3 text-white bg-blue-600">
                    <Users className="w-6 h-6 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                        <h2 id="lembrete-crm-titulo" className="text-base font-black uppercase tracking-widest leading-tight">{tx('Hora de fazer o CRM')}</h2>
                        <p className="text-[12px] font-bold uppercase tracking-widest opacity-90 mt-1">{unidade} · {textoHora(horario)}</p>
                    </div>
                    <button type="button" onClick={lembrarDepois} aria-label={tx('Fechar')} className="opacity-80 hover:opacity-100"><X className="w-5 h-5" /></button>
                </div>
                <div className="px-6 py-5 space-y-3">
                    <p className="text-sm font-bold text-slate-700 leading-snug dark:text-slate-200">
                        {tx('Abra o CRM e faça a lista de contatos de hoje: agendados, visitantes 24h e 48h, atrasados e aniversariantes.')}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {proximo ? tx('Próximo lembrete às {hora}.', { hora: textoHora(proximo) }) : tx('Este é o último lembrete de hoje.')}
                    </p>
                </div>
                <div className="px-6 py-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 dark:border-slate-800">
                    <button type="button" onClick={encerrar} className="h-11 px-3 rounded-xl bg-slate-100 text-slate-500 text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700" title={tx('Fecha e só volta no próximo horário')}>{tx('Não lembrar')}</button>
                    <button type="button" onClick={lembrarDepois} className="h-11 px-3 rounded-xl bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700" title={tx('Volta em 15 minutos')}>{tx('Lembrar depois')}</button>
                    <button type="button" onClick={ir} autoFocus className="h-11 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md">
                        <Users className="w-4 h-4" />{tx('Ir para o CRM')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LembreteCrm;
