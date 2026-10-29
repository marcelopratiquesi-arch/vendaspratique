import { supabase } from '../../supabaseClient.js';
import { MENSAGENS_PADRAO, apenasDigitos, diaISO } from './utils';

// ==========================================
// TABELAS DO CRM CRIADAS NA ETAPA B (rodadas pelo dono no Supabase)
// crm_contatos_feitos   → "Marcar como feito" (24h, 48h, aniversário; depois migração, cancelado, inativo)
// crm_mensagens_prontas → textos do WhatsApp (Admin/Líder editam)
// crm_nao_contatar      → quem pediu para não receber contato (fica fora de todas as listas)
// Se alguma ainda não existir, as funções avisam no console e devolvem o padrão.
// ==========================================

export const TIPOS_CONTATO = {
    VISITANTE_24H: 'Visitante 24h',
    VISITANTE_48H: 'Visitante 48h',
    ANIVERSARIO: 'Aniversário',
    MIGRACAO: 'Migração',
    CANCELADO: 'Cancelado',
    INATIVO: 'Inativo'
};

// Chave que identifica um contato feito (o mesmo contato não é marcado duas vezes)
export const chaveContatoFeito = (tipo, pessoaId, referencia) => `${tipo}|${pessoaId}|${referencia}`;

export const carregarMensagensProntas = async () => {
    const mensagens = { ...MENSAGENS_PADRAO };
    const { data, error } = await supabase.from('crm_mensagens_prontas').select('chave, texto');
    if (error) { console.warn('Tabela crm_mensagens_prontas indisponível; usando os textos padrão:', error.message || error); return mensagens; }
    (data || []).forEach(r => { if (r.texto && r.chave in mensagens) mensagens[r.chave] = r.texto; });
    return mensagens;
};

export const salvarMensagemPronta = async (chave, texto, quem) => {
    const { error } = await supabase.from('crm_mensagens_prontas')
        .upsert({ chave, texto, atualizado_em: new Date().toISOString(), atualizado_por: quem }, { onConflict: 'chave' });
    return error;
};

// Contatos feitos dos tipos pedidos, a partir de um dia de referência (AAAA-MM-DD)
export const carregarContatosFeitos = async ({ tipos, desde }) => {
    let consulta = supabase.from('crm_contatos_feitos').select('*').in('tipo', tipos).order('criado_em', { ascending: false }).limit(5000);
    if (desde) consulta = consulta.gte('referencia', desde);
    const { data, error } = await consulta;
    if (error) { console.warn('Tabela crm_contatos_feitos indisponível:', error.message || error); return null; }
    return data || [];
};

// Contatos feitos dentro de um período (data e hora em que foram feitos), para o relatório por recepcionista
export const carregarContatosFeitosPeriodo = async ({ inicio, fim }) => {
    let consulta = supabase.from('crm_contatos_feitos').select('*').order('criado_em', { ascending: false }).limit(10000); // mesmo teto do relatório
    if (inicio) consulta = consulta.gte('criado_em', inicio.toISOString());
    if (fim) consulta = consulta.lt('criado_em', fim.toISOString());
    const { data, error } = await consulta;
    if (error) { console.warn('Tabela crm_contatos_feitos indisponível:', error.message || error); return null; }
    return data || [];
};

// Grava o "Marcar como feito". Se outra pessoa marcou antes (registro repetido), considera feito.
// Devolve false quando já estava gravado (não gravou de novo).
export const registrarContatoFeito = async (registro) => {
    const { error } = await supabase.from('crm_contatos_feitos').insert([registro]);
    if (error && error.code !== '23505') throw error;
    return !error;
};

// Alunos com contato de Migração já registrado hoje (um por aluno por dia: repetir não soma)
export const carregarMigracaoContatadosHoje = async () => {
    const { data, error } = await supabase.from('crm_contatos_feitos').select('aluno_id').eq('tipo', 'MIGRACAO').eq('referencia', diaISO(0));
    if (error) { console.warn('Não foi possível ler os contatos de migração de hoje:', error.message || error); return new Set(); }
    return new Set((data || []).map(r => r.aluno_id).filter(Boolean));
};

// ==========================================
// NÃO CONTATAR (pedido da pessoa; vale para a rede inteira)
// ==========================================
export const carregarListaNaoContatar = async () => {
    const { data, error } = await supabase.from('crm_nao_contatar').select('*').eq('ativo', true).order('criado_em', { ascending: false });
    if (error) { console.warn('Tabela crm_nao_contatar indisponível:', error.message || error); return null; }
    return data || [];
};

export const colocarNaoContatar = async ({ unidade, cpf, aluno_id = null, lead_id = null, nome, motivo, colocado_por }) => {
    const { error } = await supabase.from('crm_nao_contatar').insert([{
        unidade: String(unidade || '').toUpperCase().trim(), cpf: apenasDigitos(cpf) || null,
        aluno_id, lead_id: lead_id ? String(lead_id) : null, nome, motivo, colocado_por
    }]);
    if (error) throw error;
};

// Só Líder e Admin (o banco também confere)
export const tirarNaoContatar = async (id, quem) => {
    const { error } = await supabase.from('crm_nao_contatar')
        .update({ ativo: false, removido_em: new Date().toISOString(), removido_por: quem }).eq('id', id);
    if (error) throw error;
};

// ==========================================
// MIGRAÇÃO (alunos da unidade com o último plano comprado; o filtro NUTRI é feito na tela)
// ==========================================
export const carregarUltimoPlanoAlunos = async (unidade) => {
    const { data, error } = await supabase.rpc('crm_migracao_alunos', { p_unidade: unidade });
    if (error) { console.warn('Consulta crm_migracao_alunos indisponível:', error.message || error); return null; }
    return data || [];
};

export const carregarAndamentoMigracao = async () => {
    const { data, error } = await supabase.from('crm_migracao').select('*');
    if (error) { console.warn('Tabela crm_migracao indisponível:', error.message || error); return null; }
    return new Map((data || []).map(r => [r.aluno_id, r]));
};

// puxado_por/puxado_em: dono da fila (se não vier, o banco mantém o que já tinha)
export const salvarAndamentoMigracao = async ({ aluno_id, unidade, status, quem, puxado_por, puxado_em }) => {
    const linha = {
        aluno_id, unidade: String(unidade || '').toUpperCase().trim(), status,
        atualizado_em: new Date().toISOString(), atualizado_por: quem
    };
    if (puxado_por !== undefined) linha.puxado_por = puxado_por;
    if (puxado_em !== undefined) linha.puxado_em = puxado_em;
    const { error } = await supabase.from('crm_migracao').upsert(linha, { onConflict: 'aluno_id' });
    if (error) throw error;
};

// "Puxar" alunos da Migração para a fila (situação NA_FILA = puxado, ainda não contatado).
// Quem decide é o banco (função crm_puxar_migracao): só pega aluno livre, nunca "rouba" da fila de ninguém,
// e o dono da fila é conferido lá (Recepção: sempre ela mesma). Devolve os alunos que o banco confirmou.
export const puxarParaFilaMigracao = async ({ alunoIds, unidade, operador }) => {
    if (!alunoIds.length) return [];
    const { data, error } = await supabase.rpc('crm_puxar_migracao', {
        p_unidade: String(unidade || '').toUpperCase().trim(),
        p_aluno_ids: alunoIds,
        p_operador: operador
    });
    if (error) throw error;
    // Função que devolve uma lista de valores: cada item pode vir como texto ou como { crm_puxar_migracao: ... }
    return (data || []).map(item => (item && typeof item === 'object' ? Object.values(item)[0] : item));
};

// "Devolver": o aluno sai da fila e volta para os Disponíveis
export const devolverDaFilaMigracao = async ({ aluno_id, unidade, quem }) => {
    const { error } = await supabase.from('crm_migracao').upsert({
        aluno_id, unidade: String(unidade || '').toUpperCase().trim(), status: 'NA_FILA',
        puxado_por: null, puxado_em: null, atualizado_em: new Date().toISOString(), atualizado_por: quem
    }, { onConflict: 'aluno_id' });
    if (error) throw error;
};

// Resumo do dia de quem fecha o turno (contatos feitos, Não contatar e interessados na Migração)
export const carregarResumoDoDia = async (consultor) => {
    const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
    const desde = inicio.toISOString();
    const [feitos, bloqueios, interessados] = await Promise.all([
        supabase.from('crm_contatos_feitos').select('tipo, canal').eq('consultor', consultor).gte('criado_em', desde),
        supabase.from('crm_nao_contatar').select('id', { count: 'exact', head: true }).eq('colocado_por', consultor).gte('criado_em', desde),
        supabase.from('crm_migracao').select('aluno_id', { count: 'exact', head: true }).eq('status', 'INTERESSADO').eq('atualizado_por', consultor).gte('atualizado_em', desde)
    ]);
    if (feitos.error) { console.warn('Resumo do dia indisponível:', feitos.error.message || feitos.error); return null; }
    return { feitos: feitos.data || [], naoContatar: bloqueios.count || 0, interessados: interessados.count || 0 };
};

// Contatos feitos de um aluno (aba Contatos e linha do tempo da ficha): pelo aluno ou pelos contatos do CRM dele.
// Usa a consulta segura "crm_contatos_feitos_do_aluno" (rede inteira: a tabela é protegida por unidade).
// Se ela não existir, cai na leitura direta, que mostra só os contatos da própria unidade.
export const carregarContatosDoAluno = async (alunoId, leadIds = []) => {
    if (alunoId || leadIds.length) {
        const { data, error } = await supabase.rpc('crm_contatos_feitos_do_aluno', { p_aluno_id: alunoId || null, p_lead_ids: leadIds.map(String) });
        if (!error) return data || [];
        console.warn('Consulta segura crm_contatos_feitos_do_aluno indisponível; mostrando só a própria unidade:', error.message || error);
    }
    const condicoes = [];
    if (alunoId) condicoes.push(`aluno_id.eq.${alunoId}`);
    if (leadIds.length) condicoes.push(`lead_id.in.(${leadIds.map(id => `"${id}"`).join(',')})`);
    if (condicoes.length === 0) return [];
    const { data, error } = await supabase.from('crm_contatos_feitos').select('*').or(condicoes.join(',')).order('criado_em', { ascending: false });
    if (error) { console.warn('Não foi possível ler os contatos feitos do aluno:', error.message || error); return []; }
    return data || [];
};

// Quem pediu para não receber contato. Reconhece pelo CPF, pelo contato do CRM e pelo aluno
// (contato vindo de lista do TECACE pode não ter CPF).
const chavesDaPessoa = ({ cpf, leadId, alunoId }) => [
    apenasDigitos(cpf) && `cpf:${apenasDigitos(cpf)}`,
    leadId && `lead:${leadId}`,
    alunoId && `aluno:${alunoId}`
].filter(Boolean);

export const estaNaoContatar = (conjunto, pessoa) => chavesDaPessoa(pessoa).some(c => conjunto.has(c));

// Devolve um conjunto novo com a pessoa incluída (para esconder na hora, sem esperar o banco)
export const incluirNaoContatar = (conjunto, pessoa) => {
    const novo = new Set(conjunto);
    chavesDaPessoa(pessoa).forEach(c => novo.add(c));
    return novo;
};

export const carregarNaoContatar = async () => {
    const { data, error } = await supabase.from('crm_nao_contatar').select('cpf, lead_id, aluno_id').eq('ativo', true);
    if (error) { console.warn('Tabela crm_nao_contatar indisponível:', error.message || error); return new Set(); }
    return (data || []).reduce((conjunto, r) => incluirNaoContatar(conjunto, { cpf: r.cpf, leadId: r.lead_id, alunoId: r.aluno_id }), new Set());
};

// Alunos da unidade que fazem aniversário hoje (consulta segura no Supabase)
export const carregarAniversariantes = async (unidade) => {
    const { data, error } = await supabase.rpc('crm_aniversariantes_do_dia', { p_unidade: unidade });
    if (error) { console.warn('Consulta crm_aniversariantes_do_dia indisponível:', error.message || error); return null; }
    return data || [];
};
