// ==========================================
// RESULTADO DO CONTATO — regras únicas da Migração e do Resgate (decisão do dono, 06 e 07/11/2026)
// Depois do WhatsApp/Ligar a recepcionista marca "Como foi o contato?":
//   PENSANDO     → Respondeu, vai pensar: volta para a lista dela em 3 dias
//   SEM_RESPOSTA → Não respondeu / não atendeu: volta em 2 dias; na 3ª tentativa vai para a GELADEIRA (30 dias)
//   INTERESSADO  → Migração: vai para o funil; Resgate: fica na aba e volta amanhã
//   NAO_QUER     → GELADEIRA por 30 dias (NÃO vai para o "Não contatar")
// Da geladeira, depois de 30 dias, volta em "Para hoje". Contatado sem data volta 2 dias depois do último contato.
// ==========================================
import { supabase } from '../../supabaseClient.js';
import { diaISO, somarDiasISO, dataLocalISO } from './utils';
import { telefoneFalso, telefoneSem55 } from '../CadastroGeral/utilsAlunos.js';
import { tx } from '../../i18n/traduzir.js';

export const DIAS_VOLTA_PENSANDO = 3;
export const DIAS_VOLTA_SEM_RESPOSTA = 2;
export const DIAS_VOLTA_INTERESSADO = 1;
export const DIAS_GELADEIRA = 30;
export const MAX_TENTATIVAS = 3;
export const NA_GELADEIRA = ['NAO_QUER', 'SEM_RESPOSTA'];
export const RESPONDEU = ['PENSANDO', 'INTERESSADO', 'NAO_QUER'];

