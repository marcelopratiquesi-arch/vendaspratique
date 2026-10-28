import React, { useState, useEffect, useMemo, useRef } from 'react';
import TabelaHistorico from './TabelaHistorico.jsx';
import { supabase } from '../../supabaseClient.js';
import { safeIsoDate, safeNumber, formatMoney, meses, toTitleCase, buildCatalogoMap, normalizeString } from './utils.js';
import { 
    Filter, Calendar, CalendarDays, Sun, UserCheck, Wallet, BarChart2, 
    Leaf, Star, Activity, Dumbbell, ShoppingBag, Receipt, Layers, 
    ChevronDown, ChevronUp, AlertCircle, RefreshCw, AlertTriangle, 
    Bookmark, Package, Briefcase, Info, Lightbulb, Users, Building2, CalendarRange, Search, X 
} from 'lucide-react';
import { SmartFilter } from '../../components/SmartFilter.jsx';
import { SeletorPeriodo, FiltroMultiplo, calcularPreset, ROTULO_ATALHO } from './FiltrosCompactos.jsx';

// 🔥 CORREÇÃO DE FUSO HORÁRIO BRASILEIRO
const getLocalISODate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const AssinaturasPratique = ({ usuarioLogado, data = [], setData, colaboradores = [], onAbrirAluno }) => {
    const hojePadrao = getLocalISODate();
    const mesPadrao = String(new Date().getMonth() + 1).padStart(2, '0');
    const anoPadrao = new Date().getFullYear().toString();

    const [tipoFiltroData, setTipoFiltroData] = useState('dia'); 
    const [filtroMes, setFiltroMes] = useState(mesPadrao);
    const [filtroAno, setFiltroAno] = useState(anoPadrao);
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [diaEspecifico, setDiaEspecifico] = useState(hojePadrao);
    
    const [vendedoresOcultos, setVendedoresOcultos] = useState([]);
    const [planosOcultos, setPlanosOcultos] = useState([]);
    const [produtosOcultos, setProdutosOcultos] = useState([]);
    const [servicosOcultos, setServicosOcultos] = useState([]);
    
    const [filtroUnidade, setFiltroUnidade] = useState('TODOS'); 
    // Atalho de período escolhido no menu (hoje, 7d, mes, dia, personalizado...)
    const [presetPeriodo, setPresetPeriodo] = useState('hoje');
    // Busca por aluno, CPF ou matrícula
    const [busca, setBusca] = useState('');

    const [categoriaExpandida, setCategoriaExpandida] = useState(null);
    const [catalogoGeral, setCatalogoGeral] = useState([]); 

    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    const podeEditar = ['ADMIN', 'MENTOR', 'LIDER'].includes(usuarioLogado?.role);
    
    const unidadeAtual = temVisaoGlobal ? filtroUnidade : usuarioLogado?.unidade;

    useEffect(() => {
        const fetchCatalogo = async () => {
            const { data, error } = await supabase.from('catalogo').select('id, nome, tipo, valor');
            if (data && !error) setCatalogoGeral(data);
        };
        fetchCatalogo();
    }, []);

    // Utilizamos a função de utilitários oficial para construir o mapa otimizado do catálogo
    const mapCatalogo = useMemo(() => buildCatalogoMap(catalogoGeral), [catalogoGeral]);

    const limparFiltros = () => {
        setTipoFiltroData('dia');
        setFiltroMes(mesPadrao);
        setFiltroAno(anoPadrao);
        setDataInicio('');
        setDataFim('');
        setDiaEspecifico(hojePadrao);
        setVendedoresOcultos([]);
        setPlanosOcultos([]);
        setProdutosOcultos([]);
        setServicosOcultos([]);
        setPresetPeriodo('hoje');
        setBusca('');
        if (temVisaoGlobal) setFiltroUnidade('TODOS');
    };

    // Aplica o que foi escolhido no menu de período, usando os mesmos filtros de antes (dia / periodo / mes)
    const aplicarPeriodo = (p) => {
        if (!p) return;
        setPresetPeriodo(p.preset);
        setTipoFiltroData(p.tipo);
        if (p.tipo === 'dia') setDiaEspecifico(p.dia || '');
        if (p.tipo === 'periodo') { setDataInicio(p.inicio || ''); setDataFim(p.fim || ''); }
        if (p.tipo === 'mes') { setFiltroMes(p.mes || 'TODOS'); setFiltroAno(p.ano || 'TODOS'); }
    };

    useEffect(() => {
        setVendedoresOcultos([]);
        setPlanosOcultos([]);
        setProdutosOcultos([]);
        setServicosOcultos([]);
    }, [filtroUnidade, filtroMes, filtroAno, diaEspecifico, dataInicio, dataFim, tipoFiltroData]);

    const unidadesUnicas = useMemo(() => ['TODOS', ...new Set(data.map(v => String(v.unidade || '').trim().toUpperCase()))].filter(Boolean), [data]); 
    
    const anosUnicos = useMemo(() => {
        const anos = [...new Set(data.map(v => {
            const dataRef = v.data || v.created_at;
            if (!dataRef) return null;
            const partes = safeIsoDate(dataRef).split('-');
            if (partes.length === 3) {
                return partes[2].length === 4 ? partes[2] : partes[0];
            }
            return null;
        }))].filter(Boolean).sort((a,b) => b-a); 
        if(anos.length === 0) anos.push(anoPadrao);
        return anos;
    }, [data, anoPadrao]);

    const vendasBase = useMemo(() => {
        return data.filter(venda => {
            const unidadeVenda = String(venda.unidade || '').trim().toUpperCase();
            const unidadeLogado = String(usuarioLogado?.unidade || '').trim().toUpperCase();
            const filtroUnidadeTrim = String(filtroUnidade || '').trim().toUpperCase();

            if (temVisaoGlobal && filtroUnidadeTrim !== 'TODOS' && unidadeVenda !== filtroUnidadeTrim) return false;
            if (!temVisaoGlobal && unidadeVenda !== unidadeLogado) return false;

            const dataReferencia = venda.data || venda.created_at;
            if (!dataReferencia) return false;
            
            const isoDate = safeIsoDate(dataReferencia);
            const partes = isoDate.split('-');
            if (partes.length !== 3) return false;
            
            let y = partes[0], m = partes[1], d = partes[2];
            if (partes[2].length === 4) { y = partes[2]; m = partes[1]; d = partes[0]; }
            const dataFormatada = `${y}-${m}-${d}`;

            if (tipoFiltroData === 'mes') {
                if (filtroMes !== 'TODOS' && m !== filtroMes) return false;
                if (filtroAno !== 'TODOS' && y !== filtroAno) return false;
            } else if (tipoFiltroData === 'periodo') {
                if (dataInicio && dataFormatada < dataInicio) return false;
                if (dataFim && dataFormatada > dataFim) return false;
            } else if (tipoFiltroData === 'dia') {
                if (diaEspecifico && dataFormatada !== diaEspecifico) return false;
            }

            return true;
        });
    }, [data, temVisaoGlobal, filtroUnidade, usuarioLogado, tipoFiltroData, filtroMes, filtroAno, dataInicio, dataFim, diaEspecifico]);

    // 🔥 CORREÇÃO DA CLASSIFICAÇÃO: Usando o normalizeString para cruzar perfeitamente com o Catálogo
    const { planosVendidos, produtosVendidos, servicosVendidos, vendedoresUnicos } = useMemo(() => {
        const arrPlanos = [];
        const arrProds = [];
        const arrServs = [];
        const vendSet = new Set();
        const itemSet = new Set();

        vendasBase.forEach(v => {
            if (v.vendedor) vendSet.add(v.vendedor.trim().toUpperCase());
            if (v.produto) itemSet.add(v.produto.trim().toUpperCase());
        });

        Array.from(itemSet).sort().forEach(item => {
            const cat = mapCatalogo.get(normalizeString(item));
            const tipo = cat && cat.tipo ? cat.tipo.toLowerCase().trim() : 'plano'; 

            if (tipo === 'produto') arrProds.push(item);
            else if (tipo === 'servico' || tipo === 'serviço') arrServs.push(item);
            else arrPlanos.push(item);
        });

        return { 
            planosVendidos: arrPlanos, 
            produtosVendidos: arrProds, 
            servicosVendidos: arrServs,
            vendedoresUnicos: Array.from(vendSet).sort()
        };
    }, [vendasBase, mapCatalogo]);

    const termoBusca = normalizeString(busca);
    const digitosBusca = busca.replace(/\D/g, '');

    const vendasFiltradas = useMemo(() => {
        return vendasBase.filter(venda => {
            const prodUpper = (venda.produto || '').trim().toUpperCase();
            const vendUpper = (venda.vendedor || '').trim().toUpperCase();

            if (vendedoresOcultos.includes(vendUpper)) return false;
            if (planosOcultos.includes(prodUpper)) return false;
            if (produtosOcultos.includes(prodUpper)) return false;
            if (servicosOcultos.includes(prodUpper)) return false;

            // Busca por nome do aluno, CPF ou matrícula
            if (termoBusca) {
                const nome = normalizeString(String(venda.nome_aluno || venda.nome || ''));
                const cpf = String(venda.cpf || '').replace(/\D/g, '');
                const mat = String(venda.matricula || '');
                const achou = nome.includes(termoBusca)
                    || (digitosBusca.length >= 3 && (cpf.includes(digitosBusca) || mat.includes(digitosBusca)));
                if (!achou) return false;
            }

            return true;
        });
    }, [vendasBase, vendedoresOcultos, planosOcultos, produtosOcultos, servicosOcultos, termoBusca, digitosBusca]);

    const resumoVendedor = useMemo(() => {
        const resumo = {
            valorTotal: 0,
            qtdTotal: 0,
            grupos: {
                "NUTRI": { qtd: 0, valor: 0, itens: {}, icone: Leaf, cor: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200' },
                "PLUS": { qtd: 0, valor: 0, itens: {}, icone: Star, cor: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
                "FIT": { qtd: 0, valor: 0, itens: {}, icone: Activity, cor: 'text-indigo-600', bg: 'bg-indigo-100', border: 'border-indigo-200' },
                "PERSONAL CLASS": { qtd: 0, valor: 0, itens: {}, icone: Dumbbell, cor: 'text-rose-600', bg: 'bg-rose-100', border: 'border-rose-200' },
                "OUTROS PLANOS": { qtd: 0, valor: 0, itens: {}, icone: Layers, cor: 'text-slate-600', bg: 'bg-slate-200', border: 'border-slate-300' },
                "PRODUTOS": { qtd: 0, valor: 0, itens: {}, icone: ShoppingBag, cor: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' },
                "SERVIÇOS": { qtd: 0, valor: 0, itens: {}, icone: Receipt, cor: 'text-violet-600', bg: 'bg-violet-100', border: 'border-violet-200' },
                "NÃO CATALOGADO": { qtd: 0, valor: 0, itens: {}, icone: AlertTriangle, cor: 'text-red-600', bg: 'bg-red-100', border: 'border-red-400' }
            }
        };
        
        const transacoesUnicas = new Set();

        vendasFiltradas.forEach((v, index) => {
            let val = safeNumber(v.valor);
            let qtdReal = parseInt(v.quantidade) || 1;
            const nomeExato = (v.produto || 'ITEM NÃO IDENTIFICADO').trim().toUpperCase();
            
            const itemCat = mapCatalogo.get(normalizeString(nomeExato));
            const tipoCategoria = itemCat && itemCat.tipo ? itemCat.tipo.toLowerCase().trim() : 'outro';
            
            let chaveUnica = v.id || `${v.created_at || v.data}-${nomeExato}-${index}`; 
            
            if (tipoCategoria === 'plano' && v.matricula && String(v.matricula).trim() !== '') {
                const dataLimpa = safeIsoDate(v.data || v.created_at);
                chaveUnica = `${String(v.matricula).trim()}-${nomeExato}-${dataLimpa}`;
            }

            if (transacoesUnicas.has(chaveUnica)) {
                qtdReal = 0;
                val = 0; 
            } else {
                transacoesUnicas.add(chaveUnica);
            }

            resumo.valorTotal += val;
            resumo.qtdTotal += qtdReal;
            
            let grupoAlvo = 'OUTROS PLANOS';

            if (!itemCat) {
                grupoAlvo = 'NÃO CATALOGADO'; 
            } else {
                const categoriaDB = itemCat.tipo.toLowerCase().trim();
                if (categoriaDB === 'plano') {
                    if (nomeExato.includes('NUTRI')) grupoAlvo = 'NUTRI';
                    else if (nomeExato.includes('PLUS') || nomeExato.includes('AFL')) grupoAlvo = 'PLUS';
                    else if (nomeExato.includes('FIT')) grupoAlvo = 'FIT';
                    else if (nomeExato.includes('PERSONAL')) grupoAlvo = 'PERSONAL CLASS';
                    else grupoAlvo = 'OUTROS PLANOS';
                } else if (categoriaDB === 'produto') {
                    grupoAlvo = 'PRODUTOS';
                } else if (categoriaDB === 'servico' || categoriaDB === 'serviço') {
                    grupoAlvo = 'SERVIÇOS';
                }
            }

            resumo.grupos[grupoAlvo].qtd += qtdReal;
            resumo.grupos[grupoAlvo].valor += val;

            if (!resumo.grupos[grupoAlvo].itens[nomeExato]) {
                resumo.grupos[grupoAlvo].itens[nomeExato] = { qtd: 0, valor: 0 };
            }
            resumo.grupos[grupoAlvo].itens[nomeExato].qtd += qtdReal;
            resumo.grupos[grupoAlvo].itens[nomeExato].valor += val;
        });
        
        return resumo;
    }, [vendasFiltradas, mapCatalogo]);

    const toggleCategoria = (catNome) => {
        setCategoriaExpandida(prev => prev === catNome ? null : catNome);
    };

    const exibirDashboard = 
        vendedoresOcultos.length > 0 || 
        planosOcultos.length > 0 || 
        produtosOcultos.length > 0 || 
        servicosOcultos.length > 0 ||
        filtroUnidade !== 'TODOS' ||
        tipoFiltroData !== 'dia' ||
        diaEspecifico !== hojePadrao ||
        termoBusca !== '';

    // ---------- Textos do período ----------
    const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
    const nomeMes = (m) => (meses.find(x => x.val === m)?.label || '').replace(/^\d+\s*-\s*/, '');
    const rotuloPeriodo = (() => {
        if (presetPeriodo === 'dia') return dataBR(diaEspecifico) || 'Escolher dia';
        if (presetPeriodo === 'mes') return filtroMes === 'TODOS' ? `Ano ${filtroAno === 'TODOS' ? 'todos' : filtroAno}` : `${nomeMes(filtroMes)}${filtroAno !== 'TODOS' ? ` ${filtroAno}` : ''}`;
        if (presetPeriodo === 'personalizado') return `${dataBR(dataInicio)} – ${dataBR(dataFim)}`;
        return ROTULO_ATALHO[presetPeriodo] || 'Período';
    })();
    const descricaoPeriodo = (() => {
        if (tipoFiltroData === 'dia') return presetPeriodo === 'hoje' ? `Hoje, ${dataBR(diaEspecifico)}` : presetPeriodo === 'ontem' ? `Ontem, ${dataBR(diaEspecifico)}` : dataBR(diaEspecifico);
        if (tipoFiltroData === 'periodo') return dataInicio || dataFim ? `${ROTULO_ATALHO[presetPeriodo] ? `${ROTULO_ATALHO[presetPeriodo]}: ` : ''}${dataBR(dataInicio)} a ${dataBR(dataFim)}` : 'Todo o período';
        return rotuloPeriodo;
    })();

    // ---------- Filtros ativos (chips com X) ----------
    const filtrosAtivos = [];
    if (busca.trim()) filtrosAtivos.push({ id: 'busca', texto: `Busca: "${busca.trim()}"`, remover: () => setBusca('') });
    if (temVisaoGlobal && filtroUnidade !== 'TODOS') filtrosAtivos.push({ id: 'unidade', texto: `Unidade: ${filtroUnidade}`, remover: () => setFiltroUnidade('TODOS') });
    [
        ['consultores', 'Consultores', vendedoresUnicos, vendedoresOcultos, setVendedoresOcultos],
        ['planos', 'Planos', planosVendidos, planosOcultos, setPlanosOcultos],
        ['produtos', 'Produtos', produtosVendidos, produtosOcultos, setProdutosOcultos],
        ['servicos', 'Serviços', servicosVendidos, servicosOcultos, setServicosOcultos],
    ].forEach(([id, nome, opcoes, ocultos, setOcultos]) => {
        const ocultosValidos = ocultos.filter(o => opcoes.includes(o));
        if (ocultosValidos.length > 0) {
            const visiveis = opcoes.filter(o => !ocultos.includes(o));
            const texto = visiveis.length <= 2 && visiveis.length > 0
                ? `${nome}: ${visiveis.map(v => toTitleCase(v)).join(', ')}`
                : `${nome}: ${visiveis.length} de ${opcoes.length}`;
            filtrosAtivos.push({ id, texto, remover: () => setOcultos([]) });
        }
    });
    const temFiltroAtivo = filtrosAtivos.length > 0 || presetPeriodo !== 'hoje';

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-[1400px] mx-auto">
            
            {/* ========================================== */}
            {/* 🚀 FILTROS DE HISTÓRICO (versão compacta) */}
            {/* ========================================== */}
            <div className="bg-white rounded-[20px] border border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-4 md:p-5 relative z-20 flex flex-col gap-4">

                {/* Título + o que está sendo exibido | Limpar + Período */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Histórico de vendas</h2>
                        <p className="text-[12px] font-semibold text-slate-500 mt-0.5 truncate">
                            {descricaoPeriodo} · {temVisaoGlobal ? (filtroUnidade === 'TODOS' ? 'Todas as unidades' : filtroUnidade) : (usuarioLogado?.unidade || '')}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {temFiltroAtivo && (
                            <button type="button" onClick={limparFiltros} className="h-10 px-3 rounded-xl text-[12px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center gap-1.5 transition-colors">
                                <RefreshCw className="w-3.5 h-3.5" /> Limpar filtros
                            </button>
                        )}
                        <SeletorPeriodo
                            rotulo={rotuloPeriodo}
                            preset={presetPeriodo}
                            tipo={tipoFiltroData}
                            dia={diaEspecifico}
                            inicio={dataInicio}
                            fim={dataFim}
                            mes={filtroMes}
                            ano={filtroAno}
                            meses={meses}
                            anos={anosUnicos}
                            onAplicar={aplicarPeriodo}
                        />
                    </div>
                </div>

                {/* Busca + filtros lado a lado */}
                <div className="flex flex-wrap gap-2.5">
                    <label className="flex-[2] min-w-[240px] h-[42px] px-3 bg-white border border-slate-200 rounded-xl flex items-center gap-2 focus-within:ring-2 focus-within:ring-blue-500 transition-shadow">
                        <Search className="w-4 h-4 text-slate-400 shrink-0" />
                        <input
                            type="text"
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            placeholder="Buscar por aluno, CPF ou matrícula"
                            aria-label="Buscar venda por aluno, CPF ou matrícula"
                            className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] font-medium text-slate-800 placeholder-slate-400"
                        />
                        {busca && (
                            <button type="button" onClick={() => setBusca('')} aria-label="Limpar busca" className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </label>

                    {temVisaoGlobal && (
                        <div className="relative flex-1 min-w-[170px]">
                            <Building2 className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${filtroUnidade !== 'TODOS' ? 'text-blue-700' : 'text-slate-400'}`} />
                            <select
                                value={filtroUnidade}
                                onChange={(e) => setFiltroUnidade(e.target.value)}
                                aria-label="Unidade"
                                className={`w-full h-[42px] pl-9 pr-8 rounded-xl border text-[13px] appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${filtroUnidade !== 'TODOS' ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 font-semibold'}`}
                            >
                                {unidadesUnicas.map(u => <option key={u} value={u}>{u === 'TODOS' ? 'Unidade: todas' : u}</option>)}
                            </select>
                            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    )}

                    <FiltroMultiplo rotulo="Consultores" icone={Users} options={vendedoresUnicos} ocultos={vendedoresOcultos} setOcultos={setVendedoresOcultos} />
                    <FiltroMultiplo rotulo="Planos" icone={Bookmark} options={planosVendidos} ocultos={planosOcultos} setOcultos={setPlanosOcultos} />
                    <FiltroMultiplo rotulo="Produtos" icone={Package} options={produtosVendidos} ocultos={produtosOcultos} setOcultos={setProdutosOcultos} alinhar="right" />
                    <FiltroMultiplo rotulo="Serviços" icone={Briefcase} options={servicosVendidos} ocultos={servicosOcultos} setOcultos={setServicosOcultos} alinhar="right" />
                </div>

                {/* Filtros ativos (com X para tirar) */}
                {filtrosAtivos.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500">Filtros ativos:</span>
                        {filtrosAtivos.map(f => (
                            <span key={f.id} className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-full bg-slate-100 text-[12px] font-semibold text-slate-700">
                                {f.texto}
                                <button type="button" onClick={f.remover} aria-label={`Remover filtro: ${f.texto}`} className="w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors">
                                    <X className="w-3 h-3" strokeWidth={3} />
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {exibirDashboard && (
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 md:p-8 animate-[slideDown_0.3s_ease-out]">
                    
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-inner">
                                <UserCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                                    Desempenho: <span className="text-blue-600 capitalize">Seleção Personalizada</span>
                                </h2>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                                    Resumo operacional
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 p-4 rounded-xl max-w-sm shadow-sm">
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-black text-amber-700 uppercase tracking-widest mb-1">Aviso de Fechamento</p>
                                <p className="text-xs font-semibold text-amber-600/80 leading-relaxed">
                                    Este painel exibe o <strong className="text-amber-600">faturamento a conferir</strong>. O valor real depende da auditoria no Caixa.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                        
                        <div className="md:col-span-12 lg:col-span-4 bg-slate-900 rounded-[24px] p-6 md:p-8 border border-slate-800 shadow-xl flex flex-col justify-center relative overflow-hidden h-full">
                            <div className="relative z-10">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Wallet className="w-4 h-4 text-slate-500" /> Faturamento a Conferir
                                </p>
                                <p className="text-4xl md:text-5xl font-black text-white tracking-tight">{formatMoney(resumoVendedor.valorTotal)}</p>
                                <div className="flex items-center gap-2 mt-4 bg-blue-500/10 text-blue-400 w-max px-3 py-1.5 rounded-lg border border-blue-500/20">
                                    <BarChart2 className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-wider">
                                        {resumoVendedor.qtdTotal} Procedimentos Únicos
                                    </span>
                                </div>
                            </div>
                            <div className="absolute right-[-5%] bottom-[-15%] text-white/5 pointer-events-none">
                                <Wallet className="w-48 h-48" />
                            </div>
                        </div>

                        <div className="md:col-span-12 lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                            {Object.entries(resumoVendedor.grupos)
                                .filter(([_, info]) => info.qtd > 0)
                                .sort((a, b) => b[1].qtd - a[1].qtd) 
                                .map(([nomeGrupo, info]) => {
                                    const isExpanded = categoriaExpandida === nomeGrupo;
                                    const IconeCategoria = info.icone;

                                    return (
                                        <div key={nomeGrupo} className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md ${isExpanded ? `ring-2 ring-offset-1 ${info.border.replace('border-', 'ring-')}` : 'border-slate-200 hover:border-slate-300'}`}>
                                            
                                            <button 
                                                onClick={() => toggleCategoria(nomeGrupo)} 
                                                aria-expanded={isExpanded}
                                                className="w-full text-left px-5 py-4 flex items-center justify-between bg-white"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${info.bg} ${info.cor}`}>
                                                        <IconeCategoria className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xl font-black text-slate-800 tracking-tight">{String(info.qtd).padStart(2, '0')}</h3>
                                                        <p className={`text-[10px] font-black uppercase tracking-widest ${info.cor}`}>{nomeGrupo}</p>
                                                    </div>
                                                </div>
                                                <div aria-hidden="true" className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-slate-100 text-slate-800' : 'bg-slate-50 text-slate-400'}`}>
                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </div>
                                            </button>

                                            <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[400px] opacity-100 overflow-y-auto custom-scrollbar' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                                <div className="px-5 pb-5 pt-2 bg-slate-50/50 border-t border-slate-100">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Detalhamento dos Lançamentos</p>
                                                    <div className="space-y-3">
                                                        {Object.entries(info.itens)
                                                            .sort((a,b) => b[1].qtd - a[1].qtd)
                                                            .map(([nomeProduto, dadosProd]) => (
                                                                <div key={nomeProduto} className="flex items-start gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                                    <div className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-[10px] font-black shrink-0 mt-0.5" title="Quantidade Deduplicada">
                                                                        {String(dadosProd.qtd).padStart(2, '0')}x
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs font-bold text-slate-700 leading-snug">{toTitleCase(nomeProduto)}</p>
                                                                        <p className="text-[10px] font-bold text-slate-400 mt-1">{formatMoney(dadosProd.valor)}</p>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        }
                                                    </div>
                                                </div>
                                            </div>

                                        </div>
                                    );
                                })
                            }
                        </div>
                    </div>
                </div>
            )}

            <TabelaHistorico 
                data={data}
                setData={setData}
                vendasFiltradas={vendasFiltradas}
                temVisaoGlobal={temVisaoGlobal}
                podeEditar={podeEditar}
                catalogoGeral={catalogoGeral} 
                usuarioLogado={usuarioLogado}
                colaboradores={colaboradores}
                onAbrirAluno={onAbrirAluno}
            />

        </div>
    );
};

export default AssinaturasPratique;