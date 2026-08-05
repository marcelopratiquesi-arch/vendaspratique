import React, { useState, useRef, useEffect } from 'react';
import { getCategoriaItem } from './utils.js';

const RelatorioTab = ({ vendasFiltradas, temVisaoGlobal, labelFiltroAtual, planos, produtos, abrirModalWhatsapp }) => {
    
    // ==========================================
    // 1. ESTADO DE SANFONA (EXPANDIR/RECOLHER UNIDADES)
    // ==========================================
    const [unidadesRecolhidas, setUnidadesRecolhidas] = useState({});

    const toggleUnidade = (unidade) => {
        setUnidadesRecolhidas(prev => ({
            ...prev,
            [unidade]: !prev[unidade]
        }));
    };

    // ==========================================
    // 2. MOTOR DE DRAG-TO-SCROLL (MÃOZINHA VERTICAL)
    // ==========================================
    const scrollRef = useRef(null);
    const isDragging = useRef(false);
    const startY = useRef(0);
    const scrollTop = useRef(0);

    const onMouseDown = (e) => {
        // Bloqueia o arraste se clicar num botão para não bugar o clique
        if (e.target.closest('button') || e.target.closest('.no-drag')) return;
        
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
        const walk = (y - startY.current) * 1.5; // Velocidade do scroll
        scrollRef.current.scrollTop = scrollTop.current - walk;
    };

    // ==========================================
    // 3. MOTOR DE AGRUPAMENTO DE DADOS
    // ==========================================
    const relatorioPorUnidade = {};

    vendasFiltradas.forEach(v => {
        const unidade = v.unidade || 'SEM UNIDADE';
        const qtd = parseInt(v.quantidade) || 1;
        const prodUpper = (v.produto || 'ITEM NÃO IDENTIFICADO').toUpperCase();
        const vendPrimeiroNome = (v.vendedor ? v.vendedor.split(' ')[0] : 'SISTEMA').charAt(0).toUpperCase() + (v.vendedor ? v.vendedor.split(' ')[0] : 'SISTEMA').slice(1).toLowerCase();
        const categoria = getCategoriaItem(prodUpper, planos, produtos);

        if (!relatorioPorUnidade[unidade]) {
            relatorioPorUnidade[unidade] = {
                totalGeralVendas: 0,
                vendedoresTotal: {},
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

        const registro = relatorioPorUnidade[unidade];
        registro.totalGeralVendas += qtd;
        
        registro.vendedoresTotal[vendPrimeiroNome] = (registro.vendedoresTotal[vendPrimeiroNome] || 0) + qtd;

        let grupoAlvo = '';
        if (categoria === 'PLANO') {
            if (prodUpper.includes("NUTRI")) grupoAlvo = "NUTRI";
            else if (prodUpper.includes("PLUS")) grupoAlvo = "PLUS";
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

    const unidadesOrdenadas = Object.keys(relatorioPorUnidade).sort();

    // ==========================================
    // 4. GERADOR DO WHATSAPP (ISOLADO POR UNIDADE)
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

        let txt = `📊 *RELATÓRIO DE FECHAMENTO – PRATIQUE FITNESS* 📊\n`;
        txt += `📅 *Referência:* ${labelReferencia}\n`;
        txt += `🕐 *Enviado em:* ${labelEnviado}\n`;
        txt += `🏢 *Unidade:* ${unidadeAlvo}\n\n`;
        txt += `📌 *RESUMO DAS VENDAS*\n\n`;

        const dados = relatorioPorUnidade[unidadeAlvo];
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
                    const arrayVendedores = Object.entries(itemData.vendedores)
                        .sort((a,b) => b[1] - a[1]) 
                        .map(([vNome, vQtd]) => `${vNome} ${String(vQtd).padStart(2, '0')}`);
                    
                    const textoVendedores = arrayVendedores.join(', ');
                    txt += `▫️ ${String(itemData.total).padStart(2, '0')}x ${nomeItem} (${textoVendedores})\n`;
                });
                txt += `\n`;
            }
        });

        txt += `👥 *VENDAS POR CONSULTOR*\n`;
        const consultoresOrdenados = Object.entries(dados.vendedoresTotal).sort((a,b) => b[1] - a[1]);
        consultoresOrdenados.forEach(([cNome, cTotal]) => {
            txt += `${cNome} — ${String(cTotal).padStart(2, '0')}\n`;
        });

        txt += `\n📈 *TOTAL DE VENDAS REALIZADAS: ${String(dados.totalGeralVendas).padStart(2, '0')}*\n`;
        txt += `\n➖➖➖➖➖➖➖➖➖➖\n`;

        abrirModalWhatsapp(txt.trim(), { titulo: `Relatório: ${unidadeAlvo}`, icone: 'file-text', cor: 'blue' });
    };

    // Re-renderiza ícones caso o estado de expansão mude
    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [unidadesRecolhidas, vendasFiltradas]);

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
                {unidadesOrdenadas.length === 0 ? (
                    <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm flex flex-col items-center justify-center h-64 opacity-60 pointer-events-none">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <i data-lucide="file-x-2" className="w-8 h-8 text-slate-400"></i>
                        </div>
                        <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Nenhuma venda neste período.</p>
                    </div>
                ) : (
                    unidadesOrdenadas.map(unidade => {
                        const dados = relatorioPorUnidade[unidade];
                        const isRecolhido = unidadesRecolhidas[unidade];

                        return (
                            <div key={unidade} className="bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden transition-all duration-300">
                                
                                {/* CABEÇALHO DA UNIDADE (A MÁGICA ESTÁ AQUI!) */}
                                <div 
                                    className="bg-slate-900 px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-5 transition-colors cursor-pointer select-none group"
                                    onClick={() => toggleUnidade(unidade)}
                                >
                                    {/* Esquerda: Identificação */}
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
                                    
                                    {/* Direita: Ações Contextuais (Não arrastam a tela) */}
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
                                            <i data-lucide="send" className="w-3.5 h-3.5"></i> WhatsApp
                                        </button>

                                        <button 
                                            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400 transition-colors shrink-0"
                                            title={isRecolhido ? "Expandir" : "Recolher"}
                                        >
                                            <i data-lucide={isRecolhido ? "chevron-down" : "chevron-up"} className="w-5 h-5"></i>
                                        </button>
                                    </div>
                                </div>

                                {/* CORPO DO RELATÓRIO (GRID DE BLOCOS) */}
                                <div className={`transition-all duration-300 ${isRecolhido ? 'h-0 opacity-0 overflow-hidden' : 'p-6 md:p-8 bg-slate-50/50 border-t border-slate-200'}`}>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                        
                                        {/* RENDERIZA OS BLOCOS DE CATEGORIAS */}
                                        {Object.entries(dados.grupos).filter(([_, info]) => info.total > 0).map(([grupo, info]) => (
                                            <div key={grupo} className="bg-white border border-slate-200 rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex flex-col overflow-hidden transition-all hover:shadow-md hover:border-slate-300">
                                                
                                                {/* Header do Bloco */}
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

                                                {/* Lista Limpa de Itens */}
                                                <div className="flex-1 divide-y divide-slate-50 bg-slate-50/30">
                                                    {Object.entries(info.itens).sort((a,b) => b[1].total - a[1].total).map(([nomeItem, itemData]) => {
                                                        const stringConsultores = Object.entries(itemData.vendedores)
                                                            .sort((a,b) => b[1] - a[1])
                                                            .map(([vNome, vQtd]) => `${vNome} (${String(vQtd).padStart(2, '0')})`)
                                                            .join(' • ');

                                                        return (
                                                            <div key={nomeItem} className="px-5 py-3.5 flex justify-between items-center hover:bg-white transition-colors group">
                                                                <div className="flex flex-col pr-4">
                                                                    <span className="text-[11px] font-black text-slate-700 uppercase group-hover:text-blue-600 transition-colors line-clamp-1" title={nomeItem}>
                                                                        {nomeItem}
                                                                    </span>
                                                                    <span className="text-[9px] font-bold text-slate-400 mt-0.5 line-clamp-1" title={stringConsultores}>
                                                                        <i data-lucide="users" className="w-2.5 h-2.5 inline-block mr-1 opacity-70"></i>
                                                                        {stringConsultores}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[11px] font-black text-slate-800 shrink-0">
                                                                    {String(itemData.total).padStart(2, '0')}
                                                                </span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ))}

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