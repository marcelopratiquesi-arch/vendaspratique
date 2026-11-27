// Onde desenhar uma peça "fora do <main>" (a área central fica numa camada abaixo da barra do topo).
// Não pode ir para o <body>: a caixa do app é uma camada só, e a peça ficaria por cima de TUDO, até do menu.
export const caixaDoApp = () => document.getElementById('root')?.firstElementChild || document.body;
