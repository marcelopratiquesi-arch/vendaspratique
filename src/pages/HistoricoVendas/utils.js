import { avisar } from '../../components/avisar.js';
import { tx, localeAtual } from '../../i18n/traduzir.js';
// ==========================================
// 🧠 UTILITÁRIOS GLOBAIS DE SISTEMA (B2B SaaS)
// Otimizado para Performance e Segurança
// ==========================================

export const safeNumber = (val) => {
    if (typeof val === 'number') return val;
    if (val === null || val === undefined || val === '') return 0;
    
    const str = String(val).trim();
    if (str.includes(',')) {
        // Brasileiro: 1.000,50 -> 1000.50
        return parseFloat(str.replace(/[^0-9,-]+/g, '').replace(',', '.')) || 0;
    }
    // Americano / Default: 1000.50 -> 1000.50
    return parseFloat(str.replace(/[^0-9.-]+/g, '')) || 0;
};

// 🔥 BLINDAGEM DE DATAS (O Bug Catcher)
export const safeIsoDate = (dInput) => {
    if (!dInput) return '';

    // Se receber um Objeto Date nativo (O causador do bug de exportação)
    if (dInput instanceof Date && !isNaN(dInput)) {
        const year = dInput.getFullYear();
        const month = String(dInput.getMonth() + 1).padStart(2, '0');
        const day = String(dInput.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    const dStr = String(dInput);
    if (dStr.includes('T')) return dStr.split('T')[0]; 
    if (dStr.includes('/')) {
        // Assume formato Brasileiro (DD/MM/YYYY)
        const partes = dStr.split('/');
        if(partes.length === 3) {
            const [d, m, y] = partes;
            return `${y}-${m}-${d}`; 
        }
    }
    return dStr;
};

// 🔥 PERFORMANCE: um formatador por idioma, guardado na memória (Cache). O valor é sempre em R$.
const brlFormatters = {};
const brlFormatter = { format: (n) => (brlFormatters[localeAtual()] ||= new Intl.NumberFormat(localeAtual(), { style: 'currency', currency: 'BRL' })).format(n) };

export const formatMoney = (val) => {
    return brlFormatter.format(safeNumber(val));
};

export const formatDataBR = (dInput) => {
    if (!dInput) return '';
    
    const dStr = String(dInput);
    if (dStr.includes('/')) return dStr; // Já está no formato
    
    const partes = dStr.split('-');
    if (partes.length === 3) {
        // Ignora a hora caso venha junto com o traceço
        const day = partes[2].split('T')[0].split(' ')[0];
        return `${day}/${partes[1]}/${partes[0]}`;
    }
    return dStr;
};

export const extrairHoraCriacao = (isoString, comSegundos = false) => {
    if (!isoString) return '';
    const dataObj = new Date(isoString);
    // Valida se a conversão do Date falhou
    if (isNaN(dataObj)) return '';
    // Com segundos: usado na aba Duplicidades para enxergar clique duplo
    return dataObj.toLocaleTimeString(localeAtual(), comSegundos
        ? { hour: '2-digit', minute: '2-digit', second: '2-digit' }
        : { hour: '2-digit', minute: '2-digit' });
};

export const toTitleCase = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.toLowerCase().replace(/(?:^|\s)\w/g, match => match.toUpperCase());
};

// 🔥 NORMALIZAÇÃO RIGOROSA PARA COMPARAR COM O CATÁLOGO
export const normalizeString = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
};

// 🔥 FORMATAÇÃO VISUAL DO CPF
export const formatarCPF = (cpf) => {
    if (!cpf) return 'Não informado';
    const nums = String(cpf).replace(/\D/g, '');
    if (nums.length === 11) return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    return cpf;
};

// Transformação de Array do Catálogo em Dicionário O(1) de alta performance
export const buildCatalogoMap = (catalogoArray) => {
    const map = new Map();
    if (!Array.isArray(catalogoArray)) return map;

    catalogoArray.forEach(item => {
        if (item && item.nome && typeof item.nome === 'string') {
            // Usando a normalização nova para garantir o match perfeito
            map.set(normalizeString(item.nome), item);
        }
    });
    return map;
};

// ==========================================
// 🚨 MOTOR DE AUDITORIA (DUPLICIDADES) — decisão do dono (29/10/2026)
// Venda COM CPF: chave = UNIDADE | DIA | CPF | PRODUTO (o aluno é reconhecido só pelo CPF).
// Venda SEM CPF completo (as antigas, até 09/09/2026): REGRA ANTIGA, só entre elas —
// "SEMCPF" | UNIDADE | DIA | MAT_matrícula (como está escrita) ou NOME_nome | PRODUTO.
// Sem CPF, sem matrícula e sem nome: devolve null (não entra em grupo nenhum).
// ==========================================
export const PREFIXO_REGRA_ANTIGA = 'SEMCPF|';
export const cpfDaVenda = (venda) => {
    const digitos = String(venda?.cpf || venda?.cpf_aluno || '').replace(/\D/g, '');
    return digitos.length === 11 ? digitos : '';
};

