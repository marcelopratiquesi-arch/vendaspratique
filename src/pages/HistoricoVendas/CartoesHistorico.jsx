// ==========================================
// REGISTROS DO HISTÓRICO NO CELULAR (26/11/2026, projeto celular): cartões no lugar da tabela.
// Fazem tudo que a tabela faz (ordenar, copiar, abrir ficha, editar, apagar) usando as MESMAS ações do TabelaHistorico.
// ==========================================
import React from 'react';
import { User, Edit3, Trash2, Check, X, FilterX, Loader2 } from 'lucide-react';
import { CartaoCelular, OrdenarCelular } from '../../components/celular/Cartao.jsx';
import CopyButton from './CopyButton.jsx';
import { formatMoney, formatDataBR, formatarCPF, extrairHoraCriacao, toTitleCase, itensCatalogoParaEdicao } from './utils.js';
import { tx } from '../../i18n/traduzir.js';

const campo = 'w-full min-w-0 h-11 bg-white border border-blue-300 text-blue-800 rounded-xl px-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold shadow-sm dark:bg-slate-900 dark:border-blue-500/30 dark:text-blue-300';
const rotulo = 'block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 dark:text-slate-400';

const CartoesHistorico = ({
    linhas, vazio, ordenacao, setOrdenacao, temVisaoGlobal, podeEditar, podeEditarVenda, podeExcluirVenda,
    editandoId, dadosEdicao, isSubmitting, catalogoGeral, colaboradores, onAbrirAluno, abrirFichaDoAluno, abrindoAlunoId,
    iniciarEdicao, handleEdicaoChange, cancelarEdicao, salvarEdicao, removerLancamento,
}) => {
    const opcoes = [
        ['data:desc', tx('Data (mais novas)')], ['data:asc', tx('Data (mais antigas)')],
        ['nome_aluno:asc', tx('Aluno (A a Z)')], ['nome_aluno:desc', tx('Aluno (Z a A)')],
        ['cpf:asc', 'CPF'], ['produto:asc', tx('Item vendido (A a Z)')], ['vendedor:asc', tx('Vendedor (A a Z)')],
        ['valor:desc', tx('Valor (maior)')], ['valor:asc', tx('Valor (menor)')],
        ...(temVisaoGlobal ? [['unidade:asc', tx('Unidade (A a Z)')]] : []),
    ].map(([valor, texto]) => ({ valor, rotulo: texto }));
    const valorOrdem = `${ordenacao.coluna}:${ordenacao.direcao}`;
    // Se no computador escolheram uma ordem que não está na lista, ela aparece mesmo assim
    if (!opcoes.some(o => o.valor === valorOrdem)) opcoes.unshift({ valor: valorOrdem, rotulo: tx('Ordem atual') });

    if (vazio) {
        return (
            <div className="md:hidden px-5 py-16 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                <FilterX className="w-12 h-12 mx-auto text-slate-300 mb-4 opacity-60" />
                {tx("Nenhuma venda encontrada para estes filtros.")}
            </div>
        );
    }

    const vendedoresPara = (row) => {
        const lista = colaboradores
            .filter(c => (c.unidade || 'MATRIZ').toUpperCase() === (row.unidade || 'MATRIZ').toUpperCase())
            .map(c => c.nome.toUpperCase());
        const atual = (dadosEdicao.vendedor || '').toUpperCase();
        if (atual && !lista.includes(atual)) lista.push(atual);
        return lista.sort();
    };

    return (
        <div className="md:hidden p-2.5 space-y-2.5 bg-slate-50 dark:bg-slate-950/40">
            <OrdenarCelular valor={valorOrdem} opcoes={opcoes}
                onChange={(v) => { const [coluna, direcao] = v.split(':'); setOrdenacao({ coluna, direcao }); }} />
            {linhas.map(row => {
                if (editandoId === row.id) {
                    return (
                        <CartaoCelular key={row.id} destaque="!border-blue-400 !bg-blue-50/40 dark:!bg-blue-500/10">
                            <div className="grid grid-cols-1 gap-2.5">
                                <label><span className={rotulo}>{tx('Data da venda')}</span>
                                    <input type="date" value={dadosEdicao.data} onChange={e => handleEdicaoChange('data', e.target.value)} className={campo} /></label>
                                <label><span className={rotulo}>{tx('Nome do Aluno')}</span>
                                    <input type="text" value={dadosEdicao.nome_aluno} onChange={e => handleEdicaoChange('nome_aluno', e.target.value)} className={`${campo} uppercase`} /></label>
                                <label><span className={rotulo}>{tx('CPF (Apenas números)')}</span>
                                    <input type="text" inputMode="numeric" value={dadosEdicao.cpf} onChange={e => handleEdicaoChange('cpf', e.target.value)} maxLength="14" className={campo} /></label>
                                <label><span className={rotulo}>{tx('Item')}</span>
                                    <select value={dadosEdicao.produto} onChange={e => handleEdicaoChange('produto', e.target.value)} className={`${campo} uppercase`}>
                                        <option value="" disabled>{tx("Selecione...")}</option>
                                        {itensCatalogoParaEdicao(catalogoGeral, row.produto).map(c => <option key={c.id} value={c.nome}>{c.nome}{c.desativado ? ` ${tx('(desativado)')}` : ''}</option>)}
                                    </select></label>
                                <label><span className={rotulo}>{tx('Vendedor')}</span>
                                    <select value={(dadosEdicao.vendedor || '').toUpperCase()} onChange={e => handleEdicaoChange('vendedor', e.target.value)} className={`${campo} uppercase`}>
                                        <option value="" disabled>{tx("Selecione o Vendedor...")}</option>
                                        {vendedoresPara(row).map(v => <option key={v} value={v}>{toTitleCase(v)}</option>)}
                                    </select></label>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <label><span className={rotulo}>{tx('Qtd')}</span>
                                        <input type="number" min="1" inputMode="numeric" value={dadosEdicao.quantidade} onChange={e => handleEdicaoChange('quantidade', e.target.value)} className={campo} /></label>
                                    <div><span className={rotulo}>{tx('Valor')}</span>
                                        <div className="h-11 px-3 flex items-center rounded-xl bg-slate-100 border border-slate-300 text-slate-500 font-black text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">{formatMoney(dadosEdicao.valorCalculado)}</div></div>
                                </div>
                                <div className="grid grid-cols-2 gap-2.5 pt-1">
                                    <button type="button" disabled={isSubmitting} onClick={cancelarEdicao} className="h-11 flex items-center justify-center gap-1.5 bg-slate-200 text-slate-700 disabled:opacity-50 rounded-xl text-[11px] font-black uppercase tracking-widest dark:bg-slate-700 dark:text-slate-200">
                                        <X className="w-4 h-4" />{' '}{tx("Cancelar")}
                                    </button>
                                    <button type="button" disabled={isSubmitting} onClick={() => salvarEdicao(row)} className="h-11 flex items-center justify-center gap-1.5 bg-emerald-500 text-white disabled:opacity-50 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-md">
                                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{' '}{tx("Salvar")}
                                    </button>
                                </div>
                            </div>
                        </CartaoCelular>
                    );
                }

                const rawCpf = row.cpf || row.cpf_aluno;
                const rawName = row.nome_aluno || row.nome || '';
                const nomeExibicao = toTitleCase(rawName);
                const cpfExibicao = formatarCPF(rawCpf);
                const comBotoes = podeEditar && (podeEditarVenda || podeExcluirVenda);

                return (
                    <CartaoCelular key={row.id}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    {onAbrirAluno && rawCpf ? (
                                        <button type="button" onClick={() => abrirFichaDoAluno(row.id, rawCpf)} disabled={Boolean(abrindoAlunoId)}
                                            className="min-w-0 py-1 text-left text-[13px] font-black uppercase break-words text-blue-700 underline underline-offset-2 disabled:cursor-wait dark:text-blue-400">
                                            {nomeExibicao}
                                        </button>
                                    ) : (
                                        <p className="min-w-0 py-1 text-[13px] font-black uppercase break-words text-slate-800 dark:text-white">{nomeExibicao}</p>
                                    )}
                                    {abrindoAlunoId === row.id && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />}
                                    {rawName && <CopyButton textToCopy={nomeExibicao} label={tx("Copiar nome do aluno")} />}
                                </div>
                                {cpfExibicao && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">{cpfExibicao}</span>
                                        {rawCpf && <CopyButton textToCopy={cpfExibicao} label={tx("Copiar CPF do aluno")} />}
                                    </div>
                                )}
                            </div>
                            <div className="shrink-0 pt-1 text-sm font-black tabular-nums text-slate-800 dark:text-white">{formatMoney(row.valor)}</div>
                        </div>

                        <div className="mt-1.5 flex items-start gap-1.5 text-xs font-bold text-blue-600 uppercase dark:text-blue-400">
                            <span className="shrink-0 bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[10px] dark:bg-blue-500/20 dark:text-blue-300">{row.quantidade || '1'}x</span>
                            <span className="min-w-0 break-words">{row.produto}</span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="inline-flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md text-[10px] font-bold text-slate-600 uppercase tracking-widest max-w-full break-words dark:bg-slate-800 dark:text-slate-300">
                                <User className="w-3 h-3 shrink-0 text-slate-400" />{toTitleCase(row.vendedor || '-')}
                            </span>
                            {temVisaoGlobal && <span className="text-[10px] font-black text-rose-500 uppercase">{row.unidade || tx("MATRIZ")}</span>}
                        </div>
                        <p className="mt-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {formatDataBR(row.data || row.created_at)}
                            {row.created_at ? ` · ${tx('Lançado por:')} ${toTitleCase(row.criado_por ? row.criado_por.split(' ')[0] : 'Sistema')} • ${extrairHoraCriacao(row.created_at)}` : ''}
                        </p>

                        {comBotoes && (
                            <div className="mt-2.5 flex gap-2">
                                {podeEditarVenda && (
                                    <button type="button" onClick={() => iniciarEdicao(row)} className="flex-1 h-10 flex items-center justify-center gap-1.5 bg-white text-blue-600 rounded-xl border border-blue-200 text-[11px] font-black uppercase tracking-widest active:bg-blue-50 dark:bg-slate-900 dark:text-blue-400 dark:border-blue-500/30">
                                        <Edit3 className="w-3.5 h-3.5" />{' '}{tx("Editar")}
                                    </button>
                                )}
                                {podeExcluirVenda && (
                                    <button type="button" onClick={() => removerLancamento(row.id)} className="flex-1 h-10 flex items-center justify-center gap-1.5 bg-white text-rose-500 rounded-xl border border-rose-200 text-[11px] font-black uppercase tracking-widest active:bg-rose-50 dark:bg-slate-900 dark:border-rose-500/30">
                                        <Trash2 className="w-3.5 h-3.5" />{' '}{tx("Apagar")}
                                    </button>
                                )}
                            </div>
                        )}
                    </CartaoCelular>
                );
            })}
        </div>
    );
};

export default CartoesHistorico;
