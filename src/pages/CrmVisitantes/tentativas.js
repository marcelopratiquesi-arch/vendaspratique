// Contagem de tentativas por CICLO (27/11/2026, decisão do dono, 1-A). Antes o funil somava todo o histórico:
// quem já tinha respondido ou voltado da Geladeira ia direto para a Geladeira no primeiro "não respondeu".
// Um ciclo começa quando o contato entra (ou volta) na carteira (puxado_em) e RECOMEÇA quando a pessoa responde
// ("vai pensar" ou "interessado"). No máximo uma tentativa por dia.
import { dataLocalISO } from './utils.js';

export const TEXTO_SEM_RESPOSTA = 'Resultado: não respondeu';
const TEXTOS_RESPONDEU = ['Resultado: respondeu', 'Resultado: interessado'];
export const ehRespostaDoContato = (observacao) => TEXTOS_RESPONDEU.some(t => String(observacao || '').startsWith(t));

// Folga de 1 minuto: o horário de "puxado" é o do computador e o do histórico é o do banco
const momento = (v) => { const t = new Date(v || 0).getTime(); return Number.isFinite(t) ? t : 0; };

export const inicioDoCiclo = (puxadoEm, respostas = []) => Math.max(
    puxadoEm ? momento(puxadoEm) - 60000 : 0,
    ...respostas.map(momento),
    0
);

// ETIQUETA do contato no funil (27/11/2026, decisão do dono): "Vai pensar" ou "Interessado" pela ÚLTIMA resposta do ciclo
// da carteira (desde puxado_em). Um "não respondeu" depois NÃO tira a etiqueta: só soma "sem resposta Nx" (dias diferentes).
// linhas = histórico "Agendamento" do contato: { observacao, data_registro }. Devolve { tipo, semResposta } ou null.
export const etiquetaDoResultado = (linhas, puxadoEm) => {
    const desde = puxadoEm ? momento(puxadoEm) - 60000 : 0;
    const respostas = (linhas || []).filter(l => ehRespostaDoContato(l.observacao) && momento(l.data_registro) >= desde)
        .sort((a, b) => momento(b.data_registro) - momento(a.data_registro));
    if (!respostas.length) return null;
    const ultima = respostas[0];
    const semResposta = contarDiasDeContato((linhas || []).filter(l => String(l.observacao || '').startsWith(TEXTO_SEM_RESPOSTA)).map(l => l.data_registro), momento(ultima.data_registro));
    return { tipo: String(ultima.observacao).startsWith('Resultado: interessado') ? 'INTERESSADO' : 'PENSANDO', semResposta };
};

// Quantos DIAS diferentes tiveram contato desde o começo do ciclo. ignorarDia: não conta esse dia (AAAA-MM-DD).
export const contarDiasDeContato = (datas, desde = 0, ignorarDia = '') => new Set(
    (datas || []).filter(d => momento(d) >= desde).map(d => dataLocalISO(d)).filter(d => d && d !== ignorarDia)
).size;

// Funil: tentativas "não respondeu" ANTES de hoje no ciclo atual (a de agora é este número + 1).
// linhas = histórico "Agendamento" do contato: { observacao, data_registro }
export const tentativasAnteriores = (linhas, puxadoEm, hoje) => {
    const desde = inicioDoCiclo(puxadoEm, (linhas || []).filter(l => ehRespostaDoContato(l.observacao)).map(l => l.data_registro));
    return contarDiasDeContato((linhas || []).filter(l => String(l.observacao || '').startsWith(TEXTO_SEM_RESPOSTA)).map(l => l.data_registro), desde, hoje);
};
