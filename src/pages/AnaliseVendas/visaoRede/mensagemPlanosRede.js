// Mensagem de WhatsApp do quadro "Planos por unidade" (Visão da Rede do Dashboard; decisão do dono, 06/11/2026).
// Vai para o grupo dos líderes: planos de cada unidade no período, quem está parado e quem não vendeu.
// Mensagem de WhatsApp da equipe: não é traduzida (regra do projeto).
const ddmm = (iso) => (iso ? iso.split('-').reverse().slice(0, 2).join('/') : '');
const dois = (n) => String(n).padStart(2, '0');

export const montarMensagemPlanosRede = ({ linhas, textoPeriodo, totalPlanos, totalNutri }) => {
    const venderam = linhas.filter(l => l.planos > 0);
    const naoVenderam = linhas.filter(l => l.planos === 0);
    const parados = venderam.filter(l => l.parouDeVender);
    const medalha = ['🥇', '🥈', '🥉'];

    let txt = `📊 *PLANOS VENDIDOS — REDE*\n`;
    if (textoPeriodo) txt += `🗓️ ${textoPeriodo}\n`;
    txt += `Total: *${totalPlanos} ${totalPlanos === 1 ? 'plano' : 'planos'}*`;
    if (totalNutri > 0) txt += ` (+ ${totalNutri} Nutri adicional)`;
    txt += `\n${venderam.length} de ${linhas.length} unidades venderam\n`;

    if (venderam.length > 0) {
        txt += `\n🏆 *POR UNIDADE*\n`;
        venderam.forEach((l, i) => {
            const extra = [l.nutri > 0 ? `Nutri ${l.nutri}` : '', l.produtividade !== null ? `produtividade ${Math.round(l.produtividade)}%` : ''].filter(Boolean).join(' · ');
            txt += `${medalha[i] || `${i + 1}.`} ${l.nome} — *${dois(l.planos)}*${extra ? ` (${extra})` : ''}\n`;
        });
    }
    if (parados.length > 0) {
        txt += `\n⚠️ *SEM PLANO HÁ 2 DIAS OU MAIS*\n`;
        parados.forEach(l => { txt += `• ${l.nome} — último plano em ${ddmm(l.ultimoPlano)} (${l.diasSemPlano} dias)\n`; });
    }
    if (naoVenderam.length > 0) {
        txt += `\n❌ *NÃO VENDERAM PLANO NO PERÍODO*\n`;
        naoVenderam.forEach(l => { txt += `• ${l.nome}${l.ultimoPlano ? ` — último plano em ${ddmm(l.ultimoPlano)}` : ''}\n`; });
        txt += `\n🚀 Bora acelerar, equipe!`;
    }
    return txt.trim();
};
