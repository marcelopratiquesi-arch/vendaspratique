// ==========================================
// RELATÓRIO DE FECHAMENTO DA RECEPÇÃO (decisão do dono, 05/11/2026)
// No fim de cada turno a recepção manda no grupo de vendas da unidade o "WhatsApp Fechamento" (Dashboard → Relatórios).
// O sistema não vê o WhatsApp: conta como ENVIADO o clique em Copiar ou Enviar na janela desse relatório,
// feito pelo login da RECEPÇÃO, com o período "Hoje", na própria unidade e DENTRO do horário do turno
// (clique fora do horário é só consulta e não conta). Fechar não conta.
// Horário de envio (decisão do dono, 06/11/2026; antes era 13h–14h30 e 22h–23h):
//   seg a sex  MANHÃ: envio das 13h30 às 15h00 (cobrança na tela da Recepção às 14h30)
//              NOITE: envio das 21h30 às 23h00 (cobrança às 22h30; tem unidade que fecha às 22h)
//   sábado, domingo e feriado nacional: um relatório só (FIM DE SEMANA), das 12h00 às 13h00 (cobrança 12h30).
// Clique depois do prazo (até 17h59 de manhã, até 23h59 à noite e no fim de semana) ainda conta, como ATRASADO.
// Clique antes do horário de abrir não conta (é consulta).
// Vale a partir de 05/11/2026. Tabela relatorios_fechamento_envios (SQL em sql/2026-11-05-relatorio-fechamento/).
// O nome de quem devia enviar vem do cadastro da Equipe: setor Recepção, ativa, campo Turno (Manhã/Noite).
// CONFERÊNCIA NO GRUPO (06/11/2026): quando o sistema marca "não enviado", o Líder/Mentor/Admin (permissão 313) confere no
// grupo de vendas da unidade e responde ENVIADO (conta como enviado) ou NAO_ENVIADO (confirmado). Nos dois casos o turno sai
// da cobrança. Tabela relatorios_fechamento_conferencia (sql/2026-11-06-relatorio-conferencia/).
// ==========================================
import { supabase } from '../../supabaseClient.js';
import { normalizeString } from '../AnaliseVendas/utils.js';
import { tipoDoDia } from '../AnaliseVendas/feriados.js';

export const INICIO_COBRANCA_RELATORIO = '2026-11-05';

// Horários em minutos do dia
const h = (hora, min = 0) => hora * 60 + min;
const TURNOS_SEMANA = [
    { turno: 'MANHA', rotulo: 'manhã', abre: h(13, 30), fecha: h(18), cobra: h(14, 30), atrasa: h(15) },
    { turno: 'NOITE', rotulo: 'noite', abre: h(21, 30), fecha: h(24), cobra: h(22, 30), atrasa: h(23) },
];
const TURNOS_FIM_DE_SEMANA = [
    { turno: 'FIM_DE_SEMANA', rotulo: 'fim de semana/feriado', abre: h(12), fecha: h(24), cobra: h(12, 30), atrasa: h(13) },
];

const paraIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const minutosDoDia = (d) => d.getHours() * 60 + d.getMinutes();
const horaTexto = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const ROTULO_TURNO = { MANHA: 'manhã', NOITE: 'noite', FIM_DE_SEMANA: 'fim de semana/feriado' };

// Turnos que a unidade precisa enviar num dia (YYYY-MM-DD)
export const turnosDoDia = (dataIso) => {
    // Sábado, domingo e feriado nacional (decisão do dono: feriado tem horário de sábado) = um relatório só, ao meio-dia
    return (tipoDoDia(dataIso) ? TURNOS_FIM_DE_SEMANA : TURNOS_SEMANA).map(t => ({
        ...t, cobraTexto: horaTexto(t.cobra), atrasaTexto: horaTexto(t.atrasa), abreTexto: horaTexto(t.abre),
    }));
};

// Em que turno cai um clique (ou null = fora do horário, não conta)
export const turnoDoMomento = (agora = new Date()) => {
    const min = minutosDoDia(agora);
    const t = turnosDoDia(paraIso(agora)).find(x => min >= x.abre && min < x.fecha);
    return t ? t.turno : null;
};

