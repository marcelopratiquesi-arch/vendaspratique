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

export const formatarDataHora = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const data = d.toLocaleDateString('pt-BR');
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${data} às ${hora}`;
};

// ==========================================
// GERADOR DE MENSAGENS INTELIGENTE
// ==========================================
export const gerarTextoWhatsApp = (lead) => {
    const nomeAluno = lead.nome ? lead.nome.trim().split(' ')[0] : 'Aluno';
    const isInativo = lead.tipo_lead === 'CANCELADO/INATIVO'; 

    if (lead.status === 'Novo') {
        return isInativo 
            ? `Olá ${nomeAluno}, sentimos sua falta aqui na Pratique! Tudo bem com você?`
            : `Olá ${nomeAluno}, tudo bem? Vi que você tem interesse em treinar com a gente!`;
    } 
    else if (lead.status === 'Em Contato') {
        return isInativo
            ? `${nomeAluno}, a Pratique mudou e melhorou muito o atendimento! Queremos que você volte para conhecer nossa nova estrutura. 🚀\n\nLiberamos um DAY USE de 3 dias para você testar tudo na prática.\n\nE agora o nosso plano está super simples e fácil de voltar:\n✅ ZERO taxa de matrícula\n✅ SEM fidelidade\n✅ NÃO ocupa o limite do seu cartão\n\nBora treinar hoje?`
            : `${nomeAluno}, Vem pra PRATIQUE!\n\nVOCÊ GANHOU UM DAY USE DE 3 DIAS\n\n🏋️‍♂️ 3 dias grátis para TREINAR\n📊 01 Exame de Bioimpedância\n💪 01 Montagem de treino \n✅ Frequência premiada\n\n🚫 Sem pegadinha, só vir treinar!`;
    } 
    else if (lead.status === 'Day Use (3 Dias)') {
        return isInativo
            ? `E aí ${nomeAluno}, o que achou das melhorias na nossa estrutura e no atendimento? Bora oficializar esse retorno?`
            : `E aí ${nomeAluno}, curtindo os treinos? O que está achando da nossa estrutura?`;
    } 
    else if (lead.status === 'Fechado') {
        return isInativo
            ? `Que bom ter você de volta, ${nomeAluno}! A família Pratique estava com saudades de ver você quebrando tudo nos treinos!`
            : `Parabéns ${nomeAluno}, seja muito bem-vindo(a) à família Pratique! Que bom ter você com a gente!`;
    } 
    else if (lead.status === 'Perdido') {
        return `Poxa ${nomeAluno}, que pena! Mas nossas portas estão sempre abertas para quando você quiser focar na sua saúde. Um abraço de toda a equipe!`;
    }
    
    return `Olá ${nomeAluno}, tudo bem?`;
};

// Configurações Globais do Funil
export const COLUNAS = ['Novo', 'Em Contato', 'Day Use (3 Dias)', 'Fechado', 'Perdido'];

export const STATUS_TOKENS = {
    'Novo': { border: 'border-blue-200', text: 'text-blue-700', bg: 'bg-blue-50/50', accent: 'bg-blue-500', hex: '#3b82f6', icone: 'star' },
    'Em Contato': { border: 'border-amber-200', text: 'text-amber-700', bg: 'bg-amber-50/50', accent: 'bg-amber-500', hex: '#f59e0b', icone: 'phone-forwarded' },
    'Day Use (3 Dias)': { border: 'border-purple-200', text: 'text-purple-700', bg: 'bg-purple-50/50', accent: 'bg-purple-500', hex: '#a855f7', icone: 'ticket' },
    'Fechado': { border: 'border-emerald-200', text: 'text-emerald-700', bg: 'bg-emerald-50/50', accent: 'bg-emerald-500', hex: '#10b981', icone: 'check-circle' },
    'Perdido': { border: 'border-rose-200', text: 'text-rose-700', bg: 'bg-rose-50/50', accent: 'bg-rose-500', hex: '#f43f5e', icone: 'x-circle' }
};