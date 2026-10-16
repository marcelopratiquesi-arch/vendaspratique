// src/pages/AnaliseVendas/relatorio/useResgateCpf.js
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient.js';
import { formatarCPF, normalizeString } from '../utils.js';

// ==========================================
// 🧠 EXTRATOR UNIVERSAL DE NOME E CPF (COM NORMALIZAÇÃO E CACHE DO BANCO)
// ==========================================
export const extrairDadosPessoa = (reg, dicionarioAuxiliar = {}, cacheBanco = { porNome: {}, porMat: {}, porId: {} }) => {
    if (!reg) return { nome: 'Não informado', cpf: 'Não informado', cpfPuro: '', matricula: '' };

    let nomeBruto =
        reg.nome_aluno ||
        reg.aluno_nome ||
        reg.nome_visitante ||
        reg.visitante_nome ||
        reg.nome_avaliado ||
        reg.avaliado ||
        reg.aluno ||
        reg.visitante ||
        reg.cliente ||
        reg.nome_cliente ||
        reg.paciente ||
        reg.nome ||
        reg.alunos?.nome ||
        reg.visitantes?.nome ||
        '';

    if (typeof nomeBruto === 'object' && nomeBruto !== null) {
        nomeBruto = nomeBruto.nome || nomeBruto.nome_aluno || '';
    }

    let cpfBruto =
        reg.cpf ||
        reg.cpf_aluno ||
        reg.aluno_cpf ||
        reg.cpf_visitante ||
        reg.visitante_cpf ||
        reg.cpf_avaliado ||
        reg.documento ||
        reg.doc ||
        reg.alunos?.cpf ||
        reg.visitantes?.cpf ||
        (typeof reg.aluno === 'object' ? reg.aluno?.cpf : '') ||
        '';

    let matriculaBruta = String(
        reg.matricula ||
        reg.matricula_aluno ||
        reg.alunos?.matricula ||
        ''
    ).trim();

    const alunoId = reg.aluno_id || reg.id_aluno || '';

    const nomeNorm = normalizeString(String(nomeBruto || ''));
    let cpfLimpo = String(cpfBruto || '').replace(/\D/g, '');

    // RESGATE NÍVEL 1: Dicionário local da tela
    if (!nomeBruto && cpfLimpo && dicionarioAuxiliar.porCpf?.[cpfLimpo]) {
        nomeBruto = dicionarioAuxiliar.porCpf[cpfLimpo].nome;
    }
    if (!nomeBruto && matriculaBruta && dicionarioAuxiliar.porMat?.[matriculaBruta]) {
        nomeBruto = dicionarioAuxiliar.porMat[matriculaBruta].nome;
    }
    if (!cpfLimpo && matriculaBruta && dicionarioAuxiliar.porMat?.[matriculaBruta]?.cpf) {
        cpfLimpo = dicionarioAuxiliar.porMat[matriculaBruta].cpf;
    }
    if (!cpfLimpo && nomeNorm && dicionarioAuxiliar.porNome?.[nomeNorm]?.cpf) {
        cpfLimpo = dicionarioAuxiliar.porNome[nomeNorm].cpf;
    }

    // RESGATE NÍVEL 2: Cache buscado diretamente na tabela `alunos` do Supabase
    if (!cpfLimpo && alunoId && cacheBanco.porId?.[alunoId]?.cpf) {
        cpfLimpo = cacheBanco.porId[alunoId].cpf;
        if (!nomeBruto) nomeBruto = cacheBanco.porId[alunoId].nome;
        if (!matriculaBruta) matriculaBruta = cacheBanco.porId[alunoId].matricula || '';
    }
    if (!cpfLimpo && matriculaBruta && cacheBanco.porMat?.[matriculaBruta]?.cpf) {
        cpfLimpo = cacheBanco.porMat[matriculaBruta].cpf;
        if (!nomeBruto) nomeBruto = cacheBanco.porMat[matriculaBruta].nome;
    }
    if (!cpfLimpo && nomeNorm && cacheBanco.porNome?.[nomeNorm]?.cpf) {
        cpfLimpo = cacheBanco.porNome[nomeNorm].cpf;
        if (!matriculaBruta) matriculaBruta = cacheBanco.porNome[nomeNorm].matricula || '';
    }

    const nomeFinal = String(nomeBruto || '').trim() || 'Não informado';
    const cpfFormatado = cpfLimpo ? formatarCPF(cpfLimpo) : 'Não informado';

    return {
        nome: nomeFinal,
        cpf: cpfFormatado,
        cpfPuro: cpfLimpo,
        matricula: matriculaBruta
    };
};

