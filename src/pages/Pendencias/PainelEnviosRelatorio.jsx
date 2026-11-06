// ==========================================
// PAINEL "RELATÓRIOS DE FECHAMENTO ENVIADOS" (aba Relatórios; Admin, Mentor e Líder — decisão do dono, 05/11/2026)
// Mostra, no período do filtro, se a recepção enviou o relatório de cada turno (Copiar/Enviar no WhatsApp Fechamento).
// Uma unidade escolhida: uma linha por dia (Manhã | Noite; sábado e domingo um turno só).
// Várias unidades: resumo por unidade (no prazo, atrasados, não enviados, %).
// Tabela relatorios_fechamento_envios (clique da Recepção) + relatorios_fechamento_conferencia (o Líder conferiu no grupo,
// 06/11/2026: botões "Foi enviado" / "Não foi" nos turnos sem registro, permissão 313). Regras em relatorioFechamento.js.
// ==========================================
import React, { useEffect, useMemo, useState } from 'react';
import { Send, ChevronDown, Loader2 } from 'lucide-react';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import { normalizeString } from '../AnaliseVendas/utils.js';
import { buscarEnviosRelatorio, buscarConferenciasRelatorio, acharRegistroTurno, turnosDoDia, situacaoDoTurno, nomesDoTurno, INICIO_COBRANCA_RELATORIO, TEXTO_REGRA_RELATORIO, pedirConferirRelatorio } from './relatorioFechamento.js';

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

const BotaoMini = ({ onClick, cor, children }) => (
    <button type="button" onClick={onClick} className={`h-6 px-2 rounded-md text-[10px] font-black uppercase tracking-widest border ${cor}`}>{children}</button>
);

const Celula = ({ t, dataIso, envio, nomes, conferencia, podeConferir, unidade }) => {
    const sit = situacaoDoTurno(t, dataIso, envio, new Date());
    const quem = nomes.length ? nomes.join(' / ') : '';
    const abrir = () => pedirConferirRelatorio({ unidade, data: dataIso, turno: t.turno, rotulo: t.rotulo, nomes });
    const corrigir = podeConferir ? <button type="button" onClick={abrir} className="ml-2 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline dark:text-blue-400">{tx('corrigir')}</button> : null;
    // Sem registro do sistema: vale a conferência do Líder no grupo
    if (!envio && conferencia?.resultado === 'ENVIADO') return <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">✅ {tx('enviado (conferido no grupo)')}{quem ? ` · ${quem}` : ''} <span className="font-semibold text-slate-400">· {tx('por {nome}', { nome: conferencia.conferido_por || '—' })}</span>{corrigir}</span>;
    if (!envio && conferencia?.resultado === 'NAO_ENVIADO') return <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400">❌ {tx('não enviado (confirmado)')}{quem ? ` · ${quem}` : ''} <span className="font-semibold text-slate-400">· {tx('por {nome}', { nome: conferencia.conferido_por || '—' })}</span>{corrigir}</span>;
    const botoes = podeConferir && ['cobrando', 'atrasado', 'nao_enviado'].includes(sit) ? (
        <span className="inline-flex gap-1 ml-2 align-middle">
            <BotaoMini onClick={abrir} cor="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300">{tx('Foi enviado')}</BotaoMini>
            <BotaoMini onClick={abrir} cor="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300">{tx('Não foi')}</BotaoMini>
        </span>
    ) : null;
    if (sit === 'enviado') return <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">✅ {horaDe(envio.enviado_em)}{quem ? ` · ${quem}` : ''}</span>;
    if (sit === 'enviado_atrasado') return <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">⚠️ {horaDe(envio.enviado_em)} · {tx('atrasado')}{quem ? ` · ${quem}` : ''}</span>;
    if (sit === 'aguardando') return <span className="text-[11px] font-bold text-slate-400">{tx('aguardando (envio {inicio} às {fim})', { inicio: t.abreTexto, fim: t.atrasaTexto })}</span>;
    if (sit === 'cobrando') return <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">🕒 {tx('ainda não enviado (prazo {hora})', { hora: t.atrasaTexto })}{quem ? ` · ${quem}` : ''}{botoes}</span>;
    return <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400">❌ {tx('não enviado')}{quem ? ` · ${quem}` : ''}{botoes}</span>;
};

