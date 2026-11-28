// Telefone que dá para usar no CRM (27/11/2026, decisão do dono: impedir telefone estragado).
// Havia "SANTA INES II", CPF e número de preenchimento no lugar do telefone.
// A MESMA regra está no SQL sql/2026-11-27-telefones (função crm_telefone_utilizavel): mudou aqui, mudar lá.
import { telefoneSem55, telefoneFalso, validarCPF } from '../CadastroGeral/utilsAlunos.js';

export const telefoneUtilizavel = (telefone) => {
    const texto = String(telefone || '').trim();
    if (/[a-zA-ZÀ-ÿ]/.test(texto)) return false;          // nome da unidade ou outro texto
    if (/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(texto)) return false; // CPF com pontos
    const numero = telefoneSem55(texto);
    if (numero.length !== 10 && numero.length !== 11) return false; // DDD + número
    if (numero.length === 11 && numero[2] !== '9') return false;    // celular tem 9 depois do DDD (11 números sem ele costuma ser CPF)
    return !telefoneFalso(numero);
};

// ==========================================
// NÚMERO SUGERIDO para um contato com telefone errado (27/11/2026, decisão do dono 3-A).
// A MESMA regra está no SQL (função crm_telefone_sugerido): mudou aqui, mudar lá.
//   1) dois ou mais telefones no mesmo campo -> o primeiro celular que dá para usar (senão o primeiro fixo)
//   2) celular guardado no campo CPF (e que NÃO é um CPF de verdade) -> esse número
// ==========================================
const SEPARADOR_DE_TELEFONES = /\s+-\s+|\s*[/;|,]\s*|\s+ou\s+/i;
const celularNoCampoCpf = (cpf) => {
    const texto = String(cpf || '').trim();
    if (/[a-zA-ZÀ-ÿ]/.test(texto)) return null;
    const numero = telefoneSem55(texto);
    return /^[1-9][1-9]9\d{8}$/.test(numero) && telefoneUtilizavel(numero) && !validarCPF(numero) ? numero : null;
};

export const sugerirTelefone = (contato) => {
    const pedacos = String(contato?.telefone || '').split(SEPARADOR_DE_TELEFONES).filter(Boolean);
    if (pedacos.length > 1) {
        const bons = pedacos.filter(telefoneUtilizavel).map(telefoneSem55);
        const escolhido = bons.find(n => n.length === 11) || bons[0];
        if (escolhido) return { numero: escolhido, origem: 'DOIS_NUMEROS' };
    }
    const doCpf = celularNoCampoCpf(contato?.cpf);
    return doCpf ? { numero: doCpf, origem: 'CAMPO_CPF' } : null;
};

// Contato que não dá para ligar nem mandar WhatsApp
export const numeroErrado = (contato) => !telefoneUtilizavel(contato?.telefone);
