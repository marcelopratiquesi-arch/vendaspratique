// src/pages/AnaliseVendas/relatorio/ModalAuditoria.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { formatDataBR, normalizeString } from '../utils.js';
import { exportarListaModalCSV } from './exportadorSeguro.js';
import {
    LayoutList,
    X,
    Move,
    Copy,
    Check,
    Loader2,
    Search,
    Download
} from 'lucide-react';

// ==========================================
// 🧩 SUB-COMPONENTE: Botão de Cópia Rápida
// ==========================================
export const CopyMiniButton = ({ textToCopy }) => {
    const [copied, setCopied] = useState(false);

    if (!textToCopy || textToCopy === 'Não informado' || textToCopy === '—') return null;

    const handleCopy = (e) => {
        e.stopPropagation();
        const cleanText = String(textToCopy).trim();
        navigator.clipboard.writeText(cleanText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            className="opacity-0 group-hover/row:opacity-100 p-1 bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 rounded transition-all shrink-0 dark:bg-slate-800 dark:hover:bg-blue-500/20 dark:hover:text-blue-400"
            title="Copiar informação"
        >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
        </button>
    );
};

// ==========================================
// 🧠 MODAL DE AUDITORIA ARRASTÁVEL COM BUSCA E EXPORTAÇÃO
// ==========================================
const ModalAuditoria = ({
    modalConfig,
    onClose,
    dicionarioPessoas,
    cacheAlunosBanco,
    buscandoCpfsBanco,
    extrairDadosPessoa
}) => {
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [buscaInterna, setBuscaInterna] = useState('');
    const dragStart = useRef({ x: 0, y: 0 });

    const isOpen = Boolean(modalConfig?.isOpen);

    useEffect(() => {
        if (!isOpen) {
            setOffset({ x: 0, y: 0 });
            setBuscaInterna('');
        }
    }, [isOpen]);

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    // Filtra os registros do modal em tempo real pela barra de pesquisa
    const registrosFiltradosModal = useMemo(() => {
        const lista = modalConfig?.registros || [];
        const termo = normalizeString(buscaInterna);
        const termoNumeros = buscaInterna.replace(/\D/g, '');

        if (!termo && !termoNumeros) return lista;

        return lista.filter(reg => {
            const pessoa = extrairDadosPessoa(reg, dicionarioPessoas, cacheAlunosBanco);
            const nomeNorm = normalizeString(pessoa.nome);
            const prodNorm = normalizeString(reg.produto || '');
            const vendNorm = normalizeString(reg.vendedor || reg.consultor || reg.professor || reg.avaliador || '');
            const matNorm = normalizeString(pessoa.matricula || '');

            if (termo && (nomeNorm.includes(termo) || prodNorm.includes(termo) || vendNorm.includes(termo) || matNorm.includes(termo))) {
                return true;
            }
            if (termoNumeros && (pessoa.cpfPuro.includes(termoNumeros) || String(pessoa.matricula).includes(termoNumeros))) {
                return true;
            }
            return false;
        });
    }, [modalConfig?.registros, buscaInterna, dicionarioPessoas, cacheAlunosBanco, extrairDadosPessoa]);

    if (!isOpen) return null;

    const handlePointerDown = (e) => {
        if (e.target.closest('.no-drag')) return;
        setIsDragging(true);
        dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
        e.target.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e) => {
        if (!isDragging) return;
        setOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    };

    const handlePointerUp = (e) => {
        setIsDragging(false);
        try {
            e.target.releasePointerCapture(e.pointerId);
        } catch (_) {}
    };

    const handleExportarListaAtual = () => {
        exportarListaModalCSV({
            registros: registrosFiltradosModal,
            tipoTabela: modalConfig.tipoTabela,
            titulo: modalConfig.titulo,
            extrairDadosPessoa,
            dicionarioPessoas,
            cacheAlunosBanco
        });
    };

    const renderTabela = () => {
        if (registrosFiltradosModal.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 opacity-60">
                    <LayoutList className="w-12 h-12 text-slate-300 mb-4" />
                    <p className="text-sm font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">
                        Nenhum registro encontrado para esta busca.
                    </p>
                </div>
            );
        }

        if (modalConfig.tipoTabela === 'VENDA') {
            return (
                <div className="w-full overflow-x-auto custom-scrollbar bg-white dark:bg-slate-900">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-100/50 border-b border-slate-200 dark:border-slate-800">
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-100/90 backdrop-blur dark:text-slate-400">Aluno</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">CPF</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">Data</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">Plano/Produto</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center dark:text-slate-400">Qtd</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">Vendedor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {registrosFiltradosModal.map((v, i) => {
                                const pessoa = extrairDadosPessoa(v, dicionarioPessoas, cacheAlunosBanco);
                                return (
                                    <tr key={i} className="hover:bg-blue-50/50 transition-colors group/row dark:hover:bg-blue-500/10">
                                        <td className="py-4 px-5 font-bold text-slate-800 text-xs sticky left-0 bg-white/95 backdrop-blur dark:text-white dark:bg-slate-900/95">
                                            <div className="flex items-center gap-2 max-w-[240px]">
                                                <span className="truncate uppercase" title={pessoa.nome}>{pessoa.nome}</span>
                                                <CopyMiniButton textToCopy={pessoa.nome} />
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                            <div className="flex items-center gap-2">
                                                <span>{pessoa.cpf}</span>
                                                <CopyMiniButton textToCopy={pessoa.cpfPuro || pessoa.cpf} />
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 text-xs text-slate-600 font-medium whitespace-nowrap dark:text-slate-300">{formatDataBR(v.data || v.created_at)}</td>
                                        <td className="py-4 px-5 text-xs font-bold text-blue-700 uppercase truncate max-w-[250px] dark:text-blue-400" title={v.produto}>{v.produto}</td>
                                        <td className="py-4 px-5 text-xs font-black text-center text-slate-800 dark:text-white">{v.qtdConsolidada || v.quantidade || 1}</td>
                                        <td className="py-4 px-5 text-xs font-bold text-slate-600 uppercase truncate max-w-[150px] dark:text-slate-300">{v.vendedor || 'Sistema'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (modalConfig.tipoTabela === 'VISITANTE') {
            return (
                <div className="w-full overflow-x-auto custom-scrollbar bg-white dark:bg-slate-900">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-100/50 border-b border-slate-200 dark:border-slate-800">
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-100/90 backdrop-blur dark:text-slate-400">Visitante / Aluno</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">CPF</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">Telefone</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">Data</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">Consultor Resp.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {registrosFiltradosModal.map((v, i) => {
                                const pessoa = extrairDadosPessoa(v, dicionarioPessoas, cacheAlunosBanco);
                                const tel = v.telefone || v.celular || v.contato || v.whatsapp || 'Não informado';
                                const responsavel = v.consultor || v.vendedor || v.responsavel || v.atendente || v.criado_por || 'Recepção';
                                return (
                                    <tr key={i} className="hover:bg-blue-50/50 transition-colors group/row dark:hover:bg-blue-500/10">
                                        <td className="py-4 px-5 font-bold text-slate-800 text-xs sticky left-0 bg-white/95 backdrop-blur dark:text-white dark:bg-slate-900/95">
                                            <div className="flex items-center gap-2 max-w-[240px]">
                                                <span className="truncate uppercase" title={pessoa.nome}>{pessoa.nome}</span>
                                                <CopyMiniButton textToCopy={pessoa.nome} />
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                            <div className="flex items-center gap-2">
                                                <span>{pessoa.cpf}</span>
                                                <CopyMiniButton textToCopy={pessoa.cpfPuro || pessoa.cpf} />
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 font-mono text-[11px] text-slate-600 dark:text-slate-300">{tel}</td>
                                        <td className="py-4 px-5 text-xs text-slate-600 font-medium whitespace-nowrap dark:text-slate-300">{formatDataBR(v.data || v.criado_em || v.created_at)}</td>
                                        <td className="py-4 px-5 text-xs font-bold text-slate-600 uppercase truncate max-w-[150px] dark:text-slate-300">{responsavel}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (modalConfig.tipoTabela === 'AVALIACAO') {
            return (
                <div className="w-full overflow-x-auto custom-scrollbar bg-white dark:bg-slate-900">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-100/50 border-b border-slate-200 dark:border-slate-800">
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-100/90 backdrop-blur dark:text-slate-400">Aluno Avaliado</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">CPF</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">Data</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">Professor / Avaliador</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">Situação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {registrosFiltradosModal.map((a, i) => {
                                const pessoa = extrairDadosPessoa(a, dicionarioPessoas, cacheAlunosBanco);
                                const prof = a.professor || a.avaliador || a.instrutor || a.profissional || a.responsavel || a.criado_por || 'Não informado';
                                const statusAval = a.status || a.situacao || 'Concluída';
                                return (
                                    <tr key={i} className="hover:bg-blue-50/50 transition-colors group/row dark:hover:bg-blue-500/10">
                                        <td className="py-4 px-5 font-bold text-slate-800 text-xs sticky left-0 bg-white/95 backdrop-blur dark:text-white dark:bg-slate-900/95">
                                            <div className="flex items-center gap-2 max-w-[260px]">
                                                <span className="truncate uppercase" title={pessoa.nome}>{pessoa.nome}</span>
                                                {pessoa.matricula && (
                                                    <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 shrink-0 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-800">
                                                        MAT: {pessoa.matricula}
                                                    </span>
                                                )}
                                                <CopyMiniButton textToCopy={pessoa.nome} />
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                            <div className="flex items-center gap-2">
                                                <span>{pessoa.cpf}</span>
                                                <CopyMiniButton textToCopy={pessoa.cpfPuro || pessoa.cpf} />
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 text-xs text-slate-600 font-medium whitespace-nowrap dark:text-slate-300">{formatDataBR(a.data || a.data_avaliacao || a.created_at)}</td>
                                        <td className="py-4 px-5 text-xs font-bold text-slate-700 uppercase truncate max-w-[180px] dark:text-slate-200">{prof}</td>
                                        <td className="py-4 px-5">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30">
                                                {statusAval}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-[fadeIn_0.2s_ease-out]">
            <div
                className="bg-white rounded-[20px] shadow-2xl flex flex-col w-full max-w-5xl max-h-[90vh] overflow-hidden border border-slate-200 resize dark:bg-slate-900 dark:border-slate-800"
                style={{ transform: `translate(${offset.x}px, ${offset.y}px)`, transition: isDragging ? 'none' : 'transform 0.1s ease-out' }}
            >
                {/* Cabeçalho Arrastável */}
                <div
                    className="bg-slate-900 px-6 py-5 flex justify-between items-center cursor-move select-none touch-none border-b border-slate-800 group"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    title="Clique e segure para arrastar"
                >
                    <div className="flex items-center gap-4 no-drag">
                        <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                            <Move className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="flex flex-col">
                            <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight line-clamp-1">
                                {modalConfig.titulo}
                            </h3>
                            {modalConfig.subtitulo && (
                                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-0.5">
                                    {modalConfig.subtitulo}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="no-drag text-slate-400 hover:text-white transition-colors p-2 bg-white/5 hover:bg-rose-500 hover:text-white rounded-full"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Barra de Ferramentas Interna (Contador + Pesquisa + Exportar Lista) */}
                <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 no-drag dark:bg-slate-900 dark:border-slate-800">
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">
                            Total Encontrado:
                            <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 ml-1.5 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/30">
                                {modalConfig.totalItensUnicos} Itens Consolidados
                            </span>
                        </span>
                        {buscandoCpfsBanco && (
                            <span className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 uppercase tracking-widest dark:text-blue-400">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sincronizando CPFs da base...
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2.5">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={buscaInterna}
                                onChange={(e) => setBuscaInterna(e.target.value)}
                                placeholder="Buscar aluno, CPF ou vendedor..."
                                className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all dark:bg-slate-800/60 dark:border-slate-800 dark:text-slate-200 dark:focus:bg-slate-900"
                            />
                            {buscaInterna && (
                                <button
                                    type="button"
                                    onClick={() => setBuscaInterna('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={handleExportarListaAtual}
                            disabled={registrosFiltradosModal.length === 0}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shrink-0 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
                            title="Baixar planilha apenas desta lista"
                        >
                            <Download className="w-3.5 h-3.5" /> Baixar Lista
                        </button>
                    </div>
                </div>

                {/* Corpo da Tabela */}
                <div className="flex-1 overflow-y-auto bg-slate-50 no-drag custom-scrollbar dark:bg-slate-800/60">
                    {renderTabela()}
                </div>
            </div>
        </div>
    );
};

export default ModalAuditoria;