import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { normalizarNome, dataLocalISO, apenasDigitos, ehMudancaPorCompra } from './utils';
import { carregarUltimoPlanoAlunos } from './contatosFeitos';
import { buscarComprasDePlano } from './compraDePlano.js';
import { RESPONDEU } from './resultadoContato.js';
import { decomporPlano } from '../AnaliseVendas/utils.js';

// ==========================================
// RESULTADOS POR RECEPCIONISTA (07/11/2026) — usado pelo Painel da entrada do CRM.
// Por nome (normalizado), no período:
//   responderam / naoResponderam / interessados → janela "Como foi o contato?" (crm_resultados_contato)
//   fecharam → contatos do funil passados à mão para "Fechado" (quem comprou e saiu sozinho NÃO conta)
//   migrou (Migração) / voltou (Resgate) → só com UMA unidade (consulta por unidade); "calculado" diz se valeu
// ==========================================

const diaDentro = (dia, faixa) => !!dia && (!faixa.inicio || dia >= dataLocalISO(faixa.inicio)) && (!faixa.fim || dia < dataLocalISO(faixa.fim));

export const useResultadosRecepcao = ({ faixa, nomeUnidade = '', unidadeEscopo = '', versao = 0 }) => {
    const [dados, setDados] = useState({ porNome: new Map(), conversoes: false });
    const chaveFaixa = `${faixa.inicio ? faixa.inicio.getTime() : ''}|${faixa.fim ? faixa.fim.getTime() : ''}`;

    useEffect(() => {
        let cancelado = false;
        (async () => {
            const porNome = new Map();
            const de = (nome) => {
                const k = normalizarNome(nome);
                if (!k) return null;
                if (!porNome.has(k)) porNome.set(k, { responderam: 0, naoResponderam: 0, interessados: 0, fecharam: new Set(), migrou: 0, voltou: 0 });
                return porNome.get(k);
            };
            let qr = supabase.from('crm_resultados_contato').select('consultor, resultado, criado_em').limit(10000);
            let qf = supabase.from('historico_leads').select('lead_id, consultor, observacao').eq('tipo_acao', 'Mudança de Fase').ilike('observacao', '%para "Fechado"%').limit(10000);
            if (faixa.inicio) { qr = qr.gte('criado_em', faixa.inicio.toISOString()); qf = qf.gte('data_registro', faixa.inicio.toISOString()); }
            if (faixa.fim) { qr = qr.lt('criado_em', faixa.fim.toISOString()); qf = qf.lt('data_registro', faixa.fim.toISOString()); }
            const [r, f] = await Promise.all([qr, qf]);
            if (r.error) console.warn('Resultados do contato indisponíveis (rode sql/2026-11-07-crm-resgate):', r.error.message || r.error);
            (r.data || []).forEach(x => {
                const p = de(x.consultor); if (!p) return;
                if (RESPONDEU.includes(x.resultado)) p.responderam++;
                if (x.resultado === 'SEM_RESPOSTA') p.naoResponderam++;
                if (x.resultado === 'INTERESSADO') p.interessados++;
            });
            (f.data || []).filter(h => !ehMudancaPorCompra(h.observacao) && !String(h.observacao || '').startsWith('Movido em lote'))
                .forEach(h => { const p = de(h.consultor); if (p) p.fecharam.add(String(h.lead_id)); });

            // Migraram / Voltaram: só com uma unidade
            let conversoes = false;
            if (nomeUnidade) {
                conversoes = true;
                const [alunosMig, mig] = await Promise.all([
                    carregarUltimoPlanoAlunos(nomeUnidade),
                    supabase.from('crm_migracao').select('aluno_id, puxado_por, atualizado_por, criado_em')
                ]);
                const regMig = new Map((mig.data || []).map(x => [x.aluno_id, x]));
                (alunosMig || []).forEach(a => {
                    const reg = regMig.get(a.aluno_id);
                    if (!reg || !decomporPlano(a.ultimo_plano).nutri) return;
                    if (!diaDentro(String(a.data_compra || ''), faixa) || String(a.data_compra) < dataLocalISO(reg.criado_em)) return;
                    const p = de(reg.puxado_por || reg.atualizado_por); if (p) p.migrou++;
                });
                const res = await supabase.from('crm_resgate').select('aluno_id, puxado_por, atualizado_por, criado_em, status, unidade').neq('status', 'NA_FILA');
                const regRes = (res.data || []).filter(x => normalizarNome(x.unidade) === unidadeEscopo);
                if (regRes.length) {
                    const cpfDe = new Map();
                    for (let i = 0; i < regRes.length; i += 200) {
                        const { data } = await supabase.from('alunos').select('id, cpf').in('id', regRes.slice(i, i + 200).map(x => x.aluno_id));
                        (data || []).forEach(a => cpfDe.set(a.id, apenasDigitos(a.cpf)));
                    }
                    const desde = regRes.reduce((m, x) => { const d = dataLocalISO(x.criado_em); return d && d < m ? d : m; }, dataLocalISO(new Date()));
                    const compras = await buscarComprasDePlano([...cpfDe.values()], desde) || [];
                    regRes.forEach(x => {
                        const cpf = cpfDe.get(x.aluno_id);
                        if (compras.some(c => apenasDigitos(c.cpf) === cpf && diaDentro(String(c.dia || ''), faixa) && String(c.dia) >= dataLocalISO(x.criado_em))) {
                            const p = de(x.puxado_por || x.atualizado_por); if (p) p.voltou++;
                        }
                    });
                }
            }
            if (!cancelado) setDados({ porNome, conversoes });
        })();
        return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a faixa muda junto com chaveFaixa
    }, [chaveFaixa, nomeUnidade, unidadeEscopo, versao]);

    return dados;
};
