import { supabase } from '../../supabaseClient.js';

// ==========================================
// 🧠 FORMATADORES E MÁSCARAS SEGUROS (LGPD & UI)
// ==========================================

export const formatarCPF = (cpf) => {
    if (!cpf) return '—';
    const d = String(cpf).replace(/\D/g, '');
    if (d.length !== 11) return cpf;
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

export const formatarTelefone = (tel) => {
    if (!tel) return '—';
    let d = String(tel).replace(/\D/g, '');
    if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return tel;
};

export const formatarDataBR = (isoOrDate) => {
    if (!isoOrDate) return '—';
    const str = String(isoOrDate).split('T')[0].split(' ')[0];
    const partes = str.split('-');
    if (partes.length === 3) {
        const [y, m, d] = partes;
        if (y.length === 4) return `${d}/${m}/${y}`;
    }
    return str;
};

export const extrairIniciais = (nome) => {
    if (!nome) return 'AL';
    const partes = String(nome).trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return 'AL';
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
};

export const limparApenasDigitos = (val) => String(val || '').replace(/\D/g, '');

// ==========================================
// 📋 UTILITÁRIO DE CÓPIA COM FALLBACK SEGURO
// ==========================================
export const copiarTextoSeguro = async (valor, apenasDigitos = false) => {
    if (!valor || valor === '—') return false;
    const textoFinal = apenasDigitos ? limparApenasDigitos(valor) : String(valor).trim();
    if (!textoFinal) return false;

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(textoFinal);
            return true;
        }
    } catch (_) {}

    try {
        const textArea = document.createElement('textarea');
        textArea.value = textoFinal;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textArea);
        return ok;
    } catch (_) {
        return false;
    }
};

