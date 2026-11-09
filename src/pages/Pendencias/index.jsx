// ==========================================
// ABA PENDÊNCIAS (decisão do dono, 05/11/2026) — Admin (todas as unidades) e Mentor (as dele).
// Uma linha por unidade com o que falta: Conferência (prazo sexta), Movimentação (todo dia, 7h), Metas (até dia 03)
// e Relatório da recepção (turnos não enviados).
// Revisão 06/11/2026 (pedido do dono, "tela mais bonita, menos informação"): filtro por tipo de pendência no topo,
// relatório em etiquetas curtas por dia (o nome da recepcionista aparece ao passar o mouse), sem botão "Conferir"
// aqui (quem confere no grupo é o Líder, pela janela/cartão dele ou pelo painel da aba Relatórios), unidades em dia
// numa linha só no fim, prazos num "?" e plural certo ("1 venda", "1 pendência").
// Ajustes 06/11/2026 (dono): o filtro escolhe também o que vai no WhatsApp (grupo e Líder) e mostra só a coluna daquele
// tipo; o que está feito aparece em verde ("✅ OK"); movimentação de vários dias seguidos vira um bloco ("05/11 a 07/11");
// o relatório mostra todos os turnos de ontem e hoje (verde = enviado, vermelho = não enviado, amarelo = no prazo).
// WhatsApp: botão por unidade (Líder daquela unidade) e "Mensagem para o grupo geral" (todas as pendentes).
// Respeita a unidade escolhida no topo. Só leitura. Regras em pendencias.js.
// ==========================================
import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, MessageCircle, RefreshCw, Send, Loader2, ClipboardCheck, BarChart3, Target, HelpCircle } from 'lucide-react';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import ModalTextoWhatsapp from '../AnaliseVendas/Modais.jsx';
import { abrirNoWhatsApp } from '../../components/whatsapp.js';
import { avisar } from '../../components/avisar.js';
import { liderDaUnidade } from '../FechamentoCaixa/cobrancaAuditoria.js';
import { normalizeString } from '../AnaliseVendas/utils.js';
import { mensagemPendenciasGrupo, mensagemPendenciasUnidade, DIA_PRAZO_METAS, TIPOS_PENDENCIA } from './pendencias.js';

