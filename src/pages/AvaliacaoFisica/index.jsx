import React, { useState, useEffect } from 'react';
import { Dumbbell, LogOut, Calculator, BarChart3, Activity, ClipboardSignature, Search, PlusCircle } from 'lucide-react';
import FormAvaliacao from './FormAvaliacao'; // ✅ IMPORTAÇÃO DO FORMULÁRIO

const AvaliacaoFisica = ({ usuarioLogado, avaliacoes = [], colaboradores = [], setAvaliacoes }) => {
    // ESTADOS DE CONTROLE
    const [professorAtivo, setProfessorAtivo] = useState(null);
    const [abaAtiva, setAbaAtiva] = useState('relatorio'); // 'relatorio', 'calculadora' ou 'nova'

    // ESTADOS DA CALCULADORA SMI
    const [calcSMI, setCalcSMI] = useState({ altura: '', massaMuscularApendicular: '', genero: 'M' });

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [professorAtivo, abaAtiva, calcSMI]);

    // ==========================================
    // TELA 1: A CATRACA DE IDENTIFICAÇÃO
    // ==========================================
    if (!professorAtivo) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] animate-[fadeIn_0.3s_ease-out] px-4">
                <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-orange-200">
                    <Dumbbell className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight text-center">Setor de Avaliação Física</h2>
                <p className="text-slate-500 mb-10 font-medium text-center">Selecione seu nome para acessar o painel técnico.</p>
                
                {colaboradores.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-center max-w-md">
                        <p className="text-amber-700 font-bold">Nenhum profissional cadastrado nesta unidade.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 w-full max-w-4xl">
                        {colaboradores.map(c => (
                            <button 
                                key={c.id} 
                                onClick={() => setProfessorAtivo(c)} 
                                className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm hover:border-orange-500 hover:shadow-lg hover:-translate-y-1 transition-all group flex flex-col items-center gap-4"
                            >
                                <div className="w-14 h-14 bg-slate-100 text-slate-500 group-hover:bg-orange-500 group-hover:text-white rounded-full flex items-center justify-center font-black text-xl transition-colors shadow-inner">
                                    {c.nome.charAt(0)}
                                </div>
                                <div className="text-center">
                                    <span className="font-black text-slate-700 group-hover:text-orange-700 block leading-tight">{c.nome.split(' ')[0]}</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">{c.nome.split(' ').slice(1).join(' ')}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ==========================================
    // DADOS PARA OS RELATÓRIOS
    // ==========================================
    const nomeOperador = professorAtivo.nome;
    const avaliacoesDoProfessor = avaliacoes.filter(a => a.professor === nomeOperador);
    const avaliacoesUnidade = avaliacoes.filter(a => a.unidade === usuarioLogado?.unidade);

    // ==========================================
    // LÓGICA DA CALCULADORA SMI
    // ==========================================
    const calcularSMI = () => {
        const alt = parseFloat(calcSMI.altura.replace(',', '.'));
        const mma = parseFloat(calcSMI.massaMuscularApendicular.replace(',', '.'));
        
        if (!alt || !mma || alt <= 0) return { valor: 0, status: 'Preencha os dados', cor: 'text-slate-400', bg: 'bg-slate-100' };

        const smi = mma / (alt * alt);
        let status = '';
        let cor = '';
        let bg = '';

        if (calcSMI.genero === 'M') {
            if (smi < 7.0) { status = 'Sarcopenia (Baixa Massa)'; cor = 'text-rose-600'; bg = 'bg-rose-100'; }
            else if (smi < 8.5) { status = 'Abaixo da Média'; cor = 'text-amber-600'; bg = 'bg-amber-100'; }
            else { status = 'Massa Muscular Saudável'; cor = 'text-emerald-600'; bg = 'bg-emerald-100'; }
        } else {
            if (smi < 5.5) { status = 'Sarcopenia (Baixa Massa)'; cor = 'text-rose-600'; bg = 'bg-rose-100'; }
            else if (smi < 6.5) { status = 'Abaixo da Média'; cor = 'text-amber-600'; bg = 'bg-amber-100'; }
            else { status = 'Massa Muscular Saudável'; cor = 'text-emerald-600'; bg = 'bg-emerald-100'; }
        }

        return { valor: smi.toFixed(2), status, cor, bg };
    };

    const resultadoSMI = calcularSMI();

    // ==========================================
    // TELA 2: O PAINEL PRINCIPAL
    // ==========================================
    return (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto relative">
            
            {/* CABEÇALHO DO PROFESSOR */}
            <div className="bg-white rounded-[24px] border border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors shrink-0 bg-orange-100 text-orange-600 shadow-inner">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div className="flex-1 max-w-xl">
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-none mb-1">
                            {nomeOperador}
                        </h2>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            Painel de Avaliação Física • Unidade {usuarioLogado?.unidade}
                        </span>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {/* ✅ BOTÃO NOVA AVALIAÇÃO - SÓ APARECE SE NÃO ESTIVER NO FORMULÁRIO */}
                    {abaAtiva !== 'nova' && (
                        <button onClick={() => setAbaAtiva('nova')} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_4px_15px_rgba(249,115,22,0.3)] flex items-center gap-2 bg-orange-500 text-white hover:bg-orange-600">
                            <PlusCircle className="w-4 h-4" /> Nova Avaliação
                        </button>
                    )}
                    <button onClick={() => { setProfessorAtivo(null); setAbaAtiva('relatorio'); }} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-2 bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200">
                        <LogOut className="w-4 h-4" /> Trocar Prof.
                    </button>
                </div>
            </div>

            {/* BARRA DE NAVEGAÇÃO / ABAS (ESCONDE QUANDO ESTIVER PREENCHENDO A AVALIAÇÃO) */}
            {abaAtiva !== 'nova' && (
                <div className="flex bg-slate-200 p-1.5 rounded-xl border border-slate-300/60 shadow-inner w-full max-w-4xl mx-auto overflow-x-auto custom-scrollbar animate-[fadeIn_0.3s_ease-out]">
                    <button onClick={() => setAbaAtiva('relatorio')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaAtiva === 'relatorio' ? 'bg-orange-500 shadow-sm text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                        <BarChart3 className="w-4 h-4" /> Relatórios
                    </button>
                    <button onClick={() => setAbaAtiva('calculadora')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaAtiva === 'calculadora' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}>
                        <Calculator className="w-4 h-4" /> Calculadora SMI
                    </button>
                </div>
            )}

            {/* CONTEÚDO: ABA NOVA AVALIAÇÃO (FORMULÁRIO) */}
            {abaAtiva === 'nova' && (
                <FormAvaliacao 
                    usuarioLogado={usuarioLogado}
                    professorAtivo={professorAtivo}
                    voltar={() => setAbaAtiva('relatorio')}
                    setAvaliacoes={setAvaliacoes}
                />
            )}

            {/* CONTEÚDO: ABA RELATÓRIOS */}
            {abaAtiva === 'relatorio' && (
                <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                    
                    {/* Resumo Rápido */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Minhas Avaliações</span>
                            <span className="text-5xl font-black text-orange-500">{avaliacoesDoProfessor.length}</span>
                        </div>
                        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total da Unidade</span>
                            <span className="text-5xl font-black text-slate-800">{avaliacoesUnidade.length}</span>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Desempenho</span>
                            <span className="text-3xl font-black text-white">
                                {avaliacoesUnidade.length > 0 ? ((avaliacoesDoProfessor.length / avaliacoesUnidade.length) * 100).toFixed(0) : 0}%
                            </span>
                            <span className="text-[9px] text-slate-500 font-bold uppercase mt-1">Da unidade feita por você</span>
                        </div>
                    </div>

                    {/* Tabela de Relatório */}
                    <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 tracking-tight">
                                <ClipboardSignature className="w-5 h-5 text-orange-500"/> Histórico de Avaliações
                            </h3>
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input type="text" placeholder="Buscar aluno..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500 shadow-sm w-48 transition-all" />
                            </div>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar max-h-[400px]">
                            <table className="w-full text-left border-collapse min-w-max">
                                <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Data</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Aluno(a)</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Professor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {avaliacoesUnidade.length > 0 ? (
                                        avaliacoesUnidade.map((a, idx) => (
                                            <tr key={a.id || idx} className="hover:bg-orange-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <span className="text-xs font-bold text-slate-600">{new Date(a.criado_em || a.data).toLocaleDateString('pt-BR')}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm font-black text-slate-800 uppercase">{a.aluno || 'NÃO INFORMADO'}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border ${a.professor === nomeOperador ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                        {a.professor || 'SISTEMA'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="3" className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                                Nenhuma avaliação registrada para esta unidade.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTEÚDO: ABA CALCULADORA SMI */}
            {abaAtiva === 'calculadora' && (
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 lg:p-10 animate-[fadeIn_0.3s_ease-out] flex flex-col md:flex-row gap-10 items-center">
                    
                    <div className="flex-1 w-full space-y-6">
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3 mb-2">
                                <Calculator className="w-6 h-6 text-orange-500" /> Calculadora SMI
                            </h3>
                            <p className="text-sm font-medium text-slate-500">Índice de Massa Muscular Esquelética Apendicular.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="sm:col-span-2">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Gênero Biológico</label>
                                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                                    <button 
                                        type="button" 
                                        onClick={() => setCalcSMI({...calcSMI, genero: 'M'})}
                                        className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${calcSMI.genero === 'M' ? 'bg-white shadow-sm text-blue-600 border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        Masculino
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setCalcSMI({...calcSMI, genero: 'F'})}
                                        className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${calcSMI.genero === 'F' ? 'bg-white shadow-sm text-rose-500 border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        Feminino
                                    </button>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Altura (m)</label>
                                <input 
                                    type="text" 
                                    placeholder="Ex: 1.75" 
                                    value={calcSMI.altura}
                                    onChange={(e) => setCalcSMI({...calcSMI, altura: e.target.value})}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-orange-500 transition-shadow"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Massa Muscular Apendicular (kg)</label>
                                <input 
                                    type="text" 
                                    placeholder="Ex: 24.5" 
                                    value={calcSMI.massaMuscularApendicular}
                                    onChange={(e) => setCalcSMI({...calcSMI, massaMuscularApendicular: e.target.value})}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-orange-500 transition-shadow"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="w-full md:w-96 shrink-0 bg-slate-50 rounded-[24px] border border-slate-200 p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Resultado SMI</p>
                        <p className={`text-6xl font-black tracking-tighter mb-4 ${resultadoSMI.valor > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                            {resultadoSMI.valor > 0 ? resultadoSMI.valor : '0.00'}
                        </p>
                        <div className={`px-4 py-2 rounded-xl border font-black uppercase text-[10px] tracking-widest ${resultadoSMI.bg} ${resultadoSMI.cor} border-${resultadoSMI.cor.split('-')[1]}-200`}>
                            {resultadoSMI.status}
                        </div>
                        {resultadoSMI.valor > 0 && (
                            <p className="text-[9px] text-slate-400 font-bold mt-6 leading-relaxed">
                                O cálculo é feito dividindo a Massa Muscular Apendicular pela Altura ao quadrado (MMA / Altura²).
                            </p>
                        )}
                    </div>

                </div>
            )}
            
        </div>
    );
};

export default AvaliacaoFisica;