export const gerarChaveDuplicidade = (venda) => {
    if (!venda) return null;

    const unidade = normalizeString(String(venda.unidade || '')).replace(/[\s.]+/g, '');
    const dataVenda = safeIsoDate(venda.data || venda.created_at);
    const produto = normalizeString(String(venda.produto || '')).replace(/\s+/g, ' ');

    const cpf = cpfDaVenda(venda);
    if (cpf) return `${unidade}|${dataVenda}|${cpf}|${produto}`;

    // Regra antiga (sem CPF)
    const matricula = String(venda.matricula ?? '').trim();
    const nome = normalizeString(String(venda.nome_aluno || venda.nome || '')).replace(/\s+/g, ' ');
    const aluno = matricula ? `MAT_${matricula}` : (nome ? `NOME_${nome}` : '');
    if (!aluno) return null;
    return `${PREFIXO_REGRA_ANTIGA}${unidade}|${dataVenda}|${aluno}|${produto}`;
};

export const meses = [
    { val: 'TODOS', label: 'Todos os Meses' }, 
    { val: '01', label: '01 - Janeiro' }, 
    { val: '02', label: '02 - Fevereiro' },
    { val: '03', label: '03 - Março' }, 
    { val: '04', label: '04 - Abril' }, 
    { val: '05', label: '05 - Maio' },
    { val: '06', label: '06 - Junho' }, 
    { val: '07', label: '07 - Julho' }, 
    { val: '08', label: '08 - Agosto' },
    { val: '09', label: '09 - Setembro' }, 
    { val: '10', label: '10 - Outubro' }, 
    { val: '11', label: '11 - Novembro' },
    { val: '12', label: '12 - Dezembro' }
];

// ==========================================
// EXCLUSÃO DE VENDA (lixeira com motivo)
// A venda é apagada pela função segura "excluir_venda" do banco: Admin e Mentor (qualquer unidade) ou
// Líder (só a unidade dele). Ela guarda a venda inteira na lixeira (vendas_auditoria) com quem
// apagou, quando e o motivo; Admin e Mentor restauram pela aba Lixeira. O banco não aceita apagar venda direto.
// ==========================================
export const MOTIVO_EXCLUSAO_MINIMO = 5;

// Pergunta o motivo. Devolve o texto, ou null se a pessoa cancelou ou não escreveu o suficiente.
export const pedirMotivoExclusao = () => {
    const resposta = window.prompt(tx("Excluir esta venda?\n\nA venda vai para a LIXEIRA (o Admin ou o Mentor pode restaurar), com o seu nome e a data.\n\nEscreva o MOTIVO da exclusão (ex.: \"lançada em duplicidade\"):"));
    if (resposta === null) return null;
    const motivo = resposta.trim();
    if (motivo.length < MOTIVO_EXCLUSAO_MINIMO) {
        avisar(tx("Exclusão cancelada: o motivo precisa ter pelo menos {MOTIVO_EXCLUSAO_MINIMO} letras.", { MOTIVO_EXCLUSAO_MINIMO: MOTIVO_EXCLUSAO_MINIMO }));
        return null;
    }
    return motivo;
};

// Itens do catálogo para escolher ao EDITAR uma venda (decisão do dono, 30/10/2026):
// só os ATIVOS + o item que a venda já tem (mesmo desativado ou fora do catálogo), para editar a data ou o
// aluno de uma venda antiga sem ser obrigado a trocar o plano. O item desativado aparece com "(desativado)".
// Usado no Histórico (Registro e Duplicidades) e no Fechamento (janela de edição).
export const itensCatalogoParaEdicao = (catalogo = [], produtoAtual = '') => {
    const atual = String(produtoAtual || '').trim().toUpperCase();
    const mesmoItem = (c) => String(c.nome || '').trim().toUpperCase() === atual;
    const lista = catalogo
        .filter(c => c.ativo !== false || (atual && mesmoItem(c)))
        .map(c => ({ ...c, desativado: c.ativo === false }));
    if (atual && !lista.some(mesmoItem)) lista.unshift({ id: `atual-${atual}`, nome: String(produtoAtual).trim(), desativado: true, foraDoCatalogo: true });
    return lista;
};

// Manda a venda para a lixeira. Devolve o erro (ou null se deu certo).
export const excluirVendaComMotivo = async (supabase, id, motivo) => {
    const { error } = await supabase.rpc('excluir_venda', { p_venda_id: Number(id), p_motivo: motivo });
    return error || null;
};
