import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { consultaSeguraOuDireta } from '../../components/consultaSegura.js';
import { X, TrendingUp, TrendingDown, Minus, Calendar, Dumbbell, Percent, Scale, Clock, Activity, AlertCircle, RefreshCw, Info } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { tx } from '../../i18n/traduzir.js';
import { mascaraCPF } from '../CadastroGeral/utilsAlunos.js';
import { FaixaAvaliacao, BotaoFaixa } from './FaixaAvaliacao.jsx';

// 🔥 P0: Parsing numérico seguro
const parseNumber = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const num = parseFloat(String(val).replace(',', '.'));
    return isNaN(num) ? null : num;
};

// 🔥 P0: Prevenção contra Timezone Shift (UTC)
const formatarDataSegura = (dataString) => {
    if (!dataString) return '-';
    // Ignora a hora e o timezone, forçando a data literal gravada no banco
    const [datePart] = dataString.split('T');
    const [ano, mes, dia] = datePart.split('-');
    return `${dia}/${mes}/${ano}`;
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const dados = payload[0].payload.raw;
        return (
            <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-xl text-white min-w-[200px] z-50">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-700 pb-2">{tx(label)}</p>
                <div className="space-y-2">
                    {dados.mme != null && (
                        <div className="flex justify-between items-center gap-4 text-sm font-bold">
                            <span className="text-blue-400 flex items-center gap-1.5"><Dumbbell className="w-3.5 h-3.5"/>{' '}{tx("MME:")}</span>
                            <span>{dados.mme}{' '}{tx("kg")}</span>
                        </div>
                    )}
                    {dados.pgc != null && (
                        <div className="flex justify-between items-center gap-4 text-sm font-bold">
                            <span className="text-orange-400 flex items-center gap-1.5"><Percent className="w-3.5 h-3.5"/>{' '}{tx("PGC:")}</span>
                            <span>{dados.pgc}%</span>
                        </div>
                    )}
                    {dados.peso != null && (
                        <div className="flex justify-between items-center gap-4 text-sm font-bold">
                            <span className="text-blue-400 flex items-center gap-1.5"><Scale className="w-3.5 h-3.5"/>{' '}{tx("Peso:")}</span>
                            <span>{dados.peso}{' '}{tx("kg")}</span>
                        </div>
                    )}
                </div>
                {dados.professor && (
                    <p className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-700 italic dark:text-slate-400">
                        {tx("Avaliador:")}{' '}{dados.professor}
                    </p>
                )}
            </div>
        );
    }
    return null;
};

// Evolução do período dentro da faixa (09/11/2026). Mesma regra de antes: músculo subir = verde,
// gordura subir = vermelho, peso = neutro (só mostra a direção).
const VariacaoNaFaixa = ({ valor, tipo = 'padrao', sufixo = '' }) => {
    if (valor === null || valor === undefined || isNaN(valor)) return <span className="block text-[10px] font-bold text-blue-100/60 uppercase tracking-widest">{tx("Sem dados comparativos")}</span>;
    const num = parseFloat(valor);
    if (num === 0) return <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-100/80"><Minus className="w-3 h-3" />{tx("Estável")}</span>;
    const subiu = num > 0;
    let cor = 'text-white/90';
    if (tipo === 'musculo') cor = subiu ? 'text-emerald-300' : 'text-rose-300';
    if (tipo === 'gordura') cor = subiu ? 'text-rose-300' : 'text-emerald-300';
    const Icone = subiu ? TrendingUp : TrendingDown;
    return (
        <span className={`flex items-center gap-1 text-[11px] font-black tracking-widest ${cor}`}>
            <Icone className="w-3 h-3" />{subiu ? '+' : ''}{num.toFixed(1).replace('.', ',')}{sufixo}
        </span>
    );
};

const ModalEvolucaoAluno = ({ aluno, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [historicoTotal, setHistoricoTotal] = useState([]);
    const [periodo, setPeriodo] = useState(6); // 3, 6, 12 ou 'TODO'

    // 🔥 P1 e P2: Acessibilidade (Travar Scroll da página de fundo e tecla ESC)
    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden'; 
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    useEffect(() => {
        if (!aluno) return;
        const fetchHistorico = async () => {
            setLoading(true);
            try {
                // Avaliações do aluno em TODAS as unidades (consulta segura "avaliacoes_do_aluno"; sem ela, busca direta)
                const { data, error } = await consultaSeguraOuDireta(
                    'avaliacoes_do_aluno', { p_aluno_id: String(aluno.id) },
                    () => supabase.from('avaliacoes_realizadas').select('*').eq('aluno_id', aluno.id)
                );

                if (error) throw error;
                // Cronológico: Antigo -> Recente
                setHistoricoTotal([...(data || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
            } catch (err) {
                console.error("Erro ao buscar histórico:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistorico();
    }, [aluno]);

    const avaliacoesFiltradas = useMemo(() => {
        if (historicoTotal.length === 0) return [];
        if (periodo === 'TODO') return historicoTotal;
        
        const ultimaAvaliacao = historicoTotal[historicoTotal.length - 1];
        const dataReferencia = new Date(ultimaAvaliacao.data || ultimaAvaliacao.created_at);
        
        const dataLimite = new Date(dataReferencia);
        dataLimite.setMonth(dataLimite.getMonth() - parseInt(periodo));

        return historicoTotal.filter(a => {
            const dataAval = new Date(a.data || a.created_at);
            return dataAval >= dataLimite;
        });
    }, [historicoTotal, periodo]);

    // 🔥 P0: CÁLCULO INDEPENDENTE MATEMATICAMENTE SEGURO
    const metricas = useMemo(() => {
        if (avaliacoesFiltradas.length === 0) return null;

        // Função para encontrar primeiro e último valores NÃO-NULOS no período selecionado
        const getValidExtremes = (chave) => {
            let first = null, last = null;
            for (let i = 0; i < avaliacoesFiltradas.length; i++) {
                const val = parseNumber(avaliacoesFiltradas[i][chave]);
                if (val !== null) { first = val; break; }
            }
            for (let i = avaliacoesFiltradas.length - 1; i >= 0; i--) {
                const val = parseNumber(avaliacoesFiltradas[i][chave]);
                if (val !== null) { last = val; break; }
            }
            return { first, last };
        };

        const mme = getValidExtremes('mme');
        const pgc = getValidExtremes('pgc');
        const peso = getValidExtremes('peso');

        const varMmeKg = (mme.last !== null && mme.first !== null && mme.last !== mme.first) ? (mme.last - mme.first) : null;
        // PGC medido APENAS em pontos percentuais para evitar poluição visual
        const varPgcPP = (pgc.last !== null && pgc.first !== null && pgc.last !== pgc.first) ? (pgc.last - pgc.first) : null;
        const varPesoKg = (peso.last !== null && peso.first !== null && peso.last !== peso.first) ? (peso.last - peso.first) : null;

        const atual = avaliacoesFiltradas[avaliacoesFiltradas.length - 1];

        return {
            mmeAtual: parseNumber(atual.mme), varMmeKg,
            pgcAtual: parseNumber(atual.pgc), varPgcPP,
            pesoAtual: parseNumber(atual.peso), varPesoKg,
            qtd: avaliacoesFiltradas.length
        };
    }, [avaliacoesFiltradas]);

    const chartData = useMemo(() => {
        return avaliacoesFiltradas.map(a => ({
            name: formatarDataSegura(a.data || a.created_at),
            MME: parseNumber(a.mme),
            PGC: parseNumber(a.pgc),
            Peso: parseNumber(a.peso),
            raw: a
        }));
    }, [avaliacoesFiltradas]);

    if (!aluno) return null;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 md:p-6 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-slate-50 w-full max-w-[95vw] lg:max-w-5xl h-full max-h-[90vh] md:max-h-[85vh] rounded-[24px] shadow-2xl flex flex-col overflow-hidden animate-[zoomIn_0.2s_ease-out] dark:bg-[#0a0f1c]">

                {/* FAIXA DE DESTAQUE da Avaliação (peça única, 09/11/2026): aluno, período e os 3 números com a evolução */}
                <div className="p-3 md:p-4 shrink-0">
                    <FaixaAvaliacao
                        icone={<Activity className="w-6 h-6 text-orange-300" />}
                        titulo={aluno.nome}
                        subtitulo={[
                            aluno.cpf ? tx("CPF: {v1}", { v1: mascaraCPF(aluno.cpf) }) : null,
                            metricas ? tx("{qtd} avaliações no período", { qtd: metricas.qtd }) : null,
                        ].filter(Boolean).join(' · ') || tx("Evolução do aluno")}
                        acoes={<>
                            {historicoTotal.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1 rounded-xl bg-black/20 p-1">
                                    {[3, 6, 12, 'TODO'].map(meses => (
                                        periodo === meses ? (
                                            <span key={meses} className="px-3 py-1.5 rounded-lg bg-white text-[#0B1F4B] text-[10px] font-black uppercase tracking-widest">
                                                {meses === 'TODO' ? tx("Todo o Histórico") : tx("{meses} Meses", { meses })}
                                            </span>
                                        ) : (
                                            <button key={meses} type="button" onClick={() => setPeriodo(meses)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white/90 hover:bg-white/15 transition-colors">
                                                {meses === 'TODO' ? tx("Todo o Histórico") : tx("{meses} Meses", { meses })}
                                            </button>
                                        )
                                    ))}
                                </div>
                            )}
                            <BotaoFaixa onClick={onClose} aria-label={tx("Fechar painel")} className="w-10 justify-center !px-0"><X className="w-4 h-4" /></BotaoFaixa>
                        </>}
                        numeros={metricas ? [
                            { rotulo: tx("Massa Muscular (MME)"), valor: metricas.mmeAtual != null ? tx("{mmeAtual} kg", { mmeAtual: metricas.mmeAtual }) : '-', extra: <VariacaoNaFaixa valor={metricas.varMmeKg} tipo="musculo" sufixo=" kg" /> },
                            { rotulo: tx("Gordura Corporal (PGC)"), valor: metricas.pgcAtual != null ? `${metricas.pgcAtual}%` : '-', extra: <VariacaoNaFaixa valor={metricas.varPgcPP} tipo="gordura" sufixo=" p.p." /> },
                            { rotulo: tx("Peso Total"), valor: metricas.pesoAtual != null ? tx("{pesoAtual} kg", { pesoAtual: metricas.pesoAtual }) : '-', extra: <VariacaoNaFaixa valor={metricas.varPesoKg} tipo="padrao" sufixo=" kg" /> },
                        ] : []}
                    />
                </div>

                {/* CONTEÚDO SCROLLÁVEL */}
                <div className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar px-3 pb-4 md:px-4 md:pb-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64">
                            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-4"/>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{tx("Carregando evolução...")}</p>
                        </div>
                    ) : historicoTotal.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <AlertCircle className="w-12 h-12 text-slate-300 mb-3"/>
                            <h3 className="text-lg font-black text-slate-700 dark:text-slate-200">{tx("Nenhum registro encontrado")}</h3>
                            <p className="text-xs font-bold text-slate-500 mt-1 dark:text-slate-400">{tx("Este aluno ainda não possui avaliações no sistema.")}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">

                            {/* ESTADO: 1 AVALIAÇÃO */}
                            {avaliacoesFiltradas.length === 1 && (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-start gap-4 dark:bg-blue-500/10 dark:border-blue-500/30">
                                    <Info className="w-6 h-6 text-blue-500 shrink-0"/>
                                    <div>
                                        <h4 className="text-sm font-black text-blue-900 dark:text-blue-300">{tx("Apenas uma avaliação no período")}</h4>
                                        <p className="text-xs font-medium text-blue-700 mt-1 dark:text-blue-400">{tx("Ainda não há dados suficientes para gerar a linha do tempo comparativa. Os indicadores atuais estão detalhados abaixo.")}</p>
                                    </div>
                                </div>
                            )}

                            {/* GRÁFICOS (APENAS SE HOUVER MAIS DE 1 AVALIAÇÃO) */}
                            {avaliacoesFiltradas.length > 1 && (
                                <div className="space-y-6">
                                    <div className="bg-white border border-slate-200 rounded-[20px] p-4 md:p-6 shadow-sm min-w-0 dark:bg-slate-900 dark:border-slate-800">
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 dark:text-white">
                                            <TrendingUp className="w-4 h-4 text-blue-500"/>{' '}{tx("Composição Corporal (MME vs PGC)")}
                                        </h3>
                                        <div className="h-[250px] md:h-[300px] w-full">
                                            <ResponsiveContainer height="100%" width="100%">
                                                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                                                    <CartesianGrid stroke="#94a3b8" strokeOpacity={0.25} strokeDasharray="3 3" vertical={false} />
                                                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} dy={10} />
                                                    <YAxis yAxisId="left" orientation="left" stroke="#60a5fa" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} dx={-10} domain={['auto', 'auto']} />
                                                    <YAxis yAxisId="right" orientation="right" stroke="#fb923c" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} dx={10} domain={['auto', 'auto']} />
                                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '5 5' }} />
                                                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 'bold' }} />
                                                    <Line yAxisId="left" type="monotone" dataKey="MME" name="Massa Muscular (kg)" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls />
                                                    <Line yAxisId="right" type="monotone" dataKey="PGC" name="Gordura Corporal (%)" stroke="#f97316" strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-[20px] p-4 md:p-6 shadow-sm min-w-0 dark:bg-slate-900 dark:border-slate-800">
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 dark:text-white">
                                            <Scale className="w-4 h-4 text-slate-500 dark:text-slate-400"/>{' '}{tx("Curva de Peso")}
                                        </h3>
                                        <div className="h-[150px] md:h-[200px] w-full">
                                            <ResponsiveContainer height="100%" width="100%">
                                                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                                                    <CartesianGrid stroke="#94a3b8" strokeOpacity={0.25} strokeDasharray="3 3" vertical={false} />
                                                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} dy={10} />
                                                    <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} dx={-10} domain={['auto', 'auto']} />
                                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '5 5' }} />
                                                    <Line type="monotone" dataKey="Peso" name="Peso Total (kg)" stroke="#64748b" strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* LINHA DO TEMPO DETALHADA OTIMIZADA */}
                            <div className="bg-white border border-slate-200 rounded-[20px] p-5 md:p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 dark:text-white">
                                    <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400"/>{' '}{tx("Registros Cronológicos")}
                                </h3>
                                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-slate-100 before:z-0 dark:before:bg-slate-800">
                                    {[...avaliacoesFiltradas].reverse().map((a, idx) => (
                                        <div key={a.id} className="relative z-10 flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group cursor-default">
                                            <div className="w-10 h-10 rounded-full bg-white border-[3px] border-blue-100 text-blue-600 flex items-center justify-center shrink-0 md:order-1 md:mx-auto shadow-sm group-hover:border-blue-400 group-hover:scale-110 transition-all z-10 dark:bg-slate-900 dark:border-blue-500/30 dark:text-blue-400">
                                                <Calendar className="w-4 h-4"/>
                                            </div>
                                            <div className="w-[calc(100%-3.5rem)] md:w-[calc(50%-2.5rem)] bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-sm group-hover:shadow-md transition-shadow dark:bg-slate-800/60 dark:border-slate-800">
                                                <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2 dark:border-slate-800">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatarDataSegura(a.data || a.created_at)}</span>
                                                    <span className="text-[10px] font-bold bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-500 truncate max-w-[120px] dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400">{a.professor || tx("SISTEMA")}</span>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 text-center divide-x divide-slate-200 dark:divide-slate-800">
                                                    <div>
                                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">MME</span>
                                                        <span className={`text-xs md:text-sm font-black ${a.mme ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300'}`}>{a.mme ? tx("{mme} kg", { mme: a.mme }) : '-'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">PGC</span>
                                                        <span className={`text-xs md:text-sm font-black ${a.pgc ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300'}`}>{a.pgc ? `${a.pgc}%` : '-'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tx("Peso")}</span>
                                                        <span className={`text-xs md:text-sm font-black ${a.peso ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300'}`}>{a.peso ? tx("{peso} kg", { peso: a.peso }) : '-'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModalEvolucaoAluno;