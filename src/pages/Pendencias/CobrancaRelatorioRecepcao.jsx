// ==========================================
// COBRANÇA DO RELATÓRIO DE FECHAMENTO — só no login da RECEPÇÃO (decisão do dono, 05/11/2026)
// Na hora da cobrança do turno (seg-sex 14h30 manhã / 22h30 noite; sáb-dom-feriado 12h30; envio 13h30–15h, 21h30–23h, 12h–13h), se o relatório do turno
// ainda não foi enviado, abre uma janela no meio da tela (mesmo com a pessoa em outra tela) com o botão
// "Ir para o relatório" (Dashboard → Relatórios, Hoje). "Lembrar em 15 min" fecha; o cartão do canto fica
// e a janela volta 15 minutos depois. Some na hora em que o envio é registrado (Copiar/Enviar no WhatsApp Fechamento).
// Regras em relatorioFechamento.js.
// ==========================================
import React, { useCallback, useEffect, useState } from 'react';
import { Send, X } from 'lucide-react';
import { supabase } from '../../supabaseClient.js';
import { sistemaPausado } from '../../components/pausaSistema.js';
import { tx } from '../../i18n/traduzir.js';
import { turnosDoDia, situacaoDoTurno, nomesDoTurno, INICIO_COBRANCA_RELATORIO, ROTULO_TURNO } from './relatorioFechamento.js';
import { normalizeString } from '../AnaliseVendas/utils.js';
import { podeFazer } from '../../permissoes/catalogoPermissoes.js';

