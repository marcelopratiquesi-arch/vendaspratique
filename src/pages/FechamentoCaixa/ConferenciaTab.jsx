import React, { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { formatMoney, formatDataBR, formatarDataHora } from './utils.js';
import { Copy, Check, Edit3, Trash2, CheckSquare, FileSpreadsheet, Clock, ShieldCheck, ChevronUp, ChevronDown, ChevronsUpDown, X, Save, Loader2, Search, AlertCircle } from 'lucide-react';

// ==========================================
// 🧩 FORMATADOR SEGURO DE CPF E NOME (INLINE)
// ==========================================
const maskCPF = (val) => {
    let v = String(val).replace(/\D/g, '');
    if (v.length > 11) v = v.substring(0, 11);
    if (v.length > 9) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
    if (v.length > 6) return v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    if (v.length > 3) return v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
    return v;
};

// ==========================================
// 🧩 SUB-COMPONENTE: Célula Copiável (CPF e NOME)
// ==========================================
const CopiableCell = ({ text, isCpf }) => {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = () => {
        if (!text || text === '-') return;
        const textToCopy = isCpf ? String(text).replace(/\D/g, '') : text;
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatTexto = () => {
        if (!text || text === '-') return '-';
        if (isCpf) return maskCPF(text);
        return text;
    };

    const displayText = formatTexto();
    
    return (
        <div className="flex items-center gap-2 group/copy">
            <span className={`truncate max-w-[150px] ${isCpf ? 'font-mono font-bold tracking-tight text-slate-700' : 'font-black text-slate-800 uppercase'}`} title={displayText}>
                {displayText}
            </span>
            {text && text !== '-' && (
                <button 
                    onClick={handleCopy} 
                    className="opacity-0 group-hover/copy:opacity-100 p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 rounded-md transition-all shadow-sm border border-transparent hover:border-blue-200"
                    title="Copiar dado"
                >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
            )}
        </div>
    );
};

// ==========================================
// 🚀 COMPONENTE PRINCIPAL
// ==========================================
const ConferenciaTab = ({
    vendasParaConferencia = [], 
    catalogoCompleto = [], 
    temVisaoGlobal, 
    colunasVisiveis,
    usuarioLogado,
    marcarTodosConferidos, 
    toggleConferido, 
    handleObsLocalChange, 
    handleObsSaveDb,
    onSalvarEdicao, 
    onExcluirVenda  
}) => {
    // FILTROS AVANÇADOS PREMIUM
    const [vendedoresOcultos, setVendedoresOcultos] = useState([]);
    const [planosOcultos, setPlanosOcultos] = useState([]);
    const [produtosOcultos, setProdutosOcultos] = useState([]);
    const [servicosOcultos, setServicosOcultos] = useState([]);
    
    const [filtroVendedor, setFiltroVendedor] = useState('TODOS');
    const [filtroPlano, setFiltroPlano] = useState('TODOS');
    const [filtroProduto, setFiltroProduto] = useState('TODOS');
    const [filtroServico, setFiltroServico] = useState('TODOS');

    // ESTADOS DO MODAL POP-UP
    const [vendaEmEdicao, setVendaEmEdicao] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [buscandoCpf, setBuscandoCpf] = useState(false);
    const debounceRef = useRef(null);

    // 1. INTELIGÊNCIA DO CATÁLOGO E LISTAS ÚNICAS
    const { vendasCategorizadas, listasUnicas } = useMemo(() => {
        const vendedores = new Set();
        const planos = new Set();
        const produtos = new Set();
        const servicos = new Set();

        const categorizadas = vendasParaConferencia.map(v => {
            if (v.vendedor) vendedores.add(v.vendedor.trim().toUpperCase());
            
            const nomeItem = String(v.produto || '').toUpperCase().trim();
            const itemCatalogo = catalogoCompleto.find(c => c.nome?.toUpperCase().trim() === nomeItem);
            
            const categoria = itemCatalogo && itemCatalogo.tipo ? itemCatalogo.tipo.toLowerCase().trim() : 'produto'; 

            if (categoria === 'plano') planos.add(nomeItem);
            else if (categoria === 'produto') produtos.add(nomeItem);
            else if (categoria === 'servico' || categoria === 'serviço') servicos.add(nomeItem);

            return { ...v, categoriaReal: categoria };
        });

        return {
            vendasCategorizadas: categorizadas,
            listasUnicas: {
                vendedores: Array.from(vendedores).sort(),
                planos: Array.from(planos).sort(),
                produtos: Array.from(produtos).sort(),
                servicos: Array.from(servicos).sort()
            }
        };
    }, [vendasParaConferencia, catalogoCompleto]);

    // 2. APLICAÇÃO DOS FILTROS INTELIGENTES
    const vendasFiltradas = useMemo(() => {
        return vendasCategorizadas.filter(v => {
            const vendUpper = String(v.vendedor || '').trim().toUpperCase();
            const prodUpper = String(v.produto || '').trim().toUpperCase();

            // Filtros de Ocultação
            if (vendedoresOcultos.includes(vendUpper)) return false;
            if (v.categoriaReal === 'plano' && planosOcultos.includes(prodUpper)) return false;
            if (v.categoriaReal === 'produto' && produtosOcultos.includes(prodUpper)) return false;
            if ((v.categoriaReal === 'servico' || v.categoriaReal === 'serviço') && servicosOcultos.includes(prodUpper)) return false;

            // Filtros Ativos (Dropdowns)
            const passVendedor = filtroVendedor === 'TODOS' || v.vendedor === filtroVendedor;
            const passPlano = filtroPlano === 'TODOS' || (v.categoriaReal === 'plano' && v.produto === filtroPlano);
            const passProduto = filtroProduto === 'TODOS' || (v.categoriaReal === 'produto' && v.produto === filtroProduto);
            const passServico = filtroServico === 'TODOS' || ((v.categoriaReal === 'servico' || v.categoriaReal === 'serviço') && v.produto === filtroServico);

            if (filtroPlano !== 'TODOS' || filtroProduto !== 'TODOS' || filtroServico !== 'TODOS') {
                return passVendedor && (
                    (filtroPlano !== 'TODOS' && passPlano) ||
                    (filtroProduto !== 'TODOS' && passProduto) ||
                    (filtroServico !== 'TODOS' && passServico)
                );
            }
            return passVendedor;
        });
    }, [vendasCategorizadas, vendedoresOcultos, planosOcultos, produtosOcultos, servicosOcultos, filtroVendedor, filtroPlano, filtroProduto, filtroServico]);

    const valorTotalFiltrado = vendasFiltradas.reduce((acc, v) => acc + (Number(v.valor) || 0), 0);

    // 3. MOTOR DE ORDENAÇÃO
    const [sortConfig, setSortConfig] = useState({ key: 'data', direction: 'desc' });

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
        return sortConfig.direction === 'asc' 
            ? <ChevronUp className="w-3 h-3 text-indigo-600" />
            : <ChevronDown className="w-3 h-3 text-indigo-600" />;
    };

    const sortedVendas = [...vendasFiltradas].sort((a, b) => {
        if (!sortConfig.key) return 0;
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        if (sortConfig.key === 'data') {
            valA = new Date(valA).getTime() || 0;
            valB = new Date(valB).getTime() || 0;
        } else if (sortConfig.key === 'valor' || sortConfig.key === 'quantidade') {
            valA = Number(valA) || 0;
            valB = Number(valB) || 0;
        } else {
            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // 4. MOTOR DE DRAG-TO-SCROLL (MÃOZINHA)
    const scrollRef = useRef(null);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);

    const onMouseDown = (e) => {
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('.no-drag')) return;
        isDragging.current = true;
        scrollRef.current.classList.add('cursor-grabbing');
        scrollRef.current.classList.remove('cursor-grab');
        startX.current = e.pageX - scrollRef.current.offsetLeft;
        scrollLeft.current = scrollRef.current.scrollLeft;
    };

    const onMouseLeaveOrUp = () => {
        isDragging.current = false;
        if (scrollRef.current) {
            scrollRef.current.classList.remove('cursor-grabbing');
            scrollRef.current.classList.add('cursor-grab');
        }
    };

    const onMouseMove = (e) => {
        if (!isDragging.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX.current) * 1.5;
        scrollRef.current.scrollLeft = scrollLeft.current - walk;
    };

    // 5. EXPORTAÇÃO EXCEL (CPF formatado como Texto, e Colunas Ajustadas)
    const exportarParaExcel = () => {
        if (sortedVendas.length === 0) {
            alert("Não há dados para exportar com os filtros atuais.");
            return;
        }

        const BOM = '\uFEFF'; 
        const headers = ['Data da Venda', 'Unidade', 'CPF', 'Nome do Aluno', 'Item Vendido', 'Categoria', 'Vendedor', 'Quantidade', 'Valor', 'Observação', 'Status'];

        const rows = sortedVendas.map(v => [
            formatDataBR(v.data),
            v.unidade || 'MATRIZ',
            v.cpf ? maskCPF(v.cpf) : '-', // Mantém a máscara para o Excel não excluir o zero
            v.nome_aluno || v.nome || '',
            v.produto || '',
            String(v.categoriaReal).toUpperCase(),
            v.vendedor || '',
            v.quantidade,
            formatMoney(v.valor), // Formato R$ para ficar correto no relatório
            String(v.observacao || '').replace(/(\r\n|\n|\r)/gm, " "), // Limpa quebras de linha
            v.conferiu ? 'CONFERIDO' : 'PENDENTE'
        ]);

        const csvContent = [
            headers.join(';'),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
        ].join('\n');

        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Auditoria_Fechamento_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ==========================================
    // 🧠 MOTOR INTELIGENTE DO MODAL POP-UP
    // ==========================================

    const buscarAlunoPorCpf = async (cpfLimpo) => {
        setBuscandoCpf(true);
        try {
            const { data, error } = await supabase.from('alunos').select('*').eq('cpf', cpfLimpo).maybeSingle();
            if (data) {
                setVendaEmEdicao(prev => ({
                    ...prev,
                    nome_aluno: data.nome,
                    nome: data.nome,
                    matricula: data.matricula || prev.matricula
                }));
            } else {
                setVendaEmEdicao(prev => ({
                    ...prev,
                    nome_aluno: 'CPF NÃO LOCALIZADO NA BASE',
                    nome: 'CPF NÃO LOCALIZADO NA BASE'
                }));
            }
        } catch (err) {
            console.error("Erro na busca de aluno:", err);
        } finally {
            setBuscandoCpf(false);
        }
    };

    const handleEdicaoChange = (field, value) => {
        let updated = { ...vendaEmEdicao, [field]: value };
        
        // 1. Ao trocar o Produto
        if (field === 'produto') {
            const itemCat = catalogoCompleto.find(c => c.nome?.toUpperCase().trim() === value?.toUpperCase().trim());
            if (itemCat) {
                const preco = Number(itemCat.valor) || 0;
                const qtd = Number(updated.quantidade) || 1;
                updated.valor = preco * qtd;
            }
        } 
        // 2. Ao trocar a Quantidade
        else if (field === 'quantidade') {
            const itemCat = catalogoCompleto.find(c => c.nome?.toUpperCase().trim() === updated.produto?.toUpperCase().trim());
            let precoUnitario = 0;
            if (itemCat) {
                precoUnitario = Number(itemCat.valor) || 0;
            } else {
                const oldQtd = Number(vendaEmEdicao.quantidade) || 1;
                precoUnitario = Number(vendaEmEdicao.valor) / oldQtd;
            }
            const qtd = Number(value) || 1;
            updated.valor = precoUnitario * qtd;
        }
        // 3. Ao digitar o CPF
        else if (field === 'cpf') {
            const masked = maskCPF(value);
            updated.cpf = masked;
            
            if (debounceRef.current) clearTimeout(debounceRef.current);
            const limpo = masked.replace(/\D/g, '');
            if (limpo.length === 11) {
                debounceRef.current = setTimeout(() => buscarAlunoPorCpf(limpo), 600);
            }
        }
        
        setVendaEmEdicao(updated);
    };

    const handleSalvarEdicao = async (e) => {
        e.preventDefault();
        
        if (vendaEmEdicao.nome_aluno === 'CPF NÃO LOCALIZADO NA BASE') {
            alert('Não é possível salvar. Por favor, insira um CPF válido e cadastrado no sistema.');
            return;
        }

        setIsSaving(true);
        try {
            if (onSalvarEdicao) await onSalvarEdicao(vendaEmEdicao);
            setVendaEmEdicao(null);
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Ocorreu um erro ao salvar a edição.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleExcluirModal = async (id) => {
        if(window.confirm('⚠️ ATENÇÃO: Tem certeza que deseja excluir esta venda do sistema? Esta ação não pode ser desfeita.')) {
            if(onExcluirVenda) {
                await onExcluirVenda(id);
                setVendaEmEdicao(null); 
            }
        }
    };

    const thClass = "px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-100 transition-colors select-none group whitespace-nowrap";

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] relative">
            
            {/* 🔥 MODAL POP-UP FLUTUANTE (BLINDADO E VALOR AUTOMÁTICO) */}
            {vendaEmEdicao && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 pointer-events-none bg-transparent">
                    <div className="bg-white rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-slate-300 w-full max-w-2xl overflow-hidden relative z-10 animate-[zoomIn_0.15s_ease-out] pointer-events-auto">
                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center cursor-move">
                            <div className="flex items-center gap-3 pointer-events-none">
                                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-200 shadow-inner">
                                    <Edit3 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none">Ajustar Lançamento</h3>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Correção direta na base de dados</p>
                                </div>
                            </div>
                            <button onClick={() => !isSaving && setVendaEmEdicao(null)} className="w-8 h-8 rounded-full bg-slate-200 hover:bg-rose-100 text-slate-500 hover:text-rose-600 flex items-center justify-center transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSalvarEdicao} className="p-6 space-y-5 bg-white">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Data da Venda</label>
                                    <input type="date" required value={vendaEmEdicao.data ? vendaEmEdicao.data.split('T')[0] : ''} onChange={(e) => handleEdicaoChange('data', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Vendedor</label>
                                    <select required value={(vendaEmEdicao.vendedor || '').toUpperCase()} onChange={(e) => handleEdicaoChange('vendedor', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none uppercase cursor-pointer">
                                        {listasUnicas.vendedores.map(v => <option key={v} value={v.toUpperCase()}>{v.toUpperCase()}</option>)}
                                    </select>
                                </div>
                                
                                {/* BLOCO ALUNO BLINDADO */}
                                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl border border-indigo-100 bg-indigo-50/30">
                                    <div className="relative">
                                        <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1.5 ml-1">CPF (Auto-Busca)</label>
                                        <input type="text" value={vendaEmEdicao.cpf || ''} onChange={(e) => handleEdicaoChange('cpf', e.target.value)} maxLength="14" placeholder="000.000.000-00" className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm pr-8" />
                                        {buscandoCpf ? <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin absolute right-2.5 top-[32px]" /> : <Search className="w-3.5 h-3.5 text-slate-300 absolute right-2.5 top-[32px]" />}
                                    </div>
                                    <div className="sm:col-span-2 relative">
                                        <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1.5 ml-1 flex items-center justify-between">
                                            Nome do Aluno
                                            <span className="text-slate-400 font-normal lowercase flex items-center gap-1"><AlertCircle className="w-3 h-3"/>Automático via CPF</span>
                                        </label>
                                        {/* 🔒 NOME BLOQUEADO READ-ONLY */}
                                        <input 
                                            type="text" 
                                            required 
                                            readOnly 
                                            value={vendaEmEdicao.nome_aluno || vendaEmEdicao.nome || ''} 
                                            className={`w-full border rounded-lg px-3 py-2 text-xs font-bold outline-none uppercase shadow-inner cursor-not-allowed ${vendaEmEdicao.nome_aluno === 'CPF NÃO LOCALIZADO NA BASE' ? 'bg-rose-50 border-rose-200 text-rose-500' : 'bg-slate-100 border-slate-200 text-slate-600'}`} 
                                        />
                                    </div>
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Item Vendido do Catálogo</label>
                                    <select 
                                        required 
                                        value={(vendaEmEdicao.produto || '').toUpperCase()} 
                                        onChange={(e) => handleEdicaoChange('produto', e.target.value)} 
                                        className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none uppercase cursor-pointer shadow-sm"
                                    >
                                        <option value="" disabled>Selecione no catálogo...</option>
                                        {catalogoCompleto && catalogoCompleto.length > 0 ? (
                                            catalogoCompleto
                                                .slice()
                                                .sort((a, b) => a.nome.localeCompare(b.nome))
                                                .map(c => (
                                                    <option key={c.id} value={c.nome.toUpperCase()}>
                                                        {c.nome.toUpperCase()} - {formatMoney(c.valor)}
                                                    </option>
                                                ))
                                        ) : (
                                            <option value={(vendaEmEdicao.produto || '').toUpperCase()}>{(vendaEmEdicao.produto || '').toUpperCase()} (Catálogo carregando...)</option>
                                        )}
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Quantidade</label>
                                    <input type="number" required min="1" value={vendaEmEdicao.quantidade || 1} onChange={(e) => handleEdicaoChange('quantidade', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div className="relative">
                                    {/* 🔒 VALOR BLINDADO READ-ONLY E FORMATADO EM REAIS */}
                                    <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1.5 ml-1 flex items-center justify-between">
                                        Valor Final Total
                                        <span className="text-emerald-500/70 font-normal lowercase flex items-center gap-1"><AlertCircle className="w-3 h-3"/>Automático</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        readOnly 
                                        value={formatMoney(vendaEmEdicao.valor || 0)} 
                                        className="w-full bg-emerald-50/50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm font-black text-emerald-700 outline-none shadow-inner cursor-not-allowed" 
                                    />
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                                <button type="button" onClick={() => handleExcluirModal(vendaEmEdicao.id)} disabled={isSaving} className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors flex items-center gap-2 border border-transparent hover:border-rose-200">
                                    <Trash2 className="w-4 h-4" /> Excluir Venda
                                </button>
                                
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setVendaEmEdicao(null)} disabled={isSaving} className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50">
                                        Cancelar
                                    </button>
                                    <button type="submit" disabled={isSaving} className="px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all flex items-center gap-2 disabled:opacity-50">
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* PAINEL DE FILTROS BÁSICOS E EXPORTAÇÃO */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex flex-col xl:flex-row justify-between items-end gap-6">
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full xl:w-auto flex-1">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Vendedor</label>
                            <select value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer uppercase">
                                <option value="TODOS">TODOS OS VENDEDORES</option>
                                {listasUnicas.vendedores.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1.5 ml-1">Planos de Assinatura</label>
                            <select value={filtroPlano} onChange={(e) => { setFiltroPlano(e.target.value); setFiltroProduto('TODOS'); setFiltroServico('TODOS'); }} className="w-full bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer uppercase">
                                <option value="TODOS">TODOS OS PLANOS</option>
                                {listasUnicas.planos.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1.5 ml-1">Produtos Físicos</label>
                            <select value={filtroProduto} onChange={(e) => { setFiltroProduto(e.target.value); setFiltroPlano('TODOS'); setFiltroServico('TODOS'); }} className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer uppercase">
                                <option value="TODOS">TODOS OS PRODUTOS</option>
                                {listasUnicas.produtos.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-violet-500 uppercase tracking-widest mb-1.5 ml-1">Serviços Avulsos</label>
                            <select value={filtroServico} onChange={(e) => { setFiltroServico(e.target.value); setFiltroPlano('TODOS'); setFiltroProduto('TODOS'); }} className="w-full bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-xs font-bold text-violet-700 focus:ring-2 focus:ring-violet-500 outline-none cursor-pointer uppercase">
                                <option value="TODOS">TODOS OS SERVIÇOS</option>
                                {listasUnicas.servicos.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-end gap-3 w-full xl:w-auto">
                        <div className="bg-indigo-50 border border-indigo-100 px-6 py-3.5 rounded-2xl flex flex-col items-end shadow-sm w-full sm:w-auto">
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Valor Filtrado</span>
                            <span className="text-3xl font-black text-indigo-700 tracking-tight leading-none mt-1">{formatMoney(valorTotalFiltrado)}</span>
                        </div>
                        
                        <div className="flex gap-2 w-full sm:w-auto h-full">
                            <button 
                                onClick={exportarParaExcel} 
                                disabled={sortedVendas.length === 0} 
                                className="flex-1 sm:flex-none bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white border border-emerald-200 hover:border-emerald-600 disabled:opacity-50 text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 h-full"
                            >
                                <FileSpreadsheet className="w-4 h-4" /> Exportar
                            </button>

                            {usuarioLogado?.role === 'ADMIN' && (
                                <button 
                                    onClick={() => {
                                        const ids = vendasFiltradas.map(v => v.id);
                                        marcarTodosConferidos(ids);
                                    }} 
                                    disabled={vendasFiltradas.length === 0} 
                                    className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 h-full"
                                >
                                    <CheckSquare className="w-4 h-4" /> Conferir Tela
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* TABELA DE CONFERÊNCIA */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-6">
                <div className="bg-slate-100 text-slate-600 px-4 py-2 border-b border-slate-200 shadow-inner text-right text-[10px] font-black uppercase tracking-widest">
                    {sortedVendas.length} de {vendasParaConferencia.length} Registros
                </div>
                <div 
                    className="overflow-x-auto custom-scrollbar cursor-grab"
                    ref={scrollRef}
                    onMouseDown={onMouseDown}
                    onMouseLeave={onMouseLeaveOrUp}
                    onMouseUp={onMouseLeaveOrUp}
                    onMouseMove={onMouseMove}
                >
                    <table className="w-full text-left border-collapse min-w-max">
                        <thead>
                            <tr>
                                <th onClick={() => requestSort('data')} className={thClass}>
                                    <div className="flex items-center gap-1.5">Data {getSortIcon('data')}</div>
                                </th>
                                {temVisaoGlobal && (
                                    <th onClick={() => requestSort('unidade')} className={`${thClass} !bg-rose-50/20 !text-rose-500`}>
                                        <div className="flex items-center gap-1.5">Unidade {getSortIcon('unidade')}</div>
                                    </th>
                                )}
                                <th onClick={() => requestSort('cpf')} className={thClass}>
                                    <div className="flex items-center gap-1.5">CPF {getSortIcon('cpf')}</div>
                                </th>
                                <th onClick={() => requestSort('nome')} className={thClass}>
                                    <div className="flex items-center gap-1.5">Aluno {getSortIcon('nome')}</div>
                                </th>
                                <th onClick={() => requestSort('produto')} className={thClass}>
                                    <div className="flex items-center gap-1.5">Item {getSortIcon('produto')}</div>
                                </th>
                                <th onClick={() => requestSort('vendedor')} className={thClass}>
                                    <div className="flex items-center gap-1.5">Vendedor {getSortIcon('vendedor')}</div>
                                </th>
                                <th onClick={() => requestSort('quantidade')} className={`${thClass} text-center`}>
                                    <div className="flex items-center justify-center gap-1.5">Qtd {getSortIcon('quantidade')}</div>
                                </th>
                                <th onClick={() => requestSort('valor')} className={`${thClass} text-right`}>
                                    <div className="flex items-center justify-end gap-1.5">Valor {getSortIcon('valor')}</div>
                                </th>
                                <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 bg-slate-50/50 w-48 whitespace-nowrap">
                                    Observação de Caixa
                                </th>
                                <th onClick={() => requestSort('conferiu')} className={`${thClass} text-center`}>
                                    <div className="flex items-center justify-center gap-1.5">Status {getSortIcon('conferiu')}</div>
                                </th>
                                <th className={`${thClass} text-center border-l border-slate-200 sticky right-0 bg-white z-10 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)]`}>
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {sortedVendas.length > 0 ? sortedVendas.map((v) => (
                                <tr key={v.id} className={`transition-colors ${v.conferiu ? 'bg-emerald-50/20' : 'hover:bg-slate-50'}`}>
                                    <td className="px-5 py-4 text-xs font-semibold text-slate-500 whitespace-nowrap align-middle">
                                        {formatDataBR(v.data)}
                                    </td>
                                    {temVisaoGlobal && (
                                        <td className="px-5 py-4 text-xs font-black text-rose-600 bg-rose-50/5 whitespace-nowrap uppercase align-middle">
                                            {v.unidade || 'MATRIZ'}
                                        </td>
                                    )}
                                    <td className="px-5 py-4 align-middle no-drag">
                                        <CopiableCell text={v.cpf} isCpf={true} />
                                    </td>
                                    <td className="px-5 py-4 align-middle no-drag">
                                        <CopiableCell text={v.nome_aluno || v.nome} isCpf={false} />
                                    </td>
                                    <td className="px-5 py-4 text-xs font-bold text-indigo-600 uppercase align-middle whitespace-nowrap">
                                        {v.produto}
                                    </td>
                                    <td className="px-5 py-4 text-xs font-bold text-slate-600 uppercase align-middle whitespace-nowrap">
                                        {v.vendedor}
                                    </td>
                                    <td className="px-5 py-4 text-xs font-black text-slate-700 text-center align-middle">
                                        {v.quantidade}
                                    </td>
                                    <td className="px-5 py-4 text-xs font-black text-slate-800 text-right whitespace-nowrap align-middle">
                                        {formatMoney(v.valor)}
                                    </td>
                                    
                                    <td className="px-5 py-2 align-middle no-drag">
                                        <input 
                                            type="text"
                                            value={v.observacao || ''}
                                            onChange={(e) => handleObsLocalChange(v.id, e.target.value)}
                                            onBlur={(e) => handleObsSaveDb(v.id, e.target.value)}
                                            placeholder="Digitar nota..."
                                            className={`w-full text-xs font-medium px-3 py-2 rounded-lg outline-none transition-all ${v.observacao ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-transparent hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-500 border border-transparent focus:border-indigo-200'}`}
                                        />
                                    </td>
                                    
                                    <td className="px-5 py-4 text-center align-middle no-drag">
                                        <button 
                                            onClick={() => toggleConferido(v.id, v.conferiu)}
                                            className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-1.5 w-24 mx-auto ${v.conferiu ? 'bg-emerald-500 text-white border border-emerald-600 hover:bg-emerald-600' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-100 hover:text-slate-600'}`}
                                        >
                                            {v.conferiu ? <><Check className="w-3 h-3"/> OK</> : <><Clock className="w-3 h-3"/> Pendente</>}
                                        </button>
                                    </td>
                                    
                                    {/* AÇÕES DE EDITAR/EXCLUIR */}
                                    <td className={`px-5 py-4 text-center align-middle no-drag border-l border-slate-100 sticky right-0 z-10 ${v.conferiu ? 'bg-emerald-50/90' : 'bg-white'}`}>
                                        <div className="flex items-center justify-center gap-2">
                                            <button 
                                                onClick={() => setVendaEmEdicao(v)} 
                                                title="Editar Registro"
                                                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-lg transition-all border border-indigo-200 hover:border-indigo-600 text-[9px] font-black uppercase tracking-widest shadow-sm"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" /> Editar
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    if(window.confirm('⚠️ ATENÇÃO: Tem certeza que deseja excluir esta venda do sistema? Esta ação não pode ser desfeita.')) {
                                                        if(onExcluirVenda) onExcluirVenda(v.id);
                                                    }
                                                }} 
                                                title="Excluir Registro"
                                                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-lg transition-all border border-rose-200 hover:border-rose-600 text-[9px] font-black uppercase tracking-widest shadow-sm"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" /> Excluir
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="100%" className="text-center py-16 text-slate-400 text-[10px] font-bold uppercase tracking-widest bg-slate-50/30">
                                        Nenhuma venda encontrada no filtro.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ConferenciaTab;