import React, { useState, useRef, useEffect } from 'react';
import { safeIsoDate, formatMoney } from './utils.js';
import { Download, Share2, Trophy, LayoutList, ChevronDown, ChevronUp } from 'lucide-react';

const RelatorioTab = ({ vendasFiltradas, visitantesFiltrados = [], avaliacoesFiltradas = [], temVisaoGlobal, labelFiltroAtual, planos, produtos, abrirModalWhatsapp }) => {
    
    const [unidadesRecolhidas, setUnidadesRecolhidas] = useState({});
    
    // 🔥 A CHAVE MÁGICA: MODO RESUMO vs MODO DETALHADO (Afeta APENAS Ranking Global e Exportações)
    const [visaoDetalhada, setVisaoDetalhada] = useState(false);

    const toggleUnidade = (unidade) => {
        setUnidadesRecolhidas(prev => ({
            ...prev,
            [unidade]: !prev[unidade]
        }));
    };

    const scrollRef = useRef(null);
    const isDragging = useRef(false);
    const startY = useRef(0);
    const scrollTop = useRef(0);

    const onMouseDown = (e) => {
        if (e.target.closest('button') || e.target.closest('.no-drag') || e.target.closest('input')) return;
        
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
                    "OUTROS PLANOS": { total: 0, itens: {}, cor: "text-slate-600", bgIcone: "bg-slate-200 text-slate-600", icone: "🧩" },
                    "PRODUTOS": { total: 0, itens: {}, cor: "text-amber-600", bgIcone: "bg-amber-100 text-amber-600", icone: "🛍️" },
                    "SERVIÇOS": { total: 0, itens: {}, cor: "text-violet-600", bgIcone: "bg-violet-100 text-violet-600", icone: "🧾" }
                }
            };
        }
    };

    const transacoesUnicas = new Set();

    vendasFiltradas.forEach(v => {
        const unidade = v.unidade || 'SEM UNIDADE';
        inicializarUnidade(unidade);
        
        let qtd = parseInt(v.quantidade) || 1;
        const prodUpper = (v.produto || 'ITEM NÃO IDENTIFICADO').toUpperCase();
        const vendPrimeiroNome = (v.vendedor ? v.vendedor.split(' ')[0] : 'SISTEMA').charAt(0).toUpperCase() + (v.vendedor ? v.vendedor.split(' ')[0] : 'SISTEMA').slice(1).toLowerCase();
        
        let categoria = 'PLANO';
        if (prodUpper.includes('WHEY') || prodUpper.includes('PRE TREINO') || prodUpper.includes('PRODUTO') || prodUpper.includes('GATORADE')) {
            categoria = 'PRODUTO';
        } else if (prodUpper.includes('TAXA') || prodUpper.includes('AVALIACAO') || prodUpper.includes('SERVICO') || prodUpper.includes('DAY USE')) {
            categoria = 'SERVICO';
        }

        if (categoria === 'PLANO' && v.matricula && v.matricula.trim() !== '') {
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

        let grupoAlvo = '';
        if (categoria === 'PLANO') {
            if (prodUpper.includes("NUTRI")) grupoAlvo = "NUTRI";
            else if (prodUpper.includes("PLUS") || prodUpper.includes("AFL")) grupoAlvo = "PLUS";
            else if (prodUpper.includes("FIT")) grupoAlvo = "FIT";
            else if (prodUpper.includes("PERSONAL")) grupoAlvo = "PERSONAL CLASS"; 
            else grupoAlvo = "OUTROS PLANOS";
        } else if (categoria === 'PRODUTO') {
            grupoAlvo = "PRODUTOS";
        } else if (categoria === 'SERVICO') {
            grupoAlvo = "SERVIÇOS";
        }

        if (grupoAlvo) {
            registro.grupos[grupoAlvo].total += qtd;
            if (!registro.grupos[grupoAlvo].itens[prodUpper]) {
                registro.grupos[grupoAlvo].itens[prodUpper] = { total: 0, vendedores: {} };
            }
            registro.grupos[grupoAlvo].itens[prodUpper].total += qtd;
            registro.grupos[grupoAlvo].itens[prodUpper].vendedores[vendPrimeiroNome] = (registro.grupos[grupoAlvo].itens[prodUpper].vendedores[vendPrimeiroNome] || 0) + qtd;
        }
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

    // ==========================================
    // 📤 EXPORTAÇÃO PARA CSV (INTELIGENTE)
    // ==========================================
    const exportarCSV = () => {
        if (vendasFiltradas.length === 0) {
            alert("Não há dados para exportar com os filtros atuais.");
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";

        if (visaoDetalhada) {
            // PLANILHA DETALHADA: LINHA POR LINHA
            const cabeçalho = ['ID', 'Data', 'Unidade', 'Matricula', 'Aluno', 'Produto', 'Qtd'];
            const linhas = vendasFiltradas.map(v => {
                return [
                    v.id,
                    safeIsoDate(v.data || v.created_at),
                    `"${v.unidade || ''}"`,
                    `"${v.matricula || ''}"`,
                    `"${v.nome_aluno || ''}"`,
                    `"${v.produto || ''}"`,
                    v.quantidade || 1
                ].join(';');
            });
            csvContent += [cabeçalho.join(';'), ...linhas].join('\n');
        } else {
            // PLANILHA RESUMO: APENAS TOTAIS POR GRUPO
            const cabeçalho = ['Unidade', 'Categoria', 'Quantidade Total'];
            const linhas = [];
            unidadesOrdenadas.forEach(uni => {
                const dados = relatorioPorUnidade[uni];
                Object.entries(dados.grupos).forEach(([nomeGrupo, info]) => {
                    if (info.total > 0) {
                        linhas.push(`"${uni}";"${nomeGrupo}";${info.total}`);
                    }
                });
            });
            csvContent += [cabeçalho.join(';'), ...linhas].join('\n');
        }
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Exportacao_Vendas_${visaoDetalhada ? 'Detalhada' : 'Resumo'}_${safeIsoDate(new Date())}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ==========================================
    // 📲 RELATÓRIO GERAL PARA WHATSAPP
    // ==========================================
    const gerarRelatorioGlobalWhatsapp = () => {
        if (unidadesOrdenadas.length === 0) {
            alert("Não há dados para gerar relatório com os filtros atuais.");
            return;
        }

        const dataAtual = new Date();
        const dia = String(dataAtual.getDate()).padStart(2, '0');
        const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
        const ano = dataAtual.getFullYear();
        const hojeSemAno = `${dia}/${mes}`;
        const horaAtual = dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        let txt = `📊 *RESUMO EXECUTIVO – PRATIQUE FITNESS* 📊\n`;
        txt += `📅 *Filtro Ativo:* ${labelFiltroAtual}\n`;
        txt += `🕐 *Gerado em:* ${hojeSemAno} às ${horaAtual}\n\n`;

        rankingUnidades.forEach((uni) => {
            const dados = relatorioPorUnidade[uni.nome];
            txt += `🏢 *${uni.nome}:* ${uni.vendas} vendas\n`;
            
            Object.entries(dados.grupos).forEach(([nomeGrupo, grupoInfo]) => {
                if (grupoInfo.total > 0) {
                    // O GLOBAL RESPEITA A CHAVE DETALHADA/RESUMO
                    if (visaoDetalhada) {
                        const itensOrdenados = Object.entries(grupoInfo.itens).sort((a,b) => b[1].total - a[1].total);
                        itensOrdenados.forEach(([nomeItem, itemData]) => {
                            if (itemData.total > 0) txt += `▫️ ${String(itemData.total).padStart(2, '0')}x ${nomeItem}\n`;
                        });
                    } else {
                        txt += `▫️ ${String(grupoInfo.total).padStart(2, '0')}x ${nomeGrupo}\n`;
                    }
                }
            });
            txt += `\n`;
        });

        txt += `📈 *TOTAL GERAL:* ${vendasGlobal} vendas\n`;

        abrirModalWhatsapp(txt.trim(), { titulo: `Resumo Global`, icone: 'share-2', cor: 'blue' });
    };

    // ==========================================
    // 📲 RELATÓRIO INDIVIDUAL (POR UNIDADE) - 100% DETALHADO SEMPRE
    // ==========================================
    const gerarTextoFechamento = (unidadeAlvo) => {
        const dataAtual = new Date();
        const dia = String(dataAtual.getDate()).padStart(2, '0');
        const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
        const ano = dataAtual.getFullYear();
        
        const hojeDataBR = `${dia}/${mes}/${ano}`;
        const hojeSemAno = `${dia}/${mes}`;
        const horaAtual = dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        let labelReferencia = labelFiltroAtual;
        let labelEnviado = `${hojeSemAno} às ${horaAtual}`;

        if (labelFiltroAtual === hojeDataBR) {
            const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            const diaSemanaStr = diasSemana[dataAtual.getDay()];
            labelReferencia = `${diaSemanaStr}, ${hojeSemAno}`; 
        }

        const dados = relatorioPorUnidade[unidadeAlvo];

        let txt = `📊 *RELATÓRIO DE VENDAS – PRATIQUE FITNESS* 📊\n`;
        txt += `📅 *Referência:* ${labelReferencia}\n`;
        txt += `🕐 *Enviado em:* ${labelEnviado}\n`;
        txt += `🏢 *Unidade:* ${unidadeAlvo}\n\n`;
        
        txt += `📌 *RESUMO DAS VENDAS*\n\n`;

        const iconesGrupo = {
            "NUTRI": "🥗", "PLUS": "⭐", "FIT": "🏃", "PERSONAL CLASS": "🏋️",
            "OUTROS PLANOS": "🧩", "PRODUTOS": "🛍️", "SERVIÇOS": "🧾"
        };

        Object.entries(dados.grupos).forEach(([nomeGrupo, grupoInfo]) => {
            if (grupoInfo.total > 0) {
                const icone = iconesGrupo[nomeGrupo] || "🔹";
                txt += `${icone} *${nomeGrupo} — ${String(grupoInfo.total).padStart(2, '0')} venda${grupoInfo.total > 1 ? 's' : ''}*\n`;
                
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
            }
        });

        if (dados.totalGeralVendas > 0) {
            txt += `👥 *VENDAS POR CONSULTOR*\n`;
            const consultoresOrdenados = Object.entries(dados.vendedoresTotal)
                .filter(([_, cTotal]) => cTotal > 0)
                .sort((a,b) => b[1] - a[1]);
                
            consultoresOrdenados.forEach(([cNome, cTotal]) => {
                txt += `${cNome} — ${String(cTotal).padStart(2, '0')}\n`;
            });
            txt += `\n📈 *TOTAL DE VENDAS: ${String(dados.totalGeralVendas).padStart(2, '0')}*\n`;
        } else {
            txt += `Nenhuma venda registrada.\n`;
        }
        
        txt += `\n➖➖➖➖➖➖➖➖➖➖\n\n`;
        txt += `👥 *VISITANTES (BALCÃO):* ${String(dados.visitantes.length).padStart(2, '0')}\n`;
        txt += `📋 *AVALIAÇÕES FEITAS:* ${String(dados.avaliacoes.length).padStart(2, '0')}\n`;

        abrirModalWhatsapp(txt.trim(), { titulo: `Relatório: ${unidadeAlvo}`, icone: 'file-text', cor: 'blue' });
    };

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [unidadesRecolhidas, vendasFiltradas, visitantesFiltrados, avaliacoesFiltradas, visaoDetalhada]);

    return (
        <div 
            className="animate-[fadeIn_0.3s_ease-out] max-h-[75vh] overflow-y-auto custom-scrollbar cursor-grab px-2 pb-10"
            ref={scrollRef}
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseLeaveOrUp}
            onMouseUp={onMouseLeaveOrUp}
            onMouseMove={onMouseMove}
        >
            <div className="space-y-8">

                {/* 📌 BARRA DE AÇÕES GLOBAIS E CHAVE SELETORA */}
                {unidadesOrdenadas.length > 0 && temVisaoGlobal && (
                    <div className="bg-white p-4 md:p-6 rounded-[24px] shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 items-center justify-between no-drag">
                        
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center shadow-md shrink-0">
                                <LayoutList className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-800 uppercase tracking-widest">Painel Gerencial</h3>
                                <p className="text-[11px] font-bold text-slate-400 mt-0.5">Visão Global e Exportação</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-4 items-center">
                            {/* 🔥 CHAVE SELETORA: RESUMO vs DETALHADO */}
                            <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto">
                                <button 
                                    onClick={() => setVisaoDetalhada(false)}
                                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!visaoDetalhada ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    Resumo
                                </button>
                                <button 
                                    onClick={() => setVisaoDetalhada(true)}
                                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${visaoDetalhada ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    Detalhado
                                </button>
                            </div>

                            <div className="flex w-full sm:w-auto gap-3">
                                <button 
                                    onClick={exportarCSV}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-slate-200"
                                >
                                    <Download className="w-4 h-4" /> Planilha
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
                {temVisaoGlobal && rankingUnidades.length > 0 && (
                    <div className="bg-white p-6 rounded-[24px] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-200 no-drag animate-[slideDown_0.4s_ease-out]">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                            <Trophy className="w-5 h-5 text-amber-500" /> Ranking Global de Vendas
                        </h3>
                        
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50/50">
                                        <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest rounded-tl-xl w-20">Pos</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-40">Unidade</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-32">Quantidade</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest rounded-tr-xl flex-1">Desempenho & Composição</th>
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
                                                    {/* BARRA DE PROGRESSO */}
                                                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex items-center relative">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-1000 ease-out ${isCampeao ? 'bg-amber-400' : 'bg-blue-500'}`} 
                                                            style={{ width: `${percentual}%` }}
                                                        ></div>
                                                    </div>

                                                    {/* DETALHAMENTO DA COMPOSIÇÃO DE VENDAS */}
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.entries(dadosUnidade.grupos).map(([nomeGrupo, grupoInfo]) => {
                                                            if (grupoInfo.total === 0) return null;

                                                            if (!visaoDetalhada) {
                                                                return (
                                                                    <span key={nomeGrupo} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-md text-[10px] font-black text-slate-600 shadow-sm">
                                                                        <span className={grupoInfo.cor}>{grupoInfo.icone}</span>
                                                                        {String(grupoInfo.total).padStart(2, '0')}x {nomeGrupo}
                                                                    </span>
                                                                );
                                                            } else {
                                                                return Object.entries(grupoInfo.itens)
                                                                    .sort((a,b) => b[1].total - a[1].total)
                                                                    .map(([nomeItem, itemData]) => {
                                                                        if (itemData.total === 0) return null;
                                                                        return (
                                                                            <span key={nomeItem} className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-[10px] font-bold text-slate-700 shadow-sm">
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

                {/* 🏢 CARDS SANFONA POR UNIDADE (SEMPRE ABERTOS NA COMPOSIÇÃO E COM CONSULTORES) */}
                {unidadesOrdenadas.length === 0 ? (
                    <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm flex flex-col items-center justify-center h-64 opacity-60 pointer-events-none">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <i data-lucide="file-x-2" className="w-8 h-8 text-slate-400"></i>
                        </div>
                        <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Nenhum dado neste período.</p>
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
                                                Performance Operacional
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-3 no-drag">
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl flex items-center gap-2" title="Total de Vendas Registradas">
                                            <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">
                                                {String(dados.totalGeralVendas).padStart(2, '0')} Vendas
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
                                            title={isRecolhido ? "Expandir" : "Recolher"}
                                        >
                                            {isRecolhido ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <div className={`transition-all duration-300 ${isRecolhido ? 'h-0 opacity-0 overflow-hidden' : 'p-6 md:p-8 bg-slate-50/50 border-t border-slate-200'}`}>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                        
                                        {/* VENDAS */}
                                        {Object.entries(dados.grupos).filter(([_, info]) => info.total > 0).map(([grupo, info]) => (
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

                                                <div className="flex-1 divide-y divide-slate-50 bg-slate-50/30 max-h-[160px] overflow-y-auto custom-scrollbar animate-[fadeIn_0.3s_ease-out]">
                                                    {Object.entries(info.itens).sort((a,b) => b[1].total - a[1].total).map(([nomeItem, itemData]) => {
                                                        if(itemData.total === 0) return null;
                                                        
                                                        const stringConsultores = Object.entries(itemData.vendedores)
                                                            .filter(([_, vQtd]) => vQtd > 0)
                                                            .sort((a,b) => b[1] - a[1])
                                                            .map(([vNome, vQtd]) => `${vNome} (${String(vQtd).padStart(2, '0')})`)
                                                            .join(', ');

                                                        return (
                                                            <div key={nomeItem} className="px-5 py-3.5 flex justify-between items-center hover:bg-white transition-colors group">
                                                                <div className="flex flex-col pr-4">
                                                                    <span className="text-[11px] font-black text-slate-700 uppercase group-hover:text-blue-600 transition-colors line-clamp-1" title={nomeItem}>
                                                                        {nomeItem}
                                                                    </span>
                                                                    {stringConsultores && (
                                                                        <span className="text-[9px] font-bold text-slate-400 mt-0.5 line-clamp-1" title={stringConsultores}>
                                                                            <i data-lucide="users" className="w-2.5 h-2.5 inline-block mr-1 opacity-70"></i>
                                                                            {stringConsultores}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[11px] font-black text-slate-800 shrink-0 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                                                                    {String(itemData.total).padStart(2, '0')}x
                                                                </span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ))}

                                        {/* UX PREMIUM: VISITANTES */}
                                        <div className={`bg-white border ${hasVisitantes ? 'border-slate-200 hover:border-blue-300 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-md' : 'border-slate-200 border-dashed opacity-80'} rounded-2xl flex flex-col overflow-hidden transition-all`}>
                                            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${hasVisitantes ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        👥
                                                    </span>
                                                    <span className={`text-xs font-black uppercase tracking-wider ${hasVisitantes ? 'text-blue-600' : 'text-slate-400'}`}>
                                                        VISITANTES
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border ${hasVisitantes ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                    {String(dados.visitantes.length).padStart(2, '0')} UN
                                                </span>
                                            </div>
                                            <div className="flex-1 bg-slate-50/30 p-5 flex flex-col items-center justify-center text-center min-h-[160px]">
                                                {hasVisitantes ? (
                                                    <>
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Capturado</p>
                                                        <p className="text-4xl md:text-5xl font-black text-slate-800">{dados.visitantes.length}</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-4xl md:text-5xl font-black text-slate-300 mb-2">00</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhuma visita</p>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* UX PREMIUM: AVALIAÇÕES */}
                                        <div className={`bg-white border ${hasAvaliacoes ? 'border-slate-200 hover:border-orange-300 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-md' : 'border-slate-200 border-dashed opacity-80'} rounded-2xl flex flex-col overflow-hidden transition-all`}>
                                            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${hasAvaliacoes ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        📋
                                                    </span>
                                                    <span className={`text-xs font-black uppercase tracking-wider ${hasAvaliacoes ? 'text-orange-600' : 'text-slate-400'}`}>
                                                        AVALIAÇÕES
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border ${hasAvaliacoes ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                    {String(dados.avaliacoes.length).padStart(2, '0')} UN
                                                </span>
                                            </div>
                                            <div className="flex-1 bg-slate-50/30 p-5 flex flex-col items-center justify-center text-center min-h-[160px]">
                                                {hasAvaliacoes ? (
                                                    <>
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Realizadas Hoje</p>
                                                        <p className="text-4xl md:text-5xl font-black text-slate-800">{dados.avaliacoes.length}</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-4xl md:text-5xl font-black text-slate-300 mb-2">00</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhuma avaliação</p>
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