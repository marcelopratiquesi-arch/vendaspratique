// Telefone que dá para usar no CRM (27/11/2026, decisão do dono: impedir telefone estragado).
// Havia "SANTA INES II", CPF e número de preenchimento no lugar do telefone.
// A MESMA regra está no SQL sql/2026-11-27-telefones (função crm_telefone_utilizavel): mudou aqui, mudar lá.
import { telefoneSem55, telefoneFalso } from '../CadastroGeral/utilsAlunos.js';

export const telefoneUtilizavel = (telefone) => {
    const texto = String(telefone || '').trim();
    if (/[a-zA-ZÀ-ÿ]/.test(texto)) return false;          // nome da unidade ou outro texto
    if (/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(texto)) return false; // CPF com pontos
    const numero = telefoneSem55(texto);
    if (numero.length !== 10 && numero.length !== 11) return false; // DDD + número
    if (numero.length === 11 && numero[2] !== '9') return false;    // celular tem 9 depois do DDD (11 números sem ele costuma ser CPF)
    return !telefoneFalso(numero);
};
