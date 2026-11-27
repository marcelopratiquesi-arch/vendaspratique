// ==========================================
// PUXAR ALUNO CUJO CPF JÁ TEM CONTATO NO CRM — Migração, Resgate e Interessado (decisão do dono, 27/11/2026)
// O CPF é único no CRM da rede inteira, e a lista da tela NÃO tem tudo (Arquivados, Fechados antigos e contatos de
// outra unidade ficam de fora). Por isso o banco é consultado ANTES de marcar o aluno como puxado:
//   CRIAR           → não há contato: cria
//   REABRIR         → contato da própria unidade sem dona, Perdido, Fechado ou arquivado por compra em outra unidade
//   JA_MEU          → já está na carteira de quem puxa
//   COM_OUTRA       → está na carteira de outra recepcionista: não puxa
//   NAO_CONTATAR    → bloqueado: não puxa
//   FORA_DA_FILA    → telefone com problema, já é aluno ou personal: não puxa
//   OUTRA_UNIDADE   → o contato é de outra unidade: não puxa (decisão do dono: não mexer em dado de outra unidade)
// Sem importações do banco de propósito: o "supabase" chega por parâmetro (o teste roda sem o site).
// ==========================================
import { apenasDigitos, normalizarStatus, FASES_EM_ATENDIMENTO, mesmoNome } from './utils.js';
import { MOTIVOS_FORA_DA_FILA } from './foraDaFila.js';

export const PODE_PUXAR = ['CRIAR', 'REABRIR', 'JA_MEU'];

const mesmaUnidade = (a, b) => String(a || '').toUpperCase().trim() === String(b || '').toUpperCase().trim();
const ehBloqueado = (c) => c?.bloqueado_nc === true;
const motivoForaDaFila = (c) => (normalizarStatus(c?.status) === 'Arquivado' && MOTIVOS_FORA_DA_FILA.includes(c?.motivo_perda) ? c.motivo_perda : '');

// Havendo mais de um contato do mesmo CPF, vale o que mais "prende" o aluno
const peso = (c) => {
    const fase = normalizarStatus(c.status);
    if (FASES_EM_ATENDIMENTO.includes(fase)) return c.puxado_por ? 5 : 4;
    if (motivoForaDaFila(c)) return 3;
    if (fase === 'Perdido') return 2;
    if (fase === 'Fechado') return 1;
    return 0;
};

/** contatos = os contatos desse CPF que o banco deixou ler; existeNaRede = o CPF está no CRM em alguma unidade. */
export const decidirPuxada = (contatos, { unidade, operador, existeNaRede = false } = {}) => {
    const lista = contatos || [];
    if (lista.some(ehBloqueado)) return { acao: 'NAO_CONTATAR', lead: null };
    const daUnidade = lista.filter(c => mesmaUnidade(c.unidade, unidade));
    if (!daUnidade.length) return lista.length || existeNaRede ? { acao: 'OUTRA_UNIDADE', lead: null } : { acao: 'CRIAR', lead: null };
    const lead = [...daUnidade].sort((a, b) => peso(b) - peso(a))[0];
    if (FASES_EM_ATENDIMENTO.includes(normalizarStatus(lead.status)) && lead.puxado_por) {
        return { acao: mesmoNome(lead.puxado_por, operador) ? 'JA_MEU' : 'COM_OUTRA', lead };
    }
    const motivo = motivoForaDaFila(lead);
    if (motivo) return { acao: 'FORA_DA_FILA', lead, motivo };
    return { acao: 'REABRIR', lead };
};

const formatado = (cpf) => cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

/**
 * Decisão de cada CPF, consultando o banco (só leitura). Devolve Map cpf → { acao, lead, motivo }.
 * Dá erro (throw) se não conseguir ler os contatos: melhor não puxar do que puxar às cegas.
 */
