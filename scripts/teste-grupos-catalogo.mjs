// Teste dos grupos do catálogo (14/11/2026): o grupo manda; sem grupo, a regra antiga pelo nome.
// Rodar: node scripts/teste-grupos-catalogo.mjs
let falhas = 0; let n = 0;
const teste = (nome, ok) => { n++; console.log(`${ok ? '✅' : '❌'} ${n}. ${nome}`); if (!ok) falhas++; };

const { definirRegrasGrupos } = await import('../src/pages/AnaliseVendas/regrasGrupos.js');
const { decomporPlano, getCategoriaItem, contarPlanosDoCard } = await import('../src/pages/AnaliseVendas/utils.js');
const { ehDoseUnica } = await import('../src/pages/AnaliseVendas/limiteDoses.js');
const { grupoDoItem, contaComoAutomatico } = await import('../src/pages/CadastroGeral/grupoCatalogo.js');
const { processarConsolidadas, gruposParaExibir } = await import('../src/pages/AnaliseVendas/relatorio/motorConsolidacao.js');
const { montarTextoFechamentoUnidade } = await import('../src/pages/AnaliseVendas/relatorio/exportadorSeguro.js');

const planos = [
    { id: 1, nome: 'PLUS', tipo: 'plano' },
    { id: 2, nome: 'PLANO BLACK', tipo: 'plano' },
    { id: 3, nome: 'FIT + NUTRI', tipo: 'plano' },
];
const produtos = [
    { id: 10, nome: 'PRATIQUE MED', tipo: 'produto' },
    { id: 11, nome: 'PRATIQUE MED + NUTRI', tipo: 'produto' },
    { id: 12, nome: 'WHEY BAUNILHA DOSE ÚNICA 40G', tipo: 'produto' },
    { id: 13, nome: 'GARRAFA SLIM', tipo: 'produto' },
];
const grupos = [
    { id: 100, nome: 'Plus', conta_como: 'PLUS' },
    { id: 101, nome: 'Nutri adicional', conta_como: 'NUTRI' },
    { id: 102, nome: 'PraticMed', conta_como: 'PRODUTO' },
    { id: 103, nome: 'Errado', conta_como: 'SERVICO' },
];

// 1) Sem grupo nenhum: tudo igual a antes
definirRegrasGrupos([...planos, ...produtos], grupos);
teste('sem grupo: PLANO BLACK conta como Outros planos (pelo nome)', decomporPlano('PLANO BLACK').base === 'OUTROS PLANOS');
teste('sem grupo: PRATIQUE MED + NUTRI é PRODUTO', getCategoriaItem('PRATIQUE MED + NUTRI', planos, produtos) === 'PRODUTO');
teste('sem grupo: Whey dose única entra no limite', ehDoseUnica('WHEY BAUNILHA DOSE ÚNICA 40G'));
teste('sem grupo: etiqueta automática e "pelo nome"', grupoDoItem(planos[0], grupos).texto === 'Plus' && !grupoDoItem(planos[0], grupos).manual);

// 2) Com grupos
const comGrupo = [
    { ...planos[0], grupo_id: 100 },
    { ...planos[1], grupo_id: 100 },          // PLANO BLACK → Plus
    planos[2],
    { ...produtos[0], grupo_id: 102 },        // PRATIQUE MED → produto (grupo PraticMed)
    { ...produtos[1], grupo_id: 101 },        // PRATIQUE MED + NUTRI → só Nutri adicional
    { ...produtos[2], grupo_id: 102 },        // Whey num grupo PRODUTO → sai do limite
    { ...produtos[3], grupo_id: 103 },        // grupo de serviço num produto → ignorado (pelo nome)
];
definirRegrasGrupos(comGrupo, grupos);
teste('PLANO BLACK no grupo Plus conta como Plus', decomporPlano('PLANO BLACK').base === 'PLUS');
teste('PRATIQUE MED + NUTRI no grupo Nutri adicional vira PLANO só Nutri', getCategoriaItem('PRATIQUE MED + NUTRI', planos, produtos) === 'PLANO'
    && decomporPlano('PRATIQUE MED + NUTRI').base === null && decomporPlano('PRATIQUE MED + NUTRI').nutri === true);
teste('PRATIQUE MED continua PRODUTO', getCategoriaItem('PRATIQUE MED', planos, produtos) === 'PRODUTO');
teste('Whey num grupo Produto sai do limite de doses', !ehDoseUnica('WHEY BAUNILHA DOSE ÚNICA 40G'));
teste('grupo que não serve para a categoria é ignorado', getCategoriaItem('GARRAFA SLIM', planos, produtos) === 'PRODUTO' && !grupoDoItem(comGrupo[6], grupos).manual);
teste('sem grupo continua pelo nome (FIT + NUTRI)', decomporPlano('FIT + NUTRI').base === 'FIT' && decomporPlano('FIT + NUTRI').nutri);
teste('etiqueta mostra o nome do grupo', grupoDoItem(comGrupo[1], grupos).texto === 'Plus' && grupoDoItem(comGrupo[1], grupos).manual);

const vendas = [
    { produto: 'PLANO BLACK', matricula: '1', data: '2026-11-10', quantidade: 1 },
    { produto: 'PRATIQUE MED + NUTRI', matricula: '2', data: '2026-11-10', quantidade: 1 },
    { produto: 'PRATIQUE MED', matricula: '3', data: '2026-11-10', quantidade: 1 },
];
const c = contarPlanosDoCard(vendas, planos, produtos);
teste('card de planos: 1 plano (Plus) e 1 Nutri adicional; PRATIQUE MED fora', c.total === 1 && c.grupos.PLUS.total === 1 && c.nutri.total === 1);