// ==========================================
// 🪝 HOOK DE RESGATE AUTOMÁTICO DE CPFs E NOMES
// ==========================================
export const useResgateCpf = ({
    vendasFiltradas = [],
    visitantesFiltrados = [],
    avaliacoesFiltradas = [],
    modalConfig = { isOpen: false, registros: [] }
}) => {
    const [cacheAlunosBanco, setCacheAlunosBanco] = useState({ porNome: {}, porMat: {}, porId: {} });
    const [buscandoCpfsBanco, setBuscandoCpfsBanco] = useState(false);

    // Dicionário de cruzamento local instantâneo
    const dicionarioPessoas = useMemo(() => {
        const porCpf = {};
        const porMat = {};
        const porNome = {};

        const indexar = (item) => {
            const nome = String(
                item?.nome_aluno || item?.aluno_nome || item?.nome_visitante || item?.aluno || item?.visitante || item?.nome || item?.alunos?.nome || ''
            ).trim();
            const cpf = String(
                item?.cpf || item?.cpf_aluno || item?.cpf_visitante || item?.documento || item?.alunos?.cpf || ''
            ).replace(/\D/g, '');
            const mat = String(item?.matricula || item?.alunos?.matricula || '').trim();
            const nomeNorm = normalizeString(nome);

            if (cpf && nome) porCpf[cpf] = { nome, cpf, matricula: mat };
            if (mat && (nome || cpf)) porMat[mat] = { nome: nome || porMat[mat]?.nome, cpf: cpf || porMat[mat]?.cpf, matricula: mat };
            if (nomeNorm && cpf) porNome[nomeNorm] = { nome, cpf, matricula: mat };
        };

        vendasFiltradas.forEach(indexar);
        visitantesFiltrados.forEach(indexar);
        avaliacoesFiltradas.forEach(indexar);

        return { porCpf, porMat, porNome };
    }, [vendasFiltradas, visitantesFiltrados, avaliacoesFiltradas]);

    // Auto-busca no Supabase quando o modal abre e faltam CPFs
    useEffect(() => {
        if (!modalConfig?.isOpen || !modalConfig?.registros || modalConfig.registros.length === 0) return;

        const nomesSemCpf = new Set();
        const matsSemCpf = new Set();

        modalConfig.registros.forEach(reg => {
            const dados = extrairDadosPessoa(reg, dicionarioPessoas, cacheAlunosBanco);
            if (!dados.cpfPuro) {
                if (dados.nome && dados.nome !== 'Não informado') {
                    nomesSemCpf.add(dados.nome.toUpperCase().trim());
                }
                if (dados.matricula) {
                    matsSemCpf.add(dados.matricula);
                }
            }
        });

        if (nomesSemCpf.size === 0 && matsSemCpf.size === 0) return;

        let ativo = true;
        const buscarDadosFaltantesNoBanco = async () => {
            setBuscandoCpfsBanco(true);
            try {
                const novoPorNome = { ...cacheAlunosBanco.porNome };
                const novoPorMat = { ...cacheAlunosBanco.porMat };
                const novoPorId = { ...cacheAlunosBanco.porId };

                const registrarAlunoNoCache = (al) => {
                    if (!al) return;
                    const cpfLimpo = String(al.cpf || '').replace(/\D/g, '');
                    if (!cpfLimpo) return;
                    const nNorm = normalizeString(al.nome || '');
                    const mat = String(al.matricula || '').trim();
                    const obj = { nome: al.nome, cpf: cpfLimpo, matricula: mat };
                    if (nNorm) novoPorNome[nNorm] = obj;
                    if (mat) novoPorMat[mat] = obj;
                    if (al.id) novoPorId[al.id] = obj;
                };

                if (matsSemCpf.size > 0) {
                    const listaMats = Array.from(matsSemCpf);
                    const { data: porMatAlunos } = await supabase
                        .from('alunos')
                        .select('id, nome, cpf, matricula')
                        .in('matricula', listaMats);
                    (porMatAlunos || []).forEach(registrarAlunoNoCache);

                    const { data: porMatVinculos } = await supabase
                        .from('alunos_unidades')
                        .select('matricula, alunos(id, nome, cpf, matricula)')
                        .in('matricula', listaMats);
                    (porMatVinculos || []).forEach(v => {
                        if (v.alunos) {
                            registrarAlunoNoCache({ ...v.alunos, matricula: v.matricula || v.alunos.matricula });
                        }
                    });
                }

                if (nomesSemCpf.size > 0) {
                    const listaNomes = Array.from(nomesSemCpf);
                    const { data: porNomeExato } = await supabase
                        .from('alunos')
                        .select('id, nome, cpf, matricula')
                        .in('nome', listaNomes);
                    (porNomeExato || []).forEach(registrarAlunoNoCache);

                    const faltantesAinda = listaNomes.filter(n => !novoPorNome[normalizeString(n)]);
                    if (faltantesAinda.length > 0 && faltantesAinda.length <= 30) {
                        await Promise.all(
                            faltantesAinda.map(async (nomeAlvo) => {
                                const partes = nomeAlvo.split(/\s+/).filter(Boolean);
                                if (partes.length === 0) return;
                                const padraoBusca = partes.length >= 2
                                    ? `%${partes[0]}%${partes[partes.length - 1]}%`
                                    : `%${partes[0]}%`;
                                const { data } = await supabase
                                    .from('alunos')
                                    .select('id, nome, cpf, matricula')
                                    .ilike('nome', padraoBusca)
                                    .limit(5);
                                (data || []).forEach(registrarAlunoNoCache);
                            })
                        );
                    }
                }

                if (ativo) {
                    setCacheAlunosBanco({ porNome: novoPorNome, porMat: novoPorMat, porId: novoPorId });
                }
            } catch (err) {
                console.error("Erro ao resgatar CPFs na base de alunos:", err);
            } finally {
                if (ativo) setBuscandoCpfsBanco(false);
            }
        };

        buscarDadosFaltantesNoBanco();
        return () => { ativo = false; };
    }, [modalConfig.isOpen, modalConfig.registros, dicionarioPessoas]);

    return {
        dicionarioPessoas,
        cacheAlunosBanco,
        buscandoCpfsBanco,
        extrairDadosPessoa
    };
};