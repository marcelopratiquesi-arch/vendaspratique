// ==========================================
// ABA PENDÊNCIAS (decisão do dono, 05/11/2026) — Admin (todas as unidades) e Mentor (as dele).
// Uma linha por unidade com o que falta: Conferência (prazo sexta), Movimentação (todo dia, 7h) e Metas (até dia 03).
// WhatsApp: botão por unidade (Líder daquela unidade) e "Mensagem para o grupo geral" (todas as pendentes).
// Respeita a unidade escolhida no topo. Só leitura. Regras em pendencias.js.
// ==========================================
import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, MessageCircle, RefreshCw, Send, Loader2, ClipboardCheck, BarChart3, Target } from 'lucide-react';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import ModalTextoWhatsapp from '../AnaliseVendas/Modais.jsx';
import { abrirNoWhatsApp } from '../../components/whatsapp.js';
import { avisar } from '../../components/avisar.js';
import { liderDaUnidade } from '../FechamentoCaixa/cobrancaAuditoria.js';
import { normalizeString } from '../AnaliseVendas/utils.js';
import { mensagemPendenciasGrupo, mensagemPendenciasUnidade, DIA_PRAZO_METAS } from './pendencias.js';

const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dinheiro = (v) => new Intl.NumberFormat(localeAtual(), { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const juntarCampos = (lista) => lista.map(c => tx(c)).join(', ');
const Tracinho = () => <span className="text-[11px] font-bold text-slate-400">—</span>;

const PaginaPendencias = ({ pendencias, colaboradores = [], unidadeGlobal = 'TODAS', ehMentor }) => {
    const { lista = [], carregando, carregado, recarregar } = pendencias || {};
    const filtrada = unidadeGlobal && unidadeGlobal !== 'TODAS' ? lista.filter(u => normalizeString(u.unidade) === normalizeString(unidadeGlobal)) : lista;
    const comPendencia = filtrada.filter(u => u.total > 0);
    const totalPendencias = comPendencia.reduce((t, u) => t + u.total, 0);

    const [modal, setModal] = useState(null); // { titulo, texto, telefone }
    const [copiado, setCopiado] = useState(false);
    const abrirMensagem = (titulo, texto, telefone = '') => { setCopiado(false); setModal({ titulo, texto, telefone }); };
    const copiar = () => {
        navigator.clipboard.writeText(modal?.texto || '').then(() => {
            setCopiado(true);
            setTimeout(() => { setCopiado(false); setModal(null); }, 2000);
        }).catch(() => avisar(tx('Não foi possível copiar. Selecione o texto e copie manualmente.'), 'erro'));
    };

    const cobrarGrupo = () => abrirMensagem(tx('Pendências – grupo geral'), mensagemPendenciasGrupo(filtrada, new Date()));
    const cobrarLider = (u) => {
        const lider = liderDaUnidade(colaboradores, u.unidade);
        const telefone = String(lider?.telefone || '').replace(/\D/g, '');
        if (!lider) avisar(tx('Nenhum Líder ativo cadastrado na Equipe de {unidade}. Escolha o contato no WhatsApp.', { unidade: u.unidade }), 'atencao');
        else if (telefone.length < 10) avisar(tx('O Líder {nome} está sem telefone no cadastro da Equipe. Escolha o contato no WhatsApp.', { nome: lider.nome }), 'atencao');
        abrirMensagem(`${tx('Cobrar Líder')} – ${u.unidade}`, mensagemPendenciasUnidade(u, lider?.nome), telefone.length >= 10 ? telefone : '');
    };

    const th = 'px-4 py-3 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:text-slate-400';
    const cor = (atrasado) => (atrasado ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300');

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto pb-10">
            {/* TOPO EM UMA FAIXA */}
            <div className="bg-white rounded-[20px] border border-slate-200 shadow-sm p-4 md:p-5 flex flex-wrap items-center justify-between gap-3 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${comPendencia.length ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'}`}>
                        {comPendencia.length ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                    </div>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">{tx('Pendências')}</h1>
                        <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                            {tx('{qtd} pendências em {unidades} de {total} unidades', { qtd: totalPendencias, unidades: comPendencia.length, total: filtrada.length })}
                            {' · '}{unidadeGlobal && unidadeGlobal !== 'TODAS' ? unidadeGlobal : (ehMentor ? tx('Todas as minhas unidades') : tx('Todas as unidades'))}
                            {carregando && <Loader2 className="inline w-3 h-3 ml-1 animate-spin" />}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => recarregar?.()} className="h-10 px-3 rounded-xl text-[12px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center gap-1.5 transition-colors dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800">
                        <RefreshCw className="w-3.5 h-3.5" />{tx('Atualizar')}
                    </button>
                    <button type="button" onClick={cobrarGrupo} disabled={!carregado} className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm">
                        <Send className="w-4 h-4" />{tx('Mensagem para o grupo geral')}
                    </button>
                </div>
            </div>

            {/* TABELA POR UNIDADE */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 dark:border-slate-800">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest dark:text-white">{tx('O que falta em cada unidade')}</h3>
                    <p className="text-[11px] font-bold text-slate-400">{tx('Movimentação: todo dia a partir das 7h. Conferência: toda sexta-feira. Metas: até o dia 03 de cada mês. Relatório da recepção: manhã até 14h30, noite até 23h, sábado e domingo até 13h.')}</p>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1120px]">
                        <thead className="bg-slate-50 dark:bg-slate-800/60">
                            <tr>
                                <th className={th}>{tx('Unidade')}</th>
                                <th className={th}><span className="inline-flex items-center gap-1"><ClipboardCheck className="w-3.5 h-3.5" />{tx('Conferência')}</span></th>
                                <th className={th}><span className="inline-flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" />{tx('Movimentação')}</span></th>
                                <th className={th}><span className="inline-flex items-center gap-1"><Target className="w-3.5 h-3.5" />{tx('Metas do mês')}</span></th>
                                <th className={th}><span className="inline-flex items-center gap-1"><Send className="w-3.5 h-3.5" />{tx('Relatório da recepção')}</span></th>
                                <th className={th}>{tx('Líder')}</th>
                                <th className={`${th} text-center`}>{tx('Cobrar')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {!carregado ? (
                                <tr><td colSpan="7" className="py-16 text-center text-[12px] font-bold text-slate-400"><Loader2 className="inline w-4 h-4 mr-2 animate-spin" />{tx('Carregando pendências...')}</td></tr>
                            ) : filtrada.length === 0 ? (
                                <tr><td colSpan="7" className="py-16 text-center text-[12px] font-bold text-slate-400">{tx('Nenhuma unidade para mostrar.')}</td></tr>
                            ) : filtrada.map(u => {
                                const lider = liderDaUnidade(colaboradores, u.unidade);
                                const emDia = u.total === 0;
                                const c = u.conferencia;
                                return (
                                    <tr key={u.unidade} className={emDia ? 'bg-emerald-50/30 dark:bg-emerald-500/5' : ''}>
                                        <td className="px-4 py-3 align-top">
                                            <p className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-white">{u.unidade}</p>
                                            {emDia
                                                ? <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mt-0.5 dark:text-emerald-400">✅ {tx('Em dia')}</p>
                                                : <p className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${cor(u.atrasado)}`}>{tx('{qtd} pendências', { qtd: u.total })}</p>}
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            {c?.atrasado ? (
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-rose-700 dark:text-rose-300">{tx('{qtd} vendas atrasadas', { qtd: c.qtd })}</span>
                                                    <span className="text-[11px] font-bold text-slate-400">{dinheiro(c.valor)} · {tx('desde {data}', { data: ddmm(c.atrasadas[0].inicio) })}</span>
                                                </div>
                                            ) : c?.semanaAtual ? <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">{tx('Vence hoje: {qtd} vendas', { qtd: c.semanaAtual.qtd })}</span> : <Tracinho />}
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            {u.movimento.length ? (
                                                <ul className="space-y-0.5">
                                                    {u.movimento.map(d => (
                                                        <li key={d.data} className={`text-[11px] font-bold ${cor(!d.hoje)}`}>
                                                            {d.hoje ? tx('Hoje') : ddmm(d.data)}: {d.semLancamento ? tx('não lançou') : tx('falta {campos}', { campos: juntarCampos(d.falta) })}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : <Tracinho />}
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            {u.metas ? (
                                                <div className="flex flex-col gap-0.5">
                                                    {u.metas.start && <span className={`text-[11px] font-bold ${cor(u.metas.atrasado)}`}>{tx('Meta Start')}: {u.metas.start.naoPreenchida ? tx('não preenchida') : tx('falta {campos}', { campos: juntarCampos(u.metas.start.falta) })}</span>}
                                                    {u.metas.mensal && <span className={`text-[11px] font-bold ${cor(u.metas.atrasado)}`}>{tx('Meta Mensal')}: {u.metas.mensal.naoPreenchida ? tx('não preenchida') : tx('falta {campos}', { campos: juntarCampos(u.metas.mensal.falta) })}</span>}
                                                    <span className="text-[10px] font-bold text-slate-400">{u.metas.atrasado ? tx('prazo dia {dia} vencido', { dia: String(DIA_PRAZO_METAS).padStart(2, '0') }) : tx('prazo até dia {dia}', { dia: String(DIA_PRAZO_METAS).padStart(2, '0') })}</span>
                                                </div>
                                            ) : <Tracinho />}
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            {u.relatorio?.length ? (
                                                <ul className="space-y-0.5">
                                                    {u.relatorio.map(r => (
                                                        <li key={`${r.data}-${r.turno}`} className={`text-[11px] font-bold ${cor(r.situacao !== 'cobrando')}`}>
                                                            {r.hoje ? tx('Hoje') : ddmm(r.data)} · {tx(r.rotulo)}: {tx('não enviado')}{r.nomes?.length ? ` — ${r.nomes.join(' / ')}` : ''}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : <Tracinho />}
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            {lider ? (
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">{lider.nome}</span>
                                                    <span className="text-[11px] font-bold text-slate-400">{lider.telefone || tx('sem telefone')}</span>
                                                </div>
                                            ) : <span className="text-[11px] font-bold text-slate-400">{tx('Sem Líder cadastrado')}</span>}
                                        </td>
                                        <td className="px-4 py-3 align-top text-center">
                                            {!emDia ? (
                                                <button type="button" onClick={() => cobrarLider(u)} title={tx('Cobrar o Líder desta unidade no WhatsApp')} aria-label={tx('Cobrar o Líder desta unidade no WhatsApp')}
                                                    className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-500/20">
                                                    <MessageCircle className="w-4 h-4" />
                                                </button>
                                            ) : <Tracinho />}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <ModalTextoWhatsapp
                isOpen={!!modal}
                titulo={modal?.titulo}
                icone="send"
                corIcone="blue"
                texto={modal?.texto || ''}
                setTexto={(texto) => setModal(m => (m ? { ...m, texto } : m))}
                copiado={copiado}
                onFechar={() => setModal(null)}
                onCopiar={copiar}
                onEnviar={() => abrirNoWhatsApp(modal?.telefone || '', modal?.texto || '')}
            />
        </div>
    );
};

export default PaginaPendencias;
