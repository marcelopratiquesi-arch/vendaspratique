import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { safeNumber, safeIsoDate, formatMoney, formatDataBR, extrairHoraCriacao } from './utils.js';

const TabelaHistorico = ({ data, setData, vendasFiltradas, temVisaoGlobal, podeEditar }) => {
    // ESTADOS EXCLUSIVOS DA TABELA
    const [ordenacao, setOrdenacao] = useState({ coluna: 'data', direcao: 'desc' });
    const [catalogoGeral, setCatalogoGeral] = useState([]);
    const [editandoId, setEditandoId] = useState(null);
    const [dadosEdicao, setDadosEdicao] = useState({});

    // REFS PARA O DRAG TO SCROLL
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

    // FETCH DO CATÁLOGO PARA EDIÇÃO
    useEffect(() => {
        const fetchCatalogo = async () => {
            const { data } = await supabase.from('catalogo').select('*');
            if (data) setCatalogoGeral(data);
        };
        fetchCatalogo();
    }, []);

    // RENDERIZAÇÃO DE ÍCONES
    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [vendasFiltradas, editandoId, ordenacao]);

    // GESTÃO DE DADOS (CRUD)
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

    // ORDENAÇÃO DE COLUNAS OTIMIZADA COM USEMEMO
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

    return (
        <div className="bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 bg-white flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-black text-slate-800 flex items-center gap-2.5">
                        <i data-lucide="history" className="w-5 h-5 text-blue-500"></i> Registros de Vendas
                    </h2>
                </div>
                <div className="bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 shadow-sm">
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
                    <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 shadow-sm">
                        <tr>
                            <th onClick={() => handleOrdenar('data')} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors group select-none">
                                <div className="flex items-center gap-1.5">
                                    Data / Lançamento
                                    <i data-lucide={ordenacao.coluna === 'data' ? (ordenacao.direcao === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down'} className={`w-3 h-3 ${ordenacao.coluna === 'data' ? 'text-blue-500' : 'text-slate-300 group-hover:text-slate-400'}`}></i>
                                </div>
                            </th>
                            {temVisaoGlobal && <th className="px-6 py-4 text-[10px] font-black text-rose-500 uppercase tracking-widest border-b border-slate-200">Unidade</th>}
                            
                            <th onClick={() => handleOrdenar('nome_aluno')} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors group select-none">
                                <div className="flex items-center gap-1.5">
                                    Aluno / Matrícula
                                    <i data-lucide={ordenacao.coluna === 'nome_aluno' ? (ordenacao.direcao === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down'} className={`w-3 h-3 ${ordenacao.coluna === 'nome_aluno' ? 'text-blue-500' : 'text-slate-300 group-hover:text-slate-400'}`}></i>
                                </div>
                            </th>
                            
                            <th onClick={() => handleOrdenar('produto')} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors group select-none">
                                <div className="flex items-center gap-1.5">
                                    Plano/Produto
                                    <i data-lucide={ordenacao.coluna === 'produto' ? (ordenacao.direcao === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down'} className={`w-3 h-3 ${ordenacao.coluna === 'produto' ? 'text-blue-500' : 'text-slate-300 group-hover:text-slate-400'}`}></i>
                                </div>
                            </th>
                            
                            <th onClick={() => handleOrdenar('vendedor')} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors group select-none">
                                <div className="flex items-center gap-1.5">
                                    Vendedor
                                    <i data-lucide={ordenacao.coluna === 'vendedor' ? (ordenacao.direcao === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down'} className={`w-3 h-3 ${ordenacao.coluna === 'vendedor' ? 'text-blue-500' : 'text-slate-300 group-hover:text-slate-400'}`}></i>
                                </div>
                            </th>
                            
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-center">Qtd</th>
                            
                            <th onClick={() => handleOrdenar('valor')} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-right cursor-pointer hover:bg-slate-100 transition-colors group select-none">
                                <div className="flex items-center justify-end gap-1.5">
                                    Valor Total
                                    <i data-lucide={ordenacao.coluna === 'valor' ? (ordenacao.direcao === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down'} className={`w-3 h-3 ${ordenacao.coluna === 'valor' ? 'text-blue-500' : 'text-slate-300 group-hover:text-slate-400'}`}></i>
                                </div>
                            </th>
                            
                            {podeEditar && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-center">Gestão</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {vendasOrdenadas.map((row) => {
                            const isEditing = editandoId === row.id;

                            return (
                                <tr key={row.id} className={`group transition-colors ${isEditing ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}>
                                    <td className="px-6 py-4 align-middle">
                                        {isEditing ? (
                                            <input type="date" value={dadosEdicao.data} onChange={e => handleEdicaoChange('data', e.target.value)} className="w-32 bg-white border border-blue-300 text-blue-800 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs" />
                                        ) : (
                                            <div>
                                                <p className="text-xs font-black text-slate-800 whitespace-nowrap">{formatDataBR(row.data)}</p>
                                                {row.created_at && (
                                                    <div className="flex items-center gap-1.5 mt-1 text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-200 w-max" title="Quem lançou e horário">
                                                        <i data-lucide="user-edit" className="w-3 h-3 text-blue-500"></i>
                                                        <span className="text-[9px] font-black uppercase tracking-widest">
                                                            {row.criado_por ? row.criado_por.split(' ')[0] : 'SISTEMA'} • {extrairHoraCriacao(row.created_at)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    
                                    {temVisaoGlobal && (
                                        <td className="px-6 py-4 text-xs font-black text-rose-600 bg-rose-50/10 whitespace-nowrap uppercase align-middle">
                                            {row.unidade || 'MATRIZ'}
                                        </td>
                                    )}

                                    <td className="px-6 py-4 align-middle">
                                        {isEditing ? (
                                            <div className="flex flex-col gap-2">
                                                <input type="text" placeholder="Nome do Aluno" value={dadosEdicao.nome_aluno} onChange={e => handleEdicaoChange('nome_aluno', e.target.value)} className="w-full bg-white border border-blue-300 text-blue-800 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold uppercase text-xs" />
                                                <input type="text" placeholder="Matrícula" value={dadosEdicao.matricula} onChange={e => handleEdicaoChange('matricula', e.target.value)} className="w-32 bg-white border border-blue-300 text-blue-800 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs" />
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-xs font-black text-slate-800 uppercase max-w-[200px] truncate" title={row.nome_aluno || row.nome}>{row.nome_aluno || row.nome}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">MAT: {row.matricula || '-'}</p>
                                            </div>
                                        )}
                                    </td>

                                    <td className="px-6 py-4 text-xs whitespace-nowrap uppercase font-bold text-indigo-600 align-middle">
                                        {isEditing ? (
                                            <select value={dadosEdicao.produto} onChange={e => handleEdicaoChange('produto', e.target.value)} className="w-full min-w-[150px] bg-white border border-blue-300 text-blue-800 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold uppercase cursor-pointer text-xs">
                                                <option value="" disabled>Selecione no Catálogo...</option>
                                                {catalogoGeral.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                                            </select>
                                        ) : (
                                            row.produto
                                        )}
                                    </td>

                                    <td className="px-6 py-4 text-xs whitespace-nowrap font-bold text-slate-600 uppercase align-middle">
                                        {isEditing ? (
                                            <input type="text" value={dadosEdicao.vendedor} onChange={e => handleEdicaoChange('vendedor', e.target.value)} className="w-28 bg-white border border-blue-300 text-blue-800 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold uppercase text-xs" />
                                        ) : (
                                            row.vendedor
                                        )}
                                    </td>

                                    <td className="px-6 py-4 text-xs text-center font-black text-slate-700 align-middle">
                                        {isEditing ? (
                                            <input type="number" min="1" value={dadosEdicao.quantidade} onChange={e => handleEdicaoChange('quantidade', e.target.value)} className="w-14 text-center bg-white border border-blue-300 text-blue-800 rounded-lg px-1 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs" />
                                        ) : (
                                            row.quantidade || '1'
                                        )}
                                    </td>

                                    <td className="px-6 py-4 text-xs font-black text-slate-800 whitespace-nowrap text-right align-middle">
                                        {isEditing ? (
                                            <input type="text" value={formatMoney(dadosEdicao.valorCalculado)} readOnly className="w-24 text-right bg-slate-100 border border-slate-300 text-slate-500 rounded-lg px-2 py-1.5 cursor-not-allowed font-black text-xs" title="O valor calcula sozinho" />
                                        ) : (
                                            formatMoney(row.valor)
                                        )}
                                    </td>

                                    {podeEditar && (
                                        <td className="px-6 py-4 text-center align-middle w-32">
                                            {isEditing ? (
                                                <div className="flex flex-col gap-2 items-center justify-center">
                                                    <button onClick={() => salvarEdicao(row.id)} title="Salvar Alterações" className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                                                        <i data-lucide="check" className="w-3.5 h-3.5"></i> Salvar
                                                    </button>
                                                    <button onClick={cancelarEdicao} title="Cancelar" className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 bg-slate-200 text-slate-600 hover:bg-slate-300 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                                                        <i data-lucide="x" className="w-3.5 h-3.5"></i> Cancelar
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => iniciarEdicao(row)} className="flex items-center justify-center gap-1.5 px-3 py-1.5 w-24 bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                                                        <i data-lucide="edit-3" className="w-3.5 h-3.5"></i> Editar
                                                    </button>
                                                    <button onClick={() => removerLancamento(row.id)} className="flex items-center justify-center gap-1.5 px-3 py-1.5 w-24 bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                                                        <i data-lucide="trash-2" className="w-3.5 h-3.5"></i> Excluir
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
                                <td colSpan={temVisaoGlobal ? "8" : "7"} className="px-6 py-16 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                    <i data-lucide="filter-x" className="w-10 h-10 mx-auto text-slate-300 mb-4 opacity-50"></i>
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