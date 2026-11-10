// Grupo de cada item do Catálogo (Cadastros → Catálogo, coluna Grupo; 09/11/2026). Sem tela: dá para testar com node.
import { decomporPlano } from '../AnaliseVendas/utils.js';
import { ehDoseUnica } from '../AnaliseVendas/limiteDoses.js';

// Grupo de cada item (a mesma regra das metas e do Dashboard)
export const grupoDoItem = (item) => {
    if (item.tipo === 'plano') {
        const { base, nutri } = decomporPlano(item.nome);
        if (!base && nutri) return { texto: 'Nutri (adicional)', cor: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/30' };
        const nome = base === 'PERSONAL CLASS' ? 'Personal Class' : base === 'OUTROS PLANOS' ? 'Outros planos' : base === 'PLUS' ? 'Plus' : 'Fit';
        return { texto: nutri ? `${nome} + Nutri` : nome, cor: 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-500/30' };
    }
    if (item.tipo === 'produto') {
        return ehDoseUnica(item.nome)
            ? { texto: 'Dose única (limite 10/mês)', cor: 'text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30' }
            : { texto: 'Produto', cor: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-800/60 dark:border-slate-700' };
    }
    return { texto: 'Serviço', cor: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-800/60 dark:border-slate-700' };
};
