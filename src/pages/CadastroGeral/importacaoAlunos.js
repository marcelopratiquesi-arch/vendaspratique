// ==========================================
// IMPORTAÇÃO DE ALUNOS (Cadastro → Alunos → Smart Paste) — decisões do dono, 06/11/2026
// - Cada linha vai para a unidade da coluna "Unidade" da planilha, ligada à unidade do NOSSO sistema
//   (o banco é um só para a rede inteira). Dá para colar várias unidades de uma vez.
//   Sem a coluna "Unidade", vale a unidade escolhida no topo.
// - Guarda no aluno: status (com a data da importação), sexo e data de cadastro.
// - TRAVA: aluno NÃO ativo na planilha (finalizado, inativo, cancelado, visitante...) que já está ligado a
//   OUTRA unidade não é importado ("Aluno de outra unidade, verificar"): não faz sentido chamar no CRM
//   quem é aluno de outra unidade. Aluno ATIVO na planilha que está ativo (ou sem status ainda) em outra
//   unidade só é transferido depois de confirmar.
// ==========================================
import { supabase } from '../../supabaseClient.js';
import { buscarUnidadesDeVariosAlunos, moverVinculoAlunos, mesmaUnidade } from '../Alunos/utils.js';
import { mascaraCPF } from './utilsAlunos.js';
import { tx } from '../../i18n/traduzir.js';

