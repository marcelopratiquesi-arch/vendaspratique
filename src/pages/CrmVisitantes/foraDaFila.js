// Contatos FORA DA FILA, sem bloqueio (27/11/2026, decisões do dono 4-A e 5-A).
// Ficam "Arquivado" (não são baixados nas listas do CRM) com o motivo em leads.motivo_perda.
// NÃO entram no "Não contatar": podem voltar ao Banco Bruto pela aba "Fora da fila".
export const MOTIVO_TELEFONE = 'Telefone com problema';
export const MOTIVO_JA_ALUNO = 'Já é aluno';
export const MOTIVO_PERSONAL = 'É personal trainer';
export const MOTIVOS_FORA_DA_FILA = [MOTIVO_TELEFONE, MOTIVO_JA_ALUNO, MOTIVO_PERSONAL];

// Campos que devolvem o contato ao Banco Bruto (visitante mantém quem o atendeu)
export const camposVoltaBanco = (lead) => ({
    status: 'Novo', puxado_em: null, puxado_por: null, perdido_em: null, motivo_perda: null, proximo_contato: null,
    ...(String(lead?.origem || '').toUpperCase() === 'RECEPCAO' ? {} : { vendedor: 'Importação' })
});
