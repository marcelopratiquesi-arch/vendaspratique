import React, { useState } from 'react';
import {
    ArrowUpDown, ArrowUp, ArrowDown, Users, AlertCircle, RefreshCw, 
    ChevronLeft, ChevronRight, ShoppingCart, Dumbbell, UserRoundPen, Trash2,
    Copy, Check
} from 'lucide-react';
import { formatarCPF, formatarTelefone, formatarDataBR, extrairIniciais, copiarTextoSeguro } from './utils.js';
import EtiquetasUnidade from '../../components/EtiquetasUnidade.jsx';

// Função para gerar uma cor de Avatar consistente para cada Aluno
const getAvatarColor = (nome) => {
    const colors = [
        'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
        'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
        'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800',
        'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
        'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800',
        'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800'
    ];
    if (!nome) return colors[0];
    let hash = 0;
    for (let i = 0; i < nome.length; i++) {
        hash = nome.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

export const BotaoCopiarPadrao = ({ valor, apenasDigitos = false, label = 'Copiar', onCopiado }) => {
    const [copiado, setCopiado] = useState(false);
    if (!valor || valor === '—') return null;

    const handleClick = async (e) => {
        e.stopPropagation();
        const ok = await copiarTextoSeguro(valor, apenasDigitos);
        if (ok) {
            setCopiado(true);
            if (onCopiado) onCopiado(label);
            setTimeout(() => setCopiado(false), 1500);
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-label={label}
            title={copiado ? 'Copiado!' : label}
            className="p-1 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all opacity-0 group-hover/cell:opacity-100 focus:opacity-100 shrink-0 ml-1 flex items-center justify-center"
        >
            {copiado ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
    );
};

// Mapa central de cores para os planos
const mapCoresPlanos = {
    'FIT + NUTRI': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400',
    'FIT': 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-400',
    'PLUS + NUTRI': 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400',
    'PLUS': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400',
    'SSP': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400',
    'PROMO': 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400',
    'DEFAULT': 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
};

const getCorPlano = (nomePlano) => {
    if (!nomePlano) return mapCoresPlanos.DEFAULT;
    const n = nomePlano.toUpperCase();
    if (n.includes('PLUS + NUTRI')) return mapCoresPlanos['PLUS + NUTRI'];
    if (n.includes('FIT + NUTRI')) return mapCoresPlanos['FIT + NUTRI'];
    if (n.includes('FIT')) return mapCoresPlanos['FIT'];
    if (n.includes('PLUS')) return mapCoresPlanos['PLUS'];
    if (n.includes('SSP')) return mapCoresPlanos['SSP'];
    if (n.includes('PROMO')) return mapCoresPlanos['PROMO'];
    return mapCoresPlanos.DEFAULT;
};

const CabecalhoOrdenavel = ({ coluna, label, ordemColuna, ordemDirecao, onOrdenar, className = '' }) => {
    const ativo = ordemColuna === coluna;
    return (
        <th
            onClick={() => onOrdenar(coluna)}
            className={`px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800 select-none cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors ${className}`}
        >
            <div className="inline-flex items-center gap-1.5">
                <span>{label}</span>
                {ativo ? (
                    ordemDirecao === 'ASC' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-500" />
                    ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-blue-500" />
                    )
                ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-30" />
                )}
            </div>
        </th>
    );
};

const ListaAlunos = ({
    alunos = [], totalCount = 0, loading = false, erro = null,
    onTentarNovamente, onLimparFiltros, ehAdmin = false,
    unidadeMinha = '', avisoLimite = '',
    ordemColuna = 'nome', ordemDirecao = 'ASC', onOrdenar,
    pagina = 1, setPagina, itensPorPagina = 25, setItensPorPagina,
    onSelecionarAluno, onEditarAluno, onExcluirAluno, 
    onIniciarVendaAluno, onIniciarAvaliacaoAluno, onToastCopiado
}) => {
    const totalPaginas = Math.max(1, Math.ceil(totalCount / itensPorPagina));
    const inicioItem = totalCount === 0 ? 0 : (pagina - 1) * itensPorPagina + 1;
    const fimItem = Math.min(pagina * itensPorPagina, totalCount);

    if (erro) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-rose-200 dark:border-rose-900/50 p-12 text-center shadow-sm">
                <div className="w-14 h-14 bg-rose-50 dark:bg-rose-900/30 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-7 h-7" />
                </div>
                <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Erro ao carregar</h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{erro}</p>
                <button onClick={onTentarNovamente} className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest transition-all">
                    <RefreshCw className="w-4 h-4" /> Tentar Novamente
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto custom-scrollbar max-h-[65vh]">
                <table className="w-full text-left border-collapse min-w-[1050px]">
                    <thead className="bg-slate-50 dark:bg-slate-800/90 sticky top-0 z-30 backdrop-blur">
                        <tr>
                            <CabecalhoOrdenavel coluna="nome" label="Aluno" ordemColuna={ordemColuna} ordemDirecao={ordemDirecao} onOrdenar={onOrdenar} className="sticky left-0 bg-slate-50 dark:bg-slate-800/90 z-30 w-[280px]" />
                            <CabecalhoOrdenavel coluna="cpf" label="CPF" ordemColuna={ordemColuna} ordemDirecao={ordemDirecao} onOrdenar={onOrdenar} />
                            <CabecalhoOrdenavel coluna="email" label="E-mail" ordemColuna={ordemColuna} ordemDirecao={ordemDirecao} onOrdenar={onOrdenar} />
                            <CabecalhoOrdenavel coluna="telefone" label="Telefone" ordemColuna={ordemColuna} ordemDirecao={ordemDirecao} onOrdenar={onOrdenar} />
                            {/* Unidade sempre visível: a busca é na rede inteira (regra 8 do CLAUDE.md) */}
                            <CabecalhoOrdenavel coluna="unidade" label="Unidade" ordemColuna={ordemColuna} ordemDirecao={ordemDirecao} onOrdenar={onOrdenar} />
                            <CabecalhoOrdenavel coluna="plano" label="Plano" ordemColuna={ordemColuna} ordemDirecao={ordemDirecao} onOrdenar={onOrdenar} />
                            <CabecalhoOrdenavel coluna="cadastro" label="Cadastro" ordemColuna={ordemColuna} ordemDirecao={ordemDirecao} onOrdenar={onOrdenar} />
                            {/* 🔥 COLUNA DE AÇÕES STICKY À DIREITA */}
                            <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800 text-right sticky right-0 bg-slate-50 dark:bg-slate-800/90 z-30 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.02)]">Ações</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                        {loading ? (
                            Array.from({ length: 8 }).map((_, idx) => (
                                <tr key={idx} className="animate-pulse">
                                    <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" /><div className="space-y-2 flex-1"><div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded" /><div className="h-2 w-16 bg-slate-100 dark:bg-slate-800/60 rounded" /></div></div></td>
                                    <td className="px-5 py-4"><div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                                    <td className="px-5 py-4"><div className="h-3 w-36 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                                    <td className="px-5 py-4"><div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                                    <td className="px-5 py-4"><div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                                    <td className="px-5 py-4"><div className="space-y-2"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" /><div className="h-2 w-16 bg-slate-100 dark:bg-slate-800/60 rounded" /></div></td>
                                    <td className="px-5 py-4"><div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                                    <td className="px-5 py-4 text-right sticky right-0 bg-white dark:bg-slate-900 z-10 border-l border-slate-100 dark:border-slate-800/60 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.02)]"><div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded ml-auto" /></td>
                                </tr>
                            ))
                        ) : alunos.length === 0 ? (
                            <tr>
                                <td colSpan={8}className="py-24 text-center">
                                    <div className="flex flex-col items-center">
                                        <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-500 flex items-center justify-center mb-3 border border-slate-100 dark:border-slate-700"><Users className="w-5 h-5" /></div>
                                        <p className="text-sm font-black text-slate-600 dark:text-slate-300 uppercase">Nenhum aluno encontrado</p>
                                        <button onClick={onLimparFiltros} className="mt-4 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest transition-colors">Limpar Filtros</button>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            alunos.map((aluno) => {
                                const matriculaValida = aluno.matricula && String(aluno.matricula).toUpperCase() !== 'VISITANTE' ? aluno.matricula : '';
                                const planoClass = getCorPlano(aluno.ultimo_plano);
                                const avatarColor = getAvatarColor(aluno.nome);

                                return (
                                    <tr
                                        key={aluno.id}
                                        onClick={() => onSelecionarAluno(aluno)}
                                        className="group/row hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                                    >
                                        {/* A) HIERARQUIA VISUAL DO ALUNO COM AVATAR DINÂMICO */}
                                        <td className="px-5 py-4 sticky left-0 bg-white dark:bg-slate-900 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/90 transition-colors z-10 border-r border-slate-100 dark:border-slate-800/60">
                                            <div className="flex items-center gap-3.5">
                                                {aluno.foto_url ? (
                                                    <img src={aluno.foto_url} alt={aluno.nome} className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                                                ) : (
                                                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-[10px] font-black shrink-0 ${avatarColor}`}>
                                                        {extrairIniciais(aluno.nome)}
                                                    </div>
                                                )}
                                                <div className="flex flex-col min-w-0 justify-center">
                                                    <div className="flex items-center gap-1.5 group/cell">
                                                        <span className="text-sm font-black text-slate-800 dark:text-slate-100 truncate group-hover/row:text-blue-600 dark:group-hover/row:text-blue-400 transition-colors uppercase">
                                                            {aluno.nome}
                                                        </span>
                                                        <BotaoCopiarPadrao valor={aluno.nome} apenasDigitos={false} label="Copiar nome" onCopiado={onToastCopiado} />
                                                    </div>
                                                    {matriculaValida && (
                                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                                                            Mat. {matriculaValida}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* OUTRAS COLUNAS (TEXTO MAIS FORTE - ACESSIBILIDADE WCAG) */}
                                        <td className="px-5 py-4 whitespace-nowrap group/cell">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono text-[13px] font-semibold text-slate-600 dark:text-slate-300">{formatarCPF(aluno.cpf)}</span>
                                                <BotaoCopiarPadrao valor={aluno.cpf} apenasDigitos={true} label="Copiar CPF" onCopiado={onToastCopiado} />
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 max-w-[200px] group/cell">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[13px] font-medium text-slate-600 dark:text-slate-300 truncate lowercase" title={aluno.email || ''}>{aluno.email || '—'}</span>
                                                <BotaoCopiarPadrao valor={aluno.email} apenasDigitos={false} label="Copiar e-mail" onCopiado={onToastCopiado} />
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap group/cell">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono text-[13px] font-semibold text-slate-600 dark:text-slate-300">{formatarTelefone(aluno.telefone)}</span>
                                                <BotaoCopiarPadrao valor={aluno.telefone} apenasDigitos={true} label="Copiar telefone" onCopiado={onToastCopiado} />
                                            </div>
                                        </td>

                                        <td className="px-5 py-4 max-w-[220px]">
                                            <EtiquetasUnidade unidades={aluno.unidades || (aluno.unidade ? [aluno.unidade] : [])} unidadeMinha={unidadeMinha} />
                                        </td>

                                        {/* B) PLANO (BADGE COM CORES HARMÔNICAS) */}
                                        <td className="px-5 py-4">
                                            {aluno.ultimo_plano ? (
                                                <div className="flex flex-col items-start">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${planoClass} max-w-[160px] truncate`} title={aluno.ultimo_plano}>
                                                        {aluno.ultimo_plano}
                                                    </span>
                                                    {aluno.ultimo_plano_data && (
                                                        <span className="text-[9px] font-medium text-slate-400 mt-1 ml-0.5">em {formatarDataBR(aluno.ultimo_plano_data)}</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-[13px] font-medium text-slate-300 dark:text-slate-600">—</span>
                                            )}
                                        </td>

                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <span className="text-[13px] font-medium text-slate-600 dark:text-slate-300">{formatarDataBR(aluno.created_at)}</span>
                                        </td>

                                        {/* C) AÇÕES FIXAS À DIREITA (STICKY) */}
                                        <td className="px-5 py-4 text-right sticky right-0 bg-white dark:bg-slate-900 group-hover/row:bg-slate-50 dark:group-hover/row:bg-slate-800/90 transition-colors z-10 border-l border-slate-100 dark:border-slate-800/60 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.02)]">
                                            <div className="inline-flex items-center justify-end gap-1">
                                                {onIniciarVendaAluno && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); if(aluno.cpf) onIniciarVendaAluno(aluno); }}
                                                        disabled={!aluno.cpf}
                                                        title={aluno.cpf ? "Vender para este aluno" : "Aluno sem CPF cadastrado"}
                                                        className="p-2 rounded-lg bg-transparent text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent disabled:hover:text-slate-400 disabled:cursor-not-allowed"
                                                    >
                                                        <ShoppingCart className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {onIniciarAvaliacaoAluno && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); if(aluno.cpf) onIniciarAvaliacaoAluno(aluno); }}
                                                        disabled={!aluno.cpf}
                                                        title={aluno.cpf ? "Avaliar este aluno" : "Aluno sem CPF cadastrado"}
                                                        className="p-2 rounded-lg bg-transparent text-slate-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/30 dark:hover:text-amber-400 border border-transparent hover:border-amber-200 dark:hover:border-amber-800 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent disabled:hover:text-slate-400 disabled:cursor-not-allowed"
                                                    >
                                                        <Dumbbell className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); onEditarAluno(aluno); }}
                                                    title="Editar dados"
                                                    className="p-2 rounded-lg bg-transparent text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 border border-transparent hover:border-blue-200 dark:hover:border-blue-800 transition-all"
                                                >
                                                    <UserRoundPen className="w-4 h-4" />
                                                </button>
                                                {ehAdmin && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); onExcluirAluno(aluno); }}
                                                        title="Excluir cadastro"
                                                        className="p-2 rounded-lg bg-transparent text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400 border border-transparent hover:border-rose-200 dark:hover:border-rose-800 transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {avisoLimite && (
                <p className="px-6 py-2.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-100 dark:border-amber-900/40">{avisoLimite}</p>
            )}

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
                    <span>Exibindo <strong className="text-slate-800 dark:text-white">{inicioItem}–{fimItem}</strong> de <strong className="text-blue-600 dark:text-blue-400">{totalCount.toLocaleString('pt-BR')}</strong> alunos</span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-widest">Por página:</span>
                        {[25, 50, 100].map((qtd) => (
                            <button key={qtd} onClick={() => { setItensPorPagina(qtd); setPagina(1); }} className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${itensPorPagina === qtd ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                                {qtd}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina <= 1 || loading} className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"><ChevronLeft className="w-4 h-4" /> Anterior</button>
                    <span className="px-3 py-1.5 text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Página {pagina} de {totalPaginas}</span>
                    <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina >= totalPaginas || loading} className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Próxima <ChevronRight className="w-4 h-4" /></button>
                </div>
            </div>
        </div>
    );
};
export default ListaAlunos;