// Grupo de cada item do Catálogo (Cadastros → Catálogo). Sem tela: dá para testar com node.
// Desde 14/11/2026 (decisão do dono) o GRUPO cadastrado manda (regrasGrupos.js). Item sem grupo segue a regra
// antiga pelo nome ("automático"), que também é a sugestão do botão "Colocar nos grupos".
import { decomporPlanoPeloNome } from '../AnaliseVendas/utils.js';
import { ehDoseUnicaPeloNome } from '../AnaliseVendas/limiteDoses.js';
import { infoContaComo } from '../AnaliseVendas/regrasGrupos.js';

const COR_NUTRI = 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/30';
const COR_PLANO = 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-500/30';
const COR_DOSE = 'text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30';
const COR_APARTE = 'text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-500/10 dark:border-sky-500/30';
const COR_CINZA = 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-800/60 dark:border-slate-700';

// Cor da etiqueta pelo "como conta"
export const corDoContaComo = (chave) => {
    const info = infoContaComo(chave);
    if (!info) return COR_CINZA;
    if (info.chave === 'NUTRI') return COR_NUTRI;
    if (info.aParte) return COR_APARTE;
    if (info.categoria === 'PLANO') return COR_PLANO;
    if (info.dose) return COR_DOSE;
    return COR_CINZA;
};

// Como o item contaria SEM grupo (a regra antiga, pelo nome) → chave de CONTA_COMO
export const contaComoAutomatico = (item) => {
    if (item.tipo === 'plano') {
        const { base, nutri } = decomporPlanoPeloNome(item.nome);
        if (!base) return 'NUTRI';
        const chave = { PLUS: 'PLUS', FIT: 'FIT', 'PERSONAL CLASS': 'PERSONAL', 'OUTROS PLANOS': 'OUTROS' }[base];
        return nutri && chave !== 'OUTROS' ? `${chave}_NUTRI` : chave;
    }
    if (item.tipo === 'produto') return ehDoseUnicaPeloNome(item.nome) ? 'DOSE_UNICA' : 'PRODUTO';
    return 'SERVICO';
};

// Grupo do item para mostrar: { texto, cor, contaComo, manual }
// grupos = lista de catalogo_grupos. Grupo que não serve para a categoria do item é ignorado (como no regrasGrupos.js).
export const grupoDoItem = (item, grupos = []) => {
    const grupo = item.grupo_id !== null && item.grupo_id !== undefined ? grupos.find(g => String(g.id) === String(item.grupo_id)) : null;
    const info = grupo && infoContaComo(grupo.conta_como);
    if (info && info.tipos.includes(item.tipo)) {
        return { texto: grupo.nome, cor: corDoContaComo(info.chave), contaComo: info.chave, manual: true, grupo };
    }
    const chave = contaComoAutomatico(item);
    return { texto: textoAutomatico(chave), cor: corDoContaComo(chave), contaComo: chave, manual: false, grupo: null };
};

// Texto curto da regra automática (o que aparecia antes na coluna Grupo)
const TEXTO_AUTOMATICO = {
    PLUS: 'Plus', PLUS_NUTRI: 'Plus + Nutri', FIT: 'Fit', FIT_NUTRI: 'Fit + Nutri', PERSONAL: 'Personal Class',
    PERSONAL_NUTRI: 'Personal Class + Nutri', OUTROS: 'Outros planos', NUTRI: 'Nutri (adicional)', PRODUTO: 'Produto',
    DOSE_UNICA: 'Dose única (limite 10/mês)', SERVICO: 'Serviço',
    A_PARTE: 'Plano à parte', A_PARTE_FORA: 'Plano à parte (não conta)',
};
export const textoAutomatico = (chave) => TEXTO_AUTOMATICO[chave] || chave;

// Nome sugerido para o grupo de cada "como conta" (usado ao organizar automaticamente)
export const NOME_GRUPO_PADRAO = {
    PLUS: 'Plus', PLUS_NUTRI: 'Plus + Nutri', FIT: 'Fit', FIT_NUTRI: 'Fit + Nutri', PERSONAL: 'Personal Class',
    PERSONAL_NUTRI: 'Personal Class + Nutri', OUTROS: 'Outros planos', NUTRI: 'Nutri adicional', PRODUTO: 'Produtos',
    DOSE_UNICA: 'Dose única', SERVICO: 'Serviços',
};
