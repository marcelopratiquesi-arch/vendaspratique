import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient.js';
import { SeletorPeriodo, calcularPreset, isoLocal } from '../HistoricoVendas/FiltrosCompactos.jsx';
import { usePeriodoPadrao } from '../../components/periodoPadrao.js';
import { pedirMotivoExclusao, excluirVendaComMotivo } from '../HistoricoVendas/utils.js';
import ConferenciaTab from './ConferenciaTab.jsx';
import ComissoesTab from './ComissoesTab.jsx';
import { periodoExato } from './periodoExato.js';
import VisaoGeralTab from './VisaoGeralTab.jsx';
import AuditoriaTab from './AuditoriaTab.jsx';
import { vendaAtrasada, consumirConferenciaPedida, EVENTO_PEDIR_CONFERENCIA } from './cobrancaAuditoria.js';
import { RefreshCw, Building2, PieChart, ShieldAlert, ClipboardCheck, Users, ChevronDown, Briefcase } from 'lucide-react';
import { criarLocalizadorDeSetor, listarSetores, vendaDoSetor, TODOS_SETORES } from './setorDaVenda.js';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';
import { podeVer, podeFazer } from '../../permissoes/catalogoPermissoes.js';
import PainelPagamento from './PainelPagamento.jsx';
import { usePagamentosComissao, mesDaFaixa, pagamentoDe, mensagemDaTrava, pagamentosDeSetor, idsPagosPorSetor, ehPagamentoDeSetor } from './pagamentosComissao.js';
import { consumirSubaba, avisarSubabaAtual, EVENTO_PEDIR_SUBABA } from '../../components/subAbas.js';

