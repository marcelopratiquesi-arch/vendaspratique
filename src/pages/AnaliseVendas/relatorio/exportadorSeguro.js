// src/pages/AnaliseVendas/relatorio/exportadorSeguro.js
import { safeIsoDate, formatDataBR } from '../utils.js';
import { ORDEM_CLASSICA, ROTULO_NUTRI_ADICIONAL } from './motorConsolidacao.js';
import { avisar } from '../../../components/avisar.js';
import { tx } from '../../../i18n/traduzir.js';

// 🛡️ Blindagem contra CSV Injection (impede que sinais =, +, -, @ executem fórmulas no Excel)
export const sanitizarCelulaCSV = (valor) => {
    if (valor === null || valor === undefined) return '""';
    let str = String(valor).trim().replace(/"/g, '""');
    if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
    }
    return `"${str}"`;
};

const dispararDownloadCSV = (csvContent, nomeArquivo) => {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", nomeArquivo);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
};

const obterDataStringSegura = () => {
    const hojeData = new Date();
    const anoStr = hojeData.getFullYear();
    const mesStr = String(hojeData.getMonth() + 1).padStart(2, '0');
    const diaStr = String(hojeData.getDate()).padStart(2, '0');
    return `${anoStr}-${mesStr}-${diaStr}`;
};

// 📊 Exportação Geral da Tela (Resumo por Categoria ou Detalhada Completa)
export const exportarRelatorioGeralCSV = ({
    vendasFiltradas = [],
    unidadesOrdenadas = [],
    relatorioPorUnidade = {},
    visaoDetalhada = false,
    extrairDadosPessoa,
    dicionarioPessoas,
    cacheAlunosBanco,
    t
}) => {
    try {
        if (vendasFiltradas.length === 0) {
            avisar(t ? t('analytics.report.noDataExport', { defaultValue: "Não há dados para exportar com os filtros atuais." }) : tx("Não há dados para exportar com os filtros atuais."));
            return;
        }

        let csvContent = "";

        if (visaoDetalhada) {
            const cabecalho = ['ID', 'Data', 'Unidade', 'Matricula', 'Aluno', 'CPF', 'Produto', 'Qtd', 'Vendedor'];
            const linhas = vendasFiltradas.map(v => {
                const dataFormatada = v.data || v.created_at ? safeIsoDate(v.data || v.created_at) : '';
                const pessoa = extrairDadosPessoa ? extrairDadosPessoa(v, dicionarioPessoas, cacheAlunosBanco) : { nome: v.aluno || '', cpf: v.cpf || '', matricula: v.matricula || '' };
                return [
                    sanitizarCelulaCSV(v.id || ''),
                    sanitizarCelulaCSV(dataFormatada),
                    sanitizarCelulaCSV(v.unidade || ''),
                    sanitizarCelulaCSV(pessoa.matricula || ''),
                    sanitizarCelulaCSV(pessoa.nome || ''),
                    sanitizarCelulaCSV(pessoa.cpf || ''),
                    sanitizarCelulaCSV(v.produto || ''),
                    Number(v.quantidade) || 1,
                    sanitizarCelulaCSV(v.vendedor || '')
                ].join(';');
            });
            csvContent = [cabecalho.join(';'), ...linhas].join('\n');
        } else {
            const cabecalho = ['Unidade', 'Categoria', 'Quantidade Total'];
            const linhas = [];
            unidadesOrdenadas.forEach(uni => {
                const dados = relatorioPorUnidade[uni];
                if (!dados) return;
                const gruposOrd = Object.values(dados.gruposAdmin).sort((a, b) => {
                    if (a.order !== b.order) return a.order - b.order;
                    return b.total - a.total;
                });

                gruposOrd.forEach(info => {
                    if (info.total > 0) {
                        linhas.push(`${sanitizarCelulaCSV(uni)};${sanitizarCelulaCSV(info.grupo)};${info.total}`);
                    }
                });
            });
            csvContent = [cabecalho.join(';'), ...linhas].join('\n');
        }

        const dataStr = obterDataStringSegura();
        dispararDownloadCSV(csvContent, `Exportacao_Vendas_${visaoDetalhada ? 'Detalhada' : 'Resumo'}_${dataStr}.csv`);
    } catch (error) {
        console.error("Erro ao exportar CSV:", error);
        avisar(t ? t('analytics.report.exportError', { defaultValue: "Ocorreu um erro ao gerar a planilha." }) : tx("Ocorreu um erro ao gerar a planilha."));
    }
};

