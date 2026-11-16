// ==========================================
// ALUNO PUXADO QUE ESTÁ NO FUNIL — regras únicas da Migração, do Resgate e do grupo Wellhub/Gympass
// (decisão do dono, 16/11/2026)
// Ao puxar, o aluno vira um contato do funil da recepcionista (coluna "Novo", etiqueta MIGRACAO / RESGATE / WELLHUB).
// As abas Migração e Resgate passam a ser só consulta ("Minha fila") + botão "Abrir no CRM": quem manda é o contato do funil.
//   - contato em Novo/Em Contato COM dona        → "No funil" (não está disponível para ninguém)
//   - contato em Novo/Em Contato SEM dona        → voltou para a aba (rotina automática, ex.: 3 dias sem caminho): disponível
//   - contato Perdido (geladeira de 30 dias)     → "Geladeira"; passados os 30 dias volta a ficar disponível
//   - contato Fechado                            → "No funil · Fechado" (não está disponível)
// Sem estas regras, o aluno puxado voltaria a aparecer como disponível depois de 3 dias (regra antiga da fila).
// ==========================================
import { apenasDigitos, normalizarStatus, FASES_EM_ATENDIMENTO, estaEmEspera, dataLocalISO, somarDiasISO } from './utils.js';

export const DIAS_GELADEIRA_FUNIL = 30;

// Leads da unidade, dos tipos pedidos, por CPF (só com CPF completo). Arquivado não conta.
export const indexarLeadsDeFila = (leads, tipos) => {
    const mapa = new Map();
    (leads || []).forEach(l => {
        if (!tipos.includes(String(l?.tipo_lead || '').toUpperCase()) || normalizarStatus(l.status) === 'Arquivado') return;
        const cpf = apenasDigitos(l.cpf);
        if (cpf.length !== 11) return;
        const atual = mapa.get(cpf);
        // Se houver mais de um, vale o que está em aberto e com dona
        const peso = (x) => (FASES_EM_ATENDIMENTO.includes(normalizarStatus(x.status)) ? (x.puxado_por ? 3 : 2) : 1);
        if (!atual || peso(l) > peso(atual)) mapa.set(cpf, l);
    });
    return mapa;
};

/**
 * Situação do aluno olhando o contato dele no funil.
 * Devolve null (sem contato), ou { tipo, lead, fase, dono, voltaEm } com tipo:
 *   NO_FUNIL · DEVOLVIDO (sem dona) · GELADEIRA · LIBERADO (geladeira vencida) · FECHADO
 */
export const situacaoNoFunil = (lead, hoje) => {
    if (!lead) return null;
    const fase = normalizarStatus(lead.status);
    const dono = lead.puxado_por || '';
    if (FASES_EM_ATENDIMENTO.includes(fase)) {
        if (!dono) return { tipo: 'DEVOLVIDO', lead, fase, dono: '', voltaEm: null };
        const espera = estaEmEspera(lead);
        return { tipo: 'NO_FUNIL', lead, fase: espera ? 'Em Espera' : fase, dono, voltaEm: espera ? String(lead.proximo_contato).slice(0, 10) : null };
    }
    if (fase === 'Perdido') {
        const volta = somarDiasISO(dataLocalISO(lead.perdido_em) || hoje, DIAS_GELADEIRA_FUNIL);
        return { tipo: volta <= hoje ? 'LIBERADO' : 'GELADEIRA', lead, fase, dono: '', voltaEm: volta };
    }
    if (fase === 'Fechado') return { tipo: 'FECHADO', lead, fase: 'Fechado', dono: '', voltaEm: null };
    return null;
};

// Contatos do grupo WELLHUB / GYMPASS que estão esperando uma recepcionista: tipo WELLHUB, em Novo e sem dona.
export const leadsWellhubDisponiveis = (leads, unidade) => {
    const alvo = String(unidade || '').toUpperCase().trim();
    return (leads || []).filter(l => String(l?.tipo_lead || '').toUpperCase() === 'WELLHUB'
        && normalizarStatus(l.status) === 'Novo' && !l.puxado_por
        && (!alvo || String(l.unidade || '').toUpperCase().trim() === alvo));
};
