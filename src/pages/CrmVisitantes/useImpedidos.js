// ==========================================
// QUEM NÃO DÁ PARA PUXAR — usado pelas abas Migração e Resgate (27/11/2026)
// As regras ficam em contatosPorCpf.js. Aqui é só o que a tela precisa guardar:
//   - CPFs em "Fora da fila" e no grupo Wellhub/Gympass (não são oferecidos de novo);
//   - quem foi pulado ao puxar, e quem já estava preso na fila sem poder entrar no funil.
// Nada é gravado no banco: só muda o que a tela mostra.
// ==========================================
import { useState, useMemo, useCallback } from 'react';
import { supabase } from '../../supabaseClient.js';
import { apenasDigitos } from './utils';
import { consultarCpfs, escolherPuxaveis, carregarForaDaFila, cpfsNoWellhub, motivoImpedimento, PODE_PUXAR } from './contatosPorCpf.js';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';

export const textoDoImpedimento = (decisao) => {
    const m = motivoImpedimento(decisao);
    return tx(m.texto, { motivo: m.motivo ? tx(m.motivo) : '', nome: m.nome || '' });
};

// Aviso de quem foi pulado ao puxar
export const avisarPulados = (pulados) => {
    if (!pulados.length) return;
    avisar(pulados.length === 1
        ? tx("{nome} não foi puxado: {motivo}.", { nome: pulados[0].linha.nome, motivo: textoDoImpedimento(pulados[0].decisao) })
        : tx("{qtd} aluno(s) foram pulados porque o CPF não pode ser puxado. O motivo aparece em cada um, no filtro \"Todos\".", { qtd: pulados.length }), 'atenção');
};

const useImpedidos = ({ unidade, operador, leads }) => {
    const [impedidos, setImpedidos] = useState(() => new Map()); // aluno_id → decisão
    const [foraDaFila, setForaDaFila] = useState(() => new Map()); // cpf → motivo
    const wellhub = useMemo(() => cpfsNoWellhub(leads, unidade), [leads, unidade]);

    const marcar = useCallback((pares) => {
        if (!pares.length) return;
        setImpedidos(prev => { const novo = new Map(prev); pares.forEach(([id, d]) => novo.set(id, d)); return novo; });
    }, []);

    const impedimentoDe = useCallback((alunoId, cpfBruto) => {
        const cpf = apenasDigitos(cpfBruto);
        if (cpf && foraDaFila.has(cpf)) return { acao: 'FORA_DA_FILA', motivo: foraDaFila.get(cpf) };
        if (cpf && wellhub.has(cpf)) return { acao: 'WELLHUB' };
        return impedidos.get(alunoId) || null;
    }, [foraDaFila, wellhub, impedidos]);

    // Ao abrir (ou recarregar) a aba: lê os "Fora da fila" e confere quem está "puxado" sem ter contato ({ aluno_id, cpf })
    const conferirAoAbrir = useCallback(async (presos) => {
        setImpedidos(new Map());
        setForaDaFila(await carregarForaDaFila(supabase, unidade));
        if (!presos.length) return;
        try {
            const decisoes = await consultarCpfs(supabase, presos.map(p => p.cpf), { unidade, operador });
            marcar(presos.map(p => [p.aluno_id, decisoes.get(apenasDigitos(p.cpf))]).filter(([, d]) => d && !PODE_PUXAR.includes(d.acao)));
        } catch (err) {
            console.warn('Não foi possível conferir os alunos que estavam na fila:', err?.message || err);
        }
    }, [unidade, operador, marcar]);

    // Da lista em ordem, quem dá para puxar até completar a quantidade (quem não pode é pulado)
    const separar = useCallback(async (ordenados, quantidade) => {
        const r = await escolherPuxaveis(supabase, ordenados, quantidade, { unidade, operador });
        marcar(r.impedidos.map(i => [i.linha.aluno_id, i.decisao]));
        return r;
    }, [unidade, operador, marcar]);

    const marcarForaDaFila = useCallback((cpfBruto, motivo) => {
        const cpf = apenasDigitos(cpfBruto);
        if (cpf) setForaDaFila(prev => new Map(prev).set(cpf, motivo));
    }, []);

    return { impedimentoDe, conferirAoAbrir, separar, marcar, marcarForaDaFila };
};

export default useImpedidos;