// Grava o envio (só Recepção, só a própria unidade, só no horário). Devolve { contou, motivo }.
export const registrarEnvioRelatorio = async ({ usuario, unidade, acao }) => {
    if (String(usuario?.role || '').toUpperCase() !== 'RECEPCAO') return { contou: false, motivo: 'nao_recepcao' };
    if (normalizeString(String(unidade || '')) !== normalizeString(String(usuario?.unidade || ''))) return { contou: false, motivo: 'outra_unidade' };
    const agora = new Date();
    if (paraIso(agora) < INICIO_COBRANCA_RELATORIO) return { contou: false, motivo: 'antes_do_inicio' };
    const turno = turnoDoMomento(agora);
    if (!turno) return { contou: false, motivo: 'fora_do_horario' };
    const { error } = await supabase.from('relatorios_fechamento_envios').insert({
        unidade: String(usuario.unidade).toUpperCase(),
        data: paraIso(agora),
        turno,
        acao,
        login_nome: usuario?.nome || null,
    });
    if (error) {
        if (error.code === '23505') return { contou: true, motivo: 'ja_enviado', turno }; // o primeiro envio do turno é o que vale
        console.warn('Relatório de fechamento: não deu para registrar o envio (rodou o SQL 2026-11-05-relatorio-fechamento?)', error.message);
        return { contou: false, motivo: 'erro' };
    }
    window.dispatchEvent(new CustomEvent('relatorio-fechamento-enviado'));
    return { contou: true, motivo: 'ok', turno };
};

// Lê os envios de um período (só leitura). Sem a tabela, devolve null.
export const buscarEnviosRelatorio = async (inicioIso, fimIso) => {
    let q = supabase.from('relatorios_fechamento_envios').select('unidade, data, turno, acao, login_nome, enviado_em').gte('data', inicioIso > INICIO_COBRANCA_RELATORIO ? inicioIso : INICIO_COBRANCA_RELATORIO);
    if (fimIso) q = q.lte('data', fimIso);
    const { data, error } = await q.order('data', { ascending: true }).limit(5000);
    if (error) { console.warn('Relatório de fechamento: não deu para ler os envios', error.message); return null; }
    return data || [];
};

// ---------- CONFERÊNCIA NO GRUPO ----------
// Lê as conferências de um período. Sem a tabela, devolve null (as telas funcionam sem os botões).
export const buscarConferenciasRelatorio = async (inicioIso, fimIso) => {
    let q = supabase.from('relatorios_fechamento_conferencia').select('unidade, data, turno, resultado, conferido_por, conferido_em')
        .gte('data', inicioIso > INICIO_COBRANCA_RELATORIO ? inicioIso : INICIO_COBRANCA_RELATORIO);
    if (fimIso) q = q.lte('data', fimIso);
    const { data, error } = await q.limit(5000);
    if (error) { console.warn('Relatório de fechamento: conferências indisponíveis (rodou o SQL 2026-11-06-relatorio-conferencia?)', error.message); return null; }
    return data || [];
};

export const acharRegistroTurno = (lista, unidade, dataIso, turno) => {
    const alvo = normalizeString(String(unidade || ''));
    return (lista || []).find(e => normalizeString(String(e.unidade || '')) === alvo && String(e.data).slice(0, 10) === dataIso && e.turno === turno) || null;
};

// Grava (ou corrige) a resposta do Líder: resultado 'ENVIADO' | 'NAO_ENVIADO'. Devolve o erro (ou null).
export const gravarConferenciaRelatorio = async ({ usuario, unidade, data, turno, resultado }) => {
    const { error } = await supabase.from('relatorios_fechamento_conferencia').upsert({
        unidade: String(unidade || '').toUpperCase().trim(),
        data, turno, resultado,
        conferido_por: usuario?.nome || usuario?.email || null,
        conferido_email: usuario?.email || null,
        conferido_em: new Date().toISOString(),
    }, { onConflict: 'unidade,data,turno' });
    if (!error) window.dispatchEvent(new CustomEvent('relatorio-fechamento-enviado'));
    return error || null;
};

// Texto da regra de horário (para mostrar na tela)
export const TEXTO_REGRA_RELATORIO = 'Conta sozinho como enviado quando o login da Recepção clica em Copiar ou Enviar no WhatsApp Fechamento (Relatórios, período Hoje, a própria unidade) no horário: manhã das 13h30 às 15h · noite das 21h30 às 23h · sábado, domingo e feriado das 12h às 13h. Depois do prazo ainda conta, como atrasado (até 17h59 de manhã e até 23h59 à noite). Se a recepção mandou de outro jeito, o Líder confere no grupo de vendas e confirma.';

// Situação de um turno num dia: 'enviado' | 'enviado_atrasado' | 'aguardando' (antes da cobrança) |
// 'cobrando' (passou da cobrança, ainda no prazo) | 'atrasado' (hoje, passou do prazo) | 'nao_enviado' (dia que já passou)
export const situacaoDoTurno = (turnoInfo, dataIso, envio, agora = new Date()) => {
    if (envio) {
        const enviado = new Date(envio.enviado_em);
        const atrasou = paraIso(enviado) > dataIso || minutosDoDia(enviado) > turnoInfo.atrasa;
        return atrasou ? 'enviado_atrasado' : 'enviado';
    }
    const hojeIso = paraIso(agora);
    if (dataIso < hojeIso) return 'nao_enviado';
    if (dataIso > hojeIso) return 'aguardando';
    const min = minutosDoDia(agora);
    if (min < turnoInfo.cobra) return 'aguardando';
    if (min < turnoInfo.atrasa) return 'cobrando';
    return 'atrasado';
};