// 3) Sugestão automática = regra de hoje
teste('automático: PRATIQUE NUTRI → NUTRI', contaComoAutomatico({ tipo: 'plano', nome: 'PRATIQUE NUTRI' }) === 'NUTRI');
teste('automático: PLUS + NUTRI → PLUS_NUTRI', contaComoAutomatico({ tipo: 'plano', nome: 'PLUS + NUTRI' }) === 'PLUS_NUTRI');
teste('automático: Energy dose única → DOSE_UNICA', contaComoAutomatico({ tipo: 'produto', nome: 'ENERGY LIMÃO DOSE ÚNICA 20G' }) === 'DOSE_UNICA');
teste('automático: serviço → SERVICO', contaComoAutomatico({ tipo: 'servico', nome: 'DIÁRIA' }) === 'SERVICO');

// 4) Grupo próprio, sem "como conta" (16/11/2026): os itens contam como sempre; só aparecem num bloco com o nome do grupo
const planosGP = [
    { id: 20, nome: 'FÉRIAS 7 DIAS', tipo: 'plano' },
    { id: 21, nome: 'FÉRIAS 15 DIAS', tipo: 'plano' },
    { id: 22, nome: 'PLUS', tipo: 'plano' },
];
const produtosGP = [{ id: 30, nome: 'GARRAFA SLIM', tipo: 'produto' }];
const gruposGP = [
    { id: 200, nome: 'Férias', conta_como: null },
    { id: 201, nome: 'Piscina', conta_como: '' },
];
const vendasGP = [
    { produto: 'FÉRIAS 7 DIAS', matricula: '1', data: '2026-11-10', quantidade: 1, unidade: 'X', vendedor: 'ANA SILVA' },
    { produto: 'FÉRIAS 15 DIAS', matricula: '2', data: '2026-11-10', quantidade: 1, unidade: 'X', vendedor: 'ANA SILVA' },
    { produto: 'PLUS', matricula: '3', data: '2026-11-10', quantidade: 1, unidade: 'X', vendedor: 'ANA SILVA' },
    { produto: 'GARRAFA SLIM', matricula: '4', data: '2026-11-10', quantidade: 2, unidade: 'X', vendedor: 'ANA SILVA' },
];
const semGrupoGP = processarConsolidadas({ vendasFiltradas: vendasGP, planos: planosGP, produtos: produtosGP });
const exibirSem = new Map(gruposParaExibir(semGrupoGP.relatorioPorUnidade.X.grupos));
definirRegrasGrupos([{ ...planosGP[0], grupo_id: 200 }, { ...planosGP[1], grupo_id: 200 }, planosGP[2], { ...produtosGP[0], grupo_id: 201 }], gruposGP);
const comGrupoGP = processarConsolidadas({ vendasFiltradas: vendasGP, planos: planosGP, produtos: produtosGP });
teste('grupo próprio NÃO muda nenhum número (planos, produtos, vendas)',
    comGrupoGP.baseRankingUnidades[0].totalPlanos === semGrupoGP.baseRankingUnidades[0].totalPlanos
    && comGrupoGP.baseRankingUnidades[0].totalProdutos === semGrupoGP.baseRankingUnidades[0].totalProdutos
    && comGrupoGP.baseRankingUnidades[0].vendas === semGrupoGP.baseRankingUnidades[0].vendas
    && comGrupoGP.baseRankingUnidades[0].totalPlanos === 3);
teste('item em grupo próprio conta como plano pelo nome (Férias = Outros planos)', decomporPlano('FÉRIAS 7 DIAS').base === 'OUTROS PLANOS' && getCategoriaItem('GARRAFA SLIM', planosGP, produtosGP) === 'PRODUTO');
const exibir = new Map(gruposParaExibir(comGrupoGP.relatorioPorUnidade.X.grupos));
teste('exibição: bloco FÉRIAS com 2 e bloco PISCINA com 2 (garrafa x2)', exibir.get('FÉRIAS')?.total === 2 && exibir.get('PISCINA')?.total === 2);
teste('exibição: itens que saíram do bloco de sempre (Outros planos some, Produtos some, Plus fica)', !exibir.has('OUTROS PLANOS') && !exibir.has('PRODUTOS') && exibir.get('PLUS')?.total === 1);
const txtGP = montarTextoFechamentoUnidade({ unidadeAlvo: 'X', relatorioPorUnidade: comGrupoGP.relatorioPorUnidade });
teste('mensagem do fechamento mostra os blocos com o nome do grupo', txtGP.includes('FÉRIAS') && txtGP.includes('PISCINA') && txtGP.includes('FÉRIAS 7 DIAS'));
teste('sem grupo próprio: tudo como antes (bloco FÉRIAS com 2, Produtos com 2, sem bloco PISCINA)', exibirSem.get('FÉRIAS')?.total === 2 && exibirSem.get('PRODUTOS')?.total === 2 && !exibirSem.has('PISCINA'));

definirRegrasGrupos([], []);
console.log(falhas ? `\n❌ ${falhas} de ${n} falharam` : `\n✅ Todos os ${n} testes passaram`);
process.exit(falhas ? 1 : 0);
