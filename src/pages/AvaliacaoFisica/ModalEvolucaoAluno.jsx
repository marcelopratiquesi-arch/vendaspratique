import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { X, TrendingUp, TrendingDown, Minus, Calendar, Dumbbell, Percent, Scale, Clock, Activity, AlertCircle, RefreshCw, Info } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

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
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-700 pb-2">{label}</p>
                <div className="space-y-2">
                    {dados.mme != null && (
                        <div className="flex justify-between items-center gap-4 text-sm font-bold">
                            <span className="text-indigo-400 flex items-center gap-1.5"><Dumbbell className="w-3.5 h-3.5"/> MME:</span>
                            <span>{dados.mme} kg</span>
                        </div>
                    )}
                    {dados.pgc != null && (
                        <div className="flex justify-between items-center gap-4 text-sm font-bold">
                            <span className="text-orange-400 flex items-center gap-1.5"><Percent className="w-3.5 h-3.5"/> PGC:</span>
                            <span>{dados.pgc}%</span>
                        </div>
                    )}
                    {dados.peso != null && (
                        <div className="flex justify-between items-center gap-4 text-sm font-bold">
                            <span className="text-blue-400 flex items-center gap-1.5"><Scale className="w-3.5 h-3.5"/> Peso:</span>
                            <span>{dados.peso} kg</span>
                        </div>
                    )}
                </div>
                {dados.professor && (
                    <p className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-700 italic">
                        Avaliador: {dados.professor}
                    </p>
                )}
            </div>
        );
    }
    return null;
};