const FechamentoCaixa = ({ vendas = [], setVendas, usuarioLogado, visitantes = [], avaliacoes = [], colaboradores = [] }) => {
    const [subAba, setSubAba] = useState(() => consumirSubaba('fechamento') || 'conferencia');
    // Menu lateral (subabas, 10/11/2026)
    useEffect(() => {
        const aoPedir = (e) => { if (e.detail?.tela !== 'fechamento') return; const aba = consumirSubaba('fechamento'); if (aba) setSubAba(aba); };
        window.addEventListener(EVENTO_PEDIR_SUBABA, aoPedir);
        return () => window.removeEventListener(EVENTO_PEDIR_SUBABA, aoPedir);
    }, []);
    
    // 🔥 BUSCA O CATÁLOGO DIRETAMENTE NA FONTE (Evita o erro de drop-down vazio)
    const [catalogoGeral, setCatalogoGeral] = useState([]);
    useEffect(() => {
        const fetchCatalogo = async () => {
            const { data, error } = await supabase.from('catalogo').select('id, nome, tipo, valor, ativo');
            if (data && !error) setCatalogoGeral(data);
        };
        fetchCatalogo();
    }, []);

    // Filtro de período padrão do sistema (começa em "Este mês"). Faixa: início entra, fim não entra.
    const periodo = usePeriodoPadrao('este_mes');
    // Setor escolhido (16/11/2026): vale para Conferência, Comissões e Visão Geral (regras mais abaixo)
    const [filtroSetor, setFiltroSetor] = useState(TODOS_SETORES);

    // Janela de cobrança do Líder ("Fazer a conferência agora"): abre a aba Conferência no período das vendas pendentes
    const aplicarPeriodo = periodo.propsSeletor.onAplicar;
    useEffect(() => {
        const atender = () => {
            const pedido = consumirConferenciaPedida();
            if (!pedido) return;
            setSubAba('conferencia');
            setFiltroSetor(TODOS_SETORES); // a cobrança é de todas as vendas pendentes, de qualquer setor
            aplicarPeriodo({ preset: 'personalizado', tipo: 'periodo', inicio: pedido.inicio, fim: pedido.fim });
        };
        atender();
        window.addEventListener(EVENTO_PEDIR_CONFERENCIA, atender);
        return () => window.removeEventListener(EVENTO_PEDIR_CONFERENCIA, atender);
    }, [aplicarPeriodo]);
    const inicioIso = periodo.faixa.inicio ? isoLocal(periodo.faixa.inicio) : '';
    const fimIso = periodo.faixa.fim ? isoLocal(periodo.faixa.fim) : '';
    const [filtroUnidadeIsolada, setFiltroUnidadeIsolada] = useState('TODOS');
    // Pagamento das comissões (11/11/2026): unidade (uma só) e mês (um mês inteiro) escolhidos nos filtros
    const papelReal = String(usuarioLogado?.roleReal || usuarioLogado?.role || '').toUpperCase();
    const unidadePagamento = (usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR')
        ? (filtroUnidadeIsolada !== 'TODOS' ? filtroUnidadeIsolada : null)
        : (usuarioLogado?.unidade || null);
    const mesPagamento = mesDaFaixa(inicioIso, fimIso);
    const pagamentos = usePagamentosComissao({ mesInicio: inicioIso ? inicioIso.slice(0, 7) : null, mesFim: fimIso ? fimIso.slice(0, 7) : null });
    const podeAprovarPagamento = (papelReal === 'ADMIN' || papelReal === 'MENTOR') && podeFazer(usuarioLogado, '407');
    // Venda travada (paga): mês com pagamento da unidade inteira, ou venda dentro de um pagamento de setor (16/11/2026).
    // Índices montados uma vez (a Conferência pergunta por cada linha da tabela).
    const travas = useMemo(() => {
        const meses = new Set();
        const ids = new Set();
        pagamentos.lista.filter(p => p.ativo !== false).forEach(p => {
            if (ehPagamentoDeSetor(p)) (p.venda_ids || []).forEach(id => ids.add(String(id)));
            else meses.add(`${String(p.unidade || '').trim().toUpperCase()}|${p.mes}`);
        });
        return { meses, ids };
    }, [pagamentos.lista]);
    const vendaEstaTravada = (v) => !!v && (travas.ids.has(String(v.id)) || travas.meses.has(`${String(v.unidade || '').trim().toUpperCase()}|${String(v.data || '').slice(0, 7)}`));

    const temVisaoGlobal = usuarioLogado?.role === 'ADMIN' || usuarioLogado?.role === 'MENTOR';
    // Aba Auditoria: Admin e Mentor de verdade (roleReal), mesmo quando escolhem uma unidade no topo
    // (aí o App os trata como LIDER daquela unidade e a aba mostra só ela)
    // Abas pelas permissões (Configurações → Permissões, 06/11/2026; padrão = como era): Conferência é a principal (sempre)
    const podeVerAuditoria = podeVer(usuarioLogado, '404');
    const abaLiberada = { conferencia: true, comissoes: podeVer(usuarioLogado, '402'), geral: podeVer(usuarioLogado, '403'), auditoria: podeVerAuditoria };
    const abaMostrada = abaLiberada[subAba] ? subAba : 'conferencia';
    useEffect(() => { avisarSubabaAtual('fechamento', abaMostrada); }, [abaMostrada]);
    let colunasVisiveis = 10;
    if (temVisaoGlobal) colunasVisiveis++;

    // Filtro de SETOR (16/11/2026, decisão do dono): uma escolha só para Conferência, Comissões e Visão Geral.
    // O setor da venda é o setor de quem vendeu no cadastro da Equipe (regra única em setorDaVenda.js). Só filtra a tela.
    const setorDaVenda = useMemo(() => criarLocalizadorDeSetor(colaboradores), [colaboradores]);
    const unidadeDoFiltro = temVisaoGlobal ? (filtroUnidadeIsolada !== 'TODOS' ? filtroUnidadeIsolada : null) : (usuarioLogado?.unidade || null);
    const opcoesSetor = useMemo(() => listarSetores({
        colaboradores,
        vendas: unidadeDoFiltro ? vendas.filter(v => (v.unidade || 'MATRIZ') === unidadeDoFiltro) : vendas,
        unidade: unidadeDoFiltro,
        setorDaVenda,
    }), [colaboradores, vendas, unidadeDoFiltro, setorDaVenda]);
    // Trocou de unidade e o setor escolhido não existe nela: vale "todos" (sem apagar a escolha)
    const setorAtivo = opcoesSetor.some(s => s.chave === filtroSetor) ? filtroSetor : TODOS_SETORES;
    const passaSetor = useMemo(
        () => (setorAtivo === TODOS_SETORES ? null : (v) => vendaDoSetor(v, setorAtivo, setorDaVenda)),
        [setorAtivo, setorDaVenda]
    );

    // Limpar volta ao jeito que a tela abre: "Este mês", todas as unidades e todos os setores
    const limparFiltros = () => {
        periodo.propsSeletor.onAplicar(calcularPreset('este_mes'));
        if (temVisaoGlobal) setFiltroUnidadeIsolada('TODOS');
        setFiltroSetor(TODOS_SETORES);
    };
    const temFiltroAtivo = periodo.filtro.preset !== 'este_mes' || filtroUnidadeIsolada !== 'TODOS' || setorAtivo !== TODOS_SETORES;

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
        return passUnidade && passSeguranca && (!passaSetor || passaSetor(v));
    });

    const toggleConferido = async (id, statusAtual) => {
        const venda = vendas.find(v => v.id === id);
        if (vendaEstaTravada(venda)) { avisar(tx('O pagamento desta venda já foi aprovado: a conferência não pode mais ser mexida.'), 'atencao'); return; }
        const novoStatus = !statusAtual;
        const validadorNome = novoStatus ? usuarioLogado.nome : null;
        const validadorData = novoStatus ? new Date().toISOString() : null;

        setVendas(vendas.map(v => v.id === id ? { ...v, conferiu: novoStatus, conferido_por: validadorNome, conferido_em: validadorData } : v));
        const { error } = await supabase.from('vendas').update({ conferiu: novoStatus, conferido_por: validadorNome, conferido_em: validadorData }).eq('id', id);

        if (error) {
            console.error("Erro ao atualizar:", error);
            avisar(mensagemDaTrava(error) || tx("Erro de conexão. Revertendo alteração."));
            setVendas(vendas.map(v => v.id === id ? { ...v, conferiu: statusAtual } : v));
        }
    };

    const handleObsLocalChange = (id, novaObs) => setVendas(vendas.map(v => v.id === id ? { ...v, observacao: novaObs } : v));
    const handleObsSaveDb = async (id, textoFinal) => {
        const { error } = await supabase.from('vendas').update({ observacao: textoFinal }).eq('id', id);
        if (error && mensagemDaTrava(error)) avisar(mensagemDaTrava(error), 'atencao');
    };

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
            avisar(mensagemDaTrava(error) || tx("Erro ao salvar a edição. Tente novamente."));
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

    // Vendas ainda sem conferir da unidade+mês do pagamento (o banco confere de novo ao aprovar)
    const pendentesPagamento = unidadePagamento && mesPagamento
        ? vendas.filter(v => !v.conferiu && String(v.data || '').slice(0, 7) === mesPagamento && String(v.unidade || '').toUpperCase() === String(unidadePagamento).toUpperCase() && (!passaSetor || passaSetor(v))).length
        : 0;

    // Monta a tabela de comissões de uma lista de vendas conferidas. É chamada para a unidade inteira (quadro do
    // pagamento, que NUNCA obedece ao filtro de setor) e, com um setor escolhido, de novo só com as vendas dele (tabela).
    const montarComissoes = (listaVendas) => {
    let comissaoTotalGeral = 0;
    const relatorioVendedores = {};

    listaVendas.forEach(venda => {
        const valorComissao = Number(venda.valor) || 0;
        if (valorComissao <= 0) return; 

        comissaoTotalGeral += valorComissao;

        // Agrupa pelo CPF do vendedor quando a venda tem (passo 1 do SQL de 11/11/2026); senão pelo nome escrito.
        // Assim a mesma pessoa com o nome escrito de dois jeitos vira UMA linha. O total geral não muda.
        const cpfVenda = String(venda.vendedor_cpf || '').replace(/\D/g, '');
        const chave = cpfVenda.length === 11 ? `cpf:${cpfVenda}` : venda.vendedor;
        if (!relatorioVendedores[chave]) {
            relatorioVendedores[chave] = { chave, vendedor: venda.vendedor, cpfVenda: cpfVenda.length === 11 ? cpfVenda : '', totalComissao: 0, itens: {}, detalhe: {} };
        }

        relatorioVendedores[chave].totalComissao += valorComissao;
        (relatorioVendedores[chave].unidades ||= new Set()).add(String(venda.unidade || '').toUpperCase());
        const qty = parseInt(venda.quantidade) || 1;
        relatorioVendedores[chave].itens[venda.produto] = (relatorioVendedores[chave].itens[venda.produto] || 0) + qty;
        // Para o recibo: comissão somada de cada item (valor unitário = total ÷ quantidade)
        const det = (relatorioVendedores[chave].detalhe[venda.produto] ||= { qtd: 0, total: 0 });
        det.qtd += qty; det.total += valorComissao;
    });

    const normalizarTexto = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

    // Conta bancária de quem vendeu (corrigido em 11/11/2026, decisão do dono): SÓ o nome exato da Equipe.
    // Antes, sem o nome exato, aceitava um nome PARECIDO ("ANA SILVA" pegava a conta da "ANA SILVA SANTOS").
    // Com mais de uma pessoa com o mesmo nome: a ativa da unidade das vendas; se ainda empatar, não chuta
    // ("conferir cadastro"). Só muda os dados bancários mostrados: os totais de comissão continuam iguais.
    const dadosTabelaComissoes = Object.values(relatorioVendedores).map(r => {
        // Venda com CPF do vendedor: a pessoa da Equipe é achada pelo CPF (certeiro)
        if (r.cpfVenda) {
            const doCpf = colaboradores.filter(c => String(c.cpf || '').replace(/\D/g, '') === r.cpfVenda);
            const pessoa = doCpf.find(c => c.ativo !== false) || doCpf[0] || null;
            const { unidades, ...restoCpf } = r;
            return {
                ...restoCpf,
                vendedor: pessoa?.nome || r.vendedor,
                unidadeRecibo: unidades ? [...unidades][0] : '',
                totalItens: Object.values(r.itens).reduce((acc, q) => acc + q, 0),
                cpf: pessoa?.cpf || r.cpfVenda,
                tipo_conta: pessoa?.tipo_conta || '',
                conta_inter: pessoa?.conta_inter || '',
                colaborador: pessoa || { nome: r.vendedor, unidade: unidades ? [...unidades][0] : '' },
                situacaoCadastro: pessoa ? 'ok' : 'sem_cadastro',
            };
        }
        const nomeVenda = normalizarTexto(r.vendedor);
        let candidatos = colaboradores.filter(c => normalizarTexto(c.nome) === nomeVenda);
        if (candidatos.length > 1) {
            const ativos = candidatos.filter(c => c.ativo !== false);
            if (ativos.length) candidatos = ativos;
        }
        if (candidatos.length > 1 && r.unidades) {
            const daUnidade = candidatos.filter(c => r.unidades.has(String(c.unidade || '').toUpperCase()));
            if (daUnidade.length) candidatos = daUnidade;
        }
        const cpfsDiferentes = new Set(candidatos.map(c => String(c.cpf || '').replace(/\D/g, ''))).size;
        const ambiguo = candidatos.length > 1 && cpfsDiferentes > 1;
        const infoColaborador = (!ambiguo && candidatos[0]) || {};
        const { unidades, ...resto } = r;

        return {
            ...resto,
            unidadeRecibo: unidades ? [...unidades][0] : '',
            totalItens: Object.values(r.itens).reduce((acc, q) => acc + q, 0),
            cpf: infoColaborador.cpf || '',
            tipo_conta: infoColaborador.tipo_conta || '',
            conta_inter: infoColaborador.conta_inter || '',
            // Para a Central do Colaborador e o aviso "conferir cadastro"
            colaborador: infoColaborador.id != null ? infoColaborador : { nome: r.vendedor, unidade: unidades ? [...unidades][0] : '' },
            situacaoCadastro: ambiguo ? 'ambiguo' : infoColaborador.id != null ? 'ok' : 'sem_cadastro',
        };
    }).sort((a, b) => b.totalComissao - a.totalComissao);

    return { total: comissaoTotalGeral, linhas: dadosTabelaComissoes };
    };

    // Unidade inteira: é o que o quadro "Pagamento das comissões" mostra e aprova (não muda com o setor)
    const comissoesDaUnidade = montarComissoes(vendasComissionadas);
    // Tabela de comissões: com um setor escolhido, só as vendas das pessoas dele
    const vendasDoSetor = passaSetor ? vendasComissionadas.filter(passaSetor) : vendasComissionadas;
    const comissoesDoSetor = passaSetor ? montarComissoes(vendasDoSetor) : comissoesDaUnidade;

    // PAGAMENTO POR SETOR (16/11/2026, decisão do dono): o quadro do pagamento segue o filtro de setor.
    // "Todos" = unidade inteira (ou o que falta, se algum setor já foi aprovado); um setor = só ele, os outros ficam em aberto.
    const setorEscolhido = setorAtivo === TODOS_SETORES ? null : (opcoesSetor.find(s => s.chave === setorAtivo) || null);
    const temLugarDoPagamento = !!(unidadePagamento && mesPagamento);
    const pagamentoDaUnidade = temLugarDoPagamento ? pagamentoDe(unidadePagamento, mesPagamento, pagamentos.ativos) : null;
    const pagamentosPorSetor = temLugarDoPagamento ? pagamentosDeSetor(unidadePagamento, mesPagamento, pagamentos.ativos) : [];
    const idsJaPagos = temLugarDoPagamento ? idsPagosPorSetor(unidadePagamento, mesPagamento, pagamentos.ativos) : new Set();
    const pagamentoDoPainel = pagamentoDaUnidade || (setorEscolhido ? (pagamentosPorSetor.find(p => p.setor === setorEscolhido.chave) || null) : null);
    // O que entra na aprovação agora: as vendas mostradas que ainda não foram pagas num setor
    const vendasParaAprovar = idsJaPagos.size ? vendasDoSetor.filter(v => !idsJaPagos.has(String(v.id))) : vendasDoSetor;
    const comissoesParaAprovar = idsJaPagos.size ? montarComissoes(vendasParaAprovar) : comissoesDoSetor;
    // Linha "Por setor" do quadro: total conferido de cada setor e se já foi pago
    const resumoSetores = temLugarDoPagamento ? (() => {
        const totais = new Map();
        vendasComissionadas.forEach(v => {
            const valor = Number(v.valor) || 0;
            if (valor <= 0) return;
            const chave = setorDaVenda(v).chave;
            totais.set(chave, (totais.get(chave) || 0) + valor);
        });
        return opcoesSetor
            .map(s => ({ ...s, total: totais.get(s.chave) || 0, pagamento: pagamentoDaUnidade || pagamentosPorSetor.find(p => p.setor === s.chave) || null }))
            .filter(s => s.total > 0 || (s.pagamento && ehPagamentoDeSetor(s.pagamento)));
    })() : [];

    const relatorioAuditoria = {};
    let totalAuditoriaRegistrados = 0;
    let totalAuditoriaConferidos = 0;
    let totalAuditoriaPendentes = 0;
    let totalAuditoriaValorPendente = 0;
    let totalAuditoriaAtrasadas = 0;
    let totalAuditoriaValorAtrasado = 0;

    vendasDataAvancada.forEach(v => {
        const unid = v.unidade || 'MATRIZ';
        if (filtroUnidadeIsolada !== 'TODOS' && unid !== filtroUnidadeIsolada) return;

        if (!temVisaoGlobal && unid !== usuarioLogado?.unidade) return;
        if (!relatorioAuditoria[unid]) relatorioAuditoria[unid] = { unidade: unid, registrados: 0, conferidos: 0, pendentes: 0, valorPendente: 0, atrasadas: 0, valorAtrasado: 0, maisAntiga: null, ultimaEm: null, ultimaPor: null, conferidasNoPeriodo: 0 };
        const linha = relatorioAuditoria[unid];

        linha.registrados++;
        totalAuditoriaRegistrados++;

        if (v.conferiu) {
            linha.conferidos++;
            totalAuditoriaConferidos++;
        } else {
            linha.pendentes++;
            linha.valorPendente += Number(v.valor) || 0;
            totalAuditoriaPendentes++;
            totalAuditoriaValorPendente += Number(v.valor) || 0;
            // Mais antiga sem conferir e atrasadas (passou do prazo de conferência)
            if (!linha.maisAntiga || v.data < linha.maisAntiga) linha.maisAntiga = v.data;
            if (vendaAtrasada(v)) {
                linha.atrasadas++;
                linha.valorAtrasado += Number(v.valor) || 0;
                totalAuditoriaAtrasadas++;
                totalAuditoriaValorAtrasado += Number(v.valor) || 0;
            }
        }
    });

    // Última conferência de cada unidade (qualquer data carregada, últimos 90 dias), para ver se alguém está deixando acumular,
    // e quantas conferências foram FEITAS dentro do período (pela data em que a pessoa conferiu)
    const inicioMs = periodo.faixa.inicio ? periodo.faixa.inicio.getTime() : null;
    const fimMs = periodo.faixa.fim ? periodo.faixa.fim.getTime() : null;
    vendas.forEach(v => {
        const linha = relatorioAuditoria[v.unidade || 'MATRIZ'];
        if (!linha || !v.conferiu || !v.conferido_em) return;
        if (!linha.ultimaEm || v.conferido_em > linha.ultimaEm) { linha.ultimaEm = v.conferido_em; linha.ultimaPor = v.conferido_por; }
        const ms = new Date(v.conferido_em).getTime();
        if ((inicioMs === null || ms >= inicioMs) && (fimMs === null || ms < fimMs)) linha.conferidasNoPeriodo++;
    });
    // Mais atrasadas primeiro (é quem precisa ser cobrado), depois mais pendências
    const dadosTabelaAuditoria = Object.values(relatorioAuditoria).sort((a, b) => b.atrasadas - a.atrasadas || b.pendentes - a.pendentes || b.valorPendente - a.valorPendente);
    const totaisAuditoria = { registrados: totalAuditoriaRegistrados, conferidos: totalAuditoriaConferidos, pendentes: totalAuditoriaPendentes, valorPendente: totalAuditoriaValorPendente, atrasadas: totalAuditoriaAtrasadas, valorAtrasado: totalAuditoriaValorAtrasado };

    const abrirConferenciaDaUnidade = (unidade) => {
        if (temVisaoGlobal) setFiltroUnidadeIsolada(unidade);
        setFiltroSetor(TODOS_SETORES); // vindo da Auditoria: mostrar todas as pendentes da unidade
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
                        ['auditoria', 'Auditoria', ShieldAlert],
                    ].filter(([id]) => abaLiberada[id]).map(([id, rotulo, Icone]) => {
                        const ativa = abaMostrada === id;
                        return (
                            <button key={id} type="button" role="tab" aria-selected={ativa} onClick={() => setSubAba(id)}
                                className={`h-9 px-3.5 rounded-lg text-[12px] whitespace-nowrap flex items-center gap-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${ativa ? 'bg-white shadow-sm text-blue-700 font-extrabold dark:bg-slate-900 dark:text-blue-400' : 'text-slate-500 hover:text-slate-800 font-bold dark:text-slate-400 dark:hover:text-white'}`}>
                                <Icone className="w-4 h-4" /> {tx(rotulo)}
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* O texto "período · unidade · setor" saiu (decisão do dono, 16/11/2026): os próprios filtros já mostram
                        a escolha e, sem ele, abas e filtros cabem numa linha só. Quem não troca de unidade vê só o nome dela. */}
                    {!temVisaoGlobal && usuarioLogado?.unidade && (
                        <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400">{usuarioLogado.unidade}</span>
                    )}
                    {/* Filtro de setor no topo: Comissões e Visão Geral (na Conferência ele fica antes do Vendedor) */}
                    {(abaMostrada === 'comissoes' || abaMostrada === 'geral') && (
                        <div className="relative">
                            <Briefcase className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${setorAtivo !== TODOS_SETORES ? 'text-blue-700 dark:text-blue-400' : 'text-slate-400'}`} />
                            <select value={setorAtivo} onChange={(e) => setFiltroSetor(e.target.value)} aria-label={tx("Filtrar por setor")}
                                title={tx("O setor é o do cadastro da Equipe de quem vendeu. Escolhendo um, aparecem só as vendas das pessoas daquele setor.")}
                                className={`h-[42px] pl-9 pr-8 rounded-xl border text-[13px] appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${setorAtivo !== TODOS_SETORES ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 font-semibold dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700 dark:text-slate-200'}`}>
                                <option value={TODOS_SETORES}>{tx("Setor: todos")}</option>
                                {opcoesSetor.map(s => <option key={s.chave} value={s.chave}>{tx(s.rotulo)}</option>)}
                            </select>
                            <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                        </div>
                    )}
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

            {/* Pagamento das comissões (11/11/2026): substituiu a etiqueta "Pagamento Aprovado" que aparecia SEMPRE */}
            {abaMostrada === 'comissoes' && (
                <PainelPagamento
                    unidade={unidadePagamento}
                    mes={mesPagamento}
                    pagamento={pagamentoDoPainel}
                    semTabela={pagamentos.semTabela}
                    pendentes={pendentesPagamento}
                    setor={setorEscolhido}
                    totalComissao={comissoesDoSetor.total}
                    totalAprovar={comissoesParaAprovar.total}
                    qtdVendasAprovar={vendasParaAprovar.length}
                    pessoas={comissoesParaAprovar.linhas}
                    resumoSetores={resumoSetores}
                    onEscolherSetor={setFiltroSetor}
                    podeAprovar={podeAprovarPagamento}
                    podeReabrir={papelReal === 'ADMIN'}
                    onAprovar={pagamentos.aprovar}
                    onReabrir={pagamentos.reabrir}
                />
            )}

            {abaMostrada === 'conferencia' && (
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
                    estaTravada={vendaEstaTravada}
                    filtroSetor={setorAtivo}
                    onMudarSetor={setFiltroSetor}
                    opcoesSetor={opcoesSetor}
                />
            )}
            {abaMostrada === 'comissoes' && <ComissoesTab dadosTabelaComissoes={comissoesDoSetor.linhas} colaboradores={colaboradores} rotuloPeriodo={periodoExato(inicioIso, fimIso)} />}
            {abaMostrada === 'auditoria' && <AuditoriaTab dadosTabelaAuditoria={dadosTabelaAuditoria} totais={totaisAuditoria} rotuloPeriodo={periodo.rotulo} inicioIso={inicioIso} fimIso={fimIso} colaboradores={colaboradores} onAbrirUnidade={abrirConferenciaDaUnidade} />}
            {abaMostrada === 'geral' && <VisaoGeralTab vendas={vendas} unidadesPermitidas={unidadesPermitidas} filtroUnidade={temVisaoGlobal ? filtroUnidadeIsolada : 'TODOS'} mesReferencia={mesReferencia} temVisaoGlobal={temVisaoGlobal} unidadeUsuario={usuarioLogado?.unidade} passaSetor={passaSetor} />}
        </div>
    );
};

export default FechamentoCaixa;