// Telefone usado pelo "Não contatar" (27/11/2026, decisão do dono: bloquear também pelo telefone, para a pessoa
// não voltar numa lista nova que venha sem CPF). A MESMA regra existe no banco, na função nc_chave_telefone
// (sql/2026-11-27-nao-contatar): mudou aqui, mudar lá.
import { telefoneSem55, telefoneFalso } from '../CadastroGeral/utilsAlunos.js';

// Chave = DDD + 8 últimos números (o "9" da frente não faz diferença). Vazio = não serve para bloquear
// (sem DDD, incompleto ou número de preenchimento, como 31999999999).
export const chaveTelefoneBloqueio = (telefone) => {
    const numero = telefoneSem55(telefone);
    if (numero.length !== 10 && numero.length !== 11) return '';
    if (telefoneFalso(numero)) return '';
    return numero.slice(0, 2) + numero.slice(-8);
};
