// ==========================================
// CADASTRO DO COLABORADOR COMPLETO? (decisão do dono, 11/11/2026)
// Regra única usada pela tela Cadastros → Equipe, pela janela do login e pelo cartão do canto do Líder/Mentor
// (src/pages/Pendencias/AvisoCadastroEquipe.jsx).
// - O pagamento da comissão é PRINCIPALMENTE pelo Banco Inter. O PIX (sempre a chave CPF) é o secundário:
//   continua permitido, mas quem está no PIX é cobrado até trocar para o Inter.
// - Também é cobrado: sem conta definida (ou Inter sem número), CPF vazio/inválido, sem telefone, sem setor
//   e setor que não existe mais na lista de Setores.
// Só vale para colaborador ATIVO. Não mexe em vendas nem em comissão.
// ==========================================
import { validarCPF } from './utilsAlunos.js';

const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
const soNumeros = (t) => String(t || '').replace(/\D/g, '');

// Ordem = ordem em que aparecem na tela. O texto é em português (traduzido na hora de mostrar, com tx).
export const PROBLEMAS_CADASTRO = {
    pix: 'Recebe por PIX: trocar para o Banco Inter',
    semConta: 'Sem conta para receber a comissão',
    cpf: 'CPF vazio ou inválido',
    telefone: 'Sem telefone (WhatsApp)',
    semSetor: 'Sem setor',
    setorForaDaLista: 'Setor que não existe mais na lista',
};

// Problemas de conta (resolvidos preenchendo a conta do Banco Inter)
export const ehProblemaDeConta = (p) => p === 'pix' || p === 'semConta';

// setoresValidos: Set com os nomes dos setores (normalizados) ou null quando a lista não foi lida (não confere).
export const conjuntoDeSetores = (lista = []) => {
    const nomes = (lista || []).map(s => normalizar(typeof s === 'string' ? s : s?.nome)).filter(Boolean);
    return nomes.length ? new Set(nomes) : null;
};

export const problemasDoColaborador = (c, setoresValidos = null) => {
    if (!c || c.ativo === false) return [];
    const lista = [];
    const tipo = String(c.tipo_conta || '').toUpperCase();
    if (tipo === 'PIX_CPF') lista.push('pix');
    else if (tipo !== 'INTER' || !soNumeros(c.conta_inter)) lista.push('semConta');
    if (!validarCPF(c.cpf)) lista.push('cpf');
    if (soNumeros(c.telefone).length < 10) lista.push('telefone');
    const setor = normalizar(c.role);
    if (!setor) lista.push('semSetor');
    else if (setoresValidos && !setoresValidos.has(setor)) lista.push('setorForaDaLista');
    return lista;
};

export const temCadastroIncompleto = (c, setoresValidos = null) => problemasDoColaborador(c, setoresValidos).length > 0;

// Lista de quem tem problema, só das unidades pedidas (null = todas), por unidade e nome.
export const colaboradoresComProblema = (colaboradores = [], unidades = null, setoresValidos = null) => {
    const permitidas = unidades ? new Set(unidades.map(normalizar)) : null;
    return (colaboradores || [])
        .filter(c => c && c.ativo !== false && (!permitidas || permitidas.has(normalizar(c.unidade))))
        .map(c => ({ c, problemas: problemasDoColaborador(c, setoresValidos) }))
        .filter(x => x.problemas.length > 0)
        .sort((a, b) => String(a.c.unidade || '').localeCompare(String(b.c.unidade || ''), 'pt-BR') || String(a.c.nome || '').localeCompare(String(b.c.nome || ''), 'pt-BR'));
};

// Resumo por unidade para o cartão: { unidade, total, pix, outros }
export const resumoPorUnidade = (itens = []) => {
    const mapa = new Map();
    itens.forEach(({ c, problemas }) => {
        const u = c.unidade || '—';
        const r = mapa.get(u) || { unidade: u, total: 0, pix: 0, outros: 0 };
        r.total += 1;
        if (problemas.includes('pix')) r.pix += 1;
        if (problemas.some(p => p !== 'pix')) r.outros += 1;
        mapa.set(u, r);
    });
    return [...mapa.values()];
};

// Abrir Cadastros → Equipe já filtrada (pedido pela janela do Líder/Mentor): 'incompleto' | 'pix'
export const EVENTO_FILTRO_EQUIPE = 'equipe-filtro-pedido';
let filtroPedido = null;
export const pedirFiltroEquipe = (filtro) => {
    filtroPedido = filtro;
    window.dispatchEvent(new CustomEvent(EVENTO_FILTRO_EQUIPE, { detail: filtro }));
};
export const consumirFiltroEquipe = () => { const f = filtroPedido; filtroPedido = null; return f; };