export const normUni = (u) => String(u || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

// Status que contam como "aluno ativo" (igual à classificação do CRM: ATIVO e CLIENTE)
export const STATUS_ATIVOS = ['ATIVO', 'CLIENTE'];
export const statusEhAtivo = (s) => STATUS_ATIVOS.includes(normUni(s));

// Situações da prévia
export const SITUACAO = {
    NOVO_ALUNO: 'NOVO ALUNO',
    NOVO_VINCULO: 'NOVO VÍNCULO',
    TRANSFERIR: 'TRANSFERIR',
    ATUALIZAR_MATRICULA: 'ATUALIZAR MATRÍCULA',
    JA_NESTA_UNIDADE: 'JÁ NESTA UNIDADE',
    CONFLITO_MATRICULA: 'CONFLITO GRAVE',
    CONFIRMAR_TRANSFERENCIA: 'CONFIRMAR TRANSFERÊNCIA',
    OUTRA_UNIDADE: 'ALUNO DE OUTRA UNIDADE',
    CPF_INVALIDO: 'CPF INVÁLIDO',
    DUPLICADO: 'DUPLICADO NA LISTA',
    DADO_DE_OUTRO: 'DADO DE OUTRO ALUNO',
    SEM_UNIDADE: 'UNIDADE NÃO RECONHECIDA',
    SEM_PERMISSAO: 'SEM ACESSO À UNIDADE',
    MATRICULA_REPETIDA: 'MATRÍCULA REPETIDA NA LISTA',
};

// Grava direto ao aplicar
const SITUACOES_QUE_GRAVAM = [SITUACAO.NOVO_ALUNO, SITUACAO.NOVO_VINCULO, SITUACAO.TRANSFERIR, SITUACAO.ATUALIZAR_MATRICULA, SITUACAO.JA_NESTA_UNIDADE];
// Só grava depois do clique de confirmação
export const SITUACOES_COM_CONFIRMACAO = [SITUACAO.CONFLITO_MATRICULA, SITUACAO.CONFIRMAR_TRANSFERENCIA];
export const SITUACOES_ERRO = [SITUACAO.CPF_INVALIDO, SITUACAO.DUPLICADO, SITUACAO.DADO_DE_OUTRO, SITUACAO.SEM_UNIDADE, SITUACAO.SEM_PERMISSAO, SITUACAO.MATRICULA_REPETIDA];

export const linhaVaiGravar = (p, camposNovos = true) => {
    if (p.status === SITUACAO.JA_NESTA_UNIDADE) return camposNovos; // só atualiza status/sexo/cadastro
    return SITUACOES_QUE_GRAVAM.includes(p.status) || (SITUACOES_COM_CONFIRMACAO.includes(p.status) && p.forcarTroca);
};

// ---------- De → para das unidades da planilha ----------
// Chave = código + nome (o sistema de origem pode ter duas unidades com o mesmo nome e códigos diferentes)
export const chaveUnidadePlanilha = (p) => `${p.unidade_codigo || ''}|${normUni(p.unidade_planilha)}`;

const CHAVE_MEMORIA = 'smartpaste_alunos_unidades';
const lerMemoria = () => { try { return JSON.parse(localStorage.getItem(CHAVE_MEMORIA) || '{}') || {}; } catch { return {}; } };
export const lembrarUnidades = (lista) => {
    try {
        const memoria = lerMemoria();
        lista.forEach(u => { if (u.destino) memoria[u.chave] = u.destino; });
        localStorage.setItem(CHAVE_MEMORIA, JSON.stringify(memoria));
    } catch { /* sem armazenamento: só não lembra na próxima */ }
};

// Unidades diferentes que aparecem na planilha, com a unidade do sistema sugerida
// (nome igual ao do sistema, ou a escolha feita antes neste computador)
export const unidadesDaPlanilha = (parsed, unidadesSistema) => {
    const memoria = lerMemoria();
    const mapa = new Map();
    parsed.forEach(p => {
        if (!p.unidade_planilha) return;
        const chave = chaveUnidadePlanilha(p);
        if (!mapa.has(chave)) mapa.set(chave, { chave, nome: p.unidade_planilha, codigo: p.unidade_codigo, qtd: 0 });
        mapa.get(chave).qtd++;
    });
    const lista = [...mapa.values()];
    // Mesmo nome com códigos diferentes na planilha: não liga sozinho pelo nome (pergunta)
    const nomesRepetidos = new Set(lista.map(u => normUni(u.nome)).filter((n, i, arr) => arr.indexOf(n) !== i));
    return lista.map(u => {
        const igual = nomesRepetidos.has(normUni(u.nome)) ? null : unidadesSistema.find(s => normUni(s) === normUni(u.nome));
        const lembrada = memoria[u.chave] ? unidadesSistema.find(s => normUni(s) === normUni(memoria[u.chave])) : null;
        return { ...u, destino: lembrada || igual || '', automatico: !lembrada && Boolean(igual) };
    }).sort((a, b) => b.qtd - a.qtd);
};

const variantesUnidade = (u) => {
    const x = String(u || '').toUpperCase().trim();
    return [...new Set([x, x.replace('INES', 'INÊS'), x.replace('INÊS', 'INES')])];
};

const CAMPOS_BASICOS = 'id, cpf, nome, telefone, email, matricula, data_nascimento';
const CAMPOS_NOVOS = 'sexo, data_cadastro, status_aluno, status_atualizado_em';

// Busca os alunos que já existem (pelo CPF). Descobre se os campos novos existem no banco.
const buscarExistentes = async (cpfs) => {
    let camposNovos = true;
    const existentes = [];
    for (let i = 0; i < cpfs.length; i += 200) {
        const fatia = cpfs.slice(i, i + 200);
        let res = camposNovos ? await supabase.from('alunos').select(`${CAMPOS_BASICOS}, ${CAMPOS_NOVOS}`).in('cpf', fatia) : null;
        if (camposNovos && res.error && /column|does not exist|schema cache/i.test(res.error.message || '')) {
            camposNovos = false;
            console.warn('Importação de alunos: campos novos não existem — rode sql/2026-11-06-alunos-importacao/1_campos_novos.sql');
            res = null;
        }
        if (!res) res = await supabase.from('alunos').select(CAMPOS_BASICOS).in('cpf', fatia);
        if (res.error) throw res.error;
        existentes.push(...(res.data || []));
    }
    return { existentes, camposNovos };
};

/**
 * Audita as linhas (não grava nada).
 * destinoPorChave: { chaveUnidadePlanilha → nome da unidade do sistema }
 * unidadeTopo: unidade do topo (vale para linha sem coluna Unidade); 'TODAS' = nenhuma
 * unidadesPermitidas: nomes das unidades em que a pessoa pode importar
 */
export const auditarImportacao = async ({ parsed, destinoPorChave, unidadeTopo, unidadesPermitidas }) => {
    const topo = unidadeTopo && !['TODAS', 'TODOS', 'GLOBAL'].includes(normUni(unidadeTopo)) ? unidadeTopo : '';

    // 1) Unidade de destino de cada linha
    parsed.forEach(p => {
        if (p.status !== 'NOVO') return;
        const escolhida = p.unidade_planilha ? (destinoPorChave[chaveUnidadePlanilha(p)] || '') : topo;
        if (!escolhida) {
            p.status = SITUACAO.SEM_UNIDADE;
            p.conflitoMsg = p.unidade_planilha
                ? tx('A unidade "{nome}" da planilha não foi ligada a nenhuma unidade do sistema.', { nome: p.unidade_planilha })
                : tx('A linha não tem unidade e o topo está em "Todas". Escolha uma unidade no topo.');
            return;
        }
        const permitida = unidadesPermitidas.find(u => mesmaUnidade(u, escolhida));
        if (!permitida) {
            p.status = SITUACAO.SEM_PERMISSAO;
            p.conflitoMsg = tx('Você não tem acesso à unidade {unidade}.', { unidade: escolhida });
            return;
        }
        p.destino = String(permitida).toUpperCase().trim();
    });

    const validas = parsed.filter(p => p.status === 'NOVO');
    if (validas.length === 0) return { linhas: parsed, camposNovos: true };

    // 2) Alunos que já existem + em que unidade estão (consulta segura: enxerga a rede inteira)
    const { existentes, camposNovos } = await buscarExistentes([...new Set(validas.map(p => p.cpf))]);
    const porCpf = new Map(existentes.map(e => [e.cpf, e]));
    const ids = existentes.map(e => e.id);
    const unidadesPorAluno = await buscarUnidadesDeVariosAlunos(ids);
    if (!unidadesPorAluno) throw new Error('Consulta segura unidades_dos_alunos indisponível: não dá para saber de qual unidade os alunos vêm.');

    // Matrícula atual de cada aluno nas unidades que a pessoa enxerga
    const vinculosPorAluno = new Map();
    for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await supabase.from('alunos_unidades').select('aluno_id, unidade, matricula').in('aluno_id', ids.slice(i, i + 200));
        if (error) throw error;
        (data || []).forEach(v => {
            if (!vinculosPorAluno.has(v.aluno_id)) vinculosPorAluno.set(v.aluno_id, []);
            vinculosPorAluno.get(v.aluno_id).push(v);
        });
    }

    // Quem já usa cada matrícula em cada unidade de destino
    const destinos = [...new Set(validas.map(p => p.destino))];
    const unidadesConsulta = destinos.flatMap(variantesUnidade);
    const matriculas = [...new Set(validas.map(p => String(p.matricula || '').trim()).filter(Boolean))];
    const ocupantes = new Map();
    for (let i = 0; i < matriculas.length; i += 200) {
        const { data, error } = await supabase.from('alunos_unidades')
            .select('unidade, matricula, alunos!inner(cpf, nome)')
            .in('matricula', matriculas.slice(i, i + 200))
            .in('unidade', unidadesConsulta);
        if (error) throw error;
        (data || []).forEach(o => ocupantes.set(`${normUni(o.unidade)}|${String(o.matricula).trim()}`, { cpf: o.alunos?.cpf, nome: o.alunos?.nome }));
    }

    // 3) Situação de cada linha
    const matriculaNaLista = new Map();
    validas.forEach(p => {
        const antigo = porCpf.get(p.cpf) || null;
        p._antigo = antigo;
        if (antigo) {
            // Planilha sem telefone/e-mail: mantém o que já havia
            if (!p.telefone && antigo.telefone) p.telefone = antigo.telefone;
            if (!p.email && antigo.email) p.email = antigo.email;
        }

        const matriculaColada = String(p.matricula || '').trim();
        const chaveMatricula = `${normUni(p.destino)}|${matriculaColada}`;
        if (matriculaColada) {
            const outraLinha = matriculaNaLista.get(chaveMatricula);
            if (outraLinha && outraLinha.cpf !== p.cpf) {
                p.status = SITUACAO.MATRICULA_REPETIDA;
                p.conflitoMsg = tx('A matrícula {matricula} se repete na lista com {nome} (mesma unidade).', { matricula: matriculaColada, nome: outraLinha.nome });
                return;
            }
            matriculaNaLista.set(chaveMatricula, { cpf: p.cpf, nome: p.nome });
        }

        const unidadesDoAluno = antigo ? (unidadesPorAluno.get(antigo.id) || []) : [];
        const deFora = unidadesDoAluno.filter(u => !mesmaUnidade(u, p.destino));
        const estaAqui = unidadesDoAluno.some(u => mesmaUnidade(u, p.destino));

        // TRAVA: aluno ligado a outra unidade
        if (deFora.length > 0) {
            p.origem = deFora.join(' + ');
            const statusLa = antigo?.status_aluno || '';
            const textoStatusLa = statusLa ? tx('status lá: {status}', { status: statusLa }) : tx('sem status lá ainda');
            if (!statusEhAtivo(p.status_tecace)) {
                p.status = SITUACAO.OUTRA_UNIDADE;
                p.conflitoMsg = tx('Este aluno é de {origem} ({statusLa}). Na planilha está {status}. Verificar.', { origem: p.origem, statusLa: textoStatusLa, status: p.status_tecace || tx('sem status') });
                return;
            }
            if (!camposNovos || !statusLa || statusEhAtivo(statusLa)) {
                p.status = SITUACAO.CONFIRMAR_TRANSFERENCIA;
                p.conflitoMsg = tx('Ativo também em {origem} ({statusLa}). Confirme para trazer para {destino}.', { origem: p.origem, statusLa: textoStatusLa, destino: p.destino });
                p.forcarTroca = false;
                return;
            }
            // Ativo aqui e não ativo na outra unidade: transfere normalmente
        }

        const ocupante = matriculaColada ? ocupantes.get(chaveMatricula) : null;
        if (ocupante && ocupante.cpf !== p.cpf) {
            p.status = SITUACAO.CONFLITO_MATRICULA;
            p.conflitoMsg = tx('O aluno {nome} (CPF: {cpf}) já usa a matrícula {matricula} em {unidade}.', { nome: ocupante.nome, cpf: mascaraCPF(ocupante.cpf), matricula: matriculaColada, unidade: p.destino });
            p.forcarTroca = false;
            return;
        }

        if (deFora.length > 0) { p.status = SITUACAO.TRANSFERIR; return; }

        if (estaAqui) {
            const vinculo = (vinculosPorAluno.get(antigo.id) || []).find(v => mesmaUnidade(v.unidade, p.destino));
            const matriculaBanco = String(vinculo?.matricula || '').trim();
            if (matriculaColada && matriculaColada !== matriculaBanco) {
                p.status = SITUACAO.ATUALIZAR_MATRICULA;
                p.matriculaAntiga = matriculaBanco;
            } else {
                p.status = SITUACAO.JA_NESTA_UNIDADE;
            }
            return;
        }
        p.status = antigo ? SITUACAO.NOVO_VINCULO : SITUACAO.NOVO_ALUNO;
    });

    // 4) Telefone e e-mail únicos na rede (decisão do dono): linha com dado de OUTRO aluno não entra.
    // "Já nesta unidade" não troca telefone/e-mail, então não precisa conferir.
    const soDigitos = (v) => String(v || '').replace(/\D/g, '');
    const variantesTel = (tel) => {
        const t = soDigitos(tel);
        if (!t) return [];
        if (t.length === 11) return [t, t.slice(0, 2) + t.slice(3)];
        if (t.length === 10) return [t, t.slice(0, 2) + '9' + t.slice(2)];
        return [t];
    };
    const candidatos = parsed.filter(p => SITUACOES_QUE_GRAVAM.includes(p.status) && p.status !== SITUACAO.JA_NESTA_UNIDADE || SITUACOES_COM_CONFIRMACAO.includes(p.status));
    const telefones = [...new Set(candidatos.flatMap(p => variantesTel(p.telefone)))];
    const emails = [...new Set(candidatos.map(p => String(p.email || '').toLowerCase().trim()).filter(Boolean))];
    const donoPorTel = new Map();
    const donoPorEmail = new Map();
    for (let i = 0; i < telefones.length; i += 200) {
        const { data } = await supabase.from('alunos').select('cpf, nome, telefone').in('telefone', telefones.slice(i, i + 200));
        (data || []).forEach(a => variantesTel(a.telefone).forEach(v => donoPorTel.set(v, a)));
    }
    for (let i = 0; i < emails.length; i += 200) {
        const { data } = await supabase.from('alunos').select('cpf, nome, email').in('email', emails.slice(i, i + 200));
        (data || []).forEach(a => donoPorEmail.set(String(a.email || '').toLowerCase().trim(), a));
    }
    const telNaLista = new Map();
    const emailNaLista = new Map();
    candidatos.forEach(p => {
        const cpf = soDigitos(p.cpf);
        const tels = variantesTel(p.telefone);
        const email = String(p.email || '').toLowerCase().trim();
        const outroDonoTel = tels.map(v => donoPorTel.get(v)).find(a => a && soDigitos(a.cpf) !== cpf);
        const outroDonoEmail = email ? donoPorEmail.get(email) : null;
        const emailDeOutro = outroDonoEmail && soDigitos(outroDonoEmail.cpf) !== cpf ? outroDonoEmail : null;
        const telRepetido = tels.map(v => telNaLista.get(v)).find(n => n && n.cpf !== cpf);
        const emailRepetido = email && emailNaLista.get(email)?.cpf !== cpf ? emailNaLista.get(email) : null;

        let motivo = '';
        if (outroDonoTel) motivo = tx('O telefone já é de {nome} (CPF {cpf}).', { nome: outroDonoTel.nome, cpf: mascaraCPF(outroDonoTel.cpf) });
        else if (emailDeOutro) motivo = tx('O e-mail já é de {nome} (CPF {cpf}).', { nome: emailDeOutro.nome, cpf: mascaraCPF(emailDeOutro.cpf) });
        else if (telRepetido) motivo = tx('O telefone se repete na lista com {nome}.', { nome: telRepetido.nome });
        else if (emailRepetido) motivo = tx('O e-mail se repete na lista com {nome}.', { nome: emailRepetido.nome });

        if (motivo) {
            p.status = SITUACAO.DADO_DE_OUTRO;
            p.conflitoMsg = tx('{motivo} Corrija no sistema de origem ou no cadastro antes de importar.', { motivo });
            p.forcarTroca = false;
            return;
        }
        tels.forEach(v => telNaLista.set(v, { cpf, nome: p.nome }));
        if (email) emailNaLista.set(email, { cpf, nome: p.nome });
    });

    return { linhas: parsed, camposNovos };
};

