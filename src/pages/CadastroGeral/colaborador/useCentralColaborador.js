// ==========================================
// CENTRAL DO COLABORADOR — leitura dos dados (só leitura; 11/11/2026)
// Busca SÓ quando a Central é aberta e SÓ da pessoa aberta. O nome é escrito à mão em vendas, avaliações e CRM,
// então o banco é consultado com um filtro LARGO (padraoBuscaNome: pega com/sem acento e com espaço a mais) e a tela
// fica só com o nome IGUAL (mesmoNomeColaborador). O banco só devolve as unidades de quem está olhando.
// - vendas: do período + 6 meses (gráfico) + mesmas datas do mês anterior (▲▼)
// - vendas da unidade no período (só vendedor e comissão): posição no ranking
// - nomes parecidos com vendas (comissão separada por nome escrito diferente)
// - visitantes que atendeu · avaliações que fez (período + 6 meses) · CRM (Recepção): ações, contatos e resultados
//   do período e do mês anterior (comparação)
// Cada parte é lida separada: se uma falhar, as outras aparecem e a que falhou avisa.
// ==========================================
import { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient.js';
import { faixaMesAnterior } from '../../AnaliseVendas/comparativoMesAnterior.js';
import { paraIsoLocal, inicioDosUltimosMeses, padraoBuscaNome, mesmoNomeColaborador } from './contasColaborador.js';

const TAMANHO_PAGINA = 1000;
const LIMITE_LINHAS = 30000;
const ACOES_CRM = ['WhatsApp', 'Ligação', 'Observação', 'Mudança de Fase', 'Agendamento'];

const paginado = async (montar) => {
    let todas = [];
    for (let de = 0; de < LIMITE_LINHAS; de += TAMANHO_PAGINA) {
        const { data, error } = await montar().range(de, de + TAMANHO_PAGINA - 1);
        if (error) throw error;
        todas = todas.concat(data || []);
        if (!data || data.length < TAMANHO_PAGINA) break;
    }
    return todas;
};
const menor = (...datas) => (datas.some(d => !d) ? null : datas.reduce((a, b) => (a < b ? a : b)));
const maior = (...datas) => datas.filter(Boolean).reduce((a, b) => (a > b ? a : b), '');
const somarDias = (iso, dias) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + dias); return paraIsoLocal(d); };
const inicioIso = (dia) => new Date(`${dia}T00:00:00`).toISOString();
const fimIso = (dia) => new Date(`${somarDias(dia, 1)}T00:00:00`).toISOString();
const normalizarSetor = (c) => String(c?.role || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
export const ehRecepcaoColab = (c) => normalizarSetor(c).includes('RECEP');
// Quem faz avaliação física: SAVER ou Líder (a mesma regra da tela da Avaliação)
export const ehAvaliadorColab = (c) => /SAVER|LIDER/.test(normalizarSetor(c));

export const useCentralColaborador = ({ colaborador, faixa, ativo = true }) => {
    const [dados, setDados] = useState(null);
    const [carregando, setCarregando] = useState(false);
    const nome = String(colaborador?.nome || '').trim();
    const cpfBruto = String(colaborador?.cpf || '').replace(/\D/g, '');
    const cpf = cpfBruto.length === 11 ? cpfBruto : '';
    const unidade = String(colaborador?.unidade || '').trim();
    const recepcao = ehRecepcaoColab(colaborador);
    const fxInicio = faixa?.inicio || null;
    const fxFim = faixa?.fim || null;

    useEffect(() => {
        if (!ativo || !nome) return undefined;
        let vivo = true;
        setCarregando(true);
        (async () => {
            const agora = new Date();
            const hoje = paraIsoLocal(agora);
            const faixa = { inicio: fxInicio, fim: fxFim };
            const anterior = faixaMesAnterior(faixa.inicio && faixa.fim ? faixa : null, hoje);
            const inicio6 = inicioDosUltimosMeses(6, agora);
            const erros = [];
            const tentar = async (parte, fn, padrao) => {
                try { return await fn(); } catch (e) { console.warn(`Central do colaborador: não deu para ler ${parte}`, e?.message || e); erros.push(parte); return padrao; }
            };
            const padrao = padraoBuscaNome(nome);
            const soDela = (campo) => (linhas) => (linhas || []).filter(l => mesmoNomeColaborador(l[campo], nome));
            const partes = nome.toUpperCase().split(/\s+/).filter(Boolean);
            const parecido = partes.length >= 2 ? padraoBuscaNome(`${partes[0]} ${partes[partes.length - 1]}`) : null;
            // Vendas e avaliações: período, mês anterior e os 6 meses do gráfico
            const de6 = menor(faixa.inicio, anterior?.inicio || faixa.inicio, inicio6);
            const ate = maior(faixa.fim, hoje);
            // CRM: período e mês anterior (comparação)
            const deCrm = menor(faixa.inicio, anterior?.inicio || faixa.inicio, hoje);

            // Vendas dela: pelo CPF do vendedor (quando a venda tem, desde o SQL de 11/11/2026) OU pelo nome igual.
            // Venda com o CPF de OUTRA pessoa de mesmo nome não entra. Sem o campo no banco, só pelo nome.
            const lerVendas = async (comCpf) => paginado(() => {
                let q = supabase.from('vendas').select('*').order('id', { ascending: true });
                q = comCpf ? q.or(`vendedor_cpf.eq.${cpf},vendedor.ilike.${padrao}`) : q.ilike('vendedor', padrao);
                if (de6) q = q.gte('data', de6);
                if (ate) q = q.lte('data', ate);
                return q;
            });
            const dasVendas = (linhas) => (linhas || []).filter(v => {
                const doVendedor = String(v.vendedor_cpf || '').replace(/\D/g, '');
                if (cpf && doVendedor.length === 11) return doVendedor === cpf;
                return mesmoNomeColaborador(v.vendedor, nome);
            });

            const [vendas, vendasUnidade, parecidas, visitantes, avaliacoes, historico, feitos, resultados, pagamentos] = await Promise.all([
                tentar('as vendas', async () => {
                    if (!cpf) return dasVendas(await lerVendas(false));
                    try { return dasVendas(await lerVendas(true)); } catch (e) {
                        if (!/vendedor_cpf/i.test(e?.message || '')) throw e;
                        return dasVendas(await lerVendas(false)); // falta o passo 1 do SQL de 11/11/2026
                    }
                }, null),
                // Ranking da unidade: só com período definido (Todo o período seria a unidade inteira)
                unidade && faixa.inicio ? tentar('o ranking da unidade', () => paginado(() => {
                    let q = supabase.from('vendas').select('id, vendedor, valor, comissao').eq('unidade', unidade).gte('data', faixa.inicio).order('id', { ascending: true });
                    if (faixa.fim) q = q.lte('data', faixa.fim);
                    return q;
                }), null) : Promise.resolve(null),
                parecido ? tentar('os nomes parecidos', async () => {
                    const ler = (campos) => supabase.from('vendas').select(campos).ilike('vendedor', parecido).gte('data', inicio6).limit(3000);
                    let { data, error } = await ler('vendedor, vendedor_cpf');
                    if (error && /vendedor_cpf/i.test(error.message || '')) ({ data, error } = await ler('vendedor'));
                    if (error) throw error;
                    // As que já são dela pelo CPF não são "nome parecido" (já entram na Central)
                    return (data || []).filter(v => !(cpf && String(v.vendedor_cpf || '').replace(/\D/g, '') === cpf));
                }, []) : Promise.resolve([]),
                tentar('os visitantes', async () => soDela('vendedor')(await paginado(() => {
                    let q = supabase.from('leads').select('id, nome, status, created_at, unidade, vendedor').eq('origem', 'RECEPCAO').ilike('vendedor', padrao).order('id', { ascending: true });
                    if (faixa.inicio) q = q.gte('created_at', inicioIso(faixa.inicio));
                    if (faixa.fim) q = q.lt('created_at', fimIso(faixa.fim));
                    return q;
                })), null),
                tentar('as avaliações', async () => soDela('professor')(await paginado(() => {
                    let q = supabase.from('avaliacoes_realizadas').select('id, data, created_at, aluno, aluno_id, unidade, professor, mme, pgc, respostas_dinamicas').ilike('professor', padrao).order('id', { ascending: true });
                    if (de6) q = q.gte('data', de6);
                    if (ate) q = q.lte('data', ate);
                    return q;
                })), null),
                recepcao ? tentar('o CRM', async () => soDela('consultor')(await paginado(() => {
                    let q = supabase.from('historico_leads').select('id, lead_id, consultor, tipo_acao, observacao, data_registro')
                        .ilike('consultor', padrao).in('tipo_acao', ACOES_CRM).order('data_registro', { ascending: false });
                    if (deCrm) q = q.gte('data_registro', inicioIso(deCrm));
                    if (ate) q = q.lt('data_registro', fimIso(ate));
                    return q;
                })), null) : Promise.resolve(null),
                recepcao ? tentar('os contatos feitos', async () => soDela('consultor')(await paginado(() => {
                    let q = supabase.from('crm_contatos_feitos').select('id, lead_id, aluno_id, consultor, criado_em, canal, tipo')
                        .ilike('consultor', padrao).order('criado_em', { ascending: false });
                    if (deCrm) q = q.gte('criado_em', inicioIso(deCrm));
                    if (ate) q = q.lt('criado_em', fimIso(ate));
                    return q;
                })), []) : Promise.resolve([]),
                // Resultados da Migração/Resgate (sem o SQL de 07/11 a tabela não existe: fica vazio, sem aviso)
                recepcao ? (async () => {
                    let q = supabase.from('crm_resultados_contato').select('consultor, resultado, origem, criado_em').ilike('consultor', padrao);
                    if (deCrm) q = q.gte('criado_em', inicioIso(deCrm));
                    if (ate) q = q.lt('criado_em', fimIso(ate));
                    const { data, error } = await q.limit(10000);
                    if (error) { console.warn('Central do colaborador: resultados do contato indisponíveis', error.message || error); return []; }
                    return soDela('consultor')(data);
                })() : Promise.resolve([]),
                // Pagamentos aprovados dos últimos 6 meses (sem o SQL de 11/11/2026 a tabela não existe: fica sem a coluna)
                (async () => {
                    const { data, error } = await supabase.from('comissoes_pagamentos').select('unidade, mes, aprovado_em, aprovado_por, ativo').eq('ativo', true).gte('mes', inicio6.slice(0, 7));
                    if (error) { console.warn('Central do colaborador: pagamentos aprovados indisponíveis', error.message || error); return null; }
                    return data || [];
                })(),
            ]);
            if (!vivo) return;
            setDados({ vendas, vendasUnidade, parecidas, visitantes, avaliacoes, historico, feitos, resultados, pagamentos, faixaAnterior: anterior, erros, hoje, lidoEm: new Date() });
            setCarregando(false);
        })();
        return () => { vivo = false; };
    }, [nome, cpf, unidade, recepcao, fxInicio, fxFim, ativo]);

    return { dados, carregando };
};