// 📋 Exportação Exclusiva da Lista Aberta dentro do Modal de Auditoria
export const exportarListaModalCSV = ({
    registros = [],
    tipoTabela = 'VENDA',
    titulo = 'Auditoria',
    extrairDadosPessoa,
    dicionarioPessoas,
    cacheAlunosBanco
}) => {
    if (!registros || registros.length === 0) return;

    let cabecalho = [];
    let linhas = [];

    if (tipoTabela === 'VENDA') {
        cabecalho = ['Aluno', 'CPF', 'Matricula', 'Data', 'Unidade', 'Plano/Produto', 'Qtd', 'Vendedor'];
        linhas = registros.map(v => {
            const pessoa = extrairDadosPessoa(v, dicionarioPessoas, cacheAlunosBanco);
            return [
                sanitizarCelulaCSV(pessoa.nome),
                sanitizarCelulaCSV(pessoa.cpf),
                sanitizarCelulaCSV(pessoa.matricula),
                sanitizarCelulaCSV(formatDataBR(v.data || v.created_at)),
                sanitizarCelulaCSV(v.unidade || ''),
                sanitizarCelulaCSV(v.produto || ''),
                Number(v.qtdConsolidada || v.quantidade || 1),
                sanitizarCelulaCSV(v.vendedor || 'Sistema')
            ].join(';');
        });
    } else if (tipoTabela === 'VISITANTE') {
        cabecalho = ['Visitante / Aluno', 'CPF', 'Telefone', 'Data', 'Unidade', 'Consultor Resp.'];
        linhas = registros.map(v => {
            const pessoa = extrairDadosPessoa(v, dicionarioPessoas, cacheAlunosBanco);
            const tel = v.telefone || v.celular || v.contato || v.whatsapp || 'Não informado';
            const responsavel = v.consultor || v.vendedor || v.responsavel || v.atendente || v.criado_por || 'Recepção';
            return [
                sanitizarCelulaCSV(pessoa.nome),
                sanitizarCelulaCSV(pessoa.cpf),
                sanitizarCelulaCSV(tel),
                sanitizarCelulaCSV(formatDataBR(v.data || v.criado_em || v.created_at)),
                sanitizarCelulaCSV(v.unidade || ''),
                sanitizarCelulaCSV(responsavel)
            ].join(';');
        });
    } else if (tipoTabela === 'AVALIACAO') {
        cabecalho = ['Aluno Avaliado', 'CPF', 'Matricula', 'Data', 'Unidade', 'Professor / Avaliador', 'Situacao'];
        linhas = registros.map(a => {
            const pessoa = extrairDadosPessoa(a, dicionarioPessoas, cacheAlunosBanco);
            const prof = a.professor || a.avaliador || a.instrutor || a.profissional || a.responsavel || a.criado_por || 'Não informado';
            const statusAval = a.status || a.situacao || 'Concluída';
            return [
                sanitizarCelulaCSV(pessoa.nome),
                sanitizarCelulaCSV(pessoa.cpf),
                sanitizarCelulaCSV(pessoa.matricula),
                sanitizarCelulaCSV(formatDataBR(a.data || a.data_avaliacao || a.created_at)),
                sanitizarCelulaCSV(a.unidade || ''),
                sanitizarCelulaCSV(prof),
                sanitizarCelulaCSV(statusAval)
            ].join(';');
        });
    }

    const csvContent = [cabecalho.join(';'), ...linhas].join('\n');
    const slugTitulo = String(titulo).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    dispararDownloadCSV(csvContent, `Auditoria_${slugTitulo}_${obterDataStringSegura()}.csv`);
};

// 💬 Gerador de Texto de WhatsApp: Resumo Executivo Global (Rede)
export const montarTextoGlobalWhatsapp = ({
    rankingUnidades = [],
    relatorioPorUnidade = {},
    vendasGlobal = 0,
    visaoDetalhada = false,
    labelFiltroAtual = '',
    langAtual = 'pt-BR',
    t
}) => {
    const dataAtual = new Date();
    const dia = String(dataAtual.getDate()).padStart(2, '0');
    const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const hojeSemAno = `${dia}/${mes}`;
    const horaAtual = dataAtual.toLocaleTimeString(langAtual, { hour: '2-digit', minute: '2-digit' });

    const tr = (key, def) => (t ? t(key, { defaultValue: def }) : def);

    let txt = `${tr('analytics.report.wppGlobalTitle', '📊 *RESUMO EXECUTIVO – PRATIQUE FITNESS* 📊')}\n`;
    txt += `${tr('analytics.report.wppActiveFilter', '📅 *Filtro Ativo:*')} ${labelFiltroAtual}\n`;
    txt += `${tr('analytics.report.wppGeneratedAt', '🕐 *Gerado em:*')} ${hojeSemAno} às ${horaAtual}\n\n`;

    rankingUnidades.forEach((uni) => {
        const dados = relatorioPorUnidade[uni.nome];
        if (!dados) return;

        txt += `🏢 *${uni.nome}:* ${uni.vendas} ${tr('analytics.report.wppSalesLow', 'vendas')}\n\n`;

        const gruposOrd = Object.values(dados.gruposAdmin).sort((a, b) => {
            if (a.order !== b.order) return a.order - b.order;
            return b.total - a.total;
        });

        gruposOrd.forEach(g => {
            if (g.total === 0) return;

            txt += `${g.icone} *${g.grupo} — ${String(g.total).padStart(2, '0')}*\n`;

            if (visaoDetalhada && g.tipo === 'AGRUPADO') {
                Object.entries(g.itens).sort((a, b) => b[1].total - a[1].total).forEach(([ni, di]) => {
                    txt += `▫️ ${String(di.total).padStart(2, '0')}x ${ni}\n`;
                });
            }

            txt += `\n`;
        });
    });

    txt += `${tr('analytics.report.wppTotalGlobal', '📈 *TOTAL GERAL:*')} ${vendasGlobal} ${tr('analytics.report.wppSalesLow', 'vendas')}\n`;

    return txt.trim();
};

