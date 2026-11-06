// ==========================================
// PAINEL "RELATÓRIOS DE FECHAMENTO ENVIADOS" (aba Relatórios; Admin, Mentor e Líder — decisão do dono, 05/11/2026)
// Mostra, no período do filtro, se a recepção enviou o relatório de cada turno (Copiar/Enviar no WhatsApp Fechamento).
// Uma unidade escolhida: uma linha por dia (Manhã | Noite; sábado e domingo um turno só).
// Várias unidades: resumo por unidade (no prazo, atrasados, não enviados, %).
// Só leitura (tabela relatorios_fechamento_envios). Regras em relatorioFechamento.js.
// ==========================================
import React, { useEffect, useMemo, useState } from 'react';
import { Send, ChevronDown, Loader2 } from 'lucide-react';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import { normalizeString } from '../AnaliseVendas/utils.js';
import { buscarEnviosRelatorio, turnosDoDia, situacaoDoTurno, nomesDoTurno, INICIO_COBRANCA_RELATORIO } from './relatorioFechamento.js';

const paraIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const horaDe = (ts) => new Date(ts).toLocaleTimeString(localeAtual(), { hour: '2-digit', minute: '2-digit' });
const diaSemana = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(localeAtual(), { weekday: 'short' }).replace('.', '');

// Dias do período que contam (desde 05/11/2026, até hoje)
const diasDoPeriodo = (faixa) => {
    const hoje = paraIso(new Date());
    const inicio = !faixa?.inicio || faixa.inicio < INICIO_COBRANCA_RELATORIO ? INICIO_COBRANCA_RELATORIO : faixa.inicio;
    const fim = !faixa?.fim || faixa.fim > hoje ? hoje : faixa.fim;
    const dias = [];
    const d = new Date(`${inicio}T12:00:00`);
    while (paraIso(d) <= fim && dias.length < 400) { dias.push(paraIso(d)); d.setDate(d.getDate() + 1); }
    return dias;
};

const Celula = ({ t, dataIso, envio, nomes }) => {
    const sit = situacaoDoTurno(t, dataIso, envio, new Date());
    const quem = nomes.length ? nomes.join(' / ') : '';
    if (sit === 'enviado') return <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">✅ {horaDe(envio.enviado_em)}{quem ? ` · ${quem}` : ''}</span>;
    if (sit === 'enviado_atrasado') return <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">⚠️ {horaDe(envio.enviado_em)} · {tx('atrasado')}{quem ? ` · ${quem}` : ''}</span>;
    if (sit === 'aguardando') return <span className="text-[11px] font-bold text-slate-400">{tx('aguardando ({hora})', { hora: t.cobraTexto })}</span>;
    if (sit === 'cobrando') return <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">🕒 {tx('ainda não enviado (prazo {hora})', { hora: t.atrasaTexto })}{quem ? ` · ${quem}` : ''}</span>;
    return <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400">❌ {tx('não enviado')}{quem ? ` · ${quem}` : ''}</span>;
};

