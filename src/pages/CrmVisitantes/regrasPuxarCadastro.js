// ==========================================
// PUXAR DO CADASTRO (Base do CRM, decisão do dono, 06/11/2026)
// Traz para o Banco Bruto os alunos DA UNIDADE com o status escolhido (Finalizado, Inativo...), que veio da
// importação do Cadastro (alunos.status_aluno). Ficam de fora: quem já está no CRM (rede inteira), quem está
// em "Não contatar", quem não tem telefone válido e quem comprou plano nos últimos 30 dias (qualquer unidade).
// Aluno de outra unidade nunca vem: a importação do Cadastro já barra ("Aluno de outra unidade").
// ==========================================
import { supabase } from '../../supabaseClient.js';
import { apenasDigitos, normalizarNome, tipoPeloStatusTecace } from './utils.js';
import { carregarNaoContatar, estaNaoContatar } from './contatosFeitos.js';
import { buscarComprasDePlano } from './compraDePlano.js';
import { telefoneFalso } from '../CadastroGeral/utilsAlunos.js';

export const QTDS_PUXAR = [50, 100, 200];
export const DIAS_SEM_COMPRA = 30;

// Tipo do contato no CRM pelo status do cadastro (mesma regra do Smart Paste do CRM)
export const tipoDoStatus = (status) => {
    const s = normalizarNome(status);
    if (s === 'CANCELADO') return 'CANCELADO';
    const tipo = tipoPeloStatusTecace(s);
    return tipo === 'ATIVO' ? '' : tipo;
};

const variantesUnidade = (u) => {
    const x = String(u || '').toUpperCase().trim();
    return [...new Set([x, x.replace('INES', 'INÊS'), x.replace('INÊS', 'INES')])];
};

// Alunos da unidade que têm um status que vira contato (de 1000 em 1000). { alunos } ou { erro }
export const carregarAlunosDoCadastro = async (unidade) => {
    const alunos = [];
    for (let de = 0; de < 50000; de += 1000) {
        const { data, error } = await supabase.from('alunos')
            .select('id, nome, cpf, telefone, email, sexo, data_cadastro, status_aluno, alunos_unidades!inner(unidade, matricula)')
            .in('alunos_unidades.unidade', variantesUnidade(unidade))
            .not('status_aluno', 'is', null)
            .order('id')
            .range(de, de + 999);
        if (error) {
            const faltaSql = /status_aluno|data_cadastro|column/i.test(error.message || '');
            return { erro: faltaSql ? 'SQL_CADASTRO' : (error.message || 'erro') };
        }
        alunos.push(...(data || []));
        if (!data || data.length < 1000) break;
    }
    return { alunos: alunos.filter(a => tipoDoStatus(a.status_aluno)) };
};

// CPFs que já estão no CRM em qualquer unidade (consulta segura crm_cpfs_existentes; sem ela, busca direta)
const cpfsJaNoCrm = async (cpfs) => {
    const achados = new Set();
    for (let i = 0; i < cpfs.length; i += 200) {
        const fatia = cpfs.slice(i, i + 200);
        const { data, error } = await supabase.rpc('crm_cpfs_existentes', { p_cpfs: fatia });
        if (!error) { (data || []).forEach(a => achados.add(apenasDigitos(a.cpf))); continue; }
        const formatados = fatia.map(c => c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'));
        const { data: direto } = await supabase.from('leads').select('cpf').in('cpf', [...fatia, ...formatados]);
        (direto || []).forEach(a => achados.add(apenasDigitos(a.cpf)));
    }
    return achados;
};

const telefoneValido = (tel) => {
    const t = apenasDigitos(tel);
    return (t.length === 10 || t.length === 11) && !telefoneFalso(t);
};

/**
 * Confere os alunos dos status escolhidos. Devolve { prontos, contagem } ou { erro: 'SQL_COMPRAS' }.
 * prontos vem com os cadastrados mais recentemente primeiro.
 */
export const conferirAlunos = async (alunos, statusEscolhidos) => {
    const escolhidos = new Set(statusEscolhidos.map(normalizarNome));
    const lista = alunos.filter(a => escolhidos.has(normalizarNome(a.status_aluno)) && apenasDigitos(a.cpf).length === 11);
    const cpfs = [...new Set(lista.map(a => apenasDigitos(a.cpf)))];

    const desde = new Date(Date.now() - DIAS_SEM_COMPRA * 86400000);
    const desdeIso = `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-${String(desde.getDate()).padStart(2, '0')}`;
    const [noCrm, naoContatar, compras] = await Promise.all([cpfsJaNoCrm(cpfs), carregarNaoContatar(), buscarComprasDePlano(cpfs, desdeIso)]);
    if (compras === null) return { erro: 'SQL_COMPRAS' };
    const compraram = new Set(compras.map(c => apenasDigitos(c.cpf)));

    const contagem = { prontos: 0, noCrm: 0, naoContatar: 0, semTelefone: 0, comprou: 0 };
    const prontos = [];
    lista.forEach(a => {
        const cpf = apenasDigitos(a.cpf);
        if (noCrm.has(cpf)) contagem.noCrm++;
        else if (estaNaoContatar(naoContatar, { cpf, alunoId: a.id })) contagem.naoContatar++;
        else if (!telefoneValido(a.telefone)) contagem.semTelefone++;
        else if (compraram.has(cpf)) contagem.comprou++;
        else prontos.push(a);
    });
    prontos.sort((x, y) => String(y.data_cadastro || '').localeCompare(String(x.data_cadastro || '')));
    contagem.prontos = prontos.length;
    return { prontos, contagem };
};

/**
 * Grava os alunos como contatos do Banco Bruto da unidade. Devolve { salvos, recusados }.
 */
export const trazerParaBase = async (alunos, unidade) => {
    const agora = new Date().toISOString();
    const dataBR = new Date().toLocaleDateString('pt-BR');
    const montar = (a, comExtras) => ({
        unidade: String(unidade).toUpperCase(),
        nome: String(a.nome || '').toUpperCase(),
        telefone: apenasDigitos(a.telefone),
        cpf: apenasDigitos(a.cpf),
        tipo_lead: tipoDoStatus(a.status_aluno),
        origem: 'CRM',
        vendedor: 'Importação',
        status: 'Novo',
        data: dataBR,
        criado_em: agora,
        puxado_em: null,
        puxado_por: null,
        perdido_em: null,
        ...(comExtras ? {
            matricula: a.alunos_unidades?.[0]?.matricula || null,
            email: a.email || null,
            sexo: a.sexo || null,
            data_cadastro_tecace: a.data_cadastro || null,
        } : {}),
    });

    // Campos extras (matrícula, e-mail, sexo, data de cadastro) só existem com o SQL de 04/11/2026
    const { error: erroCampos } = await supabase.from('leads').select('matricula, email, sexo, data_cadastro_tecace').limit(1);
    const comExtras = !erroCampos;

    const salvos = [];
    const recusados = [];
    for (let i = 0; i < alunos.length; i += 100) {
        const lote = alunos.slice(i, i + 100);
        const { data, error } = await supabase.from('leads').insert(lote.map(a => montar(a, comExtras))).select();
        if (!error) { salvos.push(...(data || [])); continue; }
        for (const a of lote) {
            const { data: um, error: erroUm } = await supabase.from('leads').insert([montar(a, comExtras)]).select();
            if (erroUm) recusados.push({ nome: a.nome, erro: erroUm.code === '23505' ? 'CPF já está no CRM' : erroUm.message });
            else if (um?.[0]) salvos.push(um[0]);
        }
    }
    return { salvos, recusados };
};