// 💬 Gerador de Texto de WhatsApp: Fechamento Individual de Unidade
export const montarTextoFechamentoUnidade = ({
    unidadeAlvo,
    relatorioPorUnidade = {},
    labelFiltroAtual = '',
    langAtual = 'pt-BR',
    t
}) => {
    const dados = relatorioPorUnidade[unidadeAlvo];
    if (!dados) return '';

    const dataAtual = new Date();
    const dia = String(dataAtual.getDate()).padStart(2, '0');
    const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const ano = dataAtual.getFullYear();

    const hojeDataBR = `${dia}/${mes}/${ano}`;
    const hojeSemAno = `${dia}/${mes}`;
    const horaAtual = dataAtual.toLocaleTimeString(langAtual, { hour: '2-digit', minute: '2-digit' });

    let labelReferencia = labelFiltroAtual;
    const labelEnviado = `${hojeSemAno} às ${horaAtual}`;

    if (labelFiltroAtual === hojeDataBR) {
        const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const diaSemanaStr = diasSemana[dataAtual.getDay()];
        labelReferencia = `${diaSemanaStr}, ${hojeSemAno}`;
    }

    const tr = (key, def) => (t ? t(key, { defaultValue: def }) : def);

    let txt = `${tr('analytics.report.wppCloseTitle', '📊 *RELATÓRIO DE FECHAMENTO – PRATIQUE FITNESS* 📊')}\n`;
    txt += `${tr('analytics.report.wppRef', '📅 *Referência:*')} ${labelReferencia}\n`;
    txt += `${tr('analytics.report.wppSentAt', '🕐 *Enviado em:*')} ${labelEnviado}\n`;
    txt += `${tr('analytics.report.wppUnit', '🏢 *Unidade:*')} ${unidadeAlvo}\n\n`;

    txt += `${tr('analytics.report.wppSalesSummary', '📌 *RESUMO DAS VENDAS*')}\n\n`;

    const gruposClassicosOrdenados = Object.entries(dados.grupos)
        .sort((a, b) => ORDEM_CLASSICA.indexOf(a[0]) - ORDEM_CLASSICA.indexOf(b[0]))
        .filter(([_, info]) => info.total > 0);

    gruposClassicosOrdenados.forEach(([nomeGrupo, grupoInfo]) => {
        const icone = grupoInfo.icone || "🔹";

        txt += `${icone} *${nomeGrupo === 'NUTRI' ? ROTULO_NUTRI_ADICIONAL : nomeGrupo} — ${String(grupoInfo.total).padStart(2, '0')} ${grupoInfo.total > 1 ? tr('analytics.report.wppSalesLow', 'vendas') : tr('analytics.report.wppSaleLow', 'venda')}*\n`;

        const itensOrdenados = Object.entries(grupoInfo.itens).sort((a, b) => b[1].total - a[1].total);
        itensOrdenados.forEach(([nomeItem, itemData]) => {
            if (itemData.total > 0) {
                const stringConsultores = Object.entries(itemData.vendedores)
                    .filter(([_, vQtd]) => vQtd > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([vNome, vQtd]) => `${vNome} ${String(vQtd).padStart(2, '0')}`)
                    .join(', ');

                const txtConsultores = stringConsultores ? ` (${stringConsultores})` : '';
                txt += `▫️ ${String(itemData.total).padStart(2, '0')}x ${nomeItem}${txtConsultores}\n`;
            }
        });

        txt += `\n`;
    });

    if (dados.totalGeralVendas > 0) {
        txt += `${tr('analytics.report.wppSalesByConsultant', '👥 *VENDAS POR CONSULTOR*')}\n`;
        const consultoresOrdenados = Object.entries(dados.vendedoresTotal)
            .filter(([_, cTotal]) => cTotal > 0)
            .sort((a, b) => b[1] - a[1]);

        consultoresOrdenados.forEach(([cNome, cTotal]) => {
            txt += `${cNome} — ${String(cTotal).padStart(2, '0')}\n`;
        });
        txt += `\n${tr('analytics.report.wppTotalSalesUpper', '📈 *TOTAL DE VENDAS:')} ${String(dados.totalGeralVendas).padStart(2, '0')}*\n`;
    } else {
        txt += `${tr('analytics.report.wppNoSales', 'Nenhuma venda registrada.')}\n`;
    }

    txt += `\n➖➖➖➖➖➖➖➖➖➖\n\n`;
    txt += `${tr('analytics.report.wppVisitorsDesk', '👥 *VISITANTES (BALCÃO):*')} ${String(dados.visitantes.length).padStart(2, '0')}\n`;
    txt += `${tr('analytics.report.wppAssessmentsDone', '📋 *AVALIAÇÕES FEITAS:*')} ${String(dados.avaliacoes.length).padStart(2, '0')}\n`;

    return txt.trim();
};