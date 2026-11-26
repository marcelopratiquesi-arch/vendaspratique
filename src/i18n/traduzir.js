// ==========================================
// TRADUÇÃO POR FRASE: tx('Texto em português')
// - O texto continua escrito em português no código (fácil de ler).
// - Os dicionários de frases (i18n/frases) dizem como fica cada frase em inglês e em espanhol argentino.
// - Se faltar a tradução, aparece o português (nunca um código na tela).
// - Partes que mudam vão entre chaves: tx('{qtd} contatos', { qtd: 5 }).
// - Funciona em qualquer arquivo (telas, avisos, utilitários); o idioma vem do seletor (I18nContext).
// - Os textos antigos por chave, t('chave'), continuam funcionando como antes.
// - NÃO traduzir: dados do banco (nomes, planos, unidades) nem mensagens de WhatsApp para alunos.
// ==========================================
import frasesEn from './frases/en-US.js';
import frasesEs from './frases/es-AR.js';
// Versão celular (26/11/2026): um arquivo de frases por grupo de telas, para as conversas em paralelo não se cruzarem
import celA from './frases/celular/A-vendas-historico-alunos.js';
import celB from './frases/celular/B-dashboard.js';
import celC from './frases/celular/C-crm.js';
import celD from './frases/celular/D-fechamento-pendencias-comunicados.js';
import celE from './frases/celular/E-avaliacao-cadastros-config.js';

const CELULAR = [celA, celB, celC, celD, celE];
const juntar = (base, locale) => Object.assign({}, base, ...CELULAR.map(g => g[locale] || {}));
const FRASES = { 'en-US': juntar(frasesEn, 'en-US'), 'es-AR': juntar(frasesEs, 'es-AR') };
let idiomaAtual = 'pt-BR';

// Chamado pelo I18nProvider sempre que o idioma muda (antes de desenhar as telas)
export const definirIdioma = (locale) => { idiomaAtual = FRASES[locale] ? locale : 'pt-BR'; };

// Idioma atual, para datas e números (ex.: data.toLocaleDateString(localeAtual()))
export const localeAtual = () => idiomaAtual;

export const tx = (texto, valores) => {
    const original = texto == null ? '' : String(texto);
    let resultado = (idiomaAtual !== 'pt-BR' && FRASES[idiomaAtual]?.[original]) || original;
    if (valores) {
        Object.keys(valores).forEach(nome => {
            const valor = valores[nome];
            resultado = resultado.split(`{${nome}}`).join(valor == null ? '' : String(valor));
        });
    }
    return resultado;
};
