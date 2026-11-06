import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea } from 'recharts';
import { tx } from '../../../i18n/traduzir.js';
import { estiloDaUnidade, ritmoPorUnidade } from './calculosRede.js';

// ==========================================
// RITMO DO MÊS POR UNIDADE — "Corrida com destaque" (decisão do dono, 06/11/2026)
// A 1ª versão (uma curva colorida por dia para cada unidade) virou um emaranhado. Agora:
// - sempre ACUMULADO (a linha só sobe), em retas, só até hoje;
// - todas as unidades em cinza claro e UMA em destaque, na cor dela (a mesma do quadro "Planos por unidade");
// - começa com a líder em destaque; passar o mouse no nome (ou na linha) destaca outra; clicar fixa.
// ==========================================

const ConteudoDica = ({ active, payload, label, rotuloDia, nomes, destaque, escuro }) => {
    if (!active || !payload?.length) return null;
    const itens = payload.filter(p => p.value !== null && p.value !== undefined).sort((a, b) => b.value - a.value);
    return (
        <div className="rounded-xl border px-3 py-2 shadow-lg text-[12px] max-w-[260px]"
            style={{ background: escuro ? '#0F172A' : '#FFFFFF', borderColor: escuro ? '#334155' : '#E4E8F0' }}>
            <p className="font-bold text-[#0F172A] mb-1 dark:text-white">{rotuloDia(label)}</p>
            <p className="text-[11px] font-semibold text-[#5B6478] mb-1 dark:text-slate-400">{tx('Acumulado até o dia')}</p>
            <ul className="space-y-0.5">
                {itens.map((p, i) => {
                    const forte = p.dataKey === destaque;
                    return (
                        <li key={p.dataKey} className={`flex items-center justify-between gap-3 ${forte ? 'font-extrabold' : ''}`}>
                            <span className="inline-flex items-center gap-1.5 min-w-0 text-[#3B4458] dark:text-slate-300">
                                <span className="w-5 text-right tabular-nums text-[#5B6478] dark:text-slate-400">{i + 1}º</span>
                                <span className={`truncate ${forte ? 'text-[#0F172A] dark:text-white' : ''}`}>{nomes[p.dataKey]}</span>
                            </span>
                            <span className={`tabular-nums ${p.value === 0 ? 'text-[#B42318] dark:text-rose-300' : 'text-[#0F172A] dark:text-white'}`}>{p.value}</span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

const RitmoPorUnidade = ({ unidadesRede, contados, faixa, hojeIso, escuro, especiais = [], rotuloDia, corEixo, corGrade }) => {
    const dados = useMemo(() => ritmoPorUnidade({ contados, unidadesRede, faixa, hojeIso, modo: 'acumulado' }), [contados, unidadesRede, faixa, hojeIso]);
    const nomes = useMemo(() => Object.fromEntries(unidadesRede.map(u => [`u${u.indice}`, u.nome])), [unidadesRede]);
    // Ordem da corrida: quem vendeu mais primeiro (a cor continua a da unidade)
    const ordem = useMemo(() => (dados ? [...unidadesRede].sort((a, b) => (dados.totais.get(b.chave) || 0) - (dados.totais.get(a.chave) || 0) || a.nome.localeCompare(b.nome, 'pt-BR')) : []), [dados, unidadesRede]);
    const [fixada, setFixada] = useState(null);   // clique: fica destacada
    const [sobMouse, setSobMouse] = useState(null); // passar o mouse: destaca enquanto o mouse estiver em cima

    if (!dados) return null;
    // Só até hoje (sem o resto do mês vazio espremendo o gráfico)
    const linhas = dados.linhas.slice(0, dados.ultimo + 1);
    const n = linhas.length;
    const ticks = n <= 16 ? linhas.map(l => l.i) : linhas.filter(l => l.i % 3 === 0 || l.i === n - 1).map(l => l.i);
    const lider = ordem[0];
    const chaveDestaque = sobMouse || fixada || lider?.chave;
    const uDestaque = unidadesRede.find(u => u.chave === chaveDestaque);
    const keyDestaque = uDestaque ? `u${uDestaque.indice}` : null;
    const corCinza = escuro ? '#334155' : '#CBD5E1';
    const clicar = (chave) => setFixada(atual => (atual === chave ? null : chave));

    // Nome + total no fim da linha destacada
    const rotuloFinal = (u, cor) => (props) => {
        const { cx, cy, index } = props;
        if (index !== n - 1 || cx == null || cy == null) return <g key={`f-${index}`} />;
        return (
            <g key={`f-${index}`}>
                <circle cx={cx} cy={cy} r={5} fill={cor} stroke={escuro ? '#0F172A' : '#FFFFFF'} strokeWidth={2} />
                <text x={cx - 8} y={cy - 10} textAnchor="end" fill={escuro ? '#FFFFFF' : '#0F172A'} fontSize={12} fontWeight={800}>{u.nome} · {dados.totais.get(u.chave) || 0}</text>
            </g>
        );
    };

    return (
        <>
            <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label={tx('Unidade em destaque')} onMouseLeave={() => setSobMouse(null)}>
                {ordem.map((u, i) => {
                    const { cor } = estiloDaUnidade(u.indice, escuro);
                    const ativo = u.chave === chaveDestaque;
                    const total = dados.totais.get(u.chave) || 0;
                    return (
                        <button key={u.chave} type="button" aria-pressed={fixada === u.chave}
                            onClick={() => clicar(u.chave)} onMouseEnter={() => setSobMouse(u.chave)} onFocus={() => setSobMouse(u.chave)} onBlur={() => setSobMouse(null)}
                            title={fixada === u.chave ? tx('Clique de novo para soltar o destaque') : tx('Clique para deixar esta unidade em destaque')}
                            className={`h-9 px-3 rounded-full border text-[12px] font-semibold inline-flex items-center gap-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${ativo ? 'bg-[#0B1F4B] border-[#0B1F4B] text-white dark:bg-blue-600 dark:border-blue-600' : 'bg-white border-[#D6DCE8] text-[#0F172A] hover:bg-[#F3F5FA] dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800'}`}>
                            <span className="text-[11px] font-bold tabular-nums opacity-70">{i + 1}º</span>
                            <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: cor }} aria-hidden="true" />
                            <span className="truncate max-w-[140px]">{u.nome}</span>
                            <span className={`tabular-nums font-extrabold ${total === 0 && !ativo ? 'text-[#B42318] dark:text-rose-300' : ''}`}>{total}</span>
                        </button>
                    );
                })}
            </div>
            <div className="mt-3 h-[300px]" onMouseLeave={() => setSobMouse(null)}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={linhas} margin={{ top: 24, right: 24, left: 0, bottom: 4 }}>
                        <CartesianGrid vertical={false} stroke={corGrade} />
                        {especiais.filter(e => e.i < n).map(e => (
                            <ReferenceArea key={`sdf-${e.i}`} x1={Math.max(0, e.i - 0.5)} x2={Math.min(n - 1, e.i + 0.5)} ifOverflow="hidden"
                                fill={e.letra === 'F' ? '#F59E0B' : '#94A3B8'} fillOpacity={e.letra === 'F' ? 0.1 : 0.08} stroke="none"
                                label={{ value: e.letra, position: 'insideTop', fontSize: 10, fontWeight: 800, fill: e.letra === 'F' ? '#D97706' : corEixo }} />
                        ))}
                        <XAxis dataKey="i" type="number" domain={[0, Math.max(n - 1, 1)]} ticks={ticks}
                            tickFormatter={(i) => rotuloDia(i, true)} tick={{ fill: corEixo, fontSize: 12 }} axisLine={{ stroke: corGrade }} tickLine={false} />
                        <YAxis allowDecimals={false} tickCount={5} domain={[0, 'auto']} tick={{ fill: corEixo, fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
                        <Tooltip content={<ConteudoDica rotuloDia={rotuloDia} nomes={nomes} destaque={keyDestaque} escuro={escuro} />} />
                        {/* Cinzas primeiro; a destacada por último (fica por cima) */}
                        {unidadesRede.filter(u => u.chave !== chaveDestaque).map(u => (
                            <Line key={u.chave} type="linear" dataKey={`u${u.indice}`} name={u.nome} stroke={corCinza} strokeWidth={1.5}
                                dot={false} activeDot={false} connectNulls={false} isAnimationActive={false}
                                onMouseEnter={() => setSobMouse(u.chave)} onClick={() => clicar(u.chave)} style={{ cursor: 'pointer' }} />
                        ))}
                        {uDestaque && (() => {
                            const { cor } = estiloDaUnidade(uDestaque.indice, escuro);
                            return (
                                <Line key={`d-${uDestaque.chave}`} type="linear" dataKey={keyDestaque} name={uDestaque.nome} stroke={cor} strokeWidth={3.5}
                                    dot={rotuloFinal(uDestaque, cor)} activeDot={{ r: 5, stroke: escuro ? '#0F172A' : '#FFFFFF', strokeWidth: 2 }}
                                    connectNulls={false} isAnimationActive={false} />
                            );
                        })()}
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <p className="mt-1 text-[11px] text-[#5B6478] dark:text-slate-400">
                {tx('Cada linha é a soma de planos da unidade desde o começo do período (só sobe).')}
                {' '}{tx('Passe o mouse ou clique no nome da unidade (ou na linha) para destacá-la. Passe o mouse num dia para ver a posição de cada unidade.')}
            </p>
        </>
    );
};

export default RitmoPorUnidade;
