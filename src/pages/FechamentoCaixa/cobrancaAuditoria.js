// ==========================================
// COBRANÇA DA CONFERÊNCIA (aba Auditoria do Fechamento, 05/11/2026)
// - Prazo SEMANAL (decisão do dono, 05/11/2026): a semana vai de SÁBADO a SEXTA e as vendas dela são
//   conferidas até a SEXTA-FEIRA (ex.: vendas de 01/11 a 06/11 → conferir até sexta 06/11; de 07/11 a 13/11 → até 13/11).
//   Passou a sexta e a venda não foi conferida = "atrasada" (a partir do sábado).
// - Cobrança do Líder/Mentor (Pendencias/pendencias.js, janela do login e cartão do canto): TUDO o que está atrasado desde INICIO_COBRANCA_CONFERENCIA,
//   todas as vendas (planos, produtos e serviços). Só some quando não sobra nenhuma atrasada.
// - Mensagens de WhatsApp: rede (Resumo / Detalhado) e Líder de uma unidade.
// Só leitura: nada aqui grava ou muda vendas/comissões (regra 12).
// Mensagens de WhatsApp não são traduzidas (vão para a equipe, em português).
// ==========================================
import { telefoneParaEquipe } from '../../components/acesso/regrasAcesso.js';
import { normalizeString } from '../AnaliseVendas/utils.js';

// Cobrança começa em outubro/2026 (decisão do dono): vendas mais antigas não entram na janela do Líder
export const INICIO_COBRANCA_CONFERENCIA = '2026-10-01';
// (prazo em texto saiu: as mensagens explicam "toda sexta-feira, vendas de sábado a sexta")
// "Última conferência" fica vermelha a partir daqui
export const DIAS_ALERTA_VERMELHO = 7;

const paraIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isoHoje = () => paraIso(new Date());
const SEXTA = 5;

// Sexta-feira do prazo de uma venda: a própria data, se for sexta; senão a próxima sexta
export const sextaDoPrazo = (dataIso) => {
    const d = new Date(`${String(dataIso).slice(0, 10)}T12:00:00`);
    d.setDate(d.getDate() + ((SEXTA - d.getDay() + 7) % 7));
    return paraIso(d);
};
// Semana (sábado a sexta) de uma venda
export const semanaDaVenda = (dataIso) => {
    const fim = sextaDoPrazo(dataIso);
    const d = new Date(`${fim}T12:00:00`); d.setDate(d.getDate() - 6);
    return { inicio: paraIso(d), fim };
};
// Última sexta-feira cujo prazo JÁ VENCEU (a sexta de hoje ainda vale até 23h59)
export const ultimaSextaVencida = (hojeIso = isoHoje()) => {
    const d = new Date(`${hojeIso}T12:00:00`);
    const volta = ((d.getDay() - SEXTA + 7) % 7) || 7;
    d.setDate(d.getDate() - volta);
    return paraIso(d);
};
export const hojeEhSexta = () => new Date().getDay() === SEXTA;

// Dias entre a data da venda (YYYY-MM-DD) e hoje
export const diasDesdeData = (iso) => {
    if (!iso) return null;
    return Math.round((new Date(`${isoHoje()}T12:00:00`) - new Date(`${String(iso).slice(0, 10)}T12:00:00`)) / 86400000);
};

// Dias desde um momento (data e hora gravada), contando por dia do calendário
export const diasDesdeMomento = (ts) => {
    if (!ts) return null;
    const d = new Date(ts);
    const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);
    return Math.round((inicioHoje - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
};

// Atrasada = não conferida e a sexta do prazo já passou
export const vendaAtrasada = (venda) => !venda.conferiu && !!venda.data && sextaDoPrazo(venda.data) < isoHoje();

const ddmm = (iso) => (iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : '');
const dinheiro = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const pct = (l) => (l.registrados === 0 ? 100 : Math.floor((l.conferidos / l.registrados) * 100));
const haDias = (dias) => (dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`);
const primeiroNome = (nome) => {
    const p = String(nome || '').trim().split(/\s+/)[0] || '';
    return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '';
};

// Período em texto para a mensagem: "01/10 a 31/10" (fim da faixa não entra)
export const textoPeriodo = (inicioIso, fimIso) => {
    if (!inicioIso && !fimIso) return 'todo o período';
    const hoje = isoHoje();
    let ultimo = '';
    if (fimIso) {
        const d = new Date(`${fimIso}T12:00:00`); d.setDate(d.getDate() - 1);
        ultimo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (ultimo > hoje) ultimo = hoje;
    } else ultimo = hoje;
    if (!inicioIso) return `até ${ddmm(ultimo)}`;
    return inicioIso === ultimo ? ddmm(inicioIso) : `${ddmm(inicioIso)} a ${ddmm(ultimo)}`;
};

const linhaUltima = (l) => {
    if (!l.ultimaEm) return 'nenhuma conferência ainda';
    const dias = diasDesdeMomento(l.ultimaEm);
    return `${haDias(dias)}${l.ultimaPor ? ` (${l.ultimaPor})` : ''}`;
};

const blocoCobranca = (linhas) => {
    const comAtraso = linhas.filter(l => l.atrasadas > 0);
    const soNoPrazo = linhas.filter(l => l.atrasadas === 0 && l.pendentes > 0);
    if (!comAtraso.length && !soNoPrazo.length) return '✅ Todas as vendas do período foram conferidas. Obrigado!';
    let txt = '';
    if (comAtraso.length) {
        txt += `⏰ *Por gentileza, conferir HOJE as vendas atrasadas:*\n`;
        txt += comAtraso.map(l => `👉 ${l.unidade} — ${l.atrasadas} atrasada${l.atrasadas === 1 ? '' : 's'} (a mais antiga é de ${ddmm(l.maisAntiga)})`).join('\n');
        txt += '\n\n';
    }
    if (soNoPrazo.length) txt += `🕒 No prazo, mas sem conferir: ${soNoPrazo.map(l => `${l.unidade} (${l.pendentes})`).join(' · ')}\n\n`;
    txt += `📌 Prazo: toda SEXTA-FEIRA conferir as vendas da semana (sábado a sexta). Só venda CONFERIDA entra no Fechamento e na comissão da equipe.`;
    return txt;
};

// Mensagem para o grupo da rede: 'resumo' ou 'detalhado'
export const mensagemCobrancaRede = (linhas, totais, periodoTexto, tipo) => {
    const criticas = linhas.filter(l => l.registrados > 0 && l.pendentes > 0 && pct(l) < 50);
    const andamento = linhas.filter(l => l.pendentes > 0 && pct(l) >= 50);
    const concluidas = linhas.filter(l => l.pendentes === 0);
    const ordenar = (a, b) => b.atrasadas - a.atrasadas || b.pendentes - a.pendentes;

    let txt = `🧾 *CONFERÊNCIA DE VENDAS – ${periodoTexto}*\n`;
    txt += `Rede: ${pct(totais)}% conferido · ${totais.pendentes} pendentes · ${totais.atrasadas} atrasadas\n\n`;

    const linhaResumo = (l) => `${l.unidade} — ${pct(l)}% · ${l.pendentes} pendente${l.pendentes === 1 ? '' : 's'}${l.atrasadas ? ` (${l.atrasadas} atrasada${l.atrasadas === 1 ? '' : 's'})` : ''}`;
    const blocoDetalhe = (l) => {
        let b = `*${l.unidade}* — ${pct(l)}% conferido\n`;
        b += `• ${l.pendentes} pendente${l.pendentes === 1 ? '' : 's'} · ${dinheiro(l.valorPendente)} em comissão\n`;
        if (l.atrasadas) b += `• ${l.atrasadas} atrasada${l.atrasadas === 1 ? '' : 's'} (prazo de sexta vencido)\n`;
        if (l.maisAntiga) b += `• Mais antiga sem conferir: ${ddmm(l.maisAntiga)} (${haDias(diasDesdeData(l.maisAntiga))})\n`;
        b += `• Última conferência: ${linhaUltima(l)}`;
        return b;
    };

    const grupo = (titulo, lista, modo) => {
        if (!lista.length) return '';
        const corpo = modo === 'detalhado' ? lista.sort(ordenar).map(blocoDetalhe).join('\n\n') : lista.sort(ordenar).map(linhaResumo).join('\n');
        return `${titulo} (${lista.length})*\n${corpo}\n\n`;
    };
    txt += grupo('🔴 *CRÍTICAS – abaixo de 50%', criticas, tipo);
    txt += grupo('🟡 *EM ANDAMENTO', andamento, tipo);
    if (concluidas.length) txt += `✅ *CONCLUÍDAS (${concluidas.length})*\n${concluidas.map(l => l.unidade).join(' · ')}\n\n`;
    txt += blocoCobranca(linhas);
    return txt;
};

// Mensagem para o Líder de UMA unidade
export const mensagemCobrancaLider = (linha, nomeLider, periodoTexto) => {
    const nome = primeiroNome(nomeLider);
    let txt = `Olá${nome ? `, ${nome}` : ''}! 👋\n\n`;
    txt += `🧾 *Conferência de vendas – ${linha.unidade}* (${periodoTexto})\n`;
    txt += `• ${pct(linha)}% conferido\n`;
    txt += `• ${linha.pendentes} venda${linha.pendentes === 1 ? '' : 's'} sem conferir (${dinheiro(linha.valorPendente)} em comissão)\n`;
    if (linha.atrasadas) txt += `• ${linha.atrasadas} atrasada${linha.atrasadas === 1 ? '' : 's'} (prazo de sexta vencido)\n`;
    if (linha.maisAntiga) txt += `• A mais antiga é de ${ddmm(linha.maisAntiga)} (${haDias(diasDesdeData(linha.maisAntiga))})\n`;
    txt += `\nLembrando: só venda CONFERIDA entra no Fechamento e na comissão da equipe. Por gentileza, confira ${linha.atrasadas ? 'hoje' : 'assim que puder'}. Obrigado!`;
    return txt;
};

// Líder ativo da unidade (setor do cadastro da Equipe contém "LIDER"); prefere quem tem telefone
// Reserva (12/11/2026): se a Equipe não tem Líder da unidade, vale o líder definido em Acessos → Líderes por unidade
// (login de Líder ou Admin/Mentor marcado), com o nome e o telefone que ele confirmou. `lideresAcesso` = contas.lideres
// de useAcessos ([{ unidade, lideres: [{ nome, telefone }] }]). Sem ele, funciona como antes.
const lideresDoAcesso = (lideresAcesso, alvo) => {
    const item = (lideresAcesso || []).find(x => normalizeString(x?.unidade) === alvo);
    const l = (item?.lideres || []).find(x => String(x.telefone || '').replace(/[^0-9]/g, '').length >= 10) || item?.lideres?.[0];
    return l ? { nome: l.nome, telefone: telefoneParaEquipe(l.telefone) || '', origem: 'acesso' } : null;
};
export const liderDaUnidade = (colaboradores = [], unidade, lideresAcesso = null) => {
    const alvo = normalizeString(unidade);
    const lideres = colaboradores.filter(c => c && c.ativo !== false
        && normalizeString(c.unidade) === alvo
        && normalizeString(c.role || c.setor || c.cargo).includes('LIDER'));
    return lideres.find(c => String(c.telefone || '').replace(/\D/g, '').length >= 10) || lideres[0] || lideresDoAcesso(lideresAcesso, alvo);
};

// Pedido para o Fechamento abrir direto na aba Conferência num período (botão "Fazer a conferência agora"
// da janela de cobrança do Líder). Mesmo modelo do pedirAbaAnalise da Análise de Vendas.
let conferenciaPedida = null;
export const EVENTO_PEDIR_CONFERENCIA = 'pedir-conferencia-fechamento';
export const pedirConferencia = (periodo) => { conferenciaPedida = periodo; window.dispatchEvent(new CustomEvent(EVENTO_PEDIR_CONFERENCIA)); };
export const consumirConferenciaPedida = () => { const p = conferenciaPedida; conferenciaPedida = null; return p; };