const PainelEnviosRelatorio = ({ unidades = [], faixa, colaboradores = [] }) => {
    const [envios, setEnvios] = useState(null);
    const [carregando, setCarregando] = useState(false);
    const [aberto, setAberto] = useState(true);
    const dias = useMemo(() => diasDoPeriodo(faixa), [faixa]);
    const chaveDias = dias.length ? `${dias[0]}|${dias[dias.length - 1]}` : '';

    useEffect(() => {
        if (!chaveDias) { setEnvios([]); return undefined; }
        let ativo = true;
        const [ini, fim] = chaveDias.split('|');
        const ler = async () => {
            setCarregando(true);
            const r = await buscarEnviosRelatorio(ini, fim);
            if (ativo) { setEnvios(r); setCarregando(false); }
        };
        ler();
        window.addEventListener('relatorio-fechamento-enviado', ler);
        return () => { ativo = false; window.removeEventListener('relatorio-fechamento-enviado', ler); };
    }, [chaveDias]);

    const unidadesValidas = unidades.filter(u => u && u !== 'TODOS' && u !== 'TODAS');
    if (!unidadesValidas.length) return null;

    const achar = (unidade, dataIso, turno) => (envios || []).find(e => normalizeString(String(e.unidade || '')) === normalizeString(unidade) && String(e.data).slice(0, 10) === dataIso && e.turno === turno);

    // Resumo por unidade (só turnos que já tinham de ter sido enviados: passaram da cobrança)
    const resumo = unidadesValidas.map(unidade => {
        let noPrazo = 0, atrasados = 0, naoEnviados = 0;
        dias.forEach(d => turnosDoDia(d).forEach(t => {
            const sit = situacaoDoTurno(t, d, achar(unidade, d, t.turno), new Date());
            if (sit === 'enviado') noPrazo++;
            else if (sit === 'enviado_atrasado') atrasados++;
            else if (sit === 'nao_enviado' || sit === 'atrasado') naoEnviados++;
        }));
        const total = noPrazo + atrasados + naoEnviados;
        return { unidade, noPrazo, atrasados, naoEnviados, total, pct: total ? Math.round(((noPrazo + atrasados) / total) * 100) : 100 };
    }).sort((a, b) => a.pct - b.pct || b.naoEnviados - a.naoEnviados);
    const geral = resumo.reduce((t, r) => ({ enviados: t.enviados + r.noPrazo + r.atrasados, total: t.total + r.total }), { enviados: 0, total: 0 });
    const umaUnidade = unidadesValidas.length === 1 ? unidadesValidas[0] : null;
    const th = 'px-4 py-2.5 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:text-slate-400';

    return (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6 dark:bg-slate-900 dark:border-slate-800">
            <button type="button" onClick={() => setAberto(a => !a)} className="w-full px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 text-left">
                <span className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-[12px] font-black uppercase tracking-widest text-slate-800 dark:text-white">{tx('Relatórios de fechamento enviados')}</span>
                    {carregando && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                </span>
                <span className="flex items-center gap-3">
                    {envios !== null && <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400">{tx('{enviados} de {total} enviados no período ({pct}%)', { enviados: geral.enviados, total: geral.total, pct: geral.total ? Math.round((geral.enviados / geral.total) * 100) : 100 })}</span>}
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                </span>
            </button>
            {aberto && (
                envios === null ? (
                    <p className="px-5 pb-4 text-[11px] font-bold text-amber-700 dark:text-amber-400">{tx('O registro dos relatórios ainda não está ligado no banco (falta rodar o SQL do relatório de fechamento).')}</p>
                ) : !dias.length ? (
                    <p className="px-5 pb-4 text-[11px] font-bold text-slate-400">{tx('O registro dos relatórios começou em 05/11/2026. Escolha um período a partir dessa data.')}</p>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar border-t border-slate-100 dark:border-slate-800">
                        {umaUnidade ? (
                            <table className="w-full text-left border-collapse min-w-[640px]">
                                <thead className="bg-slate-50 dark:bg-slate-800/60">
                                    <tr><th className={th}>{tx('Dia')}</th><th className={th}>{tx('Manhã (até 14h30)')}</th><th className={th}>{tx('Noite (até 23h)')}</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {[...dias].reverse().map(d => {
                                        const turnos = turnosDoDia(d);
                                        return (
                                            <tr key={d}>
                                                <td className="px-4 py-2.5 text-[11px] font-black text-slate-700 whitespace-nowrap dark:text-slate-200">{ddmm(d)} <span className="font-bold text-slate-400 uppercase">{diaSemana(d)}</span></td>
                                                {turnos.length === 1 ? (
                                                    <td colSpan="2" className="px-4 py-2.5">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-2">{tx('Sábado, domingo e feriado (até 13h)')}</span>
                                                        <Celula t={turnos[0]} dataIso={d} envio={achar(umaUnidade, d, turnos[0].turno)} nomes={[]} />
                                                    </td>
                                                ) : turnos.map(t => (
                                                    <td key={t.turno} className="px-4 py-2.5"><Celula t={t} dataIso={d} envio={achar(umaUnidade, d, t.turno)} nomes={nomesDoTurno(colaboradores, umaUnidade, t.turno)} /></td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full text-left border-collapse min-w-[640px]">
                                <thead className="bg-slate-50 dark:bg-slate-800/60">
                                    <tr>
                                        <th className={th}>{tx('Unidade')}</th>
                                        <th className={`${th} text-right`}>{tx('No prazo')}</th>
                                        <th className={`${th} text-right`}>{tx('Atrasados')}</th>
                                        <th className={`${th} text-right`}>{tx('Não enviados')}</th>
                                        <th className={`${th} w-48`}>{tx('Enviados')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {resumo.map(r => (
                                        <tr key={r.unidade}>
                                            <td className="px-4 py-2.5 text-[12px] font-black uppercase text-slate-800 dark:text-white">{r.unidade}</td>
                                            <td className="px-4 py-2.5 text-right text-[12px] font-black text-emerald-600 tabular-nums dark:text-emerald-400">{r.noPrazo}</td>
                                            <td className="px-4 py-2.5 text-right text-[12px] font-black text-amber-600 tabular-nums dark:text-amber-400">{r.atrasados}</td>
                                            <td className="px-4 py-2.5 text-right text-[12px] font-black text-rose-600 tabular-nums dark:text-rose-400">{r.naoEnviados}</td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800"><div className={`h-full rounded-full ${r.pct >= 90 ? 'bg-emerald-500' : r.pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${r.pct}%` }} /></div>
                                                    <span className="text-[11px] font-black tabular-nums text-slate-600 dark:text-slate-300">{r.pct}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {!umaUnidade && <p className="px-5 py-2.5 text-[11px] font-bold text-slate-400">{tx('Escolha uma unidade no topo para ver dia a dia.')}</p>}
                    </div>
                )
            )}
        </section>
    );
};

export default PainelEnviosRelatorio;
