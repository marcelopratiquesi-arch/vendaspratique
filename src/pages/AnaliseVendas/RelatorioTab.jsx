import React, { useState, useRef, useEffect } from 'react';
import { safeIsoDate, formatarCPF, formatDataBR, formatMoney, normalizeString, getCategoriaItem } from './utils.js';
import { Download, Share2, Trophy, LayoutList, ChevronDown, ChevronUp, X, Move } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext.jsx';

// ==========================================
// 🧠 MODAL DRAGGABLE RESPONSIVO (COMPONENTE INTERNO)
// ==========================================
const ModalDraggable = ({ isOpen, onClose, titulo, subtitulo, children }) => {
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (!isOpen) setOffset({ x: 0, y: 0 });
    }, [isOpen]);

    useEffect(() => {
        const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

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
        e.target.releasePointerCapture(e.pointerId);
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-[fadeIn_0.2s_ease-out]">
            <div 
                className="bg-white rounded-[20px] shadow-2xl flex flex-col w-full max-w-5xl max-h-[90vh] overflow-hidden border border-slate-200"
                style={{ transform: `translate(${offset.x}px, ${offset.y}px)`, transition: isDragging ? 'none' : 'transform 0.1s ease-out' }}
            >
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
                            <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight line-clamp-1">{titulo}</h3>
                            {subtitulo && <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-0.5">{subtitulo}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} className="no-drag text-slate-400 hover:text-white transition-colors p-2 bg-white/5 hover:bg-rose-500 hover:text-white rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto bg-slate-50 no-drag custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );
};

// ==========================================
// 🧠 MOTOR DE CLASSIFICAÇÃO INTELIGENTE (ADMIN / LÍDER)
// ==========================================
const classificarParaAdmin = (nome, categoria) => {
    const prodNorm = normalizeString(nome);
    
    if (categoria === 'PRODUTO') return { grupo: 'PRODUTOS', tipo: 'AGRUPADO', order: 100, icone: '🛍️', cor: 'text-amber-600' };
    if (categoria === 'SERVICO') return { grupo: 'SERVIÇOS', tipo: 'AGRUPADO', order: 200, icone: '🧾', cor: 'text-violet-600' };
    if (categoria === 'NAO_CLASSIFICADO') return { grupo: 'NÃO CLASSIFICADOS', tipo: 'AGRUPADO', order: 300, icone: '❓', cor: 'text-slate-400' };

    // É PLANO - Subdivide pelos nomes amigáveis para UI
    if (prodNorm.includes('NUTRI')) return { grupo: 'NUTRI', tipo: 'AGRUPADO', order: 10, icone: '🥗', cor: 'text-emerald-600' };
    if (prodNorm.includes('PLUS') || prodNorm.includes('AFL')) return { grupo: 'PLUS', tipo: 'AGRUPADO', order: 20, icone: '⭐', cor: 'text-blue-600' };
    if (prodNorm.includes('FIT')) return { grupo: 'FIT', tipo: 'AGRUPADO', order: 30, icone: '🏃', cor: 'text-indigo-600' };
    if (prodNorm.includes('PERSONAL')) return { grupo: 'PERSONAL CLASS', tipo: 'INDIVIDUAL', order: 40, icone: '🏋️', cor: 'text-rose-600' };
    if (prodNorm.includes('1200') || prodNorm.includes('PROMO')) return { grupo: 'PROMOÇÕES', tipo: 'INDIVIDUAL', order: 50, icone: '🎯', cor: 'text-purple-600' };
    if (prodNorm.includes('FÉRIAS') || prodNorm.includes('FERIAS')) return { grupo: 'FÉRIAS', tipo: 'AGRUPADO', order: 60, icone: '🏖️', cor: 'text-orange-500' };
    
    return { grupo: 'OUTROS PLANOS', tipo: 'AGRUPADO', order: 90, icone: '🧩', cor: 'text-slate-600' };
};

const ORDEM_CLASSICA = ["NUTRI", "PLUS", "FIT", "PERSONAL CLASS", "PROMOÇÕES", "FÉRIAS", "OUTROS PLANOS", "PRODUTOS", "SERVIÇOS", "NÃO CLASSIFICADOS"];

const RelatorioTab = ({ vendasFiltradas, visitantesFiltrados = [], avaliacoesFiltradas = [], planos = [], produtos = [], temVisaoGlobal, labelFiltroAtual, abrirModalWhatsapp, usuarioLogado }) => {
    const { t, locale, language } = useI18n(); 
    const langAtual = locale || language || 'pt-BR';

    const [unidadesRecolhidas, setUnidadesRecolhidas] = useState({});
    const [visaoDetalhada, setVisaoDetalhada] = useState(false);

    // 🔥 ESTADOS DO MODAL INTERATIVO
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        tipoTabela: '', // 'VENDA', 'VISITANTE', 'AVALIACAO'
        titulo: '',
        subtitulo: '',
        registros: [],
        totalItensUnicos: 0
    });

    const permissaoGerencial = temVisaoGlobal || (usuarioLogado && usuarioLogado.role === 'LIDER');

    const toggleUnidade = (unidade) => {
        setUnidadesRecolhidas(prev => ({
            ...prev,
            [unidade]: !prev[unidade]
        }));
    };

    const abrirModalAuditoria = (titulo, unidade, tipoTabela, registros, totalUnicos) => {
        setModalConfig({
            isOpen: true,
            titulo: titulo,
            subtitulo: `${unidade} — Ref: ${labelFiltroAtual}`,
            tipoTabela: tipoTabela,
            registros: registros,
            totalItensUnicos: totalUnicos
        });
    };

    const scrollRef = useRef(null);
    const isDragging = useRef(false);
    const startY = useRef(0);
    const scrollTop = useRef(0);

    const onMouseDown = (e) => {
        if (e.target.closest('button') || e.target.closest('.no-drag') || e.target.closest('.cursor-pointer')) return;
        isDragging.current = true;
        scrollRef.current.classList.add('cursor-grabbing');
        scrollRef.current.classList.remove('cursor-grab');
        scrollRef.current.style.userSelect = 'none';
        startY.current = e.pageY - scrollRef.current.offsetTop;
        scrollTop.current = scrollRef.current.scrollTop;
    };

    const onMouseLeaveOrUp = () => {
        isDragging.current = false;
        if (scrollRef.current) {
            scrollRef.current.classList.remove('cursor-grabbing');
            scrollRef.current.classList.add('cursor-grab');
            scrollRef.current.style.userSelect = 'auto';
        }
    };

    const onMouseMove = (e) => {
        if (!isDragging.current) return;
        e.preventDefault();
        const y = e.pageY - scrollRef.current.offsetTop;
        const walk = (y - startY.current) * 1.5; 
        scrollRef.current.scrollTop = scrollTop.current - walk;
    };

    const relatorioPorUnidade = {};
    let vendasGlobal = 0;

    const inicializarUnidade = (unidade) => {
        if (!relatorioPorUnidade[unidade]) {
            relatorioPorUnidade[unidade] = {
                totalGeralVendas: 0,
                vendedoresTotal: {},
                visitantes: [], 
                avaliacoes: [], 
                grupos: {
                    "NUTRI": { total: 0, itens: {}, cor: "text-emerald-600", bgIcone: "bg-emerald-100 text-emerald-600", icone: "🥗" },
                    "PLUS": { total: 0, itens: {}, cor: "text-blue-600", bgIcone: "bg-blue-100 text-blue-600", icone: "⭐" },
                    "FIT": { total: 0, itens: {}, cor: "text-indigo-600", bgIcone: "bg-indigo-100 text-indigo-600", icone: "🏃" },
                    "PERSONAL CLASS": { total: 0, itens: {}, cor: "text-rose-600", bgIcone: "bg-rose-100 text-rose-600", icone: "🏋️" }, 
                    "PROMOÇÕES": { total: 0, itens: {}, cor: "text-purple-600", bgIcone: "bg-purple-100 text-purple-600", icone: "🎯" },
                    "FÉRIAS": { total: 0, itens: {}, cor: "text-orange-500", bgIcone: "bg-orange-100 text-orange-500", icone: "🏖️" },
                    "OUTROS PLANOS": { total: 0, itens: {}, cor: "text-slate-600", bgIcone: "bg-slate-200 text-slate-600", icone: "🧩" },
                    "PRODUTOS": { total: 0, itens: {}, cor: "text-amber-600", bgIcone: "bg-amber-100 text-amber-600", icone: "🛍️" },
                    "SERVIÇOS": { total: 0, itens: {}, cor: "text-violet-600", bgIcone: "bg-violet-100 text-violet-600", icone: "🧾" },
                    "NÃO CLASSIFICADOS": { total: 0, itens: {}, cor: "text-slate-400", bgIcone: "bg-slate-100 text-slate-400", icone: "❓" }
                },
                gruposAdmin: {}
            };
        }
    };

    const transacoesUnicas = new Set();

    vendasFiltradas.forEach(v => {
        const unidade = v.unidade || 'SEM UNIDADE';
        inicializarUnidade(unidade);
        
        let qtd = parseInt(v.quantidade) || 1;
        const prodOriginal = (v.produto || 'ITEM NÃO IDENTIFICADO');
        const prodUpper = prodOriginal.toUpperCase().trim();
        const vendPrimeiroNome = (v.vendedor ? v.vendedor.split(' ')[0] : 'SISTEMA').charAt(0).toUpperCase() + (v.vendedor ? v.vendedor.split(' ')[0] : 'SISTEMA').slice(1).toLowerCase();
        
        // 🔥 A MÁGICA ACONTECE AQUI: Fonte da verdade pelo Catálogo.
        const categoriaMestre = getCategoriaItem(prodOriginal, planos, produtos);

        if (categoriaMestre === 'PLANO' && v.matricula && v.matricula.trim() !== '') {
            const dataLimpa = safeIsoDate(v.data || v.created_at);
            const chaveUnica = `${v.matricula.trim()}-${prodUpper}-${dataLimpa}`;

            if (transacoesUnicas.has(chaveUnica)) {
                qtd = 0; 
            } else {
                transacoesUnicas.add(chaveUnica);
            }
        }

        const registro = relatorioPorUnidade[unidade];
        registro.totalGeralVendas += qtd;
        vendasGlobal += qtd;
        registro.vendedoresTotal[vendPrimeiroNome] = (registro.vendedoresTotal[vendPrimeiroNome] || 0) + qtd;

        // Atribuição de Grupos com base na classificação Master
        let grupoAlvo = '';
        if (categoriaMestre === 'PLANO') {
            const nomeNorm = normalizeString(prodUpper);
            if (nomeNorm.includes("NUTRI")) grupoAlvo = "NUTRI";
            else if (nomeNorm.includes("PLUS") || nomeNorm.includes("AFL")) grupoAlvo = "PLUS";
            else if (nomeNorm.includes("FIT")) grupoAlvo = "FIT";
            else if (nomeNorm.includes("PERSONAL")) grupoAlvo = "PERSONAL CLASS"; 
            else if (nomeNorm.includes("1200") || nomeNorm.includes("PROMO")) grupoAlvo = "PROMOÇÕES"; 
            else if (nomeNorm.includes("FÉRIAS") || nomeNorm.includes("FERIAS")) grupoAlvo = "FÉRIAS"; 
            else grupoAlvo = "OUTROS PLANOS";
        } else if (categoriaMestre === 'PRODUTO') {
            grupoAlvo = "PRODUTOS";
        } else if (categoriaMestre === 'SERVICO') {
            grupoAlvo = "SERVIÇOS";
        } else {
            grupoAlvo = "NÃO CLASSIFICADOS";
        }

        if (grupoAlvo) {
            registro.grupos[grupoAlvo].total += qtd;
            if (!registro.grupos[grupoAlvo].itens[prodUpper]) {
                registro.grupos[grupoAlvo].itens[prodUpper] = { total: 0, vendedores: {}, vendasAuditaveis: [] };
            }
            registro.grupos[grupoAlvo].itens[prodUpper].total += qtd;
            registro.grupos[grupoAlvo].itens[prodUpper].vendedores[vendPrimeiroNome] = (registro.grupos[grupoAlvo].itens[prodUpper].vendedores[vendPrimeiroNome] || 0) + qtd;
            
            // Push auditável apenas se contabilizou quantidade > 0 (Deduplicação)
            if (qtd > 0) {
                registro.grupos[grupoAlvo].itens[prodUpper].vendasAuditaveis.push({...v, qtdConsolidada: qtd});
            }
        }

        const clAdmin = classificarParaAdmin(prodOriginal, categoriaMestre);
        
        if (!registro.gruposAdmin[clAdmin.grupo]) {
            registro.gruposAdmin[clAdmin.grupo] = { 
                grupo: clAdmin.grupo,
                total: 0, 
                itens: {}, 
                tipo: clAdmin.tipo,
                order: clAdmin.order, 
                icone: clAdmin.icone, 
                cor: clAdmin.cor 
            };
        }
        registro.gruposAdmin[clAdmin.grupo].total += qtd;

        if (!registro.gruposAdmin[clAdmin.grupo].itens[prodUpper]) {
            registro.gruposAdmin[clAdmin.grupo].itens[prodUpper] = { total: 0 };
        }
        registro.gruposAdmin[clAdmin.grupo].itens[prodUpper].total += qtd;
    });

    visitantesFiltrados.forEach(v => {
        if (v.origem !== 'RECEPCAO') return;
        const unidade = v.unidade || 'SEM UNIDADE';
        inicializarUnidade(unidade);
        relatorioPorUnidade[unidade].visitantes.push(v);
    });

    avaliacoesFiltradas.forEach(a => {
        const unidade = a.unidade || 'SEM UNIDADE';
        inicializarUnidade(unidade);
        relatorioPorUnidade[unidade].avaliacoes.push(a);
    });

    const unidadesOrdenadas = Object.keys(relatorioPorUnidade).sort();

    const rankingUnidades = unidadesOrdenadas
        .map(u => ({ nome: u, vendas: relatorioPorUnidade[u].totalGeralVendas }))
        .filter(u => u.vendas > 0)
        .sort((a, b) => b.vendas - a.vendas);

    const maxVendasNoRanking = Math.max(...rankingUnidades.map(u => u.vendas), 1);

    const exportarCSV = () => {
        try {
            if (vendasFiltradas.length === 0) {
                alert(t('analytics.report.noDataExport', { defaultValue: "Não há dados para exportar com os filtros atuais." }));
                return;
            }

            let csvContent = ""; 

            if (visaoDetalhada) {
                const cabeçalho = ['ID', 'Data', 'Unidade', 'Matricula', 'Aluno', 'Produto', 'Qtd', 'Vendedor'];
                const linhas = vendasFiltradas.map(v => {
                    const dataFormatada = v.data || v.created_at ? safeIsoDate(v.data || v.created_at) : '';
                    return [
                        v.id || '',
                        dataFormatada,
                        `"${(v.unidade || '').replace(/"/g, '""')}"`,
                        `"${(v.matricula || '').replace(/"/g, '""')}"`,
                        `"${(v.nome_aluno || '').replace(/"/g, '""')}"`,
                        `"${(v.produto || '').replace(/"/g, '""')}"`,
                        v.quantidade || 1,
                        `"${(v.vendedor || '').replace(/"/g, '""')}"`
                    ].join(';');
                });
                csvContent = [cabeçalho.join(';'), ...linhas].join('\n');
            } else {
                const cabeçalho = ['Unidade', 'Categoria', 'Quantidade Total'];
                const linhas = [];
                unidadesOrdenadas.forEach(uni => {
                    const dados = relatorioPorUnidade[uni];
                    const gruposOrd = Object.values(dados.gruposAdmin).sort((a,b) => {
                        if (a.order !== b.order) return a.order - b.order;
                        return b.total - a.total;
                    });

                    gruposOrd.forEach(info => {
                        if (info.total > 0) {
                            linhas.push(`"${uni}";"${info.grupo}";${info.total}`);
                        }
                    });
                });
                csvContent = [cabeçalho.join(';'), ...linhas].join('\n');
            }
            
            const hojeData = new Date();
            const anoStr = hojeData.getFullYear();
            const mesStr = String(hojeData.getMonth() + 1).padStart(2, '0');
            const diaStr = String(hojeData.getDate()).padStart(2, '0');
            const dataStringSegura = `${anoStr}-${mesStr}-${diaStr}`;
            
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `Exportacao_Vendas_${visaoDetalhada ? 'Detalhada' : 'Resumo'}_${dataStringSegura}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            
        } catch (error) {
            console.error("Erro ao exportar CSV:", error);
            alert(t('analytics.report.exportError', { defaultValue: "Ocorreu um erro ao gerar a planilha. Verifique o console para mais detalhes." }));
        }
    };

    const gerarRelatorioGlobalWhatsapp = () => {
        if (unidadesOrdenadas.length === 0) {
            alert(t('analytics.report.noDataWpp', { defaultValue: "Não há dados para gerar relatório com os filtros atuais." }));
            return;
        }

        const dataAtual = new Date();
        const dia = String(dataAtual.getDate()).padStart(2, '0');
        const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
        const hojeSemAno = `${dia}/${mes}`;
        const horaAtual = dataAtual.toLocaleTimeString(langAtual, { hour: '2-digit', minute: '2-digit' });

        let txt = `${t('analytics.report.wppGlobalTitle', { defaultValue: '📊 *RESUMO EXECUTIVO – PRATIQUE FITNESS* 📊' })}\n`;
        txt += `${t('analytics.report.wppActiveFilter', { defaultValue: '📅 *Filtro Ativo:*' })} ${labelFiltroAtual}\n`;
        txt += `${t('analytics.report.wppGeneratedAt', { defaultValue: '🕐 *Gerado em:*' })} ${hojeSemAno} às ${horaAtual}\n\n`;

        rankingUnidades.forEach((uni) => {
            const dados = relatorioPorUnidade[uni.nome];
            txt += `🏢 *${uni.nome}:* ${uni.vendas} ${t('analytics.report.wppSalesLow', { defaultValue: 'vendas' })}\n\n`;
            
            const gruposOrd = Object.values(dados.gruposAdmin).sort((a,b) => {
                if(a.order !== b.order) return a.order - b.order;
                return b.total - a.total;
            });

            gruposOrd.forEach(g => {
                if(g.total === 0) return;
                
                txt += `${g.icone} *${g.grupo} — ${String(g.total).padStart(2, '0')}*\n`;
                
                if (visaoDetalhada && g.tipo === 'AGRUPADO') {
                    Object.entries(g.itens).sort((a,b)=>b[1].total - a[1].total).forEach(([ni, di]) => {
                        txt += `▫️ ${String(di.total).padStart(2, '0')}x ${ni}\n`;
                    });
                }
                
                txt += `\n`;
            });
        });

        txt += `${t('analytics.report.wppTotalGlobal', { defaultValue: '📈 *TOTAL GERAL:*' })} ${vendasGlobal} ${t('analytics.report.wppSalesLow', { defaultValue: 'vendas' })}\n`;

        abrirModalWhatsapp(txt.trim(), { titulo: t('analytics.report.wppGlobalModal', { defaultValue: 'Resumo Global' }), icone: 'share-2', cor: 'blue' });
    };

    const gerarTextoFechamento = (unidadeAlvo) => {
        const dataAtual = new Date();
        const dia = String(dataAtual.getDate()).padStart(2, '0');
        const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
        const ano = dataAtual.getFullYear();
        
        const hojeDataBR = `${dia}/${mes}/${ano}`;
        const hojeSemAno = `${dia}/${mes}`;
        const horaAtual = dataAtual.toLocaleTimeString(langAtual, { hour: '2-digit', minute: '2-digit' });

        let labelReferencia = labelFiltroAtual;
        let labelEnviado = `${hojeSemAno} às ${horaAtual}`;

        if (labelFiltroAtual === hojeDataBR) {
            const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            const diaSemanaStr = diasSemana[dataAtual.getDay()];
            labelReferencia = `${diaSemanaStr}, ${hojeSemAno}`; 
        }

        const dados = relatorioPorUnidade[unidadeAlvo];

        let txt = `${t('analytics.report.wppCloseTitle', { defaultValue: '📊 *RELATÓRIO DE FECHAMENTO – PRATIQUE FITNESS* 📊' })}\n`;
        txt += `${t('analytics.report.wppRef', { defaultValue: '📅 *Referência:*' })} ${labelReferencia}\n`;
        txt += `${t('analytics.report.wppSentAt', { defaultValue: '🕐 *Enviado em:*' })} ${labelEnviado}\n`;
        txt += `${t('analytics.report.wppUnit', { defaultValue: '🏢 *Unidade:*' })} ${unidadeAlvo}\n\n`;
        
        txt += `${t('analytics.report.wppSalesSummary', { defaultValue: '📌 *RESUMO DAS VENDAS*' })}\n\n`;

        const gruposClassicosOrdenados = Object.entries(dados.grupos)
            .sort((a, b) => ORDEM_CLASSICA.indexOf(a[0]) - ORDEM_CLASSICA.indexOf(b[0]))
            .filter(([_, info]) => info.total > 0);

        gruposClassicosOrdenados.forEach(([nomeGrupo, grupoInfo]) => {
            const icone = grupoInfo.icone || "🔹";

            txt += `${icone} *${nomeGrupo} — ${String(grupoInfo.total).padStart(2, '0')} ${grupoInfo.total > 1 ? t('analytics.report.wppSalesLow', { defaultValue: 'vendas' }) : t('analytics.report.wppSaleLow', { defaultValue: 'venda' })}*\n`;
            
            const itensOrdenados = Object.entries(grupoInfo.itens).sort((a,b) => b[1].total - a[1].total);
            itensOrdenados.forEach(([nomeItem, itemData]) => {
                if (itemData.total > 0) {
                    const stringConsultores = Object.entries(itemData.vendedores)
                        .filter(([_, vQtd]) => vQtd > 0)
                        .sort((a,b) => b[1] - a[1])
                        .map(([vNome, vQtd]) => `${vNome} ${String(vQtd).padStart(2, '0')}`)
                        .join(', ');
                    
                    const txtConsultores = stringConsultores ? ` (${stringConsultores})` : '';
                    txt += `▫️ ${String(itemData.total).padStart(2, '0')}x ${nomeItem}${txtConsultores}\n`;
                }
            });
            
            txt += `\n`;
        });

        if (dados.totalGeralVendas > 0) {
            txt += `${t('analytics.report.wppSalesByConsultant', { defaultValue: '👥 *VENDAS POR CONSULTOR*' })}\n`;
            const consultoresOrdenados = Object.entries(dados.vendedoresTotal)
                .filter(([_, cTotal]) => cTotal > 0)
                .sort((a,b) => b[1] - a[1]);
                
            consultoresOrdenados.forEach(([cNome, cTotal]) => {
                txt += `${cNome} — ${String(cTotal).padStart(2, '0')}\n`;
            });
            txt += `\n${t('analytics.report.wppTotalSalesUpper', { defaultValue: '📈 *TOTAL DE VENDAS:' })} ${String(dados.totalGeralVendas).padStart(2, '0')}*\n`;
        } else {
            txt += `${t('analytics.report.wppNoSales', { defaultValue: 'Nenhuma venda registrada.' })}\n`;
        }
        
        txt += `\n➖➖➖➖➖➖➖➖➖➖\n\n`;
        txt += `${t('analytics.report.wppVisitorsDesk', { defaultValue: '👥 *VISITANTES (BALCÃO):*' })} ${String(dados.visitantes.length).padStart(2, '0')}\n`;
        txt += `${t('analytics.report.wppAssessmentsDone', { defaultValue: '📋 *AVALIAÇÕES FEITAS:*' })} ${String(dados.avaliacoes.length).padStart(2, '0')}\n`;

        abrirModalWhatsapp(txt.trim(), { titulo: `${t('analytics.report.reportName', { defaultValue: 'Relatório' })}: ${unidadeAlvo}`, icone: 'file-text', cor: 'blue' });
    };

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [unidadesRecolhidas, vendasFiltradas, visitantesFiltrados, avaliacoesFiltradas, visaoDetalhada, modalConfig]);

    // 🔥 RENDERIZADORES DAS TABELAS DO MODAL
    const RenderTabelaModal = () => {
        if (modalConfig.registros.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 opacity-60">
                    <LayoutList className="w-12 h-12 text-slate-300 mb-4" />
                    <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Nenhum registro detalhado encontrado.</p>
                </div>
            );
        }

        if (modalConfig.tipoTabela === 'VENDA') {
            return (
                <div className="w-full overflow-x-auto custom-scrollbar bg-white">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-100/50 border-b border-slate-200">
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-100/90 backdrop-blur">Aluno</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">CPF</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Data</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Plano/Produto</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Qtd</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Vendedor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {modalConfig.registros.map((v, i) => (
                                <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="py-4 px-5 font-bold text-slate-800 text-xs truncate max-w-[200px] sticky left-0 bg-white/90 backdrop-blur" title={v.nome_aluno || v.nome}>{v.nome_aluno || v.nome || 'Não informado'}</td>
                                    {/* 🔥 CPF BLINDADO */}
                                    <td className="py-4 px-5 font-mono text-[11px] text-slate-600">{formatarCPF(v.cpf || v.cpf_aluno || v.documento || '')}</td>
                                    <td className="py-4 px-5 text-xs text-slate-600 font-medium whitespace-nowrap">{formatDataBR(v.data || v.created_at)}</td>
                                    <td className="py-4 px-5 text-xs font-bold text-blue-700 uppercase truncate max-w-[250px]" title={v.produto}>{v.produto}</td>
                                    <td className="py-4 px-5 text-xs font-black text-center text-slate-800">{v.qtdConsolidada || v.quantidade || 1}</td>
                                    <td className="py-4 px-5 text-xs font-bold text-slate-600 capitalize truncate max-w-[150px]">{v.vendedor || 'Sistema'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (modalConfig.tipoTabela === 'VISITANTE') {
            return (
                <div className="w-full overflow-x-auto custom-scrollbar bg-white">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-100/50 border-b border-slate-200">
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-100/90 backdrop-blur">Visitante</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">CPF</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Telefone</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Data</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Consultor Resp.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {modalConfig.registros.map((v, i) => (
                                <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="py-4 px-5 font-bold text-slate-800 text-xs truncate max-w-[200px] sticky left-0 bg-white/90 backdrop-blur" title={v.nome}>{v.nome || 'Não informado'}</td>
                                    {/* 🔥 CPF BLINDADO */}
                                    <td className="py-4 px-5 font-mono text-[11px] text-slate-600">{formatarCPF(v.cpf || v.cpf_visitante || v.documento || '')}</td>
                                    <td className="py-4 px-5 font-mono text-[11px] text-slate-600">{v.telefone || 'Não informado'}</td>
                                    <td className="py-4 px-5 text-xs text-slate-600 font-medium whitespace-nowrap">{formatDataBR(v.data || v.criado_em)}</td>
                                    <td className="py-4 px-5 text-xs font-bold text-slate-600 capitalize truncate max-w-[150px]">{v.consultor || v.responsavel || 'Não informado'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (modalConfig.tipoTabela === 'AVALIACAO') {
            return (
                <div className="w-full overflow-x-auto custom-scrollbar bg-white">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-100/50 border-b border-slate-200">
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-100/90 backdrop-blur">Aluno</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">CPF</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Data</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Professor</th>
                                <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Situação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {modalConfig.registros.map((a, i) => (
                                <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="py-4 px-5 font-bold text-slate-800 text-xs truncate max-w-[200px] sticky left-0 bg-white/90 backdrop-blur" title={a.nome_aluno || a.nome}>{a.nome_aluno || a.nome || 'Não informado'}</td>
                                    {/* 🔥 CPF BLINDADO */}
                                    <td className="py-4 px-5 font-mono text-[11px] text-slate-600">{formatarCPF(a.cpf || a.cpf_aluno || a.documento || '')}</td>
                                    <td className="py-4 px-5 text-xs text-slate-600 font-medium whitespace-nowrap">{formatDataBR(a.data || a.created_at)}</td>
                                    <td className="py-4 px-5 text-xs font-bold text-slate-600 capitalize truncate max-w-[150px]">{a.professor || a.avaliador || 'Não informado'}</td>
                                    <td className="py-4 px-5 text-[10px] font-black uppercase text-emerald-600">{a.status || 'Concluída'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        return null;
    };

    return (
        <div 
            className="animate-[fadeIn_0.3s_ease-out] max-h-[75vh] overflow-y-auto custom-scrollbar cursor-grab px-2 pb-10"
            ref={scrollRef}
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseLeaveOrUp}
            onMouseUp={onMouseLeaveOrUp}
            onMouseMove={onMouseMove}
        >
            <ModalDraggable 
                isOpen={modalConfig.isOpen} 
                onClose={() => setModalConfig({...modalConfig, isOpen: false})}
                titulo={modalConfig.titulo}
                subtitulo={modalConfig.subtitulo}
            >
                <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between no-drag">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                        Total Encontrado: <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 ml-1">{modalConfig.totalItensUnicos} Itens Consolidados</span>
                    </span>
                </div>
                <RenderTabelaModal />
            </ModalDraggable>

            <div className="space-y-8">

                {/* 📌 BARRA DE AÇÕES GERENCIAIS E CHAVE SELETORA */}
                {unidadesOrdenadas.length > 0 && permissaoGerencial && (
                    <div className="bg-white p-4 md:p-6 rounded-[24px] shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 items-center justify-between no-drag">
                        
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center shadow-md shrink-0">
                                <LayoutList className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-800 uppercase tracking-widest">{t('analytics.report.managerPanel', { defaultValue: 'Painel Gerencial' })}</h3>
                                <p className="text-[11px] font-bold text-slate-400 mt-0.5">{t('analytics.report.globalExport', { defaultValue: 'Visão Global e Exportação' })}</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-4 items-center">
                            <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto">
                                <button 
                                    onClick={() => setVisaoDetalhada(false)}
                                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!visaoDetalhada ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    {t('analytics.report.btnResume', { defaultValue: 'Resumo' })}
                                </button>
                                <button 
                                    onClick={() => setVisaoDetalhada(true)}
                                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${visaoDetalhada ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    {t('analytics.report.btnDetailed', { defaultValue: 'Detalhado' })}
                                </button>
                            </div>

                            <div className="flex w-full sm:w-auto gap-3">
                                <button 
                                    onClick={exportarCSV}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-slate-200"
                                >
                                    <Download className="w-4 h-4" /> {t('analytics.report.btnSheet', { defaultValue: 'Planilha' })}
                                </button>
                                <button 
                                    onClick={gerarRelatorioGlobalWhatsapp}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-emerald-200"
                                >
                                    <Share2 className="w-4 h-4" /> WhatsApp
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🏆 RANKING VISUAL GLOBAL DETALHADO */}
                {permissaoGerencial && rankingUnidades.length > 0 && (
                    <div className="bg-white p-6 rounded-[24px] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-200 no-drag animate-[slideDown_0.4s_ease-out]">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                            <Trophy className="w-5 h-5 text-amber-500" /> {t('analytics.report.globalRanking', { defaultValue: 'Ranking Global de Vendas' })}
                        </h3>
                        
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50/50">
                                        <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest rounded-tl-xl w-20">{t('analytics.report.colPos', { defaultValue: 'Pos' })}</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-40">{t('analytics.report.colUnit', { defaultValue: 'Unidade' })}</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-32">{t('analytics.report.colQty', { defaultValue: 'Quantidade' })}</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest rounded-tr-xl flex-1">{t('analytics.report.colPerf', { defaultValue: 'Desempenho & Composição' })}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rankingUnidades.map((uni, idx) => {
                                        const percentual = (uni.vendas / maxVendasNoRanking) * 100;
                                        const isCampeao = idx === 0;
                                        const dadosUnidade = relatorioPorUnidade[uni.nome];

                                        return (
                                            <tr key={uni.nome} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group align-top">
                                                <td className="py-4 px-4 pt-5">
                                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${isCampeao ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                                                        {idx + 1}º
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4 pt-5 font-black text-slate-700 uppercase tracking-tight text-sm">
                                                    {uni.nome}
                                                </td>
                                                <td className="py-4 px-4 pt-5 text-center">
                                                    <span className="inline-block bg-white border border-slate-200 shadow-sm px-3 py-1 rounded-lg text-xs font-black text-blue-600">
                                                        {String(uni.vendas).padStart(2, '0')}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4 pt-6 pb-6 flex flex-col gap-4">
                                                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex items-center relative">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-1000 ease-out ${isCampeao ? 'bg-amber-400' : 'bg-blue-500'}`} 
                                                            style={{ width: `${percentual}%` }}
                                                        ></div>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.values(dadosUnidade.gruposAdmin)
                                                            .sort((a,b) => {
                                                                if(a.order !== b.order) return a.order - b.order;
                                                                return b.total - a.total;
                                                            })
                                                            .map((grupoInfo) => {
                                                            
                                                            if (grupoInfo.total === 0) return null;

                                                            if (grupoInfo.tipo === 'INDIVIDUAL' || !visaoDetalhada) {
                                                                return (
                                                                    <span key={grupoInfo.grupo} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-md text-[10px] font-black text-slate-600 shadow-sm">
                                                                        <span className={grupoInfo.cor}>{grupoInfo.icone}</span>
                                                                        {String(grupoInfo.total).padStart(2, '0')}x {grupoInfo.grupo}
                                                                    </span>
                                                                );
                                                            } else {
                                                                return Object.entries(grupoInfo.itens)
                                                                    .sort((a,b) => b[1].total - a[1].total)
                                                                    .map(([nomeItem, itemData]) => {
                                                                        if (itemData.total === 0) return null;
                                                                        return (
                                                                            <span key={nomeItem} className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-[10px] font-bold text-slate-700 shadow-sm border-l-2 border-l-blue-400">
                                                                                <span className="text-slate-400 font-black">{String(itemData.total).padStart(2, '0')}x</span> 
                                                                                <span className="uppercase truncate max-w-[150px]" title={nomeItem}>{nomeItem}</span>
                                                                            </span>
                                                                        );
                                                                    });
                                                            }
                                                        })}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 🏢 CARDS SANFONA POR UNIDADE COM INTERAÇÃO DE MODAL */}
                {unidadesOrdenadas.length === 0 ? (
                    <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm flex flex-col items-center justify-center h-64 opacity-60 pointer-events-none">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <i data-lucide="file-x-2" className="w-8 h-8 text-slate-400"></i>
                        </div>
                        <p className="text-sm font-black text-slate-500 uppercase tracking-widest">{t('analytics.report.emptyData', { defaultValue: 'Nenhum dado neste período.' })}</p>
                    </div>
                ) : (
                    unidadesOrdenadas.map(unidade => {
                        const dados = relatorioPorUnidade[unidade];
                        const isRecolhido = unidadesRecolhidas[unidade];

                        const hasVisitantes = dados.visitantes.length > 0;
                        const hasAvaliacoes = dados.avaliacoes.length > 0;

                        return (
                            <div key={unidade} className="bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden transition-all duration-300">
                                
                                <div 
                                    className="bg-slate-900 px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-5 transition-colors cursor-pointer select-none group"
                                    onClick={() => toggleUnidade(unidade)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/10 shrink-0 group-hover:bg-blue-500/20 group-hover:border-blue-500/30 transition-colors">
                                            <i data-lucide="building-2" className="w-6 h-6 text-white"></i>
                                        </div>
                                        <div>
                                            <h4 className="text-lg md:text-xl font-black text-white uppercase tracking-tight line-clamp-1">
                                                {unidade}
                                            </h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                {t('analytics.report.perfOps', { defaultValue: 'Performance Operacional' })}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-3 no-drag">
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl flex items-center gap-2" title="Total de Vendas Registradas">
                                            <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">
                                                {String(dados.totalGeralVendas).padStart(2, '0')} {t('analytics.report.salesUnit', { defaultValue: 'Vendas' })}
                                            </span>
                                        </div>

                                        <button 
                                            onClick={(e) => { e.stopPropagation(); gerarTextoFechamento(unidade); }} 
                                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                                        >
                                            <Share2 className="w-3.5 h-3.5" /> WhatsApp
                                        </button>

                                        <button 
                                            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400 transition-colors shrink-0"
                                            title={isRecolhido ? t('analytics.report.btnExpand', { defaultValue: 'Expandir' }) : t('analytics.report.btnCollapse', { defaultValue: 'Recolher' })}
                                        >
                                            {isRecolhido ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <div className={`transition-all duration-300 ${isRecolhido ? 'h-0 opacity-0 overflow-hidden' : 'p-6 md:p-8 bg-slate-50/50 border-t border-slate-200'}`}>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                        
                                        {/* VENDAS (AGORA CLICÁVEIS) */}
                                        {Object.entries(dados.grupos)
                                            .sort((a, b) => ORDEM_CLASSICA.indexOf(a[0]) - ORDEM_CLASSICA.indexOf(b[0]))
                                            .filter(([_, info]) => info.total > 0)
                                            .map(([grupo, info]) => (
                                            <div key={grupo} className="bg-white border border-slate-200 rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex flex-col overflow-hidden transition-all hover:shadow-md hover:border-slate-300">
                                                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${info.bgIcone}`}>
                                                            {info.icone}
                                                        </span>
                                                        <span className={`text-xs font-black uppercase tracking-wider ${info.cor}`}>
                                                            {grupo}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md border border-slate-200">
                                                        {String(info.total).padStart(2, '0')} UN
                                                    </span>
                                                </div>

                                                <div className="flex-1 divide-y divide-slate-100 bg-slate-50/30 max-h-[160px] overflow-y-auto custom-scrollbar animate-[fadeIn_0.3s_ease-out] no-drag">
                                                    {Object.entries(info.itens).sort((a,b) => b[1].total - a[1].total).map(([nomeItem, itemData]) => {
                                                        if(itemData.total === 0) return null;
                                                        
                                                        const stringConsultores = Object.entries(itemData.vendedores)
                                                            .filter(([_, vQtd]) => vQtd > 0)
                                                            .sort((a,b) => b[1] - a[1])
                                                            .map(([vNome, vQtd]) => `${vNome} (${String(vQtd).padStart(2, '0')})`)
                                                            .join(', ');

                                                        return (
                                                            // 🔥 CLIQUE NO ITEM ATIVA O MODAL DE AUDITORIA
                                                            <div 
                                                                key={nomeItem} 
                                                                onClick={(e) => { e.stopPropagation(); abrirModalAuditoria(nomeItem, unidade, 'VENDA', itemData.vendasAuditaveis, itemData.total); }}
                                                                className="px-5 py-3.5 flex justify-between items-center bg-white hover:bg-blue-50/60 cursor-pointer transition-colors group"
                                                                title="Clique para detalhar auditoria"
                                                            >
                                                                <div className="flex flex-col pr-4">
                                                                    <span className="text-[11px] font-black text-slate-700 uppercase group-hover:text-blue-600 transition-colors line-clamp-1">
                                                                        {nomeItem}
                                                                    </span>
                                                                    {stringConsultores && (
                                                                        <span className="text-[9px] font-bold text-slate-400 mt-0.5 line-clamp-1" title={stringConsultores}>
                                                                            <i data-lucide="users" className="w-2.5 h-2.5 inline-block mr-1 opacity-70"></i>
                                                                            {stringConsultores}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[11px] font-black text-slate-800 shrink-0 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 shadow-sm group-hover:bg-blue-100 group-hover:border-blue-200 group-hover:text-blue-700 transition-colors">
                                                                    {String(itemData.total).padStart(2, '0')}x
                                                                </span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ))}

                                        {/* UX PREMIUM: VISITANTES (AGORA CLICÁVEL) */}
                                        <div 
                                            className={`bg-white border no-drag ${hasVisitantes ? 'border-slate-200 hover:border-blue-300 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-md cursor-pointer group' : 'border-slate-200 border-dashed opacity-80 pointer-events-none'} rounded-2xl flex flex-col overflow-hidden transition-all`}
                                            onClick={(e) => { if(hasVisitantes) { e.stopPropagation(); abrirModalAuditoria('Visitantes Capturados', unidade, 'VISITANTE', dados.visitantes, dados.visitantes.length); } }}
                                        >
                                            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white group-hover:bg-blue-50/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${hasVisitantes ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        👥
                                                    </span>
                                                    <span className={`text-xs font-black uppercase tracking-wider ${hasVisitantes ? 'text-blue-600' : 'text-slate-400'}`}>
                                                        {t('analytics.report.cardVisitors', { defaultValue: 'VISITANTES' })}
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border transition-colors ${hasVisitantes ? 'bg-blue-50 text-blue-600 border-blue-200 group-hover:bg-blue-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                    {String(dados.visitantes.length).padStart(2, '0')} UN
                                                </span>
                                            </div>
                                            <div className="flex-1 bg-slate-50/30 p-5 flex flex-col items-center justify-center text-center min-h-[160px] group-hover:bg-blue-50/20 transition-colors">
                                                {hasVisitantes ? (
                                                    <>
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 group-hover:text-blue-600/70 transition-colors">{t('analytics.report.totalCaptured', { defaultValue: 'Total Capturado' })}</p>
                                                        <p className="text-4xl md:text-5xl font-black text-slate-800 group-hover:text-blue-700 transition-colors">{dados.visitantes.length}</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-4xl md:text-5xl font-black text-slate-300 mb-2">00</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('analytics.report.emptyVisitors', { defaultValue: 'Nenhuma visita' })}</p>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* UX PREMIUM: AVALIAÇÕES (AGORA CLICÁVEL) */}
                                        <div 
                                            className={`bg-white border no-drag ${hasAvaliacoes ? 'border-slate-200 hover:border-orange-300 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-md cursor-pointer group' : 'border-slate-200 border-dashed opacity-80 pointer-events-none'} rounded-2xl flex flex-col overflow-hidden transition-all`}
                                            onClick={(e) => { if(hasAvaliacoes) { e.stopPropagation(); abrirModalAuditoria('Avaliações Realizadas', unidade, 'AVALIACAO', dados.avaliacoes, dados.avaliacoes.length); } }}
                                        >
                                            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white group-hover:bg-orange-50/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${hasAvaliacoes ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        📋
                                                    </span>
                                                    <span className={`text-xs font-black uppercase tracking-wider ${hasAvaliacoes ? 'text-orange-600' : 'text-slate-400'}`}>
                                                        {t('analytics.report.cardAssessments', { defaultValue: 'AVALIAÇÕES' })}
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border transition-colors ${hasAvaliacoes ? 'bg-orange-50 text-orange-600 border-orange-200 group-hover:bg-orange-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                    {String(dados.avaliacoes.length).padStart(2, '0')} UN
                                                </span>
                                            </div>
                                            <div className="flex-1 bg-slate-50/30 p-5 flex flex-col items-center justify-center text-center min-h-[160px] group-hover:bg-orange-50/20 transition-colors">
                                                {hasAvaliacoes ? (
                                                    <>
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 group-hover:text-orange-600/70 transition-colors">{t('analytics.report.doneToday', { defaultValue: 'Realizadas' })}</p>
                                                        <p className="text-4xl md:text-5xl font-black text-slate-800 group-hover:text-orange-700 transition-colors">{dados.avaliacoes.length}</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-4xl md:text-5xl font-black text-slate-300 mb-2">00</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('analytics.report.emptyAssessments', { defaultValue: 'Nenhuma avaliação' })}</p>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default RelatorioTab;