export const ANDAMENTOS_BASE = {
    NAO_CONTATADO: { rotulo: 'Não contatado', classe: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700' },
    PARA_HOJE: { rotulo: 'Para hoje', classe: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30' },
    AGUARDANDO: { rotulo: 'Aguardando', classe: 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700' },
    INTERESSADO: { rotulo: 'Interessado', classe: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30' },
    GELADEIRA: { rotulo: 'Geladeira', classe: 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30' }
};

export const VISOES_FILA = [
    { val: 'FILA', label: 'Minha fila' },
    { val: 'DISPONIVEIS', label: 'Disponíveis' },
    { val: 'TODOS', label: 'Todos' },
    { val: 'SEM_TELEFONE', label: 'Sem telefone' }
];
export const QUANTIDADES_PUXAR = [10, 15, 20, 50];
export const DIAS_PARA_DEVOLVER = 7;

export const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '');

// Telefone que não dá para ligar nem mandar WhatsApp (vazio, curto ou de preenchimento)
export const semTelefoneValido = (tel) => {
    const limpo = telefoneSem55(tel);
    return limpo.length < 10 || telefoneFalso(limpo);
};

/**
 * Etapa mostrada na linha. situacao = status gravado (NAO_CONTATADO, CONTATADO, INTERESSADO, NAO_QUER, SEM_RESPOSTA).
 * Interessado com data de volta (Resgate) volta para "Para hoje" no dia marcado, mas continua "Interessado".
 */
export const calcularEtapa = (situacao, registro, hoje) => {
    let etapa = situacao;
    let voltaEm = null;
    if (situacao === 'CONTATADO') {
        voltaEm = registro?.volta_em || somarDiasISO(dataLocalISO(registro?.atualizado_em || registro?.criado_em) || hoje, DIAS_VOLTA_SEM_RESPOSTA);
        etapa = voltaEm <= hoje ? 'PARA_HOJE' : 'AGUARDANDO';
    } else if (NA_GELADEIRA.includes(situacao)) {
        voltaEm = registro?.volta_em || somarDiasISO(dataLocalISO(registro?.atualizado_em) || hoje, DIAS_GELADEIRA);
        etapa = voltaEm <= hoje ? 'PARA_HOJE' : 'GELADEIRA';
    } else if (situacao === 'INTERESSADO' && registro?.volta_em) {
        voltaEm = registro.volta_em;
    }
    const paraHoje = etapa === 'NAO_CONTATADO' || etapa === 'PARA_HOJE' || (etapa === 'INTERESSADO' && !!voltaEm && voltaEm <= hoje);
    return { etapa, voltaEm, paraHoje };
};

/**
 * O que gravar para o resultado escolhido. interessadoVolta = dias para o Interessado voltar (null = sem data).
 * "Não respondeu" marcado de novo no mesmo dia não soma outra tentativa.
 */
export const camposDoResultado = (tipo, registro, hoje, { interessadoVolta = null } = {}) => {
    const reg = registro || {};
    const tentativasAntes = Number(reg.tentativas) || 0;
    if (tipo === 'PENSANDO') return { status: 'CONTATADO', extras: { resultado: 'PENSANDO', volta_em: somarDiasISO(hoje, DIAS_VOLTA_PENSANDO), tentativas: 0 } };
    if (tipo === 'SEM_RESPOSTA') {
        const jaMarcouHoje = reg.resultado === 'SEM_RESPOSTA' && dataLocalISO(reg.atualizado_em) === hoje;
        const n = jaMarcouHoje ? Math.max(tentativasAntes, 1) : tentativasAntes + 1;
        return n >= MAX_TENTATIVAS
            ? { status: 'SEM_RESPOSTA', extras: { resultado: 'SEM_RESPOSTA', volta_em: somarDiasISO(hoje, DIAS_GELADEIRA), tentativas: 0 }, foiParaGeladeira: true }
            : { status: 'CONTATADO', extras: { resultado: 'SEM_RESPOSTA', volta_em: somarDiasISO(hoje, DIAS_VOLTA_SEM_RESPOSTA), tentativas: n } };
    }
    if (tipo === 'INTERESSADO') return { status: 'INTERESSADO', extras: { resultado: 'INTERESSADO', volta_em: interessadoVolta ? somarDiasISO(hoje, interessadoVolta) : null, tentativas: 0 } };
    return { status: 'NAO_QUER', extras: { resultado: 'NAO_QUER', volta_em: somarDiasISO(hoje, DIAS_GELADEIRA), tentativas: 0 } };
};

// Linha pequena embaixo da etapa: quando volta, tentativas, motivo da geladeira
export const detalheEtapa = (l) => {
    const reg = l.registro || {};
    const partes = [];
    if (l.etapa === 'GELADEIRA') partes.push(`${l.situacao === 'NAO_QUER' ? tx('Não quer') : tx('Sem resposta')} · ${tx('volta {dia}', { dia: dataBR(l.voltaEm) })}`);
    else if (l.etapa === 'AGUARDANDO' || (l.etapa === 'INTERESSADO' && l.voltaEm && !l.paraHoje)) partes.push(tx('volta {dia}', { dia: dataBR(l.voltaEm) }));
    else if (l.paraHoje && l.voltaEm) partes.push(l.voltaEm < diaISO(0) ? tx('atrasado desde {dia}', { dia: dataBR(l.voltaEm) }) : tx('volta hoje'));
    if (reg.resultado === 'PENSANDO' && l.situacao === 'CONTATADO') partes.push(tx('vai pensar'));
    if (Number(reg.tentativas) > 0 && l.situacao === 'CONTATADO') partes.push(tx('tentativa {n} de {max}', { n: reg.tentativas, max: MAX_TENTATIVAS }));
    if (l.etapa === 'PARA_HOJE' && NA_GELADEIRA.includes(l.situacao)) partes.push(tx('voltou da geladeira'));
    return partes.join(' · ');
};

// Ordem da lista: "Para hoje" primeiro (atrasados, depois os de hoje, depois os não contatados); nos outros, pela data de volta
export const ordenarFila = (a, b) => (
    (a.paraHoje ? 0 : 1) - (b.paraHoje ? 0 : 1)
    || String(a.voltaEm || '9999').localeCompare(String(b.voltaEm || '9999'))
);

// Guarda cada resultado marcado (relatório "Resultado por recepcionista"). Sem o SQL de 07/11 só avisa no console.
export const registrarResultadoContato = async ({ unidade, consultor, origem, aluno_id, resultado }) => {
    const { error } = await supabase.from('crm_resultados_contato').insert([{
        unidade: String(unidade || '').toUpperCase().trim(), consultor, origem, aluno_id, resultado
    }]);
    if (error) console.warn('Resultado do contato não foi guardado (rode sql/2026-11-07-crm-resgate):', error.message || error);
};
