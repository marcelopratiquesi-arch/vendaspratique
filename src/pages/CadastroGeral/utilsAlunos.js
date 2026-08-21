// ==========================================
// UTILS: ALUNOS, CPF E SMART PASTE (DATA QUALITY ENGINE)
// ==========================================

export const normalizarNumeros = (str) => {
    if (!str) return '';
    return String(str).replace(/\D/g, '');
};

// --- NOME ---
export const normalizarNome = (str) => {
    if (!str) return '';
    return String(str).toUpperCase().trim().replace(/\s+/g, ' '); // Remove espaços duplos
};

// --- CPF ---
export const mascaraCPF = (value) => {
    return normalizarNumeros(value)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1'); 
};

export const validarCPF = (cpf) => {
    const limpo = normalizarNumeros(cpf);
    if (limpo.length !== 11 || /^(\d)\1+$/.test(limpo)) return false;
    let soma = 0; let resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(limpo.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(limpo.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(limpo.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(limpo.substring(10, 11))) return false;
    return true;
};

// --- TELEFONE ---
export const validarTelefone = (tel) => {
    const limpo = normalizarNumeros(tel);
    // Brasil: DDD (2) + Numero (8 ou 9) = 10 ou 11 digitos. Pode ter DDI 55.
    if (limpo.length >= 10 && limpo.length <= 13) return true;
    return false;
};

export const formatarTelefone = (tel) => {
    const limpo = normalizarNumeros(tel);
    if (limpo.length === 11) return limpo.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (limpo.length === 10) return limpo.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    if (limpo.length === 13 && limpo.startsWith('55')) return limpo.replace(/55(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (limpo.length === 12 && limpo.startsWith('55')) return limpo.replace(/55(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return tel; // Retorna original se não bater o formato BR
};

// --- EMAIL ---
export const normalizarEmail = (email) => {
    if (!email) return '';
    return String(email).toLowerCase().trim();
};

export const validarEmail = (email) => {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

// --- DATAS E IDADE ---
export const parseDataBrParaIso = (dataStr) => {
    if (!dataStr) return null;
    const parts = String(dataStr).split('/');
    if (parts.length === 3) {
        let dia = parts[0].trim().padStart(2, '0');
        let mes = parts[1].trim().padStart(2, '0');
        let ano = parts[2].trim();
        if (ano.length === 2) {
            ano = parseInt(ano, 10) > 50 ? '19' + ano : '20' + ano;
        }
        
        // Validação básica de data absurda (Ex: 31/02 ou Ano 9999)
        const anoNum = parseInt(ano, 10);
        const mesNum = parseInt(mes, 10);
        const diaNum = parseInt(dia, 10);
        if (anoNum < 1900 || anoNum > new Date().getFullYear()) return null;
        if (mesNum < 1 || mesNum > 12) return null;
        if (diaNum < 1 || diaNum > 31) return null;
        
        return `${ano}-${mes}-${dia}`;
    }
    if (dataStr.includes('-') && dataStr.length >= 10) {
        return dataStr.substring(0, 10);
    }
    return null;
};

export const calcularIdade = (dataNascimentoIso, dataReferencia = new Date()) => {
    if (!dataNascimentoIso) return null;
    const nasc = new Date(dataNascimentoIso + 'T00:00:00'); // T00:00:00 evita bug de fuso horário voltando 1 dia
    if (isNaN(nasc)) return null;
    
    let idade = dataReferencia.getFullYear() - nasc.getFullYear();
    const mes = dataReferencia.getMonth() - nasc.getMonth();
    
    if (mes < 0 || (mes === 0 && dataReferencia.getDate() < nasc.getDate())) {
        idade--;
    }
    return idade;
};

// ==========================================
// PARSER DO EXCEL (SMART PASTE) - BLINDADO
// ==========================================
export const parseSmartPaste = (rawText) => {
    if (!rawText) return [];
    
    // Quebra por linha, ignorando linhas vazias do Excel
    const lines = rawText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    let startIndex = 0;
    // Mapa padrão caso não tenha cabeçalho na cópia (Matrícula | Nome | Doc | Tel | Email | Nasc)
    let colMap = { matricula: 0, nome: 1, cpf: 2, telefone: 3, email: 4, nascimento: 5 }; 

    const firstLine = lines[0].toUpperCase();
    
    // Auto-identifica se a primeira linha copiada foi o cabeçalho
    if (firstLine.includes('NOME') || firstLine.includes('DOCUMENTO') || firstLine.includes('CPF')) {
        startIndex = 1; // Pula o cabeçalho na importação
        const headers = firstLine.split('\t');
        
        colMap = {
            nome: headers.findIndex(h => h.includes('NOME')),
            cpf: headers.findIndex(h => h.includes('DOCUMENTO') || h.includes('CPF')),
            matricula: headers.findIndex(h => h.includes('MATRÍCULA') || h.includes('MATRICULA') || h.includes('ID')),
            telefone: headers.findIndex(h => h.includes('TELEFONE') || h.includes('CELULAR')),
            email: headers.findIndex(h => h.includes('EMAIL') || h.includes('E-MAIL')),
            nascimento: headers.findIndex(h => h.includes('NASCIMENTO') || h.includes('DATA'))
        };
    }

    const parsedData = [];
    const cpfSet = new Set(); // Para checar duplicatas nativas na própria colagem

    for (let i = startIndex; i < lines.length; i++) {
        const cols = lines[i].split('\t');
        
        // Pega as colunas mapeadas (ou usa fallback numérico padrão se não tiver header)
        const rawCpf = colMap.cpf >= 0 ? cols[colMap.cpf] : cols[2];
        const cleanCpf = normalizarNumeros(rawCpf || '');
        
        const rawNome = colMap.nome >= 0 ? cols[colMap.nome] : cols[1];
        const nome = normalizarNome(rawNome);

        if (!nome && !cleanCpf) continue; // Pula a linha se for puro lixo em branco

        // Extração Bruta
        const matricula = (colMap.matricula >= 0 ? cols[colMap.matricula] : cols[0])?.trim() || '';
        const telBruto = colMap.telefone >= 0 ? cols[colMap.telefone] : cols[3];
        const emailBruto = colMap.email >= 0 ? cols[colMap.email] : cols[4];
        const nascBruto = colMap.nascimento >= 0 ? cols[colMap.nascimento] : cols[5];

        let telefone = normalizarNumeros(telBruto || '');
        let email = normalizarEmail(emailBruto);
        let dataNascimento = parseDataBrParaIso(nascBruto || '');

        let status = 'NOVO';
        let avisos = [];

        // VALIDAÇÕES CRÍTICAS (A linha fica vermelha e bloqueia importação)
        if (!cleanCpf || !validarCPF(cleanCpf)) {
            status = 'CPF INVÁLIDO';
        } else if (cpfSet.has(cleanCpf)) {
            status = 'DUPLICADO NA LISTA';
        }

        if (cleanCpf) cpfSet.add(cleanCpf);

        // VALIDAÇÕES NÃO CRÍTICAS (A linha entra, mas os dados errados são descartados para não sujar o banco)
        if (telefone && !validarTelefone(telefone)) {
            avisos.push('Telefone');
            telefone = ''; 
        }
        if (email && !validarEmail(email)) {
            avisos.push('E-mail');
            email = ''; 
        }
        if (nascBruto && !dataNascimento) {
            avisos.push('Nascimento');
        }

        parsedData.push({
            status,
            avisos, // Mostra badge 🟠 na UI se tiver erros menores
            cpf: cleanCpf,
            cpf_mascarado: mascaraCPF(cleanCpf),
            nome: nome,
            matricula: matricula, // TEXT puro. O zero à esquerda é preservado.
            telefone: telefone,
            telefone_formatado: telefone ? formatarTelefone(telefone) : '',
            email: email,
            data_nascimento: dataNascimento,
            idade: calcularIdade(dataNascimento) // Usado apenas na UI, nunca salvo no banco
        });
    }
    
    return parsedData;
};