// Dados que vão para a tabela alunos (todas as linhas com os mesmos campos, para o banco não apagar nada)
const montarCadastro = (p, camposNovos, agora) => {
    const a = p._antigo || {};
    const soAtualizarImportacao = p.status === SITUACAO.JA_NESTA_UNIDADE;
    const obj = soAtualizarImportacao
        ? { cpf: p.cpf, nome: a.nome || p.nome, telefone: a.telefone || null, email: a.email || null, matricula: a.matricula || null, data_nascimento: a.data_nascimento || null }
        : {
            cpf: p.cpf,
            nome: p.nome,
            telefone: p.telefone || a.telefone || null,
            email: p.email || a.email || null,
            matricula: p.matricula || a.matricula || null,
            data_nascimento: p.data_nascimento || a.data_nascimento || null,
        };
    if (camposNovos) {
        obj.status_aluno = p.status_tecace || a.status_aluno || null;
        obj.status_atualizado_em = p.status_tecace ? agora : (a.status_atualizado_em || null);
        obj.sexo = p.sexo || a.sexo || null;
        obj.data_cadastro = p.data_cadastro || a.data_cadastro || null;
    }
    return obj;
};

/**
 * Grava as linhas aprovadas. Se um lote der erro, tenta linha por linha para gravar o resto
 * e devolve a lista do que não entrou (com o motivo do banco).
 */
