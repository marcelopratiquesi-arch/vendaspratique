// ==========================================
// AVISAR: aviso no padrão do sistema (substitui a janelinha cinza "localhost diz..." do navegador)
// - avisar('texto') descobre a cor pelo texto: erro (vermelho), sucesso (verde) ou atenção (amarelo).
//   avisar('texto', 'erro' | 'sucesso' | 'atencao') força a cor.
// - Quem desenha os avisos é a <CentralDeAvisos /> (Avisos.jsx), montada uma vez só no main.jsx.
// - O aviso não trava a tela (o código segue na hora). Para PERGUNTAR algo, continua o window.confirm.
// ==========================================

export const ouvintesDeAvisos = new Set();
let proximoId = 1;

const tipoPeloTexto = (texto) => {
    const t = texto.toLowerCase();
    if (/(erro|falh|não foi possível|nao foi possivel|não foi salv|não foram|não pode|bloquead|🚨|❌|inválid|invalid|negad|recusad|sem permissão|não tem permissão)/.test(t)) return 'erro';
    // "Salvo, MAS algo não deu certo": atenção (amarelo), não sucesso
    if (/(,\s*mas\b|\bnão foi\b)/.test(t)) return 'atencao';
    if (/(sucesso|concluíd|salv[oa]s?\b|✅|registrad[oa]|copiad[oa]|restaurad[oa]|atualizad[oa]|inserid[oa]s?|apagad[oa]s? (definitiv|permanent)|enviad[oa]s? para)/.test(t)) return 'sucesso';
    return 'atencao';
};

export const avisar = (mensagem, tipo) => {
    const texto = String(mensagem ?? '');
    const aviso = { id: proximoId++, texto, tipo: tipo || tipoPeloTexto(texto) };
    // Segurança: se a central não estiver na tela, usa o aviso do navegador
    if (ouvintesDeAvisos.size === 0) { window.alert(texto); return; }
    ouvintesDeAvisos.forEach(fn => fn(aviso));
};
