// ==========================================
// UTILS: Funções de Apoio do CRM
// ==========================================

export const formatarCPF = (valor) => {
    const digitos = valor.replace(/\D/g, '').slice(0, 11);
    return digitos
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

export const cpfValido = (cpfFormatado) => {
    return cpfFormatado.replace(/\D/g, '').length === 11;
};

export const apenasDigitos = (valor) => String(valor || '').replace(/\D/g, '');

// Compara nomes sem ligar para maiúsculas, acentos ou espaços sobrando ("ANA PAULA" = "Ana Paula")
export const normalizarNome = (nome) => String(nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim().replace(/\s+/g, ' ');
export const mesmoNome = (a, b) => !!normalizarNome(a) && normalizarNome(a) === normalizarNome(b);

// ==========================================
// CONTATOS DE HOJE: VISITANTES 24H/48H E ANIVERSARIANTES
// ==========================================
// Visitante = cadastrado pelo Novo Visitante na recepção (origem RECEPCAO).
// Cancelados e inativos entram por lista (Base/Smart Paste) e NÃO são visitantes.
export const ehVisitanteRecepcao = (lead) => String(lead?.origem || '').toUpperCase() === 'RECEPCAO';

// Dia da visita (AAAA-MM-DD, horário local)
export const dataDaVisita = (lead) => dataLocalISO(lead?.data || lead?.data_criacao || dataDoLead(lead));

// Dia de hoje somando dias (ex.: -1 = ontem), em AAAA-MM-DD
export const diaISO = (deslocamento = 0, base = new Date()) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + deslocamento);
    return dataLocalISO(d);
};
export const somarDiasISO = (iso, dias) => {
    const [a, m, d] = String(iso).split('-').map(Number);
    return dataLocalISO(new Date(a, m - 1, d + dias));
};

// Textos padrão (Admin/Líder podem editar no CRM; ficam na tabela crm_mensagens_prontas)
export const MENSAGENS_PADRAO = {
    VISITANTE_24H: 'Olá, {nome}! Aqui é da equipe da Pratique {unidade}. Muito obrigado pela sua visita ontem! 😊 O que você achou da academia e do atendimento? Ficou com alguma dúvida que a gente possa te ajudar?',
    VISITANTE_48H: 'Oi, {nome}! Tudo bem? Aqui é da equipe da Pratique {unidade}. Passando para dizer que as portas estão abertas para você voltar e começar a treinar com a gente. 💪 Quer ajuda para escolher o plano ideal e já deixar sua matrícula pronta?',
    ANIVERSARIO: 'Feliz aniversário, {nome}! 🎉 Toda a equipe da Pratique {unidade} deseja a você um novo ano de vida cheio de saúde, alegria e conquistas. Um grande abraço!',
    MIGRACAO: 'Oi, {nome}! Tudo bem? Aqui é da equipe da Pratique {unidade}. 😊 Temos uma novidade para você: com o plano com nutricionista, você treina com acompanhamento da alimentação e chega mais rápido no seu objetivo. 🥗💪 Quer que eu te explique como funciona a troca do seu plano?'
};

// ==========================================
// TIPO DO CONTATO NA BASE: VISITANTE, CANCELADO e INATIVO
// "CANCELADO/INATIVO" é o tipo antigo (antes da separação) e continua sendo aceito.
// ==========================================
export const TIPO_ANTIGO_CANCELADO_INATIVO = 'CANCELADO/INATIVO';
export const ehCanceladoOuInativo = (tipo) => ['CANCELADO', 'INATIVO', TIPO_ANTIGO_CANCELADO_INATIVO].includes(String(tipo || '').toUpperCase());

// Status do TECACE → tipo no CRM (decisão do dono, 2026-10-28). ATIVO/CLIENTE ainda são alunos: não entram na Base.
export const CLASSIFICACAO_STATUS_TECACE = {
    INATIVO: 'INATIVO',
    SUSPENSO: 'INATIVO',
    TRANCADO: 'INATIVO',
    FINALIZADO: 'CANCELADO',
    BLOQUEADO: 'CANCELADO',
    VISITANTE: 'VISITANTE',
    ATIVO: 'ATIVO',
    CLIENTE: 'ATIVO'
};
export const tipoPeloStatusTecace = (status) => CLASSIFICACAO_STATUS_TECACE[normalizarNome(status)] || '';

// Cor da etiqueta do tipo (Base, Kanban, Lista, ficha do contato)
export const classeTipoLead = (tipo) => {
    const t = String(tipo || '').toUpperCase();
    if (t === 'VISITANTE') return 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30';
    if (t === 'CANCELADO') return 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30';
    if (t === 'INATIVO' || t === TIPO_ANTIGO_CANCELADO_INATIVO) return 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/30';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800';
};

