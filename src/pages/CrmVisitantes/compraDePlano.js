// ==========================================
// CONTATO DO CRM QUE COMPROU PLANO (decisão do dono, 06/11/2026)
// - Comprou plano na MESMA unidade do contato → vai sozinho para "Fechado" e conta como fechamento da
//   recepcionista dona do contato (o histórico é igual ao de arrastar à mão, com "(automático: ...)").
// - Comprou plano em OUTRA unidade → sai do CRM ("Arquivado"), com o histórico "comprou ... no CASTELINHO".
//   Não conta como fechamento de ninguém (o registro fica em nome de "Sistema").
// - Só vale para contato com CPF (visitante só com nome e telefone não dá para reconhecer).
// - Só compra DEPOIS de o contato entrar no CRM. Contatos da Migração ficam de fora (lá existe o "Migrou").
// - Não mexe em vendas, comissão nem metas: só no contato do CRM.
// Usado pela Nova Venda (na hora) e pelo CRM ao abrir (pega o que ficou para trás e as outras unidades).
// ==========================================
import { supabase } from '../../supabaseClient.js';
import { decomporPlano } from '../AnaliseVendas/utils.js';
import { apenasDigitos, normalizarNome, normalizarStatus, dataDoLead, dataLocalISO } from './utils.js';

// Plano que fecha contato: plano base (Plus, Fit, Personal ou outro). Nutri sozinho, Reavaliação e Férias não.
export const ehPlanoQueFecha = (nome, tipo) => {
    if (tipo && String(tipo).toLowerCase() !== 'plano') return false;
    const n = normalizarNome(nome);
    if (!n || n.includes('REAVALIA') || n.startsWith('FERIAS')) return false;
    return decomporPlano(nome).base !== null;
};

const mesmaUnidade = (a, b) => normalizarNome(a) && normalizarNome(a) === normalizarNome(b);
const diaBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '');

// Compras de plano na rede (consulta segura crm_compras_de_plano). null = consulta indisponível (falta o SQL).
export const buscarComprasDePlano = async (cpfs, desde) => {
    const lista = [...new Set((cpfs || []).map(apenasDigitos).filter(c => c.length === 11))];
    const linhas = [];
    for (let i = 0; i < lista.length; i += 200) {
        const { data, error } = await supabase.rpc('crm_compras_de_plano', { p_cpfs: lista.slice(i, i + 200), p_desde: desde });
        if (error) {
            console.warn('Consulta segura crm_compras_de_plano indisponível — rode sql/2026-11-06-crm-puxar-cadastro/1_compras_de_plano.sql', error.message || error);
            return null;
        }
        linhas.push(...(data || []).filter(l => ehPlanoQueFecha(l.produto)));
    }
    return linhas;
};

// Fases que a compra mexe: na mesma unidade também o Perdido (voltou e comprou); em outra unidade só os abertos
const ABERTOS = ['Novo', 'Em Contato'];
const FECHA_NA_UNIDADE = ['Novo', 'Em Contato', 'Perdido'];

/**
 * Decide o que fazer com cada contato. compras = linhas de buscarComprasDePlano (todas as unidades).
 * Devolve [{ lead, compra, acao: 'FECHAR' | 'SAIR' }]
 */
export const decidirPelasCompras = (leads, compras) => {
    const porCpf = new Map();
    (compras || []).forEach(c => {
        const cpf = apenasDigitos(c.cpf);
        if (!porCpf.has(cpf)) porCpf.set(cpf, []);
        porCpf.get(cpf).push(c);
    });
    const decisoes = [];
    (leads || []).forEach(lead => {
        const cpf = apenasDigitos(lead.cpf);
        if (cpf.length !== 11 || String(lead.tipo_lead || '').toUpperCase() === 'MIGRACAO') return;
        const fase = normalizarStatus(lead.status);
        const entrou = dataLocalISO(dataDoLead(lead)) || '0000-00-00';
        const depois = (porCpf.get(cpf) || []).filter(c => String(c.dia || '') >= entrou);
        if (depois.length === 0) return;
        const naUnidade = depois.find(c => mesmaUnidade(c.unidade, lead.unidade));
        if (naUnidade && FECHA_NA_UNIDADE.includes(fase)) decisoes.push({ lead, compra: naUnidade, acao: 'FECHAR' });
        else if (!naUnidade && ABERTOS.includes(fase)) decisoes.push({ lead, compra: depois[0], acao: 'SAIR' });
    });
    return decisoes;
};

// Grava as decisões (contato + histórico). Devolve as que deram certo, com os campos novos do contato.
export const aplicarDecisoes = async (decisoes, origem = 'Nova Venda') => {
    const feitas = [];
    for (const d of decisoes) {
        const { lead, compra } = d;
        const faseAntiga = normalizarStatus(lead.status);
        const novaFase = d.acao === 'FECHAR' ? 'Fechado' : 'Arquivado';
        const campos = { status: novaFase, perdido_em: null, motivo_perda: null, proximo_contato: null };
        let { error } = await supabase.from('leads').update(campos).eq('id', lead.id);
        // Sem os campos do Bloco 4 no banco: grava só a fase
        if (error && /motivo_perda|proximo_contato|column/i.test(error.message || '')) {
            ({ error } = await supabase.from('leads').update({ status: novaFase, perdido_em: null }).eq('id', lead.id));
        }
        if (error) { console.warn('CRM: não foi possível mover o contato pela compra', lead.id, error.message); continue; }

        const quando = diaBR(compra.dia);
        const observacao = d.acao === 'FECHAR'
            ? `Movido de "${faseAntiga}" para "Fechado" (automático: comprou ${compra.produto} em ${quando} · ${origem})`
            : `Movido de "${faseAntiga}" para "Arquivado" (automático: comprou ${compra.produto} no ${String(compra.unidade || '').toUpperCase()} em ${quando}). Saiu do CRM.`;
        // Fechado conta para a recepcionista dona do contato; saída por compra em outra unidade não conta para ninguém
        const consultor = d.acao === 'FECHAR'
            ? (lead.puxado_por || (String(lead.origem || '').toUpperCase() === 'RECEPCAO' ? lead.vendedor : '') || 'Sistema')
            : 'Sistema';
        await supabase.from('historico_leads').insert([{ lead_id: String(lead.id), tipo_acao: 'Mudança de Fase', consultor, observacao }]);
        feitas.push({ ...d, campos });
    }
    return feitas;
};

/**
 * Nova Venda: logo depois de gravar, fecha os contatos do CRM desta unidade com o CPF do aluno.
 * Nunca atrapalha a venda (qualquer erro só vai para o console). Devolve quantos foram para "Fechado".
 */
export const fecharContatosPelaVenda = async ({ cpf, unidade, itens, dia }) => {
    try {
        const cpfLimpo = apenasDigitos(cpf);
        const plano = (itens || []).find(i => ehPlanoQueFecha(i.nomeItem || i.produto, i.tipo));
        if (cpfLimpo.length !== 11 || !plano || !unidade) return 0;
        const { data: leads, error } = await supabase.from('leads')
            .select('id, cpf, unidade, status, tipo_lead, origem, vendedor, puxado_por, criado_em, data')
            .in('cpf', [cpfLimpo, cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')]);
        if (error) { console.warn('CRM: não foi possível procurar o contato do aluno', error.message); return 0; }
        const daUnidade = (leads || []).filter(l => mesmaUnidade(l.unidade, unidade));
        const compra = { cpf: cpfLimpo, produto: plano.nomeItem || plano.produto, unidade, dia: dia || dataLocalISO(new Date()) };
        const decisoes = decidirPelasCompras(daUnidade, [compra]).filter(d => d.acao === 'FECHAR');
        const feitas = await aplicarDecisoes(decisoes, 'Nova Venda');
        return feitas.length;
    } catch (e) {
        console.warn('CRM: erro ao fechar o contato pela venda', e);
        return 0;
    }
};
