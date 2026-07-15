import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js'; 

const AssinaturasPratique = ({ usuarioLogado, data = [], setData }) => {
    const [tipoFiltroData, setTipoFiltroData] = useState('mes'); 
    const [filtroMes, setFiltroMes] = useState('TODOS');
    const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [filtroProduto, setFiltroProduto] = useState('TODOS');
    const [filtroVendedor, setFiltroVendedor] = useState('TODOS');
    const [filtroUnidade, setFiltroUnidade] = useState('TODOS'); 

    const [catalogoGeral, setCatalogoGeral] = useState([]);
    const [editandoId, setEditandoId] = useState(null);
    const [dadosEdicao, setDadosEdicao] = useState({});

    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    const podeEditar = ['ADMIN', 'MENTOR', 'LIDER'].includes(usuarioLogado?.role);

    // ==========================================
    // TRADUTORES UNIVERSAIS (BLINDAGEM CONTRA DADOS ANTIGOS)
    // ==========================================
    const safeNumber = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const str = String(val);
        if (str.includes(',')) {
            return parseFloat(str.replace(/[^0-9,-]+/g, '').replace(',', '.')) || 0;
        }
        return parseFloat(str.replace(/[^0-9.-]+/g, '')) || 0;
    };

    const safeIsoDate = (dStr) => {
        if (!dStr) return '';
        if (dStr.includes('-')) return dStr.split('T')[0]; 
        if (dStr.includes('/')) {
            const [d, m, y] = dStr.split('/');
            return `${y}-${m}-${d}`; 
        }
        return dStr;
    };

    const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeNumber(val));
    
    const formatDataBR = (dStr) => {
        if (!dStr) return '';
        if (dStr.includes('/')) return dStr; 
        const partes = dStr.split('-');
        if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
        return dStr;
    };

    // Extrai o horário exato da criação da venda no banco (Para a Auditoria)
    const extrairHoraCriacao = (isoString) => {
        if (!isoString) return '';
        const dataObj = new Date(isoString);
        return dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    useEffect(() => {
        const fetchCatalogo = async () => {
            const { data } = await supabase.from('catalogo').select('*');
            if (data) setCatalogoGeral(data);
        };
        fetchCatalogo();
    }, []);

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [data, tipoFiltroData, filtroMes, filtroAno, filtroProduto, filtroVendedor, filtroUnidade, editandoId, catalogoGeral]);

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
        if (itemCatalogo) {
            unitario = safeNumber(itemCatalogo.valor);
        } else {
            unitario = valorNumericoBanco / qtd;
        }

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

    const produtosUnicos = ['TODOS', ...new Set(data.map(v => v.produto))].filter(Boolean);
    const vendedoresUnicos = ['TODOS', ...new Set(data.map(v => v.vendedor))].filter(Boolean);
    const unidadesUnicas = ['TODOS', ...new Set(data.map(v => v.unidade))].filter(Boolean); 
    const anosUnicos = [...new Set(data.map(v => safeIsoDate(v.data).split('-')[0]))].filter(Boolean).sort((a,b) => b-a); 
    if(anosUnicos.length === 0) anosUnicos.push(new Date().getFullYear().toString());

    const meses = [
        { val: 'TODOS', label: 'Todos os Meses' }, { val: '01', label: '01 - Janeiro' }, { val: '02', label: '02 - Fevereiro' },
        { val: '03', label: '03 - Março' }, { val: '04', label: '04 - Abril' }, { val: '05', label: '05 - Maio' },
        { val: '06', label: '06 - Junho' }, { val: '07', label: '07 - Julho' }, { val: '08', label: '08 - Agosto' },
        { val: '09', label: '09 - Setembro' }, { val: '10', label: '10 - Outubro' }, { val: '11', label: '11 - Novembro' },
        { val: '12', label: '12 - Dezembro' }
    ];

    const vendasFiltradas = data.filter(venda => {
        if (temVisaoGlobal && filtroUnidade !== 'TODOS' && venda.unidade !== filtroUnidade) return false;
        if (filtroProduto !== 'TODOS' && venda.produto !== filtroProduto) return false;
        if (filtroVendedor !== 'TODOS' && venda.vendedor !== filtroVendedor) return false;

        if (!venda.data) return false;
        
        const isoDate = safeIsoDate(venda.data);
        const partes = isoDate.split('-');
        if (partes.length !== 3) return false;
        const [y, m, d] = partes;

        if (tipoFiltroData === 'mes') {
            if (filtroMes !== 'TODOS' && m !== filtroMes) return false;
            if (filtroAno !== 'TODOS' && y !== filtroAno) return false;
        } else {
            if (dataInicio && isoDate < dataInicio) return false;
            if (dataFim && isoDate > dataFim) return false;
        }

        return true;
    });

    return (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto">
            
            <div className="bg-white rounded-[24px] border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.01)] p-6 md:p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-inner">
                            <i data-lucide="filter" className="w-5 h-5"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Filtros de Histórico</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Sincronizado em tempo real</p>
                        </div>
                    </div>
                    
                    <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-inner w-full md:w-auto">
                        <button 
                            onClick={() => setTipoFiltroData('mes')} 
                            className={`flex-1 md:w-36 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${tipoFiltroData === 'mes' ? 'bg-white shadow-sm text-blue-600 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <i data-lucide="calendar" className="w-3.5 h-3.5"></i> Mês / Ano
                        </button>
                        <button 
                            onClick={() => setTipoFiltroData('periodo')} 
                            className={`flex-1 md:w-44 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${tipoFiltroData === 'periodo' ? 'bg-white shadow-sm text-blue-600 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <i data-lucide="calendar-days" className="w-3.5 h-3.5"></i> Período Específico
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    {tipoFiltroData === 'mes' ? (
                        <>
                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Mês Ref.</label>
                                <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
                                    {meses.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Ano Ref.</label>
                                <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
                                    <option value="TODOS">Todos os Anos</option>
                                    {anosUnicos.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Data Início</label>
                                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer" />
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Data Fim</label>
                                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer" />
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">SDR / Vendedor</label>
                        <select value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer uppercase">
                            {vendedoresUnicos.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Produto / Plano</label>
                        <select value={filtroProduto} onChange={(e) => setFiltroProduto(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer uppercase">
                            {produtosUnicos.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    {temVisaoGlobal && (
                        <div className="animate-[fadeIn_0.3s_ease-out]">
                            <label className="block text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1.5 ml-1">Isolar Unidade</label>
                            <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} className="w-full bg-white border border-rose-200 rounded-xl px-3 py-2.5 text-xs font-black text-rose-700 focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer uppercase">
                                {unidadesUnicas.map(u => <option key={u} value={u}>{u === 'TODOS' ? 'TODAS AS 10 UNIDADES' : u}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden flex flex-col">
                <div className="px-6 py-5 border-b border-slate-100 bg-white flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2.5">
                            <i data-lucide="history" className="w-5 h-5 text-blue-500"></i> Registros de Vendas
                        </h2>
                    </div>
                    <div className="bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 shadow-sm">
                        {vendasFiltradas.length} de {data.length} Encontrados
                    </div>
                </div>
                
                <div className="overflow-x-auto custom-scrollbar" style={{ maxHeight: '65vh' }}>
                    <table className="w-full text-left border-collapse min-w-max">
                        <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 shadow-sm">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Data / Lançamento</th>
                                {temVisaoGlobal && <th className="px-6 py-4 text-[10px] font-black text-rose-500 uppercase tracking-widest border-b border-slate-200">Unidade</th>}
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Aluno / Matrícula</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Plano/Produto</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Vendedor</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-center">Qtd</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-right">Valor Total</th>
                                {podeEditar && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-center">Gestão</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {vendasFiltradas.map((row) => {
                                const isEditing = editandoId === row.id;

                                return (
                                    <tr key={row.id} className={`group transition-colors ${isEditing ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}>
                                        
                                        {/* COLUNA DE DATA COM O NOME DE QUEM LANÇOU! */}
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
                                                        <button 
                                                            onClick={() => iniciarEdicao(row)} 
                                                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 w-24 bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                                                        >
                                                            <i data-lucide="edit-3" className="w-3.5 h-3.5"></i> Editar
                                                        </button>
                                                        <button 
                                                            onClick={() => removerLancamento(row.id)} 
                                                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 w-24 bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                                                        >
                                                            <i data-lucide="trash-2" className="w-3.5 h-3.5"></i> Excluir
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            
                            {vendasFiltradas.length === 0 && (
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
        </div>
    );
};

export default AssinaturasPratique;