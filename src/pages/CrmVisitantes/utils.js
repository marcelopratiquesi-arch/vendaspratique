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

// Papel verdadeiro de quem está logado (Admin/Mentor que escolhe uma unidade no topo vira "LIDER" no role)
export const papelReal = (usuario) => String(usuario?.roleReal || usuario?.role || '').toUpperCase();

// Só Líder e Admin podem apagar contato do banco (decisão do dono). Recepção e Mentor nunca apagam.
export const podeApagarLeads = (usuario) => ['ADMIN', 'LIDER'].includes(papelReal(usuario));

// Pessoal da recepção (só eles operam o CRM e ganham cartão na tela de entrada)
export const ehRecepcao = (colaborador) => {
    const cargo = String(colaborador?.role || colaborador?.setor || colaborador?.cargo || '').toUpperCase();
    const status = String(colaborador?.status || colaborador?.situacao || 'ATIVO').toUpperCase();
    const inativo = status.includes('INATIVO') || status.includes('DESLIGADO') || status === 'FALSE';
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
    const isInativo = lead.tipo_lead === 'CANCELADO/INATIVO'; 

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