// Justificativas para "Marcar como feito" SEM ter mandado o WhatsApp (fica em vermelho para o Líder conferir)
export const JUSTIFICATIVAS_SEM_WHATSAPP = ['Liguei', 'Falei pessoalmente'];

// Motivos para colocar alguém em "Não contatar"
export const MOTIVOS_NAO_CONTATAR = ['Pediu para não receber mensagens', 'Pediu para não receber ligações', 'Reclamou dos contatos', 'Número errado / não é a pessoa'];

const capitalizar = (texto) => String(texto || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

// Troca {nome} pelo primeiro nome e {unidade} pelo nome da unidade
export const preencherMensagem = (texto, { nome, unidade }) => String(texto || '')
    .split('{nome}').join(capitalizar(String(nome || '').trim().split(' ')[0]))
    .split('{unidade}').join(capitalizar(unidade));

// Busca do CRM: parte do nome (sem acento) ou parte dos números do CPF/telefone
export const contatoCombinaComBusca = (contato, termo) => {
    const texto = String(termo || '').trim();
    if (!texto) return true;
    if (normalizarNome(contato?.nome).includes(normalizarNome(texto))) return true;
    const numeros = apenasDigitos(texto);
    if (numeros.length >= 3) {
        return apenasDigitos(contato?.cpf).includes(numeros) || apenasDigitos(contato?.telefone).includes(numeros);
    }
    return false;
};

// Data de entrada do lead. O CRM grava "criado_em", o Novo Visitante grava "data_criacao" e o banco tem "created_at".
export const dataDoLead = (lead) => lead?.criado_em || lead?.data_criacao || lead?.created_at || lead?.data || null;

// Dia (AAAA-MM-DD) no horário do Brasil/do computador, e não no horário internacional
// (um contato criado às 22h não pode cair no dia seguinte)
export const dataLocalISO = (valor) => {
    if (!valor) return '';
    if (valor instanceof Date) return isNaN(valor.getTime()) ? '' : `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`;
    const texto = String(valor);
    if (/^\d{2}\/\d{2}\/\d{4}/.test(texto)) {
        const [d, m, a] = texto.split(' ')[0].split('/');
        return `${a}-${m}-${d}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
    return dataLocalISO(new Date(texto));
};

// Meta do dia: conta PESSOAS diferentes contatadas (decisão do dono), não cliques.
// Cada ação traz "pessoa" (lead:ID ou aluno:ID); ação sem pessoa conta sozinha.
export const contarPessoasDaMeta = (progresso = []) =>
    new Set(progresso.filter(p => p && p.data_contato).map((p, i) => p.pessoa || `acao:${i}`)).size;

// Papel verdadeiro de quem está logado (Admin/Mentor que escolhe uma unidade no topo vira "LIDER" no role)
export const papelReal = (usuario) => String(usuario?.roleReal || usuario?.role || '').toUpperCase();

// Admin, Líder e Mentor (nas unidades dele, mesma regra do Líder) apagam contato do banco (decisão do dono).
// A Recepção nunca apaga. O banco confere (gatilho crm_conferir_quem_apaga).
export const podeApagarLeads = (usuario) => ['ADMIN', 'LIDER', 'MENTOR'].includes(papelReal(usuario));

// Quando Líder/Admin/Mentor (ou uma colega) age no CRM de outra recepcionista, a ação conta para ela,
// mas fica a marca de quem fez de verdade: "feito por NOME (Papel)". Vazio quando a própria pessoa fez.
// O login da Recepção é da unidade (ex.: "VENEZA"), não da pessoa: quem opera é a do cartão escolhido, sem marca.
export const marcaFeitoPor = (usuarioLogado, operador) => {
    const quem = usuarioLogado?.nome;
    if (!operador || !quem || mesmoNome(quem, operador) || papelReal(usuarioLogado) === 'RECEPCAO') return '';
    const papel = { ADMIN: 'Admin', MENTOR: 'Mentor', LIDER: 'Líder', RECEPCAO: 'Recepção' }[papelReal(usuarioLogado)] || papelReal(usuarioLogado);
    return `feito por ${quem}${papel ? ` (${papel})` : ''}`;
};

// Pessoal da recepção (só eles operam o CRM e ganham cartão na tela de entrada)
export const ehRecepcao = (colaborador) => {
    const cargo = String(colaborador?.role || colaborador?.setor || colaborador?.cargo || '').toUpperCase();
    const status = String(colaborador?.status || colaborador?.situacao || 'ATIVO').toUpperCase();
    // O Cadastro Geral → Equipe marca quem foi desativado com ativo = false
    const inativo = colaborador?.ativo === false || status.includes('INATIVO') || status.includes('DESLIGADO') || status === 'FALSE';
    return !inativo && cargo.includes('RECEP');
};

// Fases em que o lead ainda está sendo trabalhado (Kanban)
export const FASES_EM_ATENDIMENTO = ['Novo', 'Em Contato'];

// O "Day Use (3 Dias)" não existe mais (decisão do dono). Contatos antigos que ainda estejam nessa fase
// aparecem como "Em Contato" para não sumirem do Kanban. Fase vazia ou desconhecida aparece como "Novo".
const FASES_VALIDAS = ['Novo', 'Em Contato', 'Fechado', 'Perdido', 'Arquivado'];
export const normalizarStatus = (status) => {
    if (status === 'Day Use (3 Dias)') return 'Em Contato';
    return FASES_VALIDAS.includes(status) ? status : 'Novo';
};

// Link do WhatsApp sem repetir o 55 quando o telefone já vem com o código do Brasil
export const linkWhatsApp = (telefone, texto) => {
    let numero = apenasDigitos(telefone);
    if (!(numero.length >= 12 && numero.startsWith('55'))) numero = '55' + numero;
    return `https://wa.me/${numero}?text=${encodeURIComponent(texto || '')}`;
};

export const formatarDataHora = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const data = d.toLocaleDateString('pt-BR');
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${data} às ${hora}`;
};

// Nova função inteligente para saudação automática baseada na hora do dia
export const getSaudacao = () => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia';
    if (hora >= 12 && hora < 18) return 'Boa tarde';
    return 'Boa noite';
};

// ==========================================
// GERADOR DE MENSAGENS INTELIGENTE
// ==========================================
export const gerarTextoWhatsApp = (lead) => {
    const nomeAluno = lead.nome ? lead.nome.trim().split(' ')[0] : 'Aluno';
    const nomeFormatado = nomeAluno.charAt(0).toUpperCase() + nomeAluno.slice(1).toLowerCase();
    
    const saudacao = getSaudacao();
    const isInativo = ehCanceladoOuInativo(lead.tipo_lead);

    if (lead.status === 'Novo') {
        return isInativo 
            ? `${saudacao} ${nomeFormatado}, sentimos sua falta aqui na Pratique! Tudo bem com você?`
            : `${saudacao} ${nomeFormatado}, tudo bem? Vi que você tem interesse em treinar com a gente!`;
    } 
    else if (lead.status === 'Em Contato') {
        return isInativo
            ? `${nomeFormatado}, a Pratique mudou e melhorou muito o atendimento! Queremos que você volte para conhecer nossa nova estrutura. 🚀\n\nE agora o nosso plano está super simples e fácil de voltar:\n✅ ZERO taxa de matrícula\n✅ SEM fidelidade\n✅ NÃO ocupa o limite do seu cartão\n\nBora treinar hoje?`
            : `${nomeFormatado}, vem conhecer a PRATIQUE! 💪\n\nAgende sua visita e monte seu treino com a gente.\n\n✅ Sem taxa de matrícula\n✅ Sem fidelidade\n\nQual o melhor horário para você vir?`;
    }
    else if (lead.status === 'Fechado') {
        return isInativo
            ? `Que bom ter você de volta, ${nomeFormatado}! A família Pratique estava com saudades de ver você quebrando tudo nos treinos!`
            : `Parabéns ${nomeFormatado}, seja muito bem-vindo(a) à família Pratique! Que bom ter você com a gente!`;
    } 
    else if (lead.status === 'Perdido') {
        return `Poxa ${nomeFormatado}, que pena! Mas nossas portas estão sempre abertas para quando você quiser focar na sua saúde. Um abraço de toda a equipe!`;
    }
    
    return `${saudacao} ${nomeFormatado}, tudo bem?`;
};

// Configurações Globais do Funil
export const COLUNAS = ['Novo', 'Em Contato', 'Fechado', 'Perdido'];

export const STATUS_TOKENS = {
    'Novo': { border: 'border-blue-200 dark:border-blue-500/30', text: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50/50 dark:bg-blue-500/10', accent: 'bg-blue-500', hex: '#3b82f6', icone: 'star' },
    'Em Contato': { border: 'border-amber-200 dark:border-amber-500/30', text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50/50 dark:bg-amber-500/10', accent: 'bg-amber-500', hex: '#f59e0b', icone: 'phone-forwarded' },
    'Fechado': { border: 'border-emerald-200 dark:border-emerald-500/30', text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50/50 dark:bg-emerald-500/10', accent: 'bg-emerald-500', hex: '#10b981', icone: 'check-circle' },
    'Perdido': { border: 'border-rose-200 dark:border-rose-500/30', text: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-50/50 dark:bg-rose-500/10', accent: 'bg-rose-500', hex: '#f43f5e', icone: 'x-circle' }
};