// ==========================================
// GRUPOS DO CATÁLOGO — o LUGAR ÚNICO que diz como cada item conta (decisão do dono, 14/11/2026)
// - O Admin cadastra os grupos em Cadastros → Catálogo Geral → Grupos (tabela catalogo_grupos), com um nome livre
//   ("PraticMed", "Nutri adicional"...) e "como conta" (lista fixa abaixo).
// - Cada item do catálogo aponta para um grupo (catalogo.grupo_id).
// - Item COM grupo: o sistema inteiro obedece ao grupo (Dashboard, Metas, Relatórios, Ranking, CRM...).
// - Item SEM grupo: continua a regra antiga pelo nome (decomporPlano / famílias de dose única).
// Aplicado na hora de LER: não muda vendas nem comissão (a comissão continua sendo o valor do item).
// Sem imports de propósito (utils.js e limiteDoses.js usam este arquivo; testável com node).
// ==========================================

// categoria: como o item entra nas contas (PLANO / PRODUTO / SERVICO)
// base/nutri: o mesmo que decomporPlano devolve · dose: entra no limite de doses únicas
// tipos: em quais categorias do catálogo o grupo pode ser usado
export const CONTA_COMO = [
    { chave: 'PLUS', rotulo: 'Plano Plus', categoria: 'PLANO', base: 'PLUS', nutri: false, tipos: ['plano'] },
    { chave: 'PLUS_NUTRI', rotulo: 'Plano Plus + Nutri adicional', categoria: 'PLANO', base: 'PLUS', nutri: true, tipos: ['plano'] },
    { chave: 'FIT', rotulo: 'Plano Fit', categoria: 'PLANO', base: 'FIT', nutri: false, tipos: ['plano'] },
    { chave: 'FIT_NUTRI', rotulo: 'Plano Fit + Nutri adicional', categoria: 'PLANO', base: 'FIT', nutri: true, tipos: ['plano'] },
    { chave: 'PERSONAL', rotulo: 'Plano Personal Class', categoria: 'PLANO', base: 'PERSONAL CLASS', nutri: false, tipos: ['plano'] },
    { chave: 'PERSONAL_NUTRI', rotulo: 'Plano Personal Class + Nutri adicional', categoria: 'PLANO', base: 'PERSONAL CLASS', nutri: true, tipos: ['plano'] },
    { chave: 'OUTROS', rotulo: 'Outros planos', categoria: 'PLANO', base: 'OUTROS PLANOS', nutri: false, tipos: ['plano'] },
    { chave: 'NUTRI', rotulo: 'Só Nutri adicional (não é plano vendido)', categoria: 'PLANO', base: null, nutri: true, tipos: ['plano', 'produto', 'servico'] },
    { chave: 'PRODUTO', rotulo: 'Produto', categoria: 'PRODUTO', base: null, nutri: false, tipos: ['produto'] },
    { chave: 'DOSE_UNICA', rotulo: 'Dose única (limite 10/mês)', categoria: 'PRODUTO', base: null, nutri: false, dose: true, tipos: ['produto'] },
    { chave: 'SERVICO', rotulo: 'Serviço', categoria: 'SERVICO', base: null, nutri: false, tipos: ['servico'] },
];
const POR_CHAVE = new Map(CONTA_COMO.map(c => [c.chave, c]));
export const infoContaComo = (chave) => POR_CHAVE.get(chave) || null;
export const contaComoPermitidoPara = (tipo) => CONTA_COMO.filter(c => c.tipos.includes(tipo));

const normalizar = (s) => (typeof s === 'string' ? s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase() : '');

// nome do item normalizado → { chave, grupo } (só itens com grupo válido)
let porNome = new Map();
// GRUPO PRÓPRIO (14/11/2026, decisão do dono): grupo só de nome, sem "como conta". O item continua contando como
// sempre (pelo nome/categoria); o grupo só organiza: os Relatórios e as mensagens mostram um bloco com o nome dele.
// nome do item normalizado → nome do grupo em maiúsculas
let porNomeProprio = new Map();

// Chamado pelo App sempre que o catálogo ou os grupos mudam.
export const definirRegrasGrupos = (itens = [], grupos = []) => {
    const gruposPorId = new Map((grupos || []).map(g => [String(g.id), g]));
    const novo = new Map();
    const novoProprio = new Map();
    (itens || []).forEach(item => {
        if (!item || item.grupo_id === null || item.grupo_id === undefined) return;
        const grupo = gruposPorId.get(String(item.grupo_id));
        if (grupo && !grupo.conta_como) { // grupo próprio: não muda a contagem, só a organização
            novoProprio.set(normalizar(item.nome), String(grupo.nome || '').trim().toUpperCase());
            return;
        }
        const info = grupo && infoContaComo(grupo.conta_como);
        if (!info || !info.tipos.includes(item.tipo)) return; // grupo que não serve para a categoria = regra antiga
        novo.set(normalizar(item.nome), { chave: info.chave, grupo });
    });
    porNome = novo;
    porNomeProprio = novoProprio;
};

// Como o item conta pelo GRUPO (null = sem grupo, vale a regra antiga pelo nome)
export const regraDoGrupo = (nomeItem) => {
    const achou = porNome.get(normalizar(nomeItem));
    return achou ? infoContaComo(achou.chave) : null;
};
export const grupoDoNome = (nomeItem) => porNome.get(normalizar(nomeItem))?.grupo || null;

// Grupo próprio do item (nome em maiúsculas) ou null: usado só para MOSTRAR (Relatórios e mensagens)
export const grupoProprioDoNome = (nomeItem) => porNomeProprio.get(normalizar(nomeItem)) || null;