const QUINZE_MIN = 15 * 60 * 1000;
const paraIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const CobrancaRelatorioRecepcao = ({ usuario, colaboradores = [], aoIrRelatorio }) => {
    // Só a Recepção, e só se a permissão 903 estiver ligada (Configurações → Permissões)
    const ehRecepcao = String(usuario?.role || '').toUpperCase() === 'RECEPCAO' && podeFazer(usuario, '903');
    const unidade = String(usuario?.unidade || '').trim();
    const [agora, setAgora] = useState(() => new Date());
    const [envios, setEnvios] = useState(null); // null = ainda não leu (ou sem a tabela)
    const [adiadoAte, setAdiadoAte] = useState(0);
    const hojeIso = paraIso(agora);

    const ler = useCallback(async () => {
        if (!ehRecepcao || !unidade) return;
        const { data, error } = await supabase.from('relatorios_fechamento_envios').select('unidade, data, turno, enviado_em').eq('data', paraIso(new Date()));
        if (error) { console.warn('Cobrança do relatório: não deu para ler os envios (rodou o SQL 2026-11-05-relatorio-fechamento?)', error.message); setEnvios(null); return; }
        setEnvios((data || []).filter(e => normalizeString(String(e.unidade || '')) === normalizeString(unidade)));
    }, [ehRecepcao, unidade]);

    useEffect(() => {
        if (!ehRecepcao || !unidade) return undefined;
        ler();
        const relogio = setInterval(() => setAgora(new Date()), 30 * 1000);
        const releitura = setInterval(() => { if (!sistemaPausado()) ler(); }, 5 * 60 * 1000); // pausado por inatividade: não relê
        const aoEnviar = () => ler();
        window.addEventListener('relatorio-fechamento-enviado', aoEnviar);
        const canal = supabase.channel(`relatorio-recepcao-${Math.random().toString(36).slice(2, 8)}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'relatorios_fechamento_envios' }, aoEnviar)
            .subscribe();
        return () => { clearInterval(relogio); clearInterval(releitura); window.removeEventListener('relatorio-fechamento-enviado', aoEnviar); supabase.removeChannel(canal); };
    }, [ehRecepcao, unidade, ler]);

    // Dia novo: lê de novo
    useEffect(() => { if (ehRecepcao) ler(); }, [hojeIso, ehRecepcao, ler]);

    if (!ehRecepcao || envios === null || hojeIso < INICIO_COBRANCA_RELATORIO) return null;

    // Turno de hoje em cobrança (o mais recente)
    const pendente = turnosDoDia(hojeIso)
        .map(t => ({ ...t, situacao: situacaoDoTurno(t, hojeIso, envios.find(e => e.turno === t.turno), agora) }))
        .filter(t => t.situacao === 'cobrando' || t.situacao === 'atrasado')
        .pop();
    if (!pendente) return null;

    const nomes = nomesDoTurno(colaboradores, unidade, pendente.turno);
    const atrasado = pendente.situacao === 'atrasado';
    const turnoTexto = tx(ROTULO_TURNO[pendente.turno]);
    const adiado = Date.now() < adiadoAte;
    const mostrarJanela = !adiado; // adiada (Ir para o relatório ou Lembrar em 15 min): cartão no canto; depois de 15 min a janela volta
    const ir = () => { setAdiadoAte(Date.now() + QUINZE_MIN); aoIrRelatorio?.(); };
    const lembrarDepois = () => setAdiadoAte(Date.now() + QUINZE_MIN);
    const titulo = tx('Envie o relatório de fechamento ({turno})', { turno: turnoTexto });
    const texto = nomes.length
        ? tx('{nomes}, o relatório de vendas do seu turno ainda não foi enviado ao grupo da unidade.', { nomes: nomes.join(' / ') })
        : tx('O relatório de vendas do turno ainda não foi enviado ao grupo da unidade.');
    const prazo = atrasado ? tx('Prazo vencido às {hora}. Envie agora.', { hora: pendente.atrasaTexto }) : tx('Prazo: até {hora}.', { hora: pendente.atrasaTexto });
    const comoFaz = tx('Dashboard → Relatórios → WhatsApp Fechamento → Copiar ou Enviar.');

    if (mostrarJanela) {
        return (
            <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]" role="dialog" aria-modal="true" aria-labelledby="cobranca-relatorio-titulo">
                <div className="bg-white rounded-2xl shadow-2xl w-[min(480px,100%)] overflow-hidden border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                    <div className={`px-6 py-5 flex items-start gap-3 text-white ${atrasado ? 'bg-rose-600' : 'bg-amber-500'}`}>
                        <Send className="w-6 h-6 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                            <h2 id="cobranca-relatorio-titulo" className="text-base font-black uppercase tracking-widest leading-tight">{titulo}</h2>
                            <p className="text-[12px] font-bold uppercase tracking-widest opacity-90 mt-1">{unidade}</p>
                        </div>
                        <button type="button" onClick={lembrarDepois} aria-label={tx('Fechar')} className="opacity-80 hover:opacity-100"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="px-6 py-5 space-y-3">
                        <p className="text-sm font-bold text-slate-700 leading-snug dark:text-slate-200">{texto}</p>
                        <p className={`text-[12px] font-black ${atrasado ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}`}>{prazo}</p>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{comoFaz}</p>
                    </div>
                    <div className="px-6 py-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 dark:border-slate-800">
                        <button type="button" onClick={lembrarDepois} className="h-11 px-4 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">{tx('Lembrar em 15 min')}</button>
                        <button type="button" onClick={ir} autoFocus className="h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md">
                            <Send className="w-4 h-4" />{tx('Ir para o relatório')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Cartão discreto no canto enquanto a janela está adiada
    return (
        <div role="alert" className={`fixed bottom-4 left-4 z-[70] w-[min(320px,calc(100%-32px))] rounded-2xl shadow-xl p-4 border ${atrasado ? 'bg-rose-50 border-rose-300 dark:bg-slate-900 dark:border-rose-500/40' : 'bg-amber-50 border-amber-300 dark:bg-slate-900 dark:border-amber-500/40'}`}>
            <p className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 ${atrasado ? 'text-rose-800 dark:text-rose-300' : 'text-amber-800 dark:text-amber-300'}`}><Send className="w-3.5 h-3.5" />{titulo}</p>
            <p className="mt-1 text-[12px] font-semibold text-slate-700 dark:text-slate-200">{prazo}</p>
            <button type="button" onClick={ir} className="mt-3 h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest">{tx('Ir para o relatório')}</button>
        </div>
    );
};

export default CobrancaRelatorioRecepcao;