const PainelEnviosRelatorio = ({ unidades = [], faixa, colaboradores = [], podeConferir = false }) => {
    const [envios, setEnvios] = useState(null);
    const [conferencias, setConferencias] = useState([]);
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
            const [r, c] = await Promise.all([buscarEnviosRelatorio(ini, fim), buscarConferenciasRelatorio(ini, fim)]);
            if (ativo) { setEnvios(r); setConferencias(c || []); setCarregando(false); }
        };
        ler();
        window.addEventListener('relatorio-fechamento-enviado', ler);
        return () => { ativo = false; window.removeEventListener('relatorio-fechamento-enviado', ler); };
    }, [chaveDias]);

    const unidadesValidas = unidades.filter(u => u && u !== 'TODOS' && u !== 'TODAS');
    if (!unidadesValidas.length) return null;

    const achar = (unidade, dataIso, turno) => (envios || []).find(e => normalizeString(String(e.unidade || '')) === normalizeString(unidade) && String(e.data).slice(0, 10) === dataIso && e.turno === turno);
    const acharConf = (unidade, dataIso, turno) => acharRegistroTurno(conferencias, unidade, dataIso, turno);

    // Resumo por unidade (só turnos que já tinham de ter sido enviados: passaram da cobrança)
    const resumo = unidadesValidas.map(unidade => {
        let noPrazo = 0, atrasados = 0, naoEnviados = 0, conferidos = 0;
        dias.forEach(d => turnosDoDia(d).forEach(t => {
            const envio = achar(unidade, d, t.turno);
            const sit = situacaoDoTurno(t, d, envio, new Date());
            if (!envio && acharConf(unidade, d, t.turno)?.resultado === 'ENVIADO') conferidos++;
            else if (sit === 'enviado') noPrazo++;
            else if (sit === 'enviado_atrasado') atrasados++;
            else if (sit === 'nao_enviado' || sit === 'atrasado') naoEnviados++;
        }));
        const total = noPrazo + atrasados + naoEnviados + conferidos;
        return { unidade, noPrazo, atrasados, naoEnviados, conferidos, total, pct: total ? Math.round(((noPrazo + atrasados + conferidos) / total) * 100) : 100 };
    }).sort((a, b) => a.pct - b.pct || b.naoEnviados - a.naoEnviados);
    const geral = resumo.reduce((t, r) => ({ enviados: t.enviados + r.noPrazo + r.atrasados + r.conferidos, total: t.total + r.total }), { enviados: 0, total: 0 });
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
                                    <tr><th className={th}>{tx('Dia')}</th><th className={th}>{tx('Manhã · 13h30 às 15h')}</th><th className={th}>{tx('Noite · 21h30 às 23h')}</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {[...dias].reverse().map(d => {
                                        const turnos = turnosDoDia(d);
                                        return (
                                            <tr key={d}>
                                                <td className="px-4 py-2.5 text-[11px] font-black text-slate-700 whitespace-nowrap dark:text-slate-200">{ddmm(d)} <span className="font-bold text-slate-400 uppercase">{diaSemana(d)}</span></td>
                                                {turnos.length === 1 ? (
                                                    <td colSpan="2" className="px-4 py-2.5">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-2">{tx('Sábado, domingo e feriado · 12h às 13h')}</span>
                                                        <Celula t={turnos[0]} dataIso={d} envio={achar(umaUnidade, d, turnos[0].turno)} nomes={[]} conferencia={acharConf(umaUnidade, d, turnos[0].turno)} podeConferir={podeConferir} unidade={umaUnidade} />
                                                    </td>
                                                ) : turnos.map(t => (
                                                    <td key={t.turno} className="px-4 py-2.5"><Celula t={t} dataIso={d} envio={achar(umaUnidade, d, t.turno)} nomes={nomesDoTurno(colaboradores, umaUnidade, t.turno)} conferencia={acharConf(umaUnidade, d, t.turno)} podeConferir={podeConferir} unidade={umaUnidade} /></td>
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
                                        <th className={`${th} text-right`} title={tx('O sistema não viu o envio, mas o Líder conferiu no grupo que foi enviado. Muitos aqui = a recepção não está clicando em Copiar/Enviar no horário.')}>{tx('Conferidos no grupo')}</th>
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
                                            <td className="px-4 py-2.5 text-right text-[12px] font-black text-blue-600 tabular-nums dark:text-blue-400">{r.conferidos}</td>
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
                        <p className="px-5 py-2.5 border-t border-slate-100 text-[11px] font-semibold text-slate-500 leading-snug dark:border-slate-800 dark:text-slate-400">{tx(TEXTO_REGRA_RELATORIO)}</p>
                    </div>
                )
            )}
        </section>
    );
};

export default PainelEnviosRelatorio;
