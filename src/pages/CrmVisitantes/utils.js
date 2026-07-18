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

export const gerarTextoWhatsApp = (lead) => {
    const nomeAluno = lead.nome ? lead.nome.trim().split(' ')[0] : 'Aluno';
    let mensagem = `Olá ${nomeAluno}, tudo bem?`;

    if (lead.status === 'Novo') {
        mensagem = `Olá ${nomeAluno}, tudo bem?`;
    } 
    else if (lead.status === 'Em Contato') {
        mensagem = `${nomeAluno}, Vem pra PRATIQUE!\n\nVOCÊ GANHOU UM DAY USE DE 3 DIAS\n\n🏋️‍♂️ 3 dias grátis para TREINAR\n📊 01 Exame de Bioimpedância\n💪 01 Montagem de treino \n✅Frequência premiada\n\n🚫 Sem pegadinha, só vir treinar`;
    } 
    else if (lead.status === 'Day Use (3 Dias)') {
        mensagem = `E aí ${nomeAluno}, curtindo os treinos? ...`;
    } 
    else if (lead.status === 'Fechado') {
        mensagem = `Parabéns ${nomeAluno}, seja muito bem-vindo(a) à família Pratique! Que bom ter você com a gente!`;
    } 
    else if (lead.status === 'Perdido') {
        mensagem = `Poxa ${nomeAluno}, que pena! Mas nossas portas estão sempre abertas para quando você quiser focar na sua saúde. Um abraço!`;
    }
    return mensagem;
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