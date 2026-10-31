// ==========================================
// LISTAS FÁCEIS DE EDITAR — lista de planos da tela Lançar venda (desenho aprovado pelo dono, 30/10/2026)
// ==========================================
import { decomporPlano, normalizeString } from '../../AnaliseVendas/utils.js';

// Atalhos "Mais vendidos" (só aparecem os que estiverem ativos no catálogo)
export const MAIS_VENDIDOS = ['PRATIQUE NUTRI', 'PERSONAL CLASS', 'PLUS', 'FIT'];

// Grupos de plano: ordem fixa dos grupos e dos planos dentro de cada um.
// Plano novo que não estiver aqui entra no fim do seu grupo, em ordem alfabética.
// O grupo de cada plano vem de decomporPlano (Nutri = só adicional; os demais pelo plano base).
// Cores = as mesmas do Dashboard.
export const GRUPOS_PLANO = [
    { chave: 'NUTRI', rotulo: 'NUTRI', nota: '· adicional, não conta como plano', cor: '#0E9F6E', ordem: ['PRATIQUE NUTRI'] },
    { chave: 'PERSONAL CLASS', rotulo: 'PERSONAL CLASS', cor: '#DB2777', ordem: ['PERSONAL CLASS'] },
    { chave: 'PLUS', rotulo: 'PLUS', cor: '#1D4FD8', ordem: ['PLUS', 'AFILIADOS PLUS', 'PLUS PATRÃO'] },
    { chave: 'FIT', rotulo: 'FIT', cor: '#7C3AED', ordem: ['FIT', 'AFILIADOS FIT', 'FIT PATRÃO'] },
    { chave: 'OUTROS PLANOS', rotulo: 'OUTROS PLANOS', cor: '#64748B', ordem: ['SSP', 'MELHOR IDADE', 'PREFEITURA NEVES', 'PREFEITURA BH', 'FÉRIAS 15 DIAS', 'FÉRIAS 7 DIAS', 'BIKE'] },
];
export const COR_NEUTRA = '#94A3B8';

// Grupo de um plano nesta lista
export const grupoDoPlanoNaLista = (nome) => {
    const { base, nutri } = decomporPlano(nome);
    if (!base && nutri) return 'NUTRI';
    return base || 'OUTROS PLANOS';
};
export const corDoPlano = (nome) => GRUPOS_PLANO.find(g => g.chave === grupoDoPlanoNaLista(nome))?.cor || COR_NEUTRA;

export const posicaoNaOrdem = (ordem, nome) => {
    const i = ordem.findIndex(o => normalizeString(o) === normalizeString(nome));
    return i < 0 ? Infinity : i;
};