export const aplicarImportacao = async ({ linhas, camposNovos, onProgresso }) => {
    const validas = linhas.filter(p => linhaVaiGravar(p, camposNovos));
    const falhas = [];
    let gravados = 0;
    const agora = new Date().toISOString();

    // 1) Matrícula "roubada" com autorização: o aluno que usava fica com LIVRE-...
    for (const p of validas.filter(x => x.status === SITUACAO.CONFLITO_MATRICULA)) {
        const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        await supabase.from('alunos_unidades')
            .update({ matricula: `LIVRE-${Date.now()}-${randomId}` })
            .in('unidade', variantesUnidade(p.destino))
            .eq('matricula', String(p.matricula).trim());
    }

    const gravarCadastros = async (lote) => {
        const { data, error } = await supabase.from('alunos')
            .upsert(lote.map(p => montarCadastro(p, camposNovos, agora)), { onConflict: 'cpf' })
            .select('id, cpf');
        if (!error) return { mapa: new Map((data || []).map(a => [a.cpf, a.id])), erros: [] };
        // Lote recusado: uma por uma, para achar a linha com problema
        const mapa = new Map();
        const erros = [];
        for (const p of lote) {
            const r = await supabase.from('alunos').upsert([montarCadastro(p, camposNovos, agora)], { onConflict: 'cpf' }).select('id, cpf');
            if (r.error) erros.push({ nome: p.nome, cpf: p.cpf, erro: r.error.message });
            else (r.data || []).forEach(a => mapa.set(a.cpf, a.id));
        }
        return { mapa, erros };
    };

    const moverVinculos = async (lote, mapa) => {
        const porDestino = new Map();
        lote.filter(p => p.status !== SITUACAO.JA_NESTA_UNIDADE && mapa.get(p.cpf)).forEach(p => {
            if (!porDestino.has(p.destino)) porDestino.set(p.destino, []);
            porDestino.get(p.destino).push(p);
        });
        const erros = [];
        for (const [destino, grupo] of porDestino) {
            const r = await moverVinculoAlunos(destino, grupo.map(p => mapa.get(p.cpf)), grupo.map(p => p.matricula || null));
            if (r.ok) continue;
            for (const p of grupo) {
                const r1 = await moverVinculoAlunos(destino, [mapa.get(p.cpf)], [p.matricula || null]);
                if (!r1.ok) erros.push({ nome: p.nome, cpf: p.cpf, erro: tx('Unidade não alterada: {erro}', { erro: r1.erro }) });
            }
        }
        return erros;
    };

    for (let i = 0; i < validas.length; i += 100) {
        const lote = validas.slice(i, i + 100);
        const { mapa, erros } = await gravarCadastros(lote);
        falhas.push(...erros);
        falhas.push(...await moverVinculos(lote, mapa));
        gravados += lote.length;
        onProgresso?.(Math.round((gravados / validas.length) * 100));
    }

    return { total: validas.length, falhas };
};