const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dinheiro = (v) => new Intl.NumberFormat(localeAtual(), { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const juntarCampos = (lista) => lista.map(c => tx(c)).join(', ');
const Ok = () => <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">✅ {tx('OK')}</span>;
// "Victor Gabriel Rehfeld Paixão" → "Victor Gabriel" (o nome completo fica no passar do mouse)
const nomeCurto = (nome) => String(nome || '').trim().split(/\s+/).slice(0, 2).join(' ');
const TURNO_CURTO = { MANHA: 'Manhã', NOITE: 'Noite', FIM_DE_SEMANA: 'Sáb/dom' };

// Tipos de pendência do filtro do topo
const FILTROS = [
    { id: 'todas', rotulo: 'Todas' },
    { id: 'conferencia', rotulo: 'Conferência', tem: TIPOS_PENDENCIA.conferencia },
    { id: 'movimento', rotulo: 'Movimentação', tem: TIPOS_PENDENCIA.movimento },
    { id: 'metas', rotulo: 'Metas', tem: TIPOS_PENDENCIA.metas },
    { id: 'relatorio', rotulo: 'Relatório', tem: TIPOS_PENDENCIA.relatorio },
];

const TEXTO_PRAZOS = 'Movimentação: de segunda a sábado (feriado também), a partir das 7h; domingo não tem. Aqui aparece só o dia atual (os dias antigos ficam na tabela Movimentação por dia). Conferência: toda sexta-feira; o mês anterior é cobrado até o dia 15 (pagamento da comissão). Metas: até o dia 03 de cada mês. Relatório da recepção: manhã das 13h30 às 15h, noite das 21h30 às 23h, sábado, domingo e feriado das 12h às 13h.';

// Cor e texto de cada situação do relatório (ontem e hoje)
const SITUACAO_RELATORIO = {
    enviado: { cor: 'emerald', texto: 'enviado' },
    enviado_atrasado: { cor: 'emerald', texto: 'enviado com atraso' },
    conferido_enviado: { cor: 'emerald', texto: 'enviado (conferido no grupo)' },
    confirmado_nao: { cor: 'rose', texto: 'não enviado (confirmado)' },
    cobrando: { cor: 'amber', texto: 'ainda no prazo' },
    atrasado: { cor: 'rose', texto: 'não enviado' },
    nao_enviado: { cor: 'rose', texto: 'não enviado' },
    aguardando: { cor: 'slate', texto: 'ainda não chegou o horário' },
};
const CLASSE_COR = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    slate: 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
};

// Relatório da recepção: uma linha por dia (ontem e hoje) com etiquetas curtas (Manhã / Noite) na cor da situação;
// o nome da recepcionista e o detalhe vão no passar do mouse
const RelatorioCompacto = ({ lista }) => {
    const porDia = [];
    lista.forEach(r => {
        let dia = porDia.find(d => d.data === r.data);
        if (!dia) { dia = { data: r.data, hoje: r.hoje, itens: [] }; porDia.push(dia); }
        dia.itens.push(r);
    });
    return (
        <div className="space-y-1">
            {porDia.map(d => (
                <div key={d.data} className="flex items-center gap-1.5 flex-wrap">
                    <span className="w-10 text-[10px] font-black uppercase tracking-wide text-slate-400">{d.hoje ? tx('Hoje') : ddmm(d.data)}</span>
                    {d.itens.map(r => {
                        const s = SITUACAO_RELATORIO[r.situacao] || SITUACAO_RELATORIO.nao_enviado;
                        const icone = s.cor === 'emerald' ? '✓ ' : s.cor === 'rose' ? '✗ ' : '';
                        const dica = `${tx(r.rotulo)}: ${tx(s.texto)}${r.situacao === 'cobrando' ? ` (${tx('prazo {hora}', { hora: r.atrasaTexto })})` : ''}${r.nomes?.length ? ` — ${r.nomes.join(' / ')}` : ''}`;
                        return (
                            <span key={r.turno} title={dica}
                                className={`h-5 px-2 rounded-md text-[10px] font-black uppercase tracking-wide inline-flex items-center cursor-default ${CLASSE_COR[s.cor]}`}>
                                {icone}{tx(TURNO_CURTO[r.turno] || r.rotulo)}
                            </span>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

const PaginaPendencias = ({ pendencias, colaboradores = [], unidadeGlobal = 'TODAS', ehMentor }) => {
    const { lista = [], carregando, carregado, recarregar } = pendencias || {};
    const filtrada = unidadeGlobal && unidadeGlobal !== 'TODAS' ? lista.filter(u => normalizeString(u.unidade) === normalizeString(unidadeGlobal)) : lista;
    const comPendencia = filtrada.filter(u => u.totalDia > 0);
    const totalPendencias = comPendencia.reduce((t, u) => t + u.totalDia, 0);

    const [filtro, setFiltro] = useState('todas');
    const filtroAtual = FILTROS.find(f => f.id === filtro) || FILTROS[0];
    const linhasPendentes = filtroAtual.tem ? comPendencia.filter(filtroAtual.tem) : comPendencia;
    // Unidades em dia (ou em dia no tipo escolhido) também aparecem na tabela, embaixo, tudo verde (decisão do dono, 09/11/2026)
    const linhasOk = filtrada.filter(u => !linhasPendentes.includes(u)).sort((a, b) => a.unidade.localeCompare(b.unidade));
    const linhas = [...linhasPendentes, ...linhasOk];
    const qtdPorFiltro = (f) => (f.tem ? comPendencia.filter(f.tem).length : comPendencia.length);

    const [modal, setModal] = useState(null); // { titulo, texto, telefone }
    const [copiado, setCopiado] = useState(false);
    const abrirMensagem = (titulo, texto, telefone = '') => { setCopiado(false); setModal({ titulo, texto, telefone }); };
    const copiar = () => {
        navigator.clipboard.writeText(modal?.texto || '').then(() => {
            setCopiado(true);
            setTimeout(() => { setCopiado(false); setModal(null); }, 2000);
        }).catch(() => avisar(tx('Não foi possível copiar. Selecione o texto e copie manualmente.'), 'erro'));
    };

    // O filtro escolhido define o que vai na mensagem (só conferência, só movimentação...)
    const tipoMensagem = filtro === 'todas' ? null : filtro;
    const cobrarGrupo = () => abrirMensagem(tipoMensagem ? `${tx('Pendências – grupo geral')} · ${tx(filtroAtual.rotulo)}` : tx('Pendências – grupo geral'), mensagemPendenciasGrupo(filtrada, new Date(), tipoMensagem));
    const cobrarLider = (u) => {
        const lider = liderDaUnidade(colaboradores, u.unidade);
        const telefone = String(lider?.telefone || '').replace(/\D/g, '');
        if (!lider) avisar(tx('Nenhum Líder ativo cadastrado na Equipe de {unidade}. Escolha o contato no WhatsApp.', { unidade: u.unidade }), 'atencao');
        else if (telefone.length < 10) avisar(tx('O Líder {nome} está sem telefone no cadastro da Equipe. Escolha o contato no WhatsApp.', { nome: lider.nome }), 'atencao');
        abrirMensagem(`${tx('Cobrar Líder')} – ${u.unidade}${tipoMensagem ? ` · ${tx(filtroAtual.rotulo)}` : ''}`, mensagemPendenciasUnidade(u, lider?.nome, tipoMensagem), telefone.length >= 10 ? telefone : '');
    };

    const th = 'px-4 py-2.5 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:text-slate-400';
    const cor = (atrasado) => (atrasado ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300');
    // Com um filtro escolhido, a tabela mostra só a coluna daquele tipo
    const mostra = (col) => filtro === 'todas' || filtro === col;
    const qtdColunas = 3 + ['conferencia', 'movimento', 'metas', 'relatorio'].filter(mostra).length;

    return (
        <div className="space-y-4 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto pb-10">
            {/* TOPO EM UMA FAIXA */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${comPendencia.length ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'}`}>
                        {comPendencia.length ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                    </div>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-1.5 dark:text-white">
                            {tx('Pendências')}
                            <span title={tx(TEXTO_PRAZOS)} aria-label={tx(TEXTO_PRAZOS)} className="text-slate-400 hover:text-slate-600 cursor-help dark:hover:text-slate-200"><HelpCircle className="w-3.5 h-3.5" /></span>
                        </h1>
                        <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                            {totalPendencias === 1 ? tx('1 pendência') : tx('{qtd} pendências', { qtd: totalPendencias })}
                            {' · '}{tx('{unidades} de {total} unidades', { unidades: comPendencia.length, total: filtrada.length })}
                            {' · '}{unidadeGlobal && unidadeGlobal !== 'TODAS' ? unidadeGlobal : (ehMentor ? tx('Todas as minhas unidades') : tx('Todas as unidades'))}
                            {carregando && <Loader2 className="inline w-3 h-3 ml-1 animate-spin" />}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => recarregar?.()} className="h-9 px-3 rounded-xl text-[12px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center gap-1.5 transition-colors dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800">
                        <RefreshCw className="w-3.5 h-3.5" />{tx('Atualizar')}
                    </button>
                    <button type="button" onClick={cobrarGrupo} disabled={!carregado} className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm">
                        <Send className="w-4 h-4" />{tipoMensagem ? tx('Mensagem para o grupo: {tipo}', { tipo: tx(filtroAtual.rotulo) }) : tx('Mensagem para o grupo geral')}
                    </button>
                </div>
            </div>

            {/* FILTRO POR TIPO DE PENDÊNCIA */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-white rounded-xl border border-slate-200 w-fit max-w-full dark:bg-slate-900 dark:border-slate-800" role="tablist" aria-label={tx('Filtrar pendências')}>
                {FILTROS.map(f => {
                    const ativo = filtro === f.id;
                    const qtd = qtdPorFiltro(f);
                    return (
                        <button key={f.id} type="button" role="tab" aria-selected={ativo} onClick={() => setFiltro(f.id)}
                            className={`h-8 px-3 rounded-lg text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 transition-colors ${ativo ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'}`}>
                            {tx(f.rotulo)}
                            <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] flex items-center justify-center ${ativo ? 'bg-white/20 text-white' : qtd ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>{qtd}</span>
                        </button>
                    );
                })}
            </div>

            {/* TABELA POR UNIDADE (primeiro as com pendência; embaixo as em dia, tudo verde) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className={`w-full text-left border-collapse ${filtro === 'todas' ? 'min-w-[1040px]' : 'min-w-[640px]'}`}>
                        <thead className="bg-slate-50 dark:bg-slate-800/60">
                            <tr>
                                <th className={th}>{tx('Unidade')}</th>
                                {mostra('conferencia') && <th className={th}><span className="inline-flex items-center gap-1"><ClipboardCheck className="w-3.5 h-3.5" />{tx('Conferência')}</span></th>}
                                {mostra('movimento') && <th className={th}><span className="inline-flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" />{tx('Movimentação')}</span></th>}
                                {mostra('metas') && <th className={th}><span className="inline-flex items-center gap-1"><Target className="w-3.5 h-3.5" />{tx('Metas do mês')}</span></th>}
                                {mostra('relatorio') && <th className={th}><span className="inline-flex items-center gap-1"><Send className="w-3.5 h-3.5" />{tx('Relatório (ontem e hoje)')}</span></th>}
                                <th className={th}>{tx('Líder')}</th>
                                <th className={`${th} text-center`}>{tx('Cobrar')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {!carregado ? (
                                <tr><td colSpan={qtdColunas} className="py-16 text-center text-[12px] font-bold text-slate-400"><Loader2 className="inline w-4 h-4 mr-2 animate-spin" />{tx('Carregando pendências...')}</td></tr>
                            ) : filtrada.length === 0 ? (
                                <tr><td colSpan={qtdColunas} className="py-16 text-center text-[12px] font-bold text-slate-400">{tx('Nenhuma unidade para mostrar.')}</td></tr>
                            ) : linhas.map((u, i) => {
                                const lider = liderDaUnidade(colaboradores, u.unidade);
                                const c = u.conferencia;
                                const ok = i >= linhasPendentes.length; // linha de unidade em dia (no tipo escolhido)
                                return (
                                    <React.Fragment key={u.unidade}>
                                    {/* Faixa que separa: "Nenhuma pendência" (quando não há) e o título "Em dia" */}
                                    {i === 0 && !linhasPendentes.length && (
                                        <tr><td colSpan={qtdColunas} className="py-4 text-center text-[12px] font-bold text-emerald-600 dark:text-emerald-400">✅ {filtroAtual.tem ? tx('Nenhuma unidade com pendência deste tipo.') : tx('Todas as unidades estão em dia.')}</td></tr>
                                    )}
                                    {i === linhasPendentes.length && (
                                        <tr className="bg-emerald-50/70 dark:bg-emerald-500/10">
                                            <td colSpan={qtdColunas} className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                                                ✅ {tx('Em dia')} ({linhasOk.length})
                                            </td>
                                        </tr>
                                    )}
                                    <tr className={ok ? 'bg-emerald-50/30 hover:bg-emerald-50/60 dark:bg-emerald-500/5 dark:hover:bg-emerald-500/10' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'}>
                                        <td className="px-4 py-2.5 align-top">
                                            <p className="text-[13px] font-black uppercase tracking-tight text-slate-800 dark:text-white">{u.unidade}</p>
                                            {u.totalDia === 0 ? (
                                                <p className="text-[10px] font-black uppercase tracking-widest mt-0.5 text-emerald-600 dark:text-emerald-400">✅ {tx('Em dia')}</p>
                                            ) : (
                                                <p className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${ok ? 'text-slate-400' : cor(u.atrasadoDia)}`}>{u.totalDia === 1 ? tx('1 pendência') : tx('{qtd} pendências', { qtd: u.totalDia })}</p>
                                            )}
                                        </td>
                                        {mostra('conferencia') && <td className="px-4 py-2.5 align-top">
                                            {c?.atrasado ? (
                                                <div className="flex flex-col">
                                                    <span className="text-[12px] font-black text-rose-700 dark:text-rose-300">{c.qtd === 1 ? tx('1 venda atrasada') : tx('{qtd} vendas atrasadas', { qtd: c.qtd })}</span>
                                                    <span className="text-[10px] font-bold text-slate-400">{dinheiro(c.valor)} · {tx('desde {data}', { data: ddmm(c.atrasadas[0].inicio) })}</span>
                                                </div>
                                            ) : c?.semanaAtual ? <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">{tx('Vence hoje: {qtd} vendas', { qtd: c.semanaAtual.qtd })}</span> : <Ok />}
                                        </td>}
                                        {mostra('movimento') && <td className="px-4 py-2.5 align-top">
                                            {/* Só o dia atual (decisão do dono, 09/11/2026): lançou hoje completo = OK; dias antigos ficam na tabela Movimentação por dia */}
                                            {u.movimentoDia?.length ? (
                                                <ul className="space-y-0.5">
                                                    {u.movimentoDia.map(d => (
                                                        <li key={d.data} className={`text-[11px] font-bold ${cor(!d.hoje)}`}>
                                                            <span className="text-[10px] font-black uppercase text-slate-400 mr-1">{d.hoje ? tx('Hoje') : ddmm(d.data)}</span>
                                                            {d.semLancamento ? tx('não lançou') : tx('falta {campos}', { campos: juntarCampos(d.falta) })}
                                                            {d.semLancamento && (
                                                                <span className="block text-[10px] font-bold text-slate-400">
                                                                    {u.ultimoLancamento ? tx('último lançamento: {data}', { data: ddmm(u.ultimoLancamento) }) : tx('nenhum lançamento')}
                                                                </span>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : <Ok />}
                                        </td>}
                                        {mostra('metas') && <td className="px-4 py-2.5 align-top">
                                            {u.metas ? (
                                                <div className="flex flex-col gap-0.5" title={u.metas.atrasado ? tx('prazo dia {dia} vencido', { dia: String(DIA_PRAZO_METAS).padStart(2, '0') }) : tx('prazo até dia {dia}', { dia: String(DIA_PRAZO_METAS).padStart(2, '0') })}>
                                                    {u.metas.start && <span className={`text-[11px] font-bold ${cor(u.metas.atrasado)}`}>{tx('Start')}: {u.metas.start.naoPreenchida ? tx('não preenchida') : tx('falta {campos}', { campos: juntarCampos(u.metas.start.falta) })}</span>}
                                                    {u.metas.mensal && <span className={`text-[11px] font-bold ${cor(u.metas.atrasado)}`}>{tx('Mensal')}: {u.metas.mensal.naoPreenchida ? tx('não preenchida') : tx('falta {campos}', { campos: juntarCampos(u.metas.mensal.falta) })}</span>}
                                                </div>
                                            ) : <Ok />}
                                        </td>}
                                        {mostra('relatorio') && <td className="px-4 py-2.5 align-top">
                                            {u.relatorioDias?.length ? <RelatorioCompacto lista={u.relatorioDias} /> : <Ok />}
                                        </td>}
                                        <td className="px-4 py-2.5 align-top">
                                            {lider ? (
                                                <div className="flex flex-col" title={lider.nome}>
                                                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">{nomeCurto(lider.nome)}</span>
                                                    <span className="text-[10px] font-bold text-slate-400">{lider.telefone || tx('sem telefone')}</span>
                                                </div>
                                            ) : <span className="text-[11px] font-bold text-slate-400">{tx('Sem Líder cadastrado')}</span>}
                                        </td>
                                        <td className="px-4 py-2.5 align-top text-center">
                                            {/* Em dia: nada para cobrar */}
                                            {ok ? <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400" aria-label={tx('Em dia')}>✓</span> : (
                                            <button type="button" onClick={() => cobrarLider(u)} title={tx('Cobrar o Líder desta unidade no WhatsApp')} aria-label={tx('Cobrar o Líder desta unidade no WhatsApp')}
                                                className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-500/20">
                                                <MessageCircle className="w-4 h-4" />
                                            </button>
                                            )}
                                        </td>
                                    </tr>
                                    </React.Fragment>
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
