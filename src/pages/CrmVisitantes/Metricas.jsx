import React, { useMemo } from 'react';
import { 
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
    Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { 
    Users, CheckCircle, XCircle, Target, TrendingUp, 
    BarChart2, PieChart as PieIcon, Activity, CalendarDays, ChevronRight 
} from 'lucide-react';
import { STATUS_TOKENS, COLUNAS, formatarDataHora } from './utils';

const Metricas = ({ visitantes = [], colaboradores = [] }) => {

    // ==========================================
    // 1. LÓGICA DE DADOS GERAIS (KPIs)
    // ==========================================
    const totalLeads = visitantes.length;
    const convertidos = visitantes.filter(v => v.status === 'Fechado').length;
    const perdidos = visitantes.filter(v => v.status === 'Perdido').length;
    const taxaConversao = totalLeads > 0 ? Math.round((convertidos / totalLeads) * 100) : 0;

    // ==========================================
    // 2. EVOLUÇÃO DIÁRIA (Gráfico de Área)
    // ==========================================
    const dadosEvolucao = useMemo(() => {
        const m = {};
        // Pega os últimos 14 dias
        for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dataStr = d.toISOString().slice(0, 10);
            m[dataStr] = 0;
        }
        
        visitantes.forEach(v => {
            const dataIso = v.criado_em ? v.criado_em.slice(0, 10) : null;
            if (dataIso && m[dataIso] !== undefined) {
                m[dataIso] += 1;
            }
        });

        return Object.entries(m).map(([dia, qtd]) => ({
            label: new Date(dia + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            Capturas: qtd
        }));
    }, [visitantes]);

    // ==========================================
    // 3. PERFORMANCE POR CONSULTOR (Gráfico de Barras)
    // ==========================================
    const leadsPorVendedor = colaboradores.map(c => {
        const leads = visitantes.filter(v => v.vendedor === c.nome);
        const conv = leads.filter(v => v.status === 'Fechado').length;
        return { 
            nome: c.nome, 
            total: leads.length, 
            convertidos: conv, 
            taxa: leads.length > 0 ? Math.round((conv / leads.length) * 100) : 0 
        };
    }).filter(v => v.total > 0).sort((a, b) => b.convertidos - a.convertidos || b.taxa - a.taxa);

    const dadosGraficoConsultores = useMemo(() => {
        return leadsPorVendedor.map(v => ({
            nome: v.nome.split(' ')[0], 
            Total: v.total,
            Fechados: v.convertidos
        }));
    }, [leadsPorVendedor]);

    // ==========================================
    // 4. DISTRIBUIÇÃO DO FUNIL (Gráfico de Pizza)
    // ==========================================
    const dadosGraficoFunil = useMemo(() => {
        return COLUNAS.map(col => ({
            nome: col,
            quantidade: visitantes.filter(v => v.status === col).length,
            fill: STATUS_TOKENS[col]?.hex || '#94a3b8'
        })).filter(d => d.quantidade > 0);
    }, [visitantes]);

    // ==========================================
    // 5. FEED AO VIVO (Últimos Leads)
    // ==========================================
    const ultimosLeads = useMemo(() => {
        return [...visitantes]
            .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
            .slice(0, 5);
    }, [visitantes]);

    // ==========================================
    // TOOLTIP CUSTOMIZADO PARA OS GRÁFICOS
    // ==========================================
    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl px-5 py-4 text-sm z-50">
                <p className="font-black text-slate-300 uppercase tracking-widest text-[10px] mb-2">{label}</p>
                {payload.map((p, i) => (
                    <p key={i} style={{ color: p.color || p.payload.fill }} className="font-black text-lg">
                        {p.name}: {p.value}
                    </p>
                ))}
            </div>
        );
    };

    return (
        <div className="bg-slate-950 p-6 lg:p-8 rounded-[2rem] shadow-2xl space-y-8 animate-[fadeIn_0.3s_ease-out]">
            
            {/* CABEÇALHO DO DASHBOARD */}
            <div className="flex items-center gap-3 mb-2 border-b border-slate-800/60 pb-6">
                <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                    <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">Performance de Captação</h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Métricas Globais do CRM</p>
                </div>
            </div>

            {/* ── KPI CARDS ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                {/* Card 1 */}
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-2xl p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400"><Users className="w-5 h-5" /></div>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total no Funil</p>
                    <p className="text-4xl font-black text-white tracking-tight">{totalLeads}</p>
                    <p className="text-xs text-blue-400 font-bold mt-2">Leads em trabalho</p>
                </div>
                
                {/* Card 2 */}
                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400"><CheckCircle className="w-5 h-5" /></div>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Fechados</p>
                    <p className="text-4xl font-black text-white tracking-tight">{convertidos}</p>
                    <p className="text-xs text-emerald-400 font-bold mt-2">Matrículas Concluídas</p>
                </div>

                {/* Card 3 */}
                <div className="bg-gradient-to-br from-rose-500/10 to-rose-500/5 border border-rose-500/20 rounded-2xl p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400"><XCircle className="w-5 h-5" /></div>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Perdidos</p>
                    <p className="text-4xl font-black text-white tracking-tight">{perdidos}</p>
                    <p className="text-xs text-rose-400 font-bold mt-2">Contatos Sem Sucesso</p>
                </div>

                {/* Card 4 */}
                <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-2xl p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400"><Target className="w-5 h-5" /></div>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Taxa de Fechamento</p>
                    <p className="text-4xl font-black text-white tracking-tight">{taxaConversao}%</p>
                    <p className="text-xs text-purple-400 font-bold mt-2">Eficiência da Equipe</p>
                </div>
            </div>

            {/* ── LINHA DO TEMPO (ÁREA) + FEED AO VIVO ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Gráfico de Área: Evolução de Capturas */}
                <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-base font-black text-white flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-orange-400" />
                                Evolução de Captação
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">Novos leads nos últimos 14 dias</p>
                        </div>
                    </div>
                    {dadosEvolucao.every(d => d.Capturas === 0) ? (
                        <div className="h-[220px] flex items-center justify-center text-slate-600 text-sm font-bold">Sem dados recentes</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={dadosEvolucao}>
                                <defs>
                                    <linearGradient id="gradCapturas" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#475569', fontWeight: 700 }} axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={{ fontSize: 10, fill: '#475569', fontWeight: 700 }} axisLine={false} tickLine={false} dx={-10} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="Capturas" stroke="#f97316" strokeWidth={3} fill="url(#gradCapturas)" dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#f97316', strokeWidth: 0 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Feed de Últimos Leads */}
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col">
                    <h2 className="text-base font-black text-white flex items-center gap-2 mb-5">
                        <CalendarDays className="w-4 h-4 text-emerald-400" /> Últimas Entradas
                        <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> AO VIVO
                        </span>
                    </h2>
                    
                    {ultimosLeads.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-slate-600 text-sm font-bold">Nenhum lead capturado</div>
                    ) : (
                        <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2">
                            {ultimosLeads.map(v => {
                                const token = STATUS_TOKENS[v.status] || STATUS_TOKENS['Novo'];
                                return (
                                    <div key={v.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-800 hover:border-slate-700 transition-all group">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-black" style={{ backgroundColor: token.bg.split('/')[0], color: token.hex }}>
                                            <Activity className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-white truncate">{v.nome}</p>
                                            <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                                                {v.vendedor} · {v.criado_em ? new Date(v.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors shrink-0" />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── BARRAS DE CONSULTORES E PIZZA ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-emerald-500" /> Performance por Consultor
                    </h3>
                    {dadosGraficoConsultores.length === 0 ? (
                        <p className="text-slate-600 font-bold text-center py-10">Gráfico aguardando volume de dados.</p>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={dadosGraficoConsultores} barSize={24}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} dx={-10} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
                                <Bar dataKey="Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Fechados" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                        <PieIcon className="w-4 h-4 text-orange-500" /> Distribuição Atual no Funil
                    </h3>
                    {dadosGraficoFunil.length === 0 ? (
                        <p className="text-slate-600 font-bold text-center py-10">Gráfico aguardando volume de dados.</p>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie data={dadosGraficoFunil} dataKey="quantidade" nameKey="nome" cx="50%" cy="50%" outerRadius={100} innerRadius={60} paddingAngle={4} stroke="none">
                                    {dadosGraficoFunil.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Metricas;