// src/data/mock.js
export const initProdutos = [
    { id: 1, nome: "DRY BELLY", valor: 54.90 },
    { id: 2, nome: "FORCE CREATINA", valor: 79.90 },
    { id: 3, nome: "GARRAFA SLIM", valor: 29.90 },
    { id: 4, nome: "RETETION", valor: 54.90 },
    { id: 5, nome: "TOALHA", valor: 24.90 },
    { id: 6, nome: "GALÃO 2LITROS", valor: 34.90 },
    { id: 7, nome: "RETETION + DRYBELLY", valor: 47.45 },
    { id: 8, nome: "WHEY PROTEIN", valor: 11.90 },
    { id: 9, nome: "PRÉ TREINO ENERGY", valor: 11.90 }
];

export const initPlanos = [
    { id: 1, nome: "FIT", valor: 5.00 },
    { id: 2, nome: "FIT + NUTRI", valor: 7.00 },
    { id: 3, nome: "PLUS", valor: 8.00 },
    { id: 4, nome: "PLUS + NUTRI", valor: 10.00 },
    { id: 5, nome: "COMBO", valor: 10.00 },
    { id: 6, nome: "LISTA PLUS", valor: 8.00 },
    { id: 7, nome: "Férias 15 dias", valor: 8.00 },
    { id: 8, nome: "PRATIQUE NUTRI", valor: 2.00 },
    { id: 9, nome: "Férias 7 dias", valor: 5.00 },
    { id: 10, nome: "LISTA PLUS NATAL", valor: 50.00 },
    { id: 11, nome: "GOSLIM", valor: 50.00 },
    { id: 12, nome: "GOSLIM PREMIUM", valor: 50.00 },
    { id: 13, nome: "Reavaliação", valor: 10.00 }
];

export const initColaboradores = [
    { id: 1, nome: "HENRIQUE", cargo: "LIDER" },
    { id: 2, nome: "THAUANY", cargo: "RECEPÇÃO" },
    { id: 3, nome: "SAMUEL", cargo: "RECEPÇÃO" },
    { id: 4, nome: "Ana Maria", cargo: "SAVER" },
    { id: 5, nome: "MARIA", cargo: "SAVER" }
];

export const assinaturasIniciais = [
    { data: "09/07/2026", matricula: "33697", nome: "poliana lima silva", produto: "PLUS + NUTRI", vendedor: "SAMUEL", valor: "R$ 10,00", observacao: "", conferiu: true, quantidade: "1", comissao: "R$ 10,00", descricao: "" },
    { data: "09/07/2026", matricula: "33696", nome: "maria isabelle alves", produto: "DRY BELLY", vendedor: "HENRIQUE", valor: "R$ 54,90", observacao: "", conferiu: false, quantidade: "1", comissao: "R$ 5,49", descricao: "" }
];