// Recepcionistas ativas da unidade naquele turno (cadastro da Equipe). Fim de semana: rodízio, sem nome.
export const recepcionistasDoTurno = (colaboradores = [], unidade, turno) => {
    if (turno === 'FIM_DE_SEMANA') return [];
    const alvo = normalizeString(String(unidade || ''));
    return colaboradores.filter(c => c && c.ativo !== false
        && normalizeString(String(c.unidade || '')) === alvo
        && normalizeString(String(c.role || c.setor || '')).includes('RECEP')
        && String(c.turno || '').toUpperCase() === turno);
};

const primeiroNome = (nome) => {
    const p = String(nome || '').trim().split(/\s+/)[0] || '';
    return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '';
};
export const nomesDoTurno = (colaboradores, unidade, turno) => recepcionistasDoTurno(colaboradores, unidade, turno).map(c => primeiroNome(c.nome)).filter(Boolean);

// Situação de TODOS os turnos de ontem e hoje de uma unidade (para a tela mostrar o que foi feito em verde):
// 'enviado' | 'enviado_atrasado' | 'conferido_enviado' (Líder conferiu no grupo) | 'confirmado_nao' (Líder confirmou que não)
// | 'aguardando' | 'cobrando' | 'atrasado' | 'nao_enviado'
export const situacaoRelatorioDias = (envios = [], conferencias = [], unidade, agora = new Date()) => {
    const hojeIso = paraIso(agora);
    const ontem = new Date(agora); ontem.setDate(ontem.getDate() - 1);
    const lista = [];
    [paraIso(ontem), hojeIso].forEach(dataIso => {
        if (dataIso < INICIO_COBRANCA_RELATORIO) return;
        turnosDoDia(dataIso).forEach(t => {
            const envio = acharRegistroTurno(envios, unidade, dataIso, t.turno);
            const conf = acharRegistroTurno(conferencias, unidade, dataIso, t.turno);
            let situacao = situacaoDoTurno(t, dataIso, envio, agora);
            if (!envio && conf) situacao = conf.resultado === 'ENVIADO' ? 'conferido_enviado' : 'confirmado_nao';
            lista.push({ data: dataIso, turno: t.turno, rotulo: t.rotulo, situacao, hoje: dataIso === hojeIso, atrasaTexto: t.atrasaTexto, abreTexto: t.abreTexto, envio, conferencia: conf });
        });
    });
    return lista;
};

// Pendências de relatório de uma unidade: hoje (turnos já em cobrança) e ontem (turnos não enviados)
// conferencias: respostas do Líder (turno conferido no grupo sai da cobrança, enviado ou não)
export const pendenciasRelatorio = (envios = [], unidade, agora = new Date(), conferencias = []) => {
    const alvo = normalizeString(String(unidade || ''));
    const hojeIso = paraIso(agora);
    const ontem = new Date(agora); ontem.setDate(ontem.getDate() - 1);
    const ontemIso = paraIso(ontem);
    const lista = [];
    [ontemIso, hojeIso].forEach(dataIso => {
        if (dataIso < INICIO_COBRANCA_RELATORIO) return;
        turnosDoDia(dataIso).forEach(t => {
            const envio = envios.find(e => normalizeString(String(e.unidade || '')) === alvo && String(e.data).slice(0, 10) === dataIso && e.turno === t.turno);
            const sit = situacaoDoTurno(t, dataIso, envio, agora);
            if (acharRegistroTurno(conferencias, unidade, dataIso, t.turno)) return;
            if (sit === 'cobrando' || sit === 'atrasado' || sit === 'nao_enviado') {
                lista.push({ data: dataIso, turno: t.turno, rotulo: t.rotulo, situacao: sit, hoje: dataIso === hojeIso, atrasaTexto: t.atrasaTexto });
            }
        });
    });
    return lista;
};

// Abre a janela "Conferiu no grupo?" (JanelaConferirRelatorio, montada uma vez no App) de qualquer tela
export const EVENTO_CONFERIR_RELATORIO = 'conferir-relatorio-fechamento';
export const pedirConferirRelatorio = (dados) => window.dispatchEvent(new CustomEvent(EVENTO_CONFERIR_RELATORIO, { detail: dados }));
