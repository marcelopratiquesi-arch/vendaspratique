import React, { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { formatMoney, formatDataBR, formatarDataHora } from './utils.js';
import { itensCatalogoParaEdicao } from '../HistoricoVendas/utils.js';
import { Copy, Check, Edit3, Trash2, CheckSquare, FileSpreadsheet, Clock, ShieldCheck, ChevronUp, ChevronDown, ChevronsUpDown, X, Save, Loader2, Search, AlertCircle, User } from 'lucide-react';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';

// ==========================================
// 🧩 FORMATADOR SEGURO DE CPF E NOME
// ==========================================
const maskCPF = (val) => {
    let v = String(val).replace(/\D/g, '');
    if (v.length > 11) v = v.substring(0, 11);
    if (v.length > 9) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
    if (v.length > 6) return v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    if (v.length > 3) return v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
    return v;
};

// Pega apenas o 1º e 2º nome, ignorando "de", "da", "do"
const shortName = (name) => {
    if (!name || name === '-') return '-';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length <= 1) return name;
    const filtered = parts.filter(p => !['de', 'da', 'do', 'dos', 'das'].includes(p.toLowerCase()));
    if (filtered.length >= 2) return `${filtered[0]} ${filtered[1]}`;
    return name;
};

// ==========================================
// 🧩 SUB-COMPONENTE: Célula Copiável
// ==========================================
const CopiableCell = ({ text, isCpf, customClass }) => {
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
        <div className={`flex items-center gap-2 group/copy w-fit ${isCpf ? 'mt-0.5' : ''}`}>
            <span className={`truncate max-w-[180px] ${customClass}`} title={displayText}>
                {displayText}
            </span>
            {text && text !== '-' && (
                <button 
                    onClick={handleCopy} 
                    className="opacity-0 group-hover/copy:opacity-100 p-1 bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 rounded transition-all shadow-sm border border-transparent hover:border-blue-200 dark:bg-slate-800 dark:hover:bg-blue-500/20 dark:hover:text-blue-400 dark:hover:border-blue-500/30"
                    title={tx("Copiar dado")}
                >
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
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

    // ==========================================
    // 3. MOTOR DE ORDENAÇÃO
    // ==========================================
    const [sortConfig, setSortConfig] = useState({ key: 'data', direction: 'desc' });

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
        return sortConfig.direction === 'asc' 
            ? <ChevronUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            : <ChevronDown className="w-3 h-3 text-blue-600 dark:text-blue-400" />;
    };

    const sortedVendas = useMemo(() => {
        let itemsSort = [...vendasFiltradas];
        itemsSort.sort((a, b) => {
            if (!sortConfig.key) return 0;
            let valA, valB;

            switch (sortConfig.key) {
                case 'data':
                    valA = new Date(a.data || 0).getTime();
                    valB = new Date(b.data || 0).getTime();
                    break;
                case 'nome':
                    valA = String(a.nome_aluno || a.nome || '').toLowerCase();
                    valB = String(b.nome_aluno || b.nome || '').toLowerCase();
                    break;
                case 'cpf':
                    valA = String(a.cpf || '').replace(/\D/g, '');
                    valB = String(b.cpf || '').replace(/\D/g, '');
                    break;
                case 'produto':
                    valA = String(a.produto || '').toLowerCase();
                    valB = String(b.produto || '').toLowerCase();
                    break;
                case 'vendedor':
                    valA = String(a.vendedor || '').toLowerCase();
                    valB = String(b.vendedor || '').toLowerCase();
                    break;
                case 'unidade':
                    valA = String(a.unidade || 'MATRIZ').toLowerCase();
                    valB = String(b.unidade || 'MATRIZ').toLowerCase();
                    break;
                case 'valor':
                    valA = Number(a.valor) || 0;
                    valB = Number(b.valor) || 0;
                    break;
                case 'quantidade':
                    valA = Number(a.quantidade) || 0;
                    valB = Number(b.quantidade) || 0;
                    break;
                case 'conferiu':
                    valA = a.conferiu ? 1 : 0;
                    valB = b.conferiu ? 1 : 0;
                    break;
                default:
                    valA = String(a[sortConfig.key] || '').toLowerCase();
                    valB = String(b[sortConfig.key] || '').toLowerCase();
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return itemsSort;
    }, [vendasFiltradas, sortConfig]);

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

    // 5. EXPORTAÇÃO EXCEL
    const exportarParaExcel = () => {
        if (sortedVendas.length === 0) {
            avisar(tx("Não há dados para exportar com os filtros atuais."));
            return;
        }

        const BOM = '\uFEFF'; 
        const headers = ['Data da Venda', 'Unidade', 'CPF', 'Nome do Aluno', 'Item Vendido', 'Categoria', 'Vendedor', 'Quantidade', 'Valor', 'Observação', 'Status'];

        const rows = sortedVendas.map(v => [
            formatDataBR(v.data),
            v.unidade || 'MATRIZ',
            v.cpf ? maskCPF(v.cpf) : '-',
            v.nome_aluno || v.nome || '',
            v.produto || '',
            String(v.categoriaReal).toUpperCase(),
            v.vendedor || '',
            v.quantidade,
            formatMoney(v.valor), 
            String(v.observacao || '').replace(/(\r\n|\n|\r)/gm, " "),
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

    // MOTOR DO MODAL POP-UP
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
        
        if (field === 'produto') {
            const itemCat = catalogoCompleto.find(c => c.nome?.toUpperCase().trim() === value?.toUpperCase().trim());
            if (itemCat) {
                const preco = Number(itemCat.valor) || 0;
                const qtd = Number(updated.quantidade) || 1;
                updated.valor = preco * qtd;
            }
        } 
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
            avisar(tx("Não é possível salvar. Por favor, insira um CPF válido e cadastrado no sistema."));
            return;
        }
        setIsSaving(true);
        try {
            if (onSalvarEdicao) await onSalvarEdicao(vendaEmEdicao);
            setVendaEmEdicao(null);
        } catch (error) {
            console.error("Erro ao salvar:", error);
            avisar(tx("Ocorreu um erro ao salvar a edição."));
        } finally {
            setIsSaving(false);
        }
    };

    const handleExcluirModal = async (id) => {
        if(window.confirm(tx("⚠️ ATENÇÃO: Tem certeza que deseja excluir esta venda? Ela vai para a lixeira (o Admin ou o Mentor pode restaurar) e será pedido o motivo."))) {
            if(onExcluirVenda) {
                // Só fecha a janela se a venda foi mesmo excluída (a pessoa pode cancelar o motivo)
                const excluiu = await onExcluirVenda(id);
                if (excluiu !== false) setVendaEmEdicao(null);
            }
        }
    };

    const thClass = "px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 bg-slate-50/50 select-none group whitespace-nowrap align-top dark:border-slate-800 dark:bg-slate-800/40";

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] relative">
            
            {/* 🔥 MODAL POP-UP FLUTUANTE */}
            {vendaEmEdicao && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 pointer-events-none bg-transparent">
                    <div className="bg-white rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-slate-300 w-full max-w-2xl overflow-hidden relative z-10 animate-[zoomIn_0.15s_ease-out] pointer-events-auto dark:bg-slate-900 dark:border-slate-700">
                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center cursor-move dark:border-slate-800 dark:bg-slate-800/60">
                            <div className="flex items-center gap-3 pointer-events-none">
                                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center border border-blue-200 shadow-inner dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30">
                                    <Edit3 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none dark:text-white">{tx("Ajustar Lançamento")}</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{tx("Correção direta na base de dados")}</p>
                                </div>
                            </div>
                            <button onClick={() => !isSaving && setVendaEmEdicao(null)} className="w-8 h-8 rounded-full bg-slate-200 hover:bg-rose-100 text-slate-500 hover:text-rose-600 flex items-center justify-center transition-colors dark:bg-slate-700 dark:hover:bg-rose-500/20 dark:text-slate-400 dark:hover:text-rose-400">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSalvarEdicao} className="p-6 space-y-5 bg-white dark:bg-slate-900">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 dark:text-slate-400">{tx("Data da Venda")}</label>
                                    <input type="date" required value={vendaEmEdicao.data ? vendaEmEdicao.data.split('T')[0] : ''} onChange={(e) => handleEdicaoChange('data', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer dark:bg-slate-800/60 dark:border-slate-800 dark:text-slate-200" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 dark:text-slate-400">{tx("Vendedor")}</label>
                                    <select required value={(vendaEmEdicao.vendedor || '').toUpperCase()} onChange={(e) => handleEdicaoChange('vendedor', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none uppercase cursor-pointer dark:bg-slate-800/60 dark:border-slate-800 dark:text-slate-200">
                                        {listasUnicas.vendedores.map(v => <option key={v} value={v.toUpperCase()}>{v.toUpperCase()}</option>)}
                                    </select>
                                </div>
                                
                                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl border border-blue-100 bg-blue-50/30 dark:border-blue-500/30 dark:bg-blue-500/10">
                                    <div className="relative">
                                        <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5 ml-1 dark:text-blue-400">{tx("CPF (Auto-Busca)")}</label>
                                        <input type="text" value={vendaEmEdicao.cpf || ''} onChange={(e) => handleEdicaoChange('cpf', e.target.value)} maxLength="14" placeholder="000.000.000-00" className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm pr-8 dark:bg-slate-900 dark:border-blue-500/30 dark:text-slate-200" />
                                        {buscandoCpf ? <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin absolute right-2.5 top-[32px]" /> : <Search className="w-3.5 h-3.5 text-slate-300 absolute right-2.5 top-[32px]" />}
                                    </div>
                                    <div className="sm:col-span-2 relative">
                                        <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5 ml-1 flex items-center justify-between dark:text-blue-400">
                                            {tx("Nome do Aluno")}
                                            <span className="text-slate-400 font-normal lowercase flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{tx("Automático")}</span>
                                        </label>
                                        <input 
                                            type="text" required readOnly 
                                            value={vendaEmEdicao.nome_aluno || vendaEmEdicao.nome || ''} 
                                            className={`w-full border rounded-lg px-3 py-2 text-xs font-bold outline-none uppercase shadow-inner cursor-not-allowed ${vendaEmEdicao.nome_aluno === 'CPF NÃO LOCALIZADO NA BASE' ? 'bg-rose-50 border-rose-200 text-rose-500 dark:bg-rose-500/10 dark:border-rose-500/30' : 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-300'}`} 
                                        />
                                    </div>
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 dark:text-slate-400">{tx("Item Vendido do Catálogo")}</label>
                                    <select 
                                        required 
                                        value={(vendaEmEdicao.produto || '').toUpperCase()} 
                                        onChange={(e) => handleEdicaoChange('produto', e.target.value)} 
                                        className="w-full bg-white border border-blue-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none uppercase cursor-pointer shadow-sm dark:bg-slate-900 dark:border-blue-500/30 dark:text-slate-200"
                                    >
                                        <option value="" disabled>{tx("Selecione no catálogo...")}</option>
                                        {catalogoCompleto && catalogoCompleto.length > 0 ? (
                                            // Só itens ativos + o item que a venda já tinha (mesmo desativado), regra única do Histórico
                                            itensCatalogoParaEdicao(catalogoCompleto, (vendasParaConferencia.find(x => x.id === vendaEmEdicao.id) || vendaEmEdicao).produto)
                                                .sort((a, b) => a.nome.localeCompare(b.nome)).map(c => (
                                                <option key={c.id} value={c.nome.toUpperCase()}>
                                                    {c.nome.toUpperCase()}{c.foraDoCatalogo ? '' : ` - ${formatMoney(c.valor)}`}{c.desativado ? ` ${tx('(desativado)')}` : ''}
                                                </option>
                                            ))
                                        ) : (
                                            <option value={(vendaEmEdicao.produto || '').toUpperCase()}>{(vendaEmEdicao.produto || '').toUpperCase()}{' '}{tx("(Carregando...)")}</option>
                                        )}
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 dark:text-slate-400">{tx("Quantidade")}</label>
                                    <input type="number" required min="1" value={vendaEmEdicao.quantidade || 1} onChange={(e) => handleEdicaoChange('quantidade', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none dark:bg-slate-800/60 dark:border-slate-800 dark:text-slate-200" />
                                </div>
                                <div className="relative">
                                    <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1.5 ml-1 flex items-center justify-between dark:text-emerald-400">
                                        {tx("Valor Final Total")}
                                        <span className="text-emerald-500/70 font-normal lowercase flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{tx("Automático")}</span>
                                    </label>
                                    <input 
                                        type="text" readOnly 
                                        value={formatMoney(vendaEmEdicao.valor || 0)} 
                                        className="w-full bg-emerald-50/50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm font-black text-emerald-700 outline-none shadow-inner cursor-not-allowed dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400" 
                                    />
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-100 flex justify-between items-center dark:border-slate-800">
                                <button type="button" onClick={() => handleExcluirModal(vendaEmEdicao.id)} disabled={isSaving} className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors flex items-center gap-2 border border-transparent hover:border-rose-200 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 dark:hover:border-rose-500/30">
                                    <Trash2 className="w-4 h-4" />{' '}{tx("Excluir Venda")}
                                </button>
                                
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setVendaEmEdicao(null)} disabled={isSaving} className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800">
                                        {tx("Cancelar")}
                                    </button>
                                    <button type="submit" disabled={isSaving} className="px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all flex items-center gap-2 disabled:opacity-50">
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{' '}{tx("Salvar")}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* PAINEL DE FILTROS BÁSICOS E EXPORTAÇÃO */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex flex-col xl:flex-row justify-between items-end gap-6">
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full xl:w-auto flex-1">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 dark:text-slate-400">{tx("Vendedor")}</label>
                            <select value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer uppercase dark:bg-slate-800/60 dark:border-slate-800 dark:text-slate-200">
                                <option value="TODOS">{tx("TODOS OS VENDEDORES")}</option>
                                {listasUnicas.vendedores.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1.5 ml-1">{tx("Planos de Assinatura")}</label>
                            <select value={filtroPlano} onChange={(e) => { setFiltroPlano(e.target.value); setFiltroProduto('TODOS'); setFiltroServico('TODOS'); }} className="w-full bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer uppercase dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400">
                                <option value="TODOS">{tx("TODOS OS PLANOS")}</option>
                                {listasUnicas.planos.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1.5 ml-1">{tx("Produtos Físicos")}</label>
                            <select value={filtroProduto} onChange={(e) => { setFiltroProduto(e.target.value); setFiltroPlano('TODOS'); setFiltroServico('TODOS'); }} className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer uppercase dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400">
                                <option value="TODOS">{tx("TODOS OS PRODUTOS")}</option>
                                {listasUnicas.produtos.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-violet-500 uppercase tracking-widest mb-1.5 ml-1">{tx("Serviços Avulsos")}</label>
                            <select value={filtroServico} onChange={(e) => { setFiltroServico(e.target.value); setFiltroPlano('TODOS'); setFiltroProduto('TODOS'); }} className="w-full bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-xs font-bold text-violet-700 focus:ring-2 focus:ring-violet-500 outline-none cursor-pointer uppercase dark:bg-violet-500/10 dark:border-violet-500/30 dark:text-violet-400">
                                <option value="TODOS">{tx("TODOS OS SERVIÇOS")}</option>
                                {listasUnicas.servicos.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-end gap-3 w-full xl:w-auto">
                        <div className="bg-blue-50 border border-blue-100 px-6 py-3.5 rounded-2xl flex flex-col items-end shadow-sm w-full sm:w-auto dark:bg-blue-500/10 dark:border-blue-500/30">
                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{tx("Valor Filtrado")}</span>
                            <span className="text-3xl font-black text-blue-700 tracking-tight leading-none mt-1 dark:text-blue-400">{formatMoney(valorTotalFiltrado)}</span>
                        </div>
                        
                        <div className="flex flex-col gap-2 w-full sm:w-36 shrink-0 h-full justify-end">
                            {usuarioLogado?.role === 'ADMIN' && (
                                <button 
                                    onClick={() => {
                                        const ids = vendasFiltradas.map(v => v.id);
                                        marcarTodosConferidos(ids);
                                    }} 
                                    disabled={vendasFiltradas.length === 0} 
                                    className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest py-2 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                                >
                                    <CheckSquare className="w-3.5 h-3.5" />{' '}{tx("Conferir Tela")}
                                </button>
                            )}
                            <button 
                                onClick={exportarParaExcel} 
                                disabled={sortedVendas.length === 0} 
                                className="w-full bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white border border-emerald-200 hover:border-emerald-600 disabled:opacity-50 text-[10px] font-black uppercase tracking-widest py-2 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30"
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5" />{' '}{tx("Exportar")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* TABELA DE CONFERÊNCIA OTIMIZADA */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-6 dark:bg-slate-900 dark:border-slate-800">
                <div className="bg-slate-100 text-slate-600 px-4 py-2 border-b border-slate-200 shadow-inner text-right text-[10px] font-black uppercase tracking-widest dark:bg-slate-800 dark:text-slate-300 dark:border-slate-800">
                    {sortedVendas.length}{' '}{tx("de")}{' '}{vendasParaConferencia.length}{' '}{tx("Registros")}
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
                                <th className={thClass}>
                                    <div className="flex flex-col gap-2">
                                        <div onClick={() => requestSort('data')} className="flex items-center gap-1 cursor-pointer hover:text-blue-500 w-fit transition-colors">
                                            DATA {getSortIcon('data')}
                                        </div>
                                        {temVisaoGlobal && (
                                            <div onClick={() => requestSort('unidade')} className="flex items-center gap-1 cursor-pointer hover:text-rose-500 text-[10px] w-fit transition-colors">
                                                {tx("UNIDADE")}{' '}{getSortIcon('unidade')}
                                            </div>
                                        )}
                                    </div>
                                </th>
                                <th className={thClass}>
                                    <div className="flex flex-col gap-2">
                                        <div onClick={() => requestSort('nome')} className="flex items-center gap-1 cursor-pointer hover:text-blue-500 w-fit transition-colors">
                                            {tx("ALUNO")}{' '}{getSortIcon('nome')}
                                        </div>
                                        <div onClick={() => requestSort('cpf')} className="flex items-center gap-1 cursor-pointer hover:text-blue-500 text-[10px] w-fit transition-colors">
                                            CPF {getSortIcon('cpf')}
                                        </div>
                                    </div>
                                </th>
                                <th className={thClass}>
                                    <div className="flex flex-col gap-2">
                                        <div onClick={() => requestSort('produto')} className="flex items-center gap-1 cursor-pointer hover:text-blue-500 w-fit transition-colors">
                                            {tx("ITEM VENDIDO (QTD)")}{' '}{getSortIcon('produto')}
                                        </div>
                                        <div onClick={() => requestSort('vendedor')} className="flex items-center gap-1 cursor-pointer hover:text-blue-500 text-[10px] w-fit transition-colors">
                                            {tx("VENDEDOR")}{' '}{getSortIcon('vendedor')}
                                        </div>
                                    </div>
                                </th>
                                <th className={thClass}>
                                    <div className="flex flex-col gap-2">
                                        <div onClick={() => requestSort('valor')} className="flex items-center gap-1 cursor-pointer hover:text-blue-500 w-fit transition-colors">
                                            {tx("VALOR")}{' '}{getSortIcon('valor')}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px]">
                                            {tx("OBSERVAÇÃO")}
                                        </div>
                                    </div>
                                </th>
                                <th className={`${thClass} sticky right-0 z-20 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] border-l border-slate-200 dark:border-slate-800`}>
                                    <div onClick={() => requestSort('conferiu')} className="flex items-center justify-center gap-1 cursor-pointer hover:text-blue-500 w-full transition-colors">
                                        STATUS & AÇÕES {getSortIcon('conferiu')}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                            {sortedVendas.length > 0 ? sortedVendas.map((v) => (
                                <tr key={v.id} className={`transition-colors ${v.conferiu ? 'bg-emerald-50/20 dark:bg-emerald-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}>
                                    
                                    {/* DATA E UNIDADE */}
                                    <td className="px-5 py-3 align-middle whitespace-nowrap">
                                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                            {formatDataBR(v.data)}
                                        </div>
                                        {temVisaoGlobal && (
                                            <div className="text-[10px] font-black text-rose-500 uppercase mt-1">
                                                {v.unidade || tx("MATRIZ")}
                                            </div>
                                        )}
                                    </td>

                                    {/* ALUNO E CPF */}
                                    <td className="px-5 py-3 align-middle no-drag">
                                        <CopiableCell text={v.nome_aluno || v.nome} isCpf={false} customClass="text-xs font-black text-slate-800 uppercase dark:text-white" />
                                        <CopiableCell text={v.cpf} isCpf={true} customClass="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400" />
                                    </td>

                                    {/* PRODUTO, QTD E VENDEDOR */}
                                    <td className="px-5 py-3 align-middle whitespace-nowrap">
                                        <div className="text-xs font-bold text-blue-600 uppercase flex items-center gap-1.5 dark:text-blue-400">
                                            <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[10px] dark:bg-blue-500/20 dark:text-blue-300">{v.quantidade}x</span>
                                            {v.produto}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-2 bg-slate-100 w-fit px-2 py-1 rounded-md border border-slate-200 dark:bg-slate-800 dark:border-slate-800" title={v.vendedor}>
                                            <User className="w-3 h-3 text-slate-400" />
                                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest dark:text-slate-300">{shortName(v.vendedor)}</span>
                                        </div>
                                    </td>

                                    {/* VALOR E OBSERVAÇÃO */}
                                    <td className="px-5 py-3 align-middle no-drag whitespace-nowrap w-48">
                                        <div className="text-sm font-black text-slate-800 dark:text-white">
                                            {formatMoney(v.valor)}
                                        </div>
                                        <input 
                                            type="text"
                                            value={v.observacao || ''}
                                            onChange={(e) => handleObsLocalChange(v.id, e.target.value)}
                                            onBlur={(e) => handleObsSaveDb(v.id, e.target.value)}
                                            placeholder={tx("+ Add Obs")}
                                            className={`w-full max-w-[200px] text-[10px] font-medium px-2.5 py-1.5 mt-1.5 rounded-md outline-none transition-all placeholder:text-slate-400 ${v.observacao ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30' : 'bg-slate-50 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500 border border-slate-200 focus:border-blue-200 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:focus:bg-slate-900 dark:border-slate-800 dark:focus:border-blue-500/30'}`}
                                        />
                                    </td>
                                    
                                    {/* BLOCO DE STATUS E AÇÕES CONSOLIDADAS */}
                                    <td className={`px-5 py-3 align-middle no-drag border-l border-slate-100 sticky right-0 z-10 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] dark:border-slate-800 ${v.conferiu ? 'bg-emerald-50/90 dark:bg-emerald-500/10' : 'bg-white dark:bg-slate-900'}`}>
                                        <div className="flex items-center justify-center gap-3">
                                            
                                            {/* BOTÃO STATUS */}
                                            <button 
                                                onClick={() => toggleConferido(v.id, v.conferiu)}
                                                className={`px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex flex-col items-center justify-center w-28 h-12 ${v.conferiu ? 'bg-emerald-500 text-white border border-emerald-600 hover:bg-emerald-600 hover:shadow-md' : 'bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200 hover:text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30 dark:hover:text-amber-300'}`}
                                            >
                                                {v.conferiu ? <><Check className="w-4 h-4 mb-0.5"/> OK</> : <><Clock className="w-4 h-4 mb-0.5"/>{' '}{tx("PENDENTE")}</>}
                                            </button>

                                            {/* BOTÕES DE EDITAR / EXCLUIR EMPILHADOS */}
                                            <div className="flex flex-col gap-1.5">
                                                <button 
                                                    onClick={() => setVendaEmEdicao(v)} 
                                                    title={tx("Editar Registro")}
                                                    className="flex items-center justify-center gap-1 w-20 py-1 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded transition-all border border-blue-200 hover:border-blue-600 text-[10px] font-black uppercase tracking-widest dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30"
                                                >
                                                    {tx("Editar")}
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if(window.confirm(tx("⚠️ ATENÇÃO: Tem certeza que deseja excluir esta venda? Ela vai para a lixeira (o Admin ou o Mentor pode restaurar) e será pedido o motivo."))) {
                                                            if(onExcluirVenda) onExcluirVenda(v.id);
                                                        }
                                                    }} 
                                                    title={tx("Excluir Registro")}
                                                    className="flex items-center justify-center gap-1 w-20 py-1 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded transition-all border border-rose-200 hover:border-rose-600 text-[10px] font-black uppercase tracking-widest dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30"
                                                >
                                                    {tx("Apagar")}
                                                </button>
                                            </div>
                                            
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="100%" className="text-center py-16 text-slate-400 text-[10px] font-bold uppercase tracking-widest bg-slate-50/30 dark:bg-slate-800/40">
                                        {tx("Nenhuma venda encontrada no filtro.")}
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