// ==========================================
// ⚡ MOTOR DE BUSCA NO SERVIDOR (RPC + FALLBACK SUPREMO GLOBAL)
// ==========================================
export const buscarAlunosPaginado = async ({
    busca = '',
    unidade = 'TODAS',
    plano = 'TODOS',
    dataInicio = '',
    dataFim = '',
    ordemColuna = 'nome',
    ordemDirecao = 'ASC',
    pagina = 1,
    limite = 25,
    roleUsuario = 'RECEPCAO',
    unidadeUsuario = '',
    signal = null
}) => {
    const termoBusca = String(busca || '').trim();
    const termoNumerico = termoBusca.replace(/\D/g, '');
    
    // Tenta adaptar o termo para a RPC (ex: formata o CPF automaticamente)
    let termoRpc = termoBusca;
    if (termoNumerico.length === 11 && !termoBusca.includes('-')) {
        termoRpc = termoNumerico.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }

    let rpcCall = supabase.rpc('listar_alunos_360', {
        p_busca: termoRpc,
        p_unidade: unidade || 'TODAS',
        p_plano: plano || 'TODOS',
        p_data_inicio: dataInicio ? dataInicio : null,
        p_data_fim: dataFim ? dataFim : null,
        p_ordem_coluna: ordemColuna || 'nome',
        p_ordem_direcao: ordemDirecao || 'ASC',
        p_pagina: pagina || 1,
        p_limite: limite || 25,
        p_role_usuario: roleUsuario || 'RECEPCAO',
        p_unidade_usuario: unidadeUsuario || ''
    });

    if (signal && typeof rpcCall.abortSignal === 'function') {
        rpcCall = rpcCall.abortSignal(signal);
    }

    const { data, error } = await rpcCall;
    // Pedido cancelado de propósito (chegou um pedido mais novo): não é erro, não avisa no console
    if (signal?.aborted) return { alunos: [], totalCount: 0 };
    if (error) console.error("Erro na RPC listar_alunos_360:", error);

    let lista = data || [];
    let totalCount = lista.length > 0 ? Number(lista[0].total_count || 0) : 0;

    // 🔥 FALLBACK SUPREMO GLOBAL
    // Se a busca falhar e o usuário digitou algo, o problema é o filtro de unidade ou caracteres especiais.
    // Ignoramos a unidade e varremos o banco de dados inteiro (igual a Nova Venda).
    if (lista.length === 0 && termoBusca.length >= 2) {
        const cleanTerm = termoBusca.replace(/"/g, ''); 
        const orConditions = [];
        
        orConditions.push(`nome.ilike."%${cleanTerm}%"`);
        orConditions.push(`email.ilike."%${cleanTerm}%"`);
        
        if (termoNumerico.length > 0) {
            if (termoNumerico.length === 11) {
                const cpfMask = termoNumerico.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
                orConditions.push(`cpf.eq."${termoNumerico}"`);
                orConditions.push(`cpf.eq."${cpfMask}"`);
            } else {
                orConditions.push(`cpf.ilike."%${termoNumerico}%"`);
            }
            orConditions.push(`telefone.ilike."%${termoNumerico}%"`);
            orConditions.push(`matricula.ilike."%${termoNumerico}%"`);
        }

        const { data: fallbackData, count: fallbackCount, error: fallbackError } = await supabase
            .from('alunos')
            .select('*', { count: 'exact' })
            .or(orConditions.join(','))
            .order(ordemColuna === 'created_at' ? 'created_at' : 'nome', { ascending: ordemDirecao === 'ASC' })
            .range((pagina - 1) * limite, pagina * limite - 1);
            
        if (!fallbackError && fallbackData && fallbackData.length > 0) {
            lista = fallbackData.map(a => ({
                ...a,
                total_count: fallbackCount || fallbackData.length,
                ultimo_plano: a.ultimo_plano || 'NENHUM',
                ultimo_plano_data: a.ultimo_plano_data || null
            }));
            totalCount = fallbackCount || fallbackData.length;
        }
    }

    return {
        alunos: lista,
        totalCount
    };
};

// ==========================================
// 🌐 BUSCA NA REDE INTEIRA (regra 8 do CLAUDE.md — decisão do dono, não "corrigir")
// Todos os perfis acham alunos de qualquer unidade. Os da unidade de quem busca vêm primeiro.
// ==========================================
const normalizarUnidade = (u) => String(u || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

const unidadeValida = (u) => {
    const limpa = String(u || '').toUpperCase().trim();
    return limpa && limpa !== 'TODAS' && limpa !== 'TODOS' && limpa !== 'GLOBAL' ? limpa : '';
};

// Mesmo nome com e sem acento (ex.: SANTA INÊS / SANTA INES), como na aba Cadastros
const variantesUnidade = (u) => {
    const base = String(u || '').toUpperCase().trim();
    return [...new Set([base, normalizarUnidade(base), base.replace('INES', 'INÊS')])].filter(Boolean);
};

const montarCondicoesBusca = (termoBusca, termoNumerico) => {
    const cleanTerm = termoBusca.replace(/"/g, '');
    const condicoes = [`nome.ilike."%${cleanTerm}%"`, `email.ilike."%${cleanTerm}%"`];
    if (termoNumerico.length > 0) {
        if (termoNumerico.length === 11) {
            const cpfMask = termoNumerico.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
            condicoes.push(`cpf.eq."${termoNumerico}"`, `cpf.eq."${cpfMask}"`);
        } else {
            condicoes.push(`cpf.ilike."%${termoNumerico}%"`);
        }
        condicoes.push(`telefone.ilike."%${termoNumerico}%"`, `matricula.ilike."%${termoNumerico}%"`);
    }
    return condicoes.join(',');
};

const erroCancelado = () => {
    const e = new Error('Busca cancelada');
    e.name = 'AbortError';
    return e;
};

const listaUnidades = (linhas) => [...new Set((linhas || []).map(v => String(v.unidade || '').toUpperCase().trim()).filter(Boolean))];

// Unidades de TODOS os alunos pedidos, inclusive de outras unidades.
// Usa a consulta segura "unidades_dos_alunos" do Supabase (devolve só o nome da unidade), porque a regra
// de acesso da tabela alunos_unidades deixa Recepção/Líder ver só os vínculos da própria unidade.
// Se a consulta ainda não existir no banco, devolve null e quem chamou usa os vínculos visíveis.
const buscarUnidadesViaConsultaSegura = async (ids, signal = null) => {
    let consulta = supabase.rpc('unidades_dos_alunos', { p_aluno_ids: ids });
    if (signal && typeof consulta.abortSignal === 'function') consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (signal?.aborted) throw erroCancelado();
    if (error) {
        console.warn('Consulta unidades_dos_alunos indisponível; usando só os vínculos visíveis:', error.message || error);
        return null;
    }
    return data || [];
};

// Unidades ligadas a um aluno
export const buscarUnidadesDoAluno = async (alunoId) => {
    if (!alunoId) return [];
    const viaConsulta = await buscarUnidadesViaConsultaSegura([alunoId]);
    if (viaConsulta) return listaUnidades(viaConsulta);

    const { data, error } = await supabase.from('alunos_unidades').select('unidade').eq('aluno_id', alunoId);
    if (error) {
        console.error('Erro ao buscar unidades do aluno:', error);
        return [];
    }
    return listaUnidades(data);
};

// Unidades de vários alunos de uma vez: Map(aluno_id → [unidades]). Usa a consulta segura (de 200 em 200).
// Devolve null se a consulta segura não existir (aí não dá para saber as unidades de outras unidades).
export const buscarUnidadesDeVariosAlunos = async (alunoIds) => {
    const ids = [...new Set((alunoIds || []).filter(Boolean))];
    const mapa = new Map();
    for (let i = 0; i < ids.length; i += 200) {
        const fatia = ids.slice(i, i + 200);
        const linhas = await buscarUnidadesViaConsultaSegura(fatia);
        if (!linhas) return null;
        fatia.forEach(id => mapa.set(id, listaUnidades(linhas.filter(v => v.aluno_id === id))));
    }
    return mapa;
};

// Mesma unidade, sem ligar para acentos e maiúsculas ("SANTA INÊS 1" = "Santa Ines 1")
export const mesmaUnidade = (a, b) => Boolean(normalizarUnidade(a)) && normalizarUnidade(a) === normalizarUnidade(b);

// REGRA: um vínculo por aluno, na unidade onde ele consome (compra). Mover, nunca somar.
// Usa a função segura "mover_vinculo_alunos" do Supabase: ela apaga os vínculos das outras unidades e deixa
// um só na unidade de destino. É preciso a função porque a regra de acesso da tabela alunos_unidades não deixa
// Recepção/Líder mexer em vínculos de outra unidade. Recepção/Líder só movem para a própria unidade.
// matriculas: uma por aluno, na mesma ordem. null (ou item vazio) = mantém a matrícula que já houver na
// unidade de destino; se não houver, o vínculo fica sem matrícula.
export const moverVinculoAlunos = async (unidade, alunoIds, matriculas = null) => {
    const destino = String(unidade || '').toUpperCase().trim();
    const ids = (alunoIds || []).filter(Boolean);
    if (!destino || destino === 'TODAS') return { ok: false, erro: 'Unidade de destino inválida.' };
    if (ids.length === 0) return { ok: true, movidos: 0 };
    const listaMatriculas = matriculas ? ids.map((_, i) => (String(matriculas[i] ?? '').trim() || null)) : null;
    const { data, error } = await supabase.rpc('mover_vinculo_alunos', {
        p_unidade: destino,
        p_aluno_ids: ids,
        p_matriculas: listaMatriculas
    });
    if (error) {
        console.error('Erro ao mover vínculo do aluno:', error);
        const naoExiste = /could not find|does not exist|not find the function/i.test(error.message || '');
        return { ok: false, erro: naoExiste ? 'A função segura "mover_vinculo_alunos" ainda não foi criada no Supabase.' : (error.message || 'Erro desconhecido.') };
    }
    return { ok: true, movidos: Number(data) || ids.length };
};

// Acrescenta em cada aluno: unidades (todas as ligadas), da_minha_unidade e multiplas_unidades
export const anexarUnidades = async (lista, unidadeMinha = '', signal = null) => {
    const alunos = lista || [];
    const ids = alunos.map(a => a.id).filter(Boolean);
    let vinculos = [];      // vínculos visíveis (trazem a matrícula da unidade de quem busca)
    let unidadesRede = null; // todas as unidades de cada aluno, pela consulta segura
    if (ids.length > 0) {
        let consulta = supabase.from('alunos_unidades').select('aluno_id, unidade, matricula').in('aluno_id', ids);
        if (signal && typeof consulta.abortSignal === 'function') consulta = consulta.abortSignal(signal);
        const [resVinculos, resUnidades] = await Promise.all([consulta, buscarUnidadesViaConsultaSegura(ids, signal)]);
        if (signal?.aborted) throw erroCancelado();
        if (resVinculos.error) console.error('Erro ao buscar unidades dos alunos:', resVinculos.error);
        vinculos = resVinculos.data || [];
        unidadesRede = resUnidades;
    }

    const minha = normalizarUnidade(unidadeValida(unidadeMinha));
    return alunos.map(aluno => {
        const doAluno = vinculos.filter(v => v.aluno_id === aluno.id);
        let unidades = listaUnidades(unidadesRede ? unidadesRede.filter(v => v.aluno_id === aluno.id) : doAluno);
        // "SEM VÍNCULO" é o que a busca do banco devolve quando não enxerga nenhum vínculo: não é unidade
        if (unidades.length === 0 && aluno.unidade && normalizarUnidade(aluno.unidade) !== 'SEM VINCULO') {
            unidades = [String(aluno.unidade).toUpperCase().trim()];
        }

        const daMinha = Boolean(minha) && unidades.some(u => normalizarUnidade(u) === minha);
        const vinculoMinha = daMinha ? doAluno.find(v => normalizarUnidade(v.unidade) === minha) : null;

        return {
            ...aluno,
            unidades,
            unidade: daMinha ? (vinculoMinha?.unidade || unidades[0]) : (unidades[0] || aluno.unidade || ''),
            matricula: aluno.matricula || vinculoMinha?.matricula || doAluno[0]?.matricula || '',
            da_minha_unidade: daMinha,
            multiplas_unidades: unidades.length > 1
        };
    });
};

export const buscarAlunosNaRede = async ({
    busca = '',
    unidadePreferida = '',
    limite = 8,
    roleUsuario = 'RECEPCAO',
    signal = null
}) => {
    const termoBusca = String(busca || '').trim();
    if (termoBusca.length < 2) return { alunos: [], temMais: false };

    const termoNumerico = termoBusca.replace(/\D/g, '');
    const unidadeMinha = unidadeValida(unidadePreferida);
    const condicoes = montarCondicoesBusca(termoBusca, termoNumerico);
    const comSinal = (q) => (signal && typeof q.abortSignal === 'function' ? q.abortSignal(signal) : q);

    let termoRpc = termoBusca;
    if (termoNumerico.length === 11 && !termoBusca.includes('-')) {
        termoRpc = termoNumerico.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }

    // 1) Rede inteira, direto no cadastro de alunos
    const consultaRede = comSinal(supabase.from('alunos').select('*').or(condicoes).order('nome', { ascending: true }).limit(limite + 1));
    // 2) Só a unidade de quem busca, para ela aparecer primeiro mesmo quando a rede tem muitos resultados
    const consultaMinha = unidadeMinha
        ? comSinal(supabase.from('alunos').select('*, vinculo:alunos_unidades!inner(unidade)').or(condicoes).in('vinculo.unidade', variantesUnidade(unidadeMinha)).order('nome', { ascending: true }).limit(limite))
        : Promise.resolve({ data: [] });
    // 3) Busca principal do banco (traz o último plano e entende acentos): só complementa
    const consultaRpc = comSinal(supabase.rpc('listar_alunos_360', {
        p_busca: termoRpc,
        p_unidade: unidadeMinha || 'TODAS',
        p_plano: 'TODOS',
        p_data_inicio: null,
        p_data_fim: null,
        p_ordem_coluna: 'nome',
        p_ordem_direcao: 'ASC',
        p_pagina: 1,
        p_limite: limite,
        p_role_usuario: roleUsuario || 'RECEPCAO',
        p_unidade_usuario: unidadeMinha
    }));

    const [resRede, resMinha, resRpc] = await Promise.allSettled([consultaRede, consultaMinha, consultaRpc]);
    if (signal?.aborted) throw erroCancelado();

    const pegarDados = (res, nome) => {
        if (res.status === 'rejected') { console.error(`Erro na busca (${nome}):`, res.reason); return null; }
        if (res.value?.error) { console.error(`Erro na busca (${nome}):`, res.value.error); return null; }
        return res.value?.data || [];
    };
    const dadosRede = pegarDados(resRede, 'rede');
    const dadosMinha = pegarDados(resMinha, 'unidade');
    const dadosRpc = pegarDados(resRpc, 'listar_alunos_360');

    if (dadosRede === null && dadosRpc === null) throw new Error('Não foi possível buscar alunos agora.');

    // Junta tudo sem repetir: o que já veio fica, o que faltava (ex.: último plano) é completado
    const porId = new Map();
    [dadosRpc, dadosMinha, dadosRede].forEach(lista => {
        (lista || []).forEach(({ vinculo: _vinculo, total_count: _total, ...aluno }) => {
            if (!aluno?.id) return;
            const existente = porId.get(aluno.id);
            porId.set(aluno.id, existente ? { ...aluno, ...existente } : aluno);
        });
    });

    const comUnidades = await anexarUnidades([...porId.values()], unidadeMinha, signal);
    const porNome = (a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    const ordenados = [
        ...comUnidades.filter(a => a.da_minha_unidade).sort(porNome),
        ...comUnidades.filter(a => !a.da_minha_unidade).sort(porNome)
    ];

    const temMais = ordenados.length > limite
        || (dadosRede || []).length > limite
        || (dadosMinha || []).length >= limite;

    return { alunos: ordenados.slice(0, limite), temMais };
};

// ==========================================
// 🛡️ EXCLUSÃO SEGURA NO BANCO (SOMENTE ADMIN)
// ==========================================
export const executarExclusaoAluno = async ({
    alunoId,
    roleUsuario,
    nomeUsuario,
    emailUsuario,
    motivo = 'Cadastro indevido'
}) => {
    const { data, error } = await supabase.rpc('excluir_aluno_seguro', {
        p_aluno_id: alunoId,
        p_role_usuario: roleUsuario || '',
        p_nome_usuario: nomeUsuario || 'ADMIN',
        p_email_usuario: emailUsuario || '',
        p_motivo: motivo || 'Cadastro indevido'
    });

    if (error) throw error;
    return data;
};