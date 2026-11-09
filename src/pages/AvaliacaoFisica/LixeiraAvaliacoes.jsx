import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Trash2, RotateCcw, Loader2, Search, Info } from 'lucide-react';
import { supabase } from '../../supabaseClient.js';
import { avisar } from '../../components/avisar.js';
import { tx, localeAtual } from '../../i18n/traduzir.js';
import { SeletorPeriodo } from '../HistoricoVendas/FiltrosCompactos.jsx';
import { usePeriodoPadrao } from '../../components/periodoPadrao.js';
import { mascaraCPF } from '../CadastroGeral/utilsAlunos.js';
import { podeFazer } from '../../permissoes/catalogoPermissoes.js';
import { FaixaAvaliacao, BotaoFaixa } from './FaixaAvaliacao.jsx';

// ==========================================
// LIXEIRA DAS AVALIAÇÕES FÍSICAS (decisão do dono, 04/11/2026)
// Lê a consulta segura avaliacoes_lixeira_listar (cada um vê só as unidades dele; Admin todas).
// Período = data da EXCLUSÃO; unidade = a do seletor do topo. Restaurar: Admin e Mentor (restaurar_avaliacao).
// ==========================================

const dataHoraBR = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(localeAtual(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const dataBR = (valor) => {
    if (!valor) return '—';
    const s = String(valor);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10).split('-').reverse().join('/');
    return s;
};

const LixeiraAvaliacoes = ({ usuarioLogado, onVoltar }) => {
    const periodo = usePeriodoPadrao('todo');
    const [linhas, setLinhas] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');
    const [busca, setBusca] = useState('');
    const [restaurandoId, setRestaurandoId] = useState(null);

    // Restaurar: permissão 705 (padrão: Admin e Mentor; o banco confere)
    const podeRestaurar = podeFazer(usuarioLogado, '705');
    const unidade = usuarioLogado?.unidade && usuarioLogado.unidade !== 'TODAS' ? usuarioLogado.unidade : null;

    const carregar = useCallback(async () => {
        setCarregando(true);
        setErro('');
        const { data, error } = await supabase.rpc('avaliacoes_lixeira_listar', {
            p_inicio: periodo.faixa.inicio ? periodo.faixa.inicio.toISOString() : null,
            p_fim: periodo.faixa.fim ? periodo.faixa.fim.toISOString() : null,
            p_unidade: unidade
        });
        setCarregando(false);
        if (error) {
            console.error('Erro ao carregar a lixeira de avaliações:', error);
            setErro(error.message || '');
            setLinhas([]);
            return;
        }
        setLinhas(data || []);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periodo.chave, unidade]);

    useEffect(() => { carregar(); }, [carregar]);

    const visiveis = useMemo(() => {
        const termo = busca.trim().toUpperCase();
        if (!termo) return linhas;
        const numeros = termo.replace(/\D/g, '');
        return linhas.filter(l => String(l.aluno || '').toUpperCase().includes(termo)
            || String(l.professor || '').toUpperCase().includes(termo)
            || (numeros.length >= 3 && String(l.cpf || '').replace(/\D/g, '').includes(numeros)));
    }, [linhas, busca]);

    const restaurar = async (linha) => {
        if (!podeRestaurar || restaurandoId) return;
        if (!window.confirm(tx("Restaurar a avaliação de {aluno}?\n\nEla volta para a Avaliação Física e para a ficha do aluno, igual estava.", { aluno: linha.aluno || tx('aluno') }))) return;
        setRestaurandoId(linha.id);
        const { error } = await supabase.rpc('restaurar_avaliacao', { p_lixeira_id: Number(linha.id) });
        setRestaurandoId(null);
        if (error) {
            avisar(tx("Não foi possível restaurar a avaliação: {v1}", { v1: error.message || '' }), 'erro');
            return;
        }
        avisar(tx("Avaliação restaurada."), 'sucesso');
        setLinhas(atual => atual.filter(l => l.id !== linha.id));
    };

    const th = 'px-4 py-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap text-left';

    return (
        <div className="max-w-[1400px] mx-auto relative z-10 space-y-4">
            {/* Faixa de destaque da Avaliação (peça única, 09/11/2026) */}
            <FaixaAvaliacao
                antes={<BotaoFaixa onClick={onVoltar}><ArrowLeft className="w-3.5 h-3.5" />{tx("Voltar")}</BotaoFaixa>}
                icone={<Trash2 className="w-6 h-6 text-rose-300" />}
                titulo={tx("Lixeira de avaliações")}
                subtitulo={`${unidade || tx("Todas as unidades")} · ${tx(periodo.rotulo)}`}
                acoes={<SeletorPeriodo {...periodo.propsSeletor} />}
                numeros={[
                    { rotulo: tx("Na lixeira"), valor: carregando ? '…' : visiveis.length },
                    { rotulo: tx("Restaurar"), valor: podeRestaurar ? tx("Liberado") : tx("Admin e Mentor") },
                ]}
            />

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        <Info className="w-3.5 h-3.5" />
                        {tx("Período pela data da exclusão.")}{' '}{podeRestaurar ? tx("Você pode restaurar uma avaliação excluída por engano.") : tx("Só o Admin e o Mentor restauram.")}
                    </p>
                    <div className="relative w-full sm:w-72">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={tx("Buscar: aluno, CPF ou avaliador")}
                            className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-[12px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800/60 dark:border-slate-700 dark:text-white" />
                    </div>
                </div>

                {erro ? (
                    <div className="m-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-xl p-4 text-xs font-bold">
                        {tx("Não foi possível carregar a lixeira (o SQL da lixeira foi rodado?):")}{' '}{erro}
                    </div>
                ) : carregando ? (
                    <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-xs font-black uppercase tracking-widest">
                        <Loader2 className="w-4 h-4 animate-spin" />{tx("Carregando...")}
                    </div>
                ) : visiveis.length === 0 ? (
                    <div className="py-16 text-center text-xs font-black uppercase tracking-widest text-slate-400">{tx("Nenhuma avaliação na lixeira neste período.")}</div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full min-w-[860px] border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-800/60">
                                <tr>
                                    <th className={th}>{tx("Aluno")}</th>
                                    <th className={th}>{tx("Avaliação")}</th>
                                    <th className={th}>{tx("Unidade")}</th>
                                    <th className={th}>{tx("Excluída por")}</th>
                                    <th className={th}>{tx("Motivo")}</th>
                                    {podeRestaurar && <th className={`${th} text-center`}>{tx("Ações")}</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {visiveis.map(l => (
                                    <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                        <td className="px-4 py-3">
                                            <span className="block text-[12px] font-black uppercase text-slate-800 dark:text-white">{l.aluno || tx("NÃO INFORMADO")}</span>
                                            {l.cpf && <span className="block text-[10px] font-bold font-mono text-slate-400">{mascaraCPF(String(l.cpf))}</span>}
                                        </td>
                                        <td className="px-4 py-3 text-[12px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                            {dataBR(l.data_avaliacao)}
                                            <span className="block text-[10px] font-bold uppercase text-slate-400">{l.professor || '—'}</span>
                                        </td>
                                        <td className="px-4 py-3 text-[11px] font-black uppercase text-slate-600 dark:text-slate-300 whitespace-nowrap">{l.unidade || '—'}</td>
                                        <td className="px-4 py-3 text-[12px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                            {l.excluido_por || '—'}
                                            <span className="block text-[10px] font-bold text-slate-400">{dataHoraBR(l.excluido_em)}</span>
                                        </td>
                                        <td className="px-4 py-3 text-[12px] font-bold text-rose-700 dark:text-rose-300 max-w-[280px]">{l.motivo}</td>
                                        {podeRestaurar && (
                                            <td className="px-4 py-3 text-center">
                                                <button type="button" onClick={() => restaurar(l)} disabled={restaurandoId === l.id}
                                                    className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5">
                                                    {restaurandoId === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}{tx("Restaurar")}
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LixeiraAvaliacoes;
