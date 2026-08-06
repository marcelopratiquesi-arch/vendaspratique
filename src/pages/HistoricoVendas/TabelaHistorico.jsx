import React, { useState, useRef, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { safeNumber, safeIsoDate, formatMoney, formatDataBR, extrairHoraCriacao, toTitleCase } from './utils.js';
import { History, ChevronUp, ChevronDown, ChevronsUpDown, User, Edit3, Trash2, Check, X, FilterX } from 'lucide-react';

const TabelaHistorico = ({ data, setData, vendasFiltradas, temVisaoGlobal, podeEditar, filtroVendedor, catalogoGeral }) => {
    const [ordenacao, setOrdenacao] = useState({ coluna: 'data', direcao: 'desc' });
    const [editandoId, setEditandoId] = useState(null);
    const [dadosEdicao, setDadosEdicao] = useState({});

    const scrollContainerRef = useRef(null);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);

    const handleMouseDown = (e) => {
        const targetTag = e.target.tagName;
        if (targetTag === 'INPUT' || targetTag === 'SELECT' || targetTag === 'BUTTON' || e.target.closest('button')) {
            return;
        }
        isDragging.current = true;
        scrollContainerRef.current.style.userSelect = 'none'; 
        scrollContainerRef.current.classList.add('cursor-grabbing');
        scrollContainerRef.current.classList.remove('cursor-grab');
        startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
        scrollLeft.current = scrollContainerRef.current.scrollLeft;
    };

    const handleMouseLeaveOrUp = () => {
        isDragging.current = false;
        if (scrollContainerRef.current) {
            scrollContainerRef.current.style.userSelect = 'auto';
            scrollContainerRef.current.classList.remove('cursor-grabbing');
            scrollContainerRef.current.classList.add('cursor-grab');
        }
    };

    const handleMouseMove = (e) => {
        if (!isDragging.current) return;
        e.preventDefault(); 
        const x = e.pageX - scrollContainerRef.current.offsetLeft;
        const walk = (x - startX.current) * 1.5; 
        scrollContainerRef.current.scrollLeft = scrollLeft.current - walk;
    };

    const removerLancamento = async (id) => {
        if(!podeEditar) return;
        if(window.confirm('Atenção: Tem certeza que deseja EXCLUIR permanentemente este registro da Nuvem?')) {
            const backupDados = [...data];
            setData(data.filter(v => v.id !== id));
            const { error } = await supabase.from('vendas').delete().eq('id', id);
            if (error) {
                console.error("Erro ao deletar:", error);
                alert("Erro ao excluir do banco de dados.");
                setData(backupDados);
            }
        }
    };

    const iniciarEdicao = (venda) => {
        const valorNumericoBanco = safeNumber(venda.valor);
        const qtd = parseInt(venda.quantidade) || 1;
        let unitario = 0;
        const itemCatalogo = catalogoGeral.find(c => c.nome.toUpperCase() === venda.produto?.toUpperCase());
        if (itemCatalogo) unitario = safeNumber(itemCatalogo.valor);
        else unitario = valorNumericoBanco / qtd;

        setEditandoId(venda.id);
        setDadosEdicao({
            data: safeIsoDate(venda.data),
            matricula: venda.matricula || '',
            nome_aluno: venda.nome_aluno || venda.nome || '',
            produto: venda.produto || '',
            vendedor: venda.vendedor || '',
            quantidade: qtd,
            valorUnitario: unitario,
            valorCalculado: valorNumericoBanco
        });
    };

    const handleEdicaoChange = (field, value) => {
        let novosDados = { ...dadosEdicao, [field]: value };
        if (field === 'produto') {
            const item = catalogoGeral.find(c => c.nome === value);
            if (item) {
                const novoUnitario = safeNumber(item.valor);
                novosDados.valorUnitario = novoUnitario;
                novosDados.valorCalculado = novoUnitario * novosDados.quantidade;
            }
        }
        if (field === 'quantidade') {
            const qtd = parseInt(value) || 1;
            novosDados.quantidade = qtd;
            novosDados.valorCalculado = novosDados.valorUnitario * qtd;
        }
        setDadosEdicao(novosDados);
    };

    const cancelarEdicao = () => {
        setEditandoId(null);
        setDadosEdicao({});
    };

    const salvarEdicao = async (id) => {
        const valorPuro = safeNumber(dadosEdicao.valorCalculado);
        const payload = {
            data: dadosEdicao.data, 
            matricula: dadosEdicao.matricula,
            nome_aluno: dadosEdicao.nome_aluno.toUpperCase(),
            produto: dadosEdicao.produto.toUpperCase(),
            vendedor: dadosEdicao.vendedor.toUpperCase(),
            quantidade: parseInt(dadosEdicao.quantidade) || 1,
            valor: valorPuro, 
            comissao: valorPuro 
        };

        setData(data.map(v => v.id === id ? { ...v, ...payload } : v));
        setEditandoId(null);

        const { error } = await supabase.from('vendas').update(payload).eq('id', id);
        if (error) {
            console.error("Erro ao editar venda:", error);
            alert("Erro de conexão ao tentar atualizar os dados da venda.");
        }
    };

    const handleOrdenar = (colunaClicada) => {
        let novaDirecao = 'asc';
        if (ordenacao.coluna === colunaClicada && ordenacao.direcao === 'asc') novaDirecao = 'desc';
        setOrdenacao({ coluna: colunaClicada, direcao: novaDirecao });
    };

    const vendasOrdenadas = useMemo(() => {
        return [...vendasFiltradas].sort((a, b) => {
            let valorA, valorB;
            if (ordenacao.coluna === 'nome_aluno') {
                valorA = (a.nome_aluno || a.nome || '').toUpperCase();
                valorB = (b.nome_aluno || b.nome || '').toUpperCase();
            } else if (ordenacao.coluna === 'data') {
                valorA = a.created_at || a.data;
                valorB = b.created_at || b.data;
            } else if (ordenacao.coluna === 'valor') {
                valorA = safeNumber(a.valor);
                valorB = safeNumber(b.valor);
            } else {
                valorA = String(a[ordenacao.coluna] || '').toUpperCase();
                valorB = String(b[ordenacao.coluna] || '').toUpperCase();
            }

            if (valorA < valorB) return ordenacao.direcao === 'asc' ? -1 : 1;
            if (valorA > valorB) return ordenacao.direcao === 'asc' ? 1 : -1;
            return 0;
        });
    }, [vendasFiltradas, ordenacao]);

    const RenderSortIcon = ({ coluna }) => {
        if (ordenacao.coluna !== coluna) return <ChevronsUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-400" />;
        return ordenacao.direcao === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-500" /> : <ChevronDown className="w-3 h-3 text-blue-500" />;
    };

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 bg-white flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                        <History className="w-6 h-6 text-blue-600" /> Registros de Vendas
                    </h2>
                </div>
                <div className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-200 shadow-inner">
                    {vendasOrdenadas.length} de {data.length} Encontrados
                </div>
            </div>
            
            <div 
                ref={scrollContainerRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeaveOrUp}
                onMouseUp={handleMouseLeaveOrUp}
                onMouseMove={handleMouseMove}
                className="overflow-x-auto custom-scrollbar cursor-grab" 
                style={{ maxHeight: '65vh' }}
            >
                <table className="w-full text-left border-collapse min-w-max">
                    <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 shadow-sm border-b border-slate-200">
                        <tr>
                            <th onClick={() => handleOrdenar('data')} className="px-5 py-4 text-xs font-black text-slate-600 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors group select-none">
                                <div className="flex items-center gap-2">
                                    Data / Lançamento
                                    <RenderSortIcon coluna="data" />
                                </div>
                            </th>
                            
                            {temVisaoGlobal && <th className="px-5 py-4 text-xs font-black text-rose-600 uppercase tracking-widest">Unidade</th>}
                            
                            <th onClick={() => handleOrdenar('nome_aluno')} className="px-5 py-4 text-xs font-black text-slate-600 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors group select-none">
                                <div className="flex items-center gap-2">
                                    Aluno / Matrícula
                                    <RenderSortIcon coluna="nome_aluno" />
                                </div>
                            </th>
                            
                            <th onClick={() => handleOrdenar('produto')} className="px-5 py-4 text-xs font-black text-slate-600 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors group select-none">
                                <div className="flex items-center gap-2">
                                    Plano/Produto
                                    <RenderSortIcon coluna="produto" />
                                </div>
                            </th>
                            
                            {filtroVendedor === 'TODOS' && (
                                <th onClick={() => handleOrdenar('vendedor')} className="px-5 py-4 text-xs font-black text-slate-600 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors group select-none">
                                    <div className="flex items-center gap-2">
                                        Vendedor
                                        <RenderSortIcon coluna="vendedor" />
                                    </div>
                                </th>
                            )}
                            
                            <th className="px-5 py-4 text-xs font-black text-slate-600 uppercase tracking-widest text-right">Qtd</th>
                            
                            <th onClick={() => handleOrdenar('valor')} className="px-5 py-4 text-xs font-black text-slate-600 uppercase tracking-widest text-right cursor-pointer hover:bg-slate-100 transition-colors group select-none">
                                <div className="flex items-center justify-end gap-2">
                                    Valor Total
                                    <RenderSortIcon coluna="valor" />
                                </div>
                            </th>
                            
                            {podeEditar && <th className="px-5 py-4 text-xs font-black text-slate-600 uppercase tracking-widest text-center">Gestão</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {vendasOrdenadas.map((row) => {
                            const isEditing = editandoId === row.id;

                            return (
                                <tr key={row.id} className={`group transition-colors ${isEditing ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}>
                                    <td className="px-5 py-4 align-middle">
                                        {isEditing ? (
                                            <input type="date" value={dadosEdicao.data} onChange={e => handleEdicaoChange('data', e.target.value)} className="w-36 bg-white border border-blue-300 text-blue-800 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm shadow-sm" />
                                        ) : (
                                            <div>
                                                <p className="text-sm font-black text-slate-800 whitespace-nowrap">{formatDataBR(row.data)}</p>
                                                {row.created_at && (
                                                    <div className="flex items-center gap-1.5 mt-1.5 text-slate-500 w-max">
                                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                            {toTitleCase(row.criado_por ? row.criado_por.split(' ')[0] : 'Sistema')} • {extrairHoraCriacao(row.created_at)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    
                                    {temVisaoGlobal && (
                                        <td className="px-5 py-4 text-xs font-black text-rose-600 bg-rose-50/20 whitespace-nowrap uppercase align-middle">
                                            {row.unidade || 'MATRIZ'}
                                        </td>
                                    )}

                                    <td className="px-5 py-4 align-middle">
                                        {isEditing ? (
                                            <div className="flex flex-col gap-2">
                                                <input type="text" placeholder="Nome do Aluno" value={dadosEdicao.nome_aluno} onChange={e => handleEdicaoChange('nome_aluno', e.target.value)} className="w-full bg-white border border-blue-300 text-blue-800 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-bold uppercase text-sm shadow-sm" />
                                                <input type="text" placeholder="Matrícula" value={dadosEdicao.matricula} onChange={e => handleEdicaoChange('matricula', e.target.value)} className="w-36 bg-white border border-blue-300 text-blue-800 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm shadow-sm" />
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-sm font-bold text-slate-800 max-w-[220px] truncate" title={row.nome_aluno || row.nome}>
                                                    {toTitleCase(row.nome_aluno || row.nome)}
                                                </p>
                                                <p className="text-xs font-bold text-slate-400 uppercase mt-1 tracking-wider">MAT: {row.matricula || '-'}</p>
                                            </div>
                                        )}
                                    </td>

                                    <td className="px-5 py-4 text-sm whitespace-nowrap uppercase font-black text-blue-600 align-middle">
                                        {isEditing ? (
                                            <select value={dadosEdicao.produto} onChange={e => handleEdicaoChange('produto', e.target.value)} className="w-full min-w-[180px] bg-white border border-blue-300 text-blue-800 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-bold uppercase cursor-pointer text-sm shadow-sm">
                                                <option value="" disabled>Selecione...</option>
                                                {catalogoGeral.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                                            </select>
                                        ) : (
                                            row.produto
                                        )}
                                    </td>

                                    {filtroVendedor === 'TODOS' && (
                                        <td className="px-5 py-4 text-sm whitespace-nowrap font-bold text-slate-700 align-middle">
                                            {isEditing ? (
                                                <input type="text" value={dadosEdicao.vendedor} onChange={e => handleEdicaoChange('vendedor', e.target.value)} className="w-36 bg-white border border-blue-300 text-blue-800 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-bold uppercase text-sm shadow-sm" />
                                            ) : (
                                                toTitleCase(row.vendedor)
                                            )}
                                        </td>
                                    )}

                                    <td className="px-5 py-4 text-sm text-right font-black text-slate-800 align-middle">
                                        {isEditing ? (
                                            <input type="number" min="1" value={dadosEdicao.quantidade} onChange={e => handleEdicaoChange('quantidade', e.target.value)} className="w-16 text-center bg-white border border-blue-300 text-blue-800 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm shadow-sm" />
                                        ) : (
                                            row.quantidade || '1'
                                        )}
                                    </td>

                                    <td className="px-5 py-4 text-sm font-black text-slate-900 whitespace-nowrap text-right align-middle">
                                        {isEditing ? (
                                            <input type="text" value={formatMoney(dadosEdicao.valorCalculado)} readOnly className="w-28 text-right bg-slate-100 border border-slate-300 text-slate-500 rounded-lg px-3 py-2 cursor-not-allowed font-black text-sm shadow-inner" title="O valor calcula sozinho" />
                                        ) : (
                                            formatMoney(row.valor)
                                        )}
                                    </td>

                                    {podeEditar && (
                                        <td className="px-5 py-4 text-center align-middle w-32">
                                            {isEditing ? (
                                                <div className="flex flex-col gap-2 items-center justify-center">
                                                    <button onClick={() => salvarEdicao(row.id)} title="Salvar Alterações" className="flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-md">
                                                        <Check className="w-4 h-4" /> Salvar
                                                    </button>
                                                    <button onClick={cancelarEdicao} title="Cancelar" className="flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-sm">
                                                        <X className="w-4 h-4" /> Cancelar
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => iniciarEdicao(row)} className="flex items-center justify-center gap-1.5 px-3 py-2 w-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                                                        <Edit3 className="w-4 h-4" /> Editar
                                                    </button>
                                                    <button onClick={() => removerLancamento(row.id)} className="flex items-center justify-center gap-1.5 px-3 py-2 w-full bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                                                        <Trash2 className="w-4 h-4" /> Excluir
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                        {vendasOrdenadas.length === 0 && (
                            <tr>
                                <td colSpan={temVisaoGlobal ? "8" : "7"} className="px-5 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                                    <FilterX className="w-12 h-12 mx-auto text-slate-300 mb-4 opacity-60" />
                                    Nenhuma venda encontrada para estes filtros.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TabelaHistorico;