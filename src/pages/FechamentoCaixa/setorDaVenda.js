// ==========================================
// SETOR DA VENDA — filtro de setor do Fechamento (Conferência, Comissões e Visão Geral; decisão do dono, 16/11/2026)
// Regra única: o setor de uma venda é o setor de QUEM VENDEU, lido no cadastro da Equipe (campo "role"),
// agrupado como na Nova Venda (setoresEquipe.js: Recepção, Musculação, Bem-estar, Saver, Líder; outro nome = setor próprio).
// - A pessoa é achada primeiro pelo CPF do vendedor gravado na venda (vendedor_cpf) e, sem ele, pelo NOME EXATO
//   (sem acento, sem espaço a mais). Homônimos: fica a ativa; depois a da unidade da venda.
// - Vale o setor de HOJE no cadastro (quem mudou de setor aparece no setor atual, inclusive nas vendas antigas).
// - Vendedor que não está na Equipe, ou sem setor no cadastro = "Sem setor" (nenhuma venda some: a soma dos
//   setores + "Sem setor" é sempre igual ao total sem filtro).
// Só leitura: não grava nada e não muda venda nem comissão.
// O BANCO tem a mesma regra na função equipe_setor_chave (sql/2026-11-16-pagamento-por-setor), usada para aprovar o
// pagamento por setor. Mudou aqui, tem que mudar lá (e o contrário).
// Teste: node scripts/teste-setor-da-venda.mjs
// ==========================================
import { setorDoColaborador, ordemDoSetor } from '../Lancamentos/seletores/setoresEquipe.js';

export const TODOS_SETORES = 'TODOS';
export const SEM_SETOR = 'SEM_SETOR';
const SETOR_VAZIO = { chave: SEM_SETOR, rotulo: 'Sem setor' };

const soNumeros = (v) => String(v || '').replace(/\D/g, '');
const nomeLimpo = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const unidadeLimpa = (v) => String(v || '').trim().toUpperCase();

// Setor de uma pessoa da Equipe: { chave, rotulo } (sem setor no cadastro = "Sem setor")
export const setorDaPessoa = (colaborador) => {
    // Só o campo "role" (é o que o banco usa em equipe_setor_chave; as duas contas têm que dar o mesmo resultado)
    const nome = String(colaborador?.role || '').trim();
    if (!colaborador || !nome) return SETOR_VAZIO;
    const setor = setorDoColaborador({ role: nome });
    if (setor.outro) return { chave: `OUTRO:${nomeLimpo(nome)}`, rotulo: nome };
    return { chave: setor.chave, rotulo: setor.rotulo };
};

// Devolve a função (venda) => { chave, rotulo }. Monta os índices uma vez e guarda as respostas (são milhares de vendas).
export const criarLocalizadorDeSetor = (colaboradores = []) => {
    const porCpf = new Map();
    const porNome = new Map();
    // Ordem fixa (pelo número do cadastro), a mesma do banco: com empate, fica sempre a mesma pessoa
    const porId = (a, b) => { const x = Number(a.id), y = Number(b.id); return Number.isFinite(x) && Number.isFinite(y) ? x - y : String(a.id).localeCompare(String(b.id)); };
    [...(colaboradores || [])].sort(porId).forEach(c => {
        const cpf = soNumeros(c.cpf);
        if (cpf.length === 11) { if (!porCpf.has(cpf)) porCpf.set(cpf, []); porCpf.get(cpf).push(c); }
        const nome = nomeLimpo(c.nome);
        if (nome) { if (!porNome.has(nome)) porNome.set(nome, []); porNome.get(nome).push(c); }
    });
    const guardado = new Map();

    const acharPessoa = (cpf, nome, unidade) => {
        if (cpf.length === 11) {
            const doCpf = porCpf.get(cpf);
            if (doCpf?.length) return doCpf.find(c => c.ativo !== false) || doCpf[0];
        }
        let candidatos = porNome.get(nome) || [];
        if (candidatos.length > 1) {
            const ativos = candidatos.filter(c => c.ativo !== false);
            if (ativos.length) candidatos = ativos;
        }
        if (candidatos.length > 1 && unidade) {
            const daUnidade = candidatos.filter(c => unidadeLimpa(c.unidade) === unidade);
            if (daUnidade.length) candidatos = daUnidade;
        }
        return candidatos[0] || null;
    };

    return (venda) => {
        const cpf = soNumeros(venda?.vendedor_cpf);
        const nome = nomeLimpo(venda?.vendedor);
        const unidade = unidadeLimpa(venda?.unidade);
        const chave = `${cpf}|${nome}|${unidade}`;
        let setor = guardado.get(chave);
        if (!setor) { setor = setorDaPessoa(acharPessoa(cpf, nome, unidade)); guardado.set(chave, setor); }
        return setor;
    };
};

// Opções do filtro: os setores da Equipe (da unidade escolhida, ou de todas) + os setores que aparecem nas vendas.
// Ordem da Nova Venda (Recepção, Musculação, Bem-estar, Saver, outros A–Z, Líder); "Sem setor" por último e só se houver venda assim.
export const listarSetores = ({ colaboradores = [], vendas = [], unidade = null, setorDaVenda }) => {
    const mapa = new Map();
    const alvo = unidade ? unidadeLimpa(unidade) : null;
    (colaboradores || []).forEach(c => {
        if (alvo && unidadeLimpa(c.unidade) !== alvo) return;
        const s = setorDaPessoa(c);
        if (s.chave !== SEM_SETOR) mapa.set(s.chave, s);
    });
    let temSemSetor = false;
    if (setorDaVenda) {
        (vendas || []).forEach(v => {
            const s = setorDaVenda(v);
            if (s.chave === SEM_SETOR) temSemSetor = true; else mapa.set(s.chave, s);
        });
    }
    const lista = [...mapa.values()].sort((a, b) => ordemDoSetor(a) - ordemDoSetor(b) || a.rotulo.localeCompare(b.rotulo));
    if (temSemSetor) lista.push(SETOR_VAZIO);
    return lista;
};

// A venda passa no filtro? ("TODOS" = passa sempre)
export const vendaDoSetor = (venda, setorEscolhido, setorDaVenda) =>
    !setorEscolhido || setorEscolhido === TODOS_SETORES || setorDaVenda(venda).chave === setorEscolhido;
