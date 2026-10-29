import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { formatMoney } from './utils.js';
import { SeletorPeriodo, calcularPreset, isoLocal } from '../HistoricoVendas/FiltrosCompactos.jsx';
import { usePeriodoPadrao } from '../../components/periodoPadrao.js';
import { pedirMotivoExclusao, excluirVendaComMotivo } from '../HistoricoVendas/utils.js';
import ConferenciaTab from './ConferenciaTab.jsx';
import ComissoesTab from './ComissoesTab.jsx';
import VisaoGeralTab from './VisaoGeralTab.jsx';
import AuditoriaTab from './AuditoriaTab.jsx';
import { RefreshCw, Building2, PieChart, ShieldAlert, ClipboardCheck, Users, ChevronDown } from 'lucide-react';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';

const FechamentoCaixa = ({ vendas = [], setVendas, usuarioLogado, visitantes = [], avaliacoes = [], colaboradores = [] }) => {
    const [subAba, setSubAba] = useState('conferencia');
    
    // 🔥 BUSCA O CATÁLOGO DIRETAMENTE NA FONTE (Evita o erro de drop-down vazio)
    const [catalogoGeral, setCatalogoGeral] = useState([]);
    useEffect(() => {
        const fetchCatalogo = async () => {
            const { data, error } = await supabase.from('catalogo').select('id, nome, tipo, valor');
            if (data && !error) setCatalogoGeral(data);
        };
        fetchCatalogo();
    }, []);

    // Filtro de período padrão do sistema (começa em "Este mês"). Faixa: início entra, fim não entra.
    const periodo = usePeriodoPadrao('este_mes');
    const inicioIso = periodo.faixa.inicio ? isoLocal(periodo.faixa.inicio) : '';
    const fimIso = periodo.faixa.fim ? isoLocal(periodo.faixa.fim) : '';
    const [filtroUnidadeIsolada, setFiltroUnidadeIsolada] = useState('TODOS'); 

    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    let colunasVisiveis = 10;
    if (temVisaoGlobal) colunasVisiveis++;

    // Limpar volta ao jeito que a tela abre: "Este mês" e todas as unidades
    const limparFiltros = () => {
        periodo.propsSeletor.onAplicar(calcularPreset('este_mes'));
        if (temVisaoGlobal) setFiltroUnidadeIsolada('TODOS');
    };
    const temFiltroAtivo = periodo.filtro.preset !== 'este_mes' || filtroUnidadeIsolada !== 'TODOS';

    const unidadesUnicas = ['TODOS', ...new Set(vendas.map(v => v.unidade))].filter(Boolean); 
    const vendasDataAvancada = vendas.filter(v => {
        if (!v.data) return false;
        if (inicioIso && v.data < inicioIso) return false;
        if (fimIso && v.data >= fimIso) return false;
        return true;
    });

    const vendasParaConferencia = vendasDataAvancada.filter(v => {
        const unid = v.unidade || 'MATRIZ';
        const passUnidade = filtroUnidadeIsolada === 'TODOS' || unid === filtroUnidadeIsolada;
        const passSeguranca = temVisaoGlobal || unid === usuarioLogado?.unidade;
        return passUnidade && passSeguranca;
    });

    const toggleConferido = async (id, statusAtual) => {
        const novoStatus = !statusAtual;
        const validadorNome = novoStatus ? usuarioLogado.nome : null;
        const validadorData = novoStatus ? new Date().toISOString() : null;

        setVendas(vendas.map(v => v.id === id ? { ...v, conferiu: novoStatus, conferido_por: validadorNome, conferido_em: validadorData } : v));
        const { error } = await supabase.from('vendas').update({ conferiu: novoStatus, conferido_por: validadorNome, conferido_em: validadorData }).eq('id', id);

        if (error) {
            console.error("Erro ao atualizar:", error);
            avisar(tx("Erro de conexão. Revertendo alteração."));
            setVendas(vendas.map(v => v.id === id ? { ...v, conferiu: statusAtual } : v));
        }
    };

    const handleObsLocalChange = (id, novaObs) => setVendas(vendas.map(v => v.id === id ? { ...v, observacao: novaObs } : v));
    const handleObsSaveDb = async (id, textoFinal) => await supabase.from('vendas').update({ observacao: textoFinal }).eq('id', id);

    const handleSalvarEdicaoVenda = async (vendaEditada) => {
        const { error } = await supabase.from('vendas').update({
            data: vendaEditada.data,
            vendedor: vendaEditada.vendedor,
            nome_aluno: vendaEditada.nome_aluno,
            nome: vendaEditada.nome,
            cpf: vendaEditada.cpf,
            matricula: vendaEditada.matricula,
            produto: vendaEditada.produto,
            quantidade: vendaEditada.quantidade,
            // O valor vem do catálogo (o campo é só leitura) e a comissão grava o mesmo número (decisão do dono, 29/10/2026)
            valor: vendaEditada.valor,
            comissao: vendaEditada.valor
        }).eq('id', vendaEditada.id);

        if (error) {
            console.error("Erro ao editar venda:", error);
            avisar(tx("Erro ao salvar a edição. Tente novamente."));
            throw error; 
        } else {
            setVendas(vendas.map(v => v.id === vendaEditada.id ? { ...v, ...vendaEditada, comissao: vendaEditada.valor } : v));
        }
    };

    // Manda para a lixeira com motivo (função segura do banco: só Admin, ou Líder da própria unidade)
    const handleExcluirVenda = async (id) => {
        const motivo = pedirMotivoExclusao();
        if (!motivo) return false;
        const error = await excluirVendaComMotivo(supabase, id, motivo);
        if (error) {
            console.error("Erro ao excluir venda:", error);
            avisar(tx("Não foi possível excluir a venda.\n\n{v1}", { v1: error.message || '' }));
            return false;
        }
        setVendas(vendas.filter(v => v.id !== id));
        return true;
    };

    const marcarTodosConferidos = async (idsParaMarcar = []) => {
        const idsAlvo = Array.isArray(idsParaMarcar) && idsParaMarcar.length > 0 ? idsParaMarcar : vendasParaConferencia.map(v => v.id);
        if (idsAlvo.length === 0) return;
        if (!window.confirm(tx("Marcar os {length} itens da lista atual como CONFERIDOS?", { length: idsAlvo.length }))) return;
        
        const validadorNome = usuarioLogado.nome;
        const validadorData = new Date().toISOString();

        setVendas(vendas.map(v => idsAlvo.includes(v.id) ? { ...v, conferiu: true, conferido_por: validadorNome, conferido_em: validadorData } : v));
        await supabase.from('vendas').update({ conferiu: true, conferido_por: validadorNome, conferido_em: validadorData }).in('id', idsAlvo);
    };

    const vendasComissionadas = vendasDataAvancada.filter(v => {
        if (!v.conferiu) return false; 
        const unid = v.unidade || 'MATRIZ';
        if (temVisaoGlobal && filtroUnidadeIsolada !== 'TODOS' && unid !== filtroUnidadeIsolada) return false;
        if (!temVisaoGlobal && unid !== usuarioLogado?.unidade) return false;
        return true;
    });

    let comissaoTotalGeral = 0;
    const relatorioVendedores = {};

    vendasComissionadas.forEach(venda => {
        const valorComissao = Number(venda.valor) || 0;
        if (valorComissao <= 0) return; 

        comissaoTotalGeral += valorComissao;

        if (!relatorioVendedores[venda.vendedor]) {
            relatorioVendedores[venda.vendedor] = { vendedor: venda.vendedor, totalComissao: 0, itens: {} };
        }
        
        relatorioVendedores[venda.vendedor].totalComissao += valorComissao;
        const qty = parseInt(venda.quantidade) || 1;
        relatorioVendedores[venda.vendedor].itens[venda.produto] = (relatorioVendedores[venda.vendedor].itens[venda.produto] || 0) + qty;
    });

    const normalizarTexto = (texto) => String(texto || '').replace(/\s+/g, ' ').trim().toUpperCase();

    const dadosTabelaComissoes = Object.values(relatorioVendedores).map(r => {
        const nomeVenda = normalizarTexto(r.vendedor);
        let infoColaborador = colaboradores.find(c => normalizarTexto(c.nome) === nomeVenda);
        
        if (!infoColaborador) {
            infoColaborador = colaboradores.find(c => {
                if (!c.nome) return false;
                const nomeRH = normalizarTexto(c.nome);
                if (nomeRH.length < 3) return false; 
                return nomeVenda.includes(nomeRH) || nomeRH.includes(nomeVenda);
            });
        }

        infoColaborador = infoColaborador || {}; 

        return {
            ...r, 
            totalItens: Object.values(r.itens).reduce((acc, q) => acc + q, 0),
            cpf: infoColaborador.cpf || '',
            tipo_conta: infoColaborador.tipo_conta || '',
            conta_inter: infoColaborador.conta_inter || ''
        };
    }).sort((a, b) => b.totalComissao - a.totalComissao);

    const relatorioAuditoria = {};
    let totalAuditoriaRegistrados = 0;
    let totalAuditoriaConferidos = 0;
    let totalAuditoriaPendentes = 0;
    let totalAuditoriaValorPendente = 0;

    vendasDataAvancada.forEach(v => {
        const unid = v.unidade || 'MATRIZ';
        if (filtroUnidadeIsolada !== 'TODOS' && unid !== filtroUnidadeIsolada) return;

        if (!temVisaoGlobal && unid !== usuarioLogado?.unidade) return;
        if (!relatorioAuditoria[unid]) relatorioAuditoria[unid] = { unidade: unid, registrados: 0, conferidos: 0, pendentes: 0, valorPendente: 0, ultimaEm: null, ultimaPor: null };
        
        relatorioAuditoria[unid].registrados++;
        totalAuditoriaRegistrados++;

        if (v.conferiu) {
            relatorioAuditoria[unid].conferidos++;
            totalAuditoriaConferidos++;
        } else {
            relatorioAuditoria[unid].pendentes++;
            relatorioAuditoria[unid].valorPendente += Number(v.valor) || 0;
            totalAuditoriaPendentes++;
            totalAuditoriaValorPendente += Number(v.valor) || 0;
        }
    });

    // Última conferência de cada unidade (qualquer data carregada), para ver se alguém está deixando acumular
    vendas.forEach(v => {
        const linha = relatorioAuditoria[v.unidade || 'MATRIZ'];
        if (!linha || !v.conferiu || !v.conferido_em) return;
        if (!linha.ultimaEm || v.conferido_em > linha.ultimaEm) { linha.ultimaEm = v.conferido_em; linha.ultimaPor = v.conferido_por; }
    });
    const dadosTabelaAuditoria = Object.values(relatorioAuditoria).sort((a, b) => b.pendentes - a.pendentes || b.valorPendente - a.valorPendente);
    const totaisAuditoria = { registrados: totalAuditoriaRegistrados, conferidos: totalAuditoriaConferidos, pendentes: totalAuditoriaPendentes, valorPendente: totalAuditoriaValorPendente };

    const abrirConferenciaDaUnidade = (unidade) => {
        if (temVisaoGlobal) setFiltroUnidadeIsolada(unidade);
        setSubAba('conferencia');
    };

    // Visão Geral: mês de referência = último mês do período escolhido (sem fim, ou no futuro = mês de hoje)
    const chaveMesReferencia = (() => {
        const hoje = new Date();
        const ultimoDia = periodo.faixa.fim ? new Date(periodo.faixa.fim.getFullYear(), periodo.faixa.fim.getMonth(), periodo.faixa.fim.getDate() - 1) : hoje;
        const d = ultimoDia > hoje ? hoje : ultimoDia;
        return `${d.getFullYear()}-${d.getMonth()}`;
    })();
    const mesReferencia = useMemo(() => {
        const [a, m] = chaveMesReferencia.split('-').map(Number);
        return new Date(a, m, 1);
    }, [chaveMesReferencia]);
    const unidadesPermitidas = useMemo(() => [...new Set(vendas.map(v => v.unidade || 'MATRIZ'))], [vendas]);

    return (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto pb-10">
            
            {/* ABAS + FILTROS (versão compacta, mesmo padrão do Dashboard e do Histórico) */}
            <div className="bg-white rounded-[20px] border border-slate-200 shadow-sm p-4 md:p-5 relative z-20 flex flex-wrap items-center justify-between gap-3 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto custom-scrollbar gap-1 max-w-full dark:bg-slate-800" role="tablist" aria-label={tx("Seções")}>
                    {[
                        ['conferencia', 'Conferência', ClipboardCheck],
                        ['comissoes', 'Comissões', Users],
                        ['geral', 'Visão Geral', PieChart],
                        ...(temVisaoGlobal ? [['auditoria', 'Auditoria', ShieldAlert]] : []),
                    ].map(([id, rotulo, Icone]) => {
                        const ativa = subAba === id;
                        return (
                            <button key={id} type="button" role="tab" aria-selected={ativa} onClick={() => setSubAba(id)}
                                className={`h-9 px-3.5 rounded-lg text-[12px] whitespace-nowrap flex items-center gap-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${ativa ? 'bg-white shadow-sm text-blue-700 font-extrabold dark:bg-slate-900 dark:text-blue-400' : 'text-slate-500 hover:text-slate-800 font-bold dark:text-slate-400 dark:hover:text-white'}`}>
                                <Icone className="w-4 h-4" /> {tx(rotulo)}
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                        {tx(periodo.rotulo)} · {temVisaoGlobal ? (filtroUnidadeIsolada === 'TODOS' ? tx("Todas as unidades") : filtroUnidadeIsolada) : (usuarioLogado?.unidade || '')}
                    </span>
                    {temVisaoGlobal && (
                        <div className="relative">
                            <Building2 className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${filtroUnidadeIsolada !== 'TODOS' ? 'text-blue-700 dark:text-blue-400' : 'text-slate-400'}`} />
                            <select value={filtroUnidadeIsolada} onChange={(e) => setFiltroUnidadeIsolada(e.target.value)} aria-label={tx("Isolar Unidade")}
                                className={`h-[42px] pl-9 pr-8 rounded-xl border text-[13px] appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${filtroUnidadeIsolada !== 'TODOS' ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 font-semibold dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700 dark:text-slate-200'}`}>
                                {unidadesUnicas.map(u => <option key={u} value={u}>{u === 'TODOS' ? tx("Unidade: todas") : u}</option>)}
                            </select>
                            <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                        </div>
                    )}
                    {temFiltroAtivo && (
                        <button type="button" onClick={limparFiltros} className="h-10 px-3 rounded-xl text-[12px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center gap-1.5 transition-colors dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800">
                            <RefreshCw className="w-3.5 h-3.5" />{' '}{tx("Limpar filtros")}
                        </button>
                    )}
                    <SeletorPeriodo {...periodo.propsSeletor} />
                </div>
            </div>

            {subAba === 'comissoes' && (
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6 animate-[fadeIn_0.3s_ease-out] dark:bg-slate-900 dark:border-slate-800">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-2 dark:text-slate-400">{tx("Status do Repasse")}</h3>
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full dark:bg-emerald-500/10 dark:border-emerald-500/30">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest dark:text-emerald-400">{tx("Pagamento Aprovado")}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1 dark:text-slate-400">{tx("Comissão Total Auditada")}</p>
                        <p className="text-4xl font-bold text-emerald-700 tracking-tight leading-none dark:text-emerald-400">{formatMoney(comissaoTotalGeral)}</p>
                    </div>
                </div>
            )}

            {subAba === 'conferencia' && (
                <ConferenciaTab 
                    vendasParaConferencia={vendasParaConferencia} 
                    catalogoCompleto={catalogoGeral} // <- Aqui o Catálogo carrega no pop-up!
                    temVisaoGlobal={temVisaoGlobal} 
                    colunasVisiveis={colunasVisiveis}
                    usuarioLogado={usuarioLogado}
                    marcarTodosConferidos={marcarTodosConferidos} 
                    toggleConferido={toggleConferido} 
                    handleObsLocalChange={handleObsLocalChange} 
                    handleObsSaveDb={handleObsSaveDb}
                    onSalvarEdicao={handleSalvarEdicaoVenda}
                    onExcluirVenda={handleExcluirVenda}
                />
            )}
            {subAba === 'comissoes' && <ComissoesTab dadosTabelaComissoes={dadosTabelaComissoes} />}
            {subAba === 'auditoria' && temVisaoGlobal && <AuditoriaTab dadosTabelaAuditoria={dadosTabelaAuditoria} totais={totaisAuditoria} rotuloPeriodo={periodo.rotulo} onAbrirUnidade={abrirConferenciaDaUnidade} />}
            {subAba === 'geral' && <VisaoGeralTab vendas={vendas} unidadesPermitidas={unidadesPermitidas} filtroUnidade={temVisaoGlobal ? filtroUnidadeIsolada : 'TODOS'} mesReferencia={mesReferencia} temVisaoGlobal={temVisaoGlobal} unidadeUsuario={usuarioLogado?.unidade} />}
        </div>
    );
};

export default FechamentoCaixa;