// 🔥 P1: Interpretação visual neutra e inteligente
const IndicadorVariacao = ({ valor, tipo = 'padrao', sufixo = '' }) => {
    if (valor === null || valor === undefined || isNaN(valor)) return <span className="text-slate-400 text-[10px] font-bold">Sem dados comparativos</span>;
    
    const num = parseFloat(valor);
    if (num === 0) return <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-md text-slate-500 w-fit"><Minus className="w-3 h-3"/> <span className="text-[10px] font-black uppercase tracking-widest">Estável</span></div>;

    let isPositivo = num > 0;
    
    // Semântica correta: MME alto é bom (verde). PGC alto é ruim (vermelho). Peso depende, deixamos neutro/cinza, mas indicamos direção.
    let corClass = 'text-slate-600 bg-slate-100'; 
    if (tipo === 'musculo') corClass = isPositivo ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50';
    if (tipo === 'gordura') corClass = isPositivo ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50';

    const Icone = isPositivo ? TrendingUp : TrendingDown;
    const sinal = isPositivo ? '+' : '';

    return (
        <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${corClass} w-fit`}>
            <Icone className="w-3 h-3"/>
            <span className="text-[11px] font-black tracking-widest">{sinal}{num.toFixed(1).replace('.', ',')}{sufixo}</span>
        </div>
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
                const { data, error } = await supabase
                    .from('avaliacoes_realizadas')
                    .select('*')
                    .eq('aluno_id', aluno.id)
                    .order('created_at', { ascending: true }); // Cronológico: Antigo -> Recente

                if (error) throw error;
                setHistoricoTotal(data || []);
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
            <div className="bg-slate-50 w-full max-w-[95vw] lg:max-w-5xl h-full max-h-[90vh] md:max-h-[85vh] rounded-[24px] shadow-2xl flex flex-col overflow-hidden animate-[zoomIn_0.2s_ease-out]">
                
                {/* HEADER */}
                <div className="bg-white px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-blue-50 to-transparent pointer-events-none"></div>
                    
                    <div className="flex items-center gap-4 relative z-10 min-w-0">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner shrink-0">
                            <Activity className="w-5 h-5 md:w-6 md:h-6"/>
                        </div>
                        <div className="min-w-0 truncate pr-4">
                            <h2 className="text-lg md:text-xl font-black text-slate-800 tracking-tight leading-tight truncate">{aluno.nome}</h2>
                            <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest truncate">
                                {aluno.cpf && <span>CPF: {mascaraCPF(aluno.cpf)}</span>}
                                {metricas && <span className="hidden sm:inline">• Avaliações: {metricas.qtd}</span>}
                            </div>
                        </div>
                    </div>
                    
                    <button onClick={onClose} aria-label="Fechar painel" className="w-8 h-8 bg-transparent hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full flex items-center justify-center transition-colors relative z-10 shrink-0 border border-transparent hover:border-slate-200">
                        <X className="w-4 h-4"/>
                    </button>
                </div>

                {/* CONTEÚDO SCROLLÁVEL */}
                <div className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar p-4 md:p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64">
                            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4"/>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Carregando evolução...</p>
                        </div>
                    ) : historicoTotal.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <AlertCircle className="w-12 h-12 text-slate-300 mb-3"/>
                            <h3 className="text-lg font-black text-slate-700">Nenhum registro encontrado</h3>
                            <p className="text-xs font-bold text-slate-500 mt-1">Este aluno ainda não possui avaliações no sistema.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            
                            {/* CONTROLE DE PERÍODO */}
                            <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex-wrap gap-4">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 hidden sm:block">Janela Temporal</span>
                                <div className="flex gap-1 w-full sm:w-auto">
                                    {[3, 6, 12, 'TODO'].map(meses => (
                                        <button 
                                            key={meses} 
                                            onClick={() => setPeriodo(meses)}
                                            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${periodo === meses ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
                                        >
                                            {meses === 'TODO' ? 'Todo o Histórico' : `${meses} Meses`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ESTADO: 1 AVALIAÇÃO */}
                            {avaliacoesFiltradas.length === 1 && (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-start gap-4">
                                    <Info className="w-6 h-6 text-blue-500 shrink-0"/>
                                    <div>
                                        <h4 className="text-sm font-black text-blue-900">Apenas uma avaliação no período</h4>
                                        <p className="text-xs font-medium text-blue-700 mt-1">Ainda não há dados suficientes para gerar a linha do tempo comparativa. Os indicadores atuais estão detalhados abaixo.</p>
                                    </div>
                                </div>
                            )}

                            {/* CARDS DE RESUMO BI (Limpos e semânticos) */}
                            {metricas && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-white rounded-[20px] p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                                        <div className="absolute right-0 top-0 w-16 h-16 bg-indigo-50 rounded-bl-[40px] flex items-center justify-center">
                                            <Dumbbell className="w-6 h-6 text-indigo-400 translate-x-2 -translate-y-2"/>
                                        </div>
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Massa Muscular (MME)</h3>
                                        <p className="text-3xl font-black text-slate-800 tracking-tighter mb-4">{metricas.mmeAtual != null ? `${metricas.mmeAtual} kg` : '-'}</p>
                                        <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Evolução</span>
                                                <IndicadorVariacao sufixo=" kg" tipo="musculo" valor={metricas.varMmeKg}/>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-[20px] p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                                        <div className="absolute right-0 top-0 w-16 h-16 bg-orange-50 rounded-bl-[40px] flex items-center justify-center">
                                            <Percent className="w-6 h-6 text-orange-400 translate-x-2 -translate-y-2"/>
                                        </div>
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Gordura Corporal (PGC)</h3>
                                        <p className="text-3xl font-black text-slate-800 tracking-tighter mb-4">{metricas.pgcAtual != null ? `${metricas.pgcAtual}%` : '-'}</p>
                                        <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Evolução</span>
                                                <IndicadorVariacao sufixo=" p.p." tipo="gordura" valor={metricas.varPgcPP}/>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-[20px] p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                                        <div className="absolute right-0 top-0 w-16 h-16 bg-slate-50 rounded-bl-[40px] flex items-center justify-center">
                                            <Scale className="w-6 h-6 text-slate-400 translate-x-2 -translate-y-2"/>
                                        </div>
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Peso Total</h3>
                                        <p className="text-3xl font-black text-slate-800 tracking-tighter mb-4">{metricas.pesoAtual != null ? `${metricas.pesoAtual} kg` : '-'}</p>
                                        <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Variação</span>
                                                <IndicadorVariacao sufixo=" kg" tipo="padrao" valor={metricas.varPesoKg}/>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* GRÁFICOS (APENAS SE HOUVER MAIS DE 1 AVALIAÇÃO) */}
                            {avaliacoesFiltradas.length > 1 && (
                                <div className="space-y-6">
                                    <div className="bg-white border border-slate-200 rounded-[20px] p-4 md:p-6 shadow-sm min-w-0">
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-indigo-500"/> Composição Corporal (MME vs PGC)
                                        </h3>
                                        <div className="h-[250px] md:h-[300px] w-full">
                                            <ResponsiveContainer height="100%" width="100%">
                                                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                                                    <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                                                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} dy={10} />
                                                    <YAxis yAxisId="left" orientation="left" stroke="#818cf8" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} dx={-10} domain={['auto', 'auto']} />
                                                    <YAxis yAxisId="right" orientation="right" stroke="#fb923c" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} dx={10} domain={['auto', 'auto']} />
                                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '5 5' }} />
                                                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 'bold' }} />
                                                    <Line yAxisId="left" type="monotone" dataKey="MME" name="Massa Muscular (kg)" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls />
                                                    <Line yAxisId="right" type="monotone" dataKey="PGC" name="Gordura Corporal (%)" stroke="#f97316" strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-[20px] p-4 md:p-6 shadow-sm min-w-0">
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                                            <Scale className="w-4 h-4 text-slate-500"/> Curva de Peso
                                        </h3>
                                        <div className="h-[150px] md:h-[200px] w-full">
                                            <ResponsiveContainer height="100%" width="100%">
                                                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                                                    <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
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
                            <div className="bg-white border border-slate-200 rounded-[20px] p-5 md:p-6 shadow-sm">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-slate-500"/> Registros Cronológicos
                                </h3>
                                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-slate-100 before:z-0">
                                    {[...avaliacoesFiltradas].reverse().map((a, idx) => (
                                        <div key={a.id} className="relative z-10 flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group cursor-default">
                                            <div className="w-10 h-10 rounded-full bg-white border-[3px] border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 md:order-1 md:mx-auto shadow-sm group-hover:border-indigo-400 group-hover:scale-110 transition-all z-10">
                                                <Calendar className="w-4 h-4"/>
                                            </div>
                                            <div className="w-[calc(100%-3.5rem)] md:w-[calc(50%-2.5rem)] bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-sm group-hover:shadow-md transition-shadow">
                                                <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatarDataSegura(a.data || a.created_at)}</span>
                                                    <span className="text-[9px] font-bold bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-500 truncate max-w-[120px]">{a.professor || 'SISTEMA'}</span>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 text-center divide-x divide-slate-200">
                                                    <div>
                                                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">MME</span>
                                                        <span className={`text-xs md:text-sm font-black ${a.mme ? 'text-slate-700' : 'text-slate-300'}`}>{a.mme ? `${a.mme} kg` : '-'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">PGC</span>
                                                        <span className={`text-xs md:text-sm font-black ${a.pgc ? 'text-slate-700' : 'text-slate-300'}`}>{a.pgc ? `${a.pgc}%` : '-'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Peso</span>
                                                        <span className={`text-xs md:text-sm font-black ${a.peso ? 'text-slate-700' : 'text-slate-300'}`}>{a.peso ? `${a.peso} kg` : '-'}</span>
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