export const consultarCpfs = async (supabase, cpfs, { unidade, operador }) => {
    const unicos = [...new Set((cpfs || []).map(apenasDigitos).filter(c => c.length === 11))];
    const decisoes = new Map();
    for (let i = 0; i < unicos.length; i += 100) {
        const fatia = unicos.slice(i, i + 100);
        const { data, error } = await supabase.from('leads').select('*').in('cpf', [...fatia, ...fatia.map(formatado)]);
        if (error) throw error;
        const porCpf = new Map();
        (data || []).forEach(l => {
            const cpf = apenasDigitos(l.cpf);
            porCpf.set(cpf, [...(porCpf.get(cpf) || []), l]);
        });
        // CPF que a leitura direta não mostrou pode ser de outra unidade (consulta segura crm_cpfs_existentes)
        const semContato = fatia.filter(c => !porCpf.has(c));
        const naRede = new Set();
        if (semContato.length) {
            const r = await supabase.rpc('crm_cpfs_existentes', { p_cpfs: semContato });
            if (r.error) console.warn('Consulta segura crm_cpfs_existentes indisponível:', r.error.message || r.error);
            (r.data || []).forEach(a => naRede.add(apenasDigitos(a.cpf)));
        }
        fatia.forEach(cpf => decisoes.set(cpf, decidirPuxada(porCpf.get(cpf), { unidade, operador, existeNaRede: naRede.has(cpf) })));
    }
    return decisoes;
};

/**
 * Escolhe quem dá para puxar, na ordem da lista, até completar a quantidade: quem não pode é pulado e o próximo entra.
 * Linha que já tem o contato (lead_id / leadParaPuxar) ou sem CPF completo passa direto.
 * Devolve { aceitos, impedidos: [{ linha, decisao }] }.
 */
export const escolherPuxaveis = async (supabase, ordenados, quantidade, contexto) => {
    const aceitos = [];
    const impedidos = [];
    let i = 0;
    // No máximo 20 consultas: com quase todos impedidos, não varre a lista inteira
    for (let volta = 0; volta < 20 && i < ordenados.length && aceitos.length < quantidade; volta++) {
        const lote = ordenados.slice(i, i + Math.max(quantidade - aceitos.length, 20));
        i += lote.length;
        const precisa = lote.filter(l => !l.leadParaPuxar && !l.lead_id);
        const decisoes = await consultarCpfs(supabase, precisa.map(l => l.cpf), contexto);
        for (const linha of lote) {
            if (aceitos.length >= quantidade) break;
            const decisao = linha.leadParaPuxar || linha.lead_id ? null : decisoes.get(apenasDigitos(linha.cpf));
            if (decisao && !PODE_PUXAR.includes(decisao.acao)) impedidos.push({ linha, decisao });
            else aceitos.push(linha);
        }
    }
    return { aceitos, impedidos };
};

/** CPFs da unidade em "Fora da fila" (Arquivados que a lista da tela não baixa): Map cpf → motivo. */
export const carregarForaDaFila = async (supabase, unidade) => {
    const mapa = new Map();
    for (let de = 0; de < 20000; de += 1000) {
        const { data, error } = await supabase.from('leads').select('id, cpf, motivo_perda')
            .eq('status', 'Arquivado').in('motivo_perda', MOTIVOS_FORA_DA_FILA)
            .ilike('unidade', String(unidade || '').trim())
            .order('id').range(de, de + 999);
        if (error) { console.warn('Não foi possível ler os contatos "Fora da fila":', error.message || error); break; }
        (data || []).forEach(l => { const cpf = apenasDigitos(l.cpf); if (cpf.length === 11) mapa.set(cpf, l.motivo_perda); });
        if (!data || data.length < 1000) break;
    }
    return mapa;
};

// Contatos do grupo Wellhub / Gympass (por CPF): o aluno não é oferecido de novo como Migração ou Resgate
export const cpfsNoWellhub = (leads, unidade) => new Set(
    (leads || []).filter(l => String(l?.tipo_lead || '').toUpperCase() === 'WELLHUB' && mesmaUnidade(l.unidade, unidade)
        && FASES_EM_ATENDIMENTO.includes(normalizarStatus(l.status)) && !l.puxado_por)
        .map(l => apenasDigitos(l.cpf)).filter(c => c.length === 11)
);

/** Frase do motivo (traduzida por quem chama: devolve { texto, partes } para o tx). */
export const motivoImpedimento = (decisao) => {
    switch (decisao?.acao) {
        case 'OUTRA_UNIDADE': return { texto: 'Já está no CRM de outra unidade' };
        case 'NAO_CONTATAR': return { texto: 'Está no "Não contatar"' };
        case 'FORA_DA_FILA': return { texto: 'Fora da fila: {motivo}', motivo: decisao.motivo };
        case 'COM_OUTRA': return { texto: 'Já é contato de {nome}', nome: String(decisao.lead?.puxado_por || '').split(' ')[0] };
        case 'WELLHUB': return { texto: 'No grupo Wellhub / Gympass' };
        default: return { texto: 'Não dá para puxar este aluno' };
    }
};
