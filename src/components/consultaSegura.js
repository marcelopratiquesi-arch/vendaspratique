import { supabase } from '../supabaseClient.js';

// Chama uma consulta segura do Supabase (função que enxerga outras unidades só no que a tela precisa,
// ex.: compras do aluno em toda a rede). Se ela não existir ou falhar, faz a busca direta de antes
// e avisa no console — assim a tela nunca fica vazia por falta do SQL.
export const consultaSeguraOuDireta = async (nomeFuncao, parametros, buscaDireta) => {
    const res = await supabase.rpc(nomeFuncao, parametros);
    if (!res.error) return res;
    console.warn(`Consulta segura ${nomeFuncao} indisponível; usando a busca direta:`, res.error.message || res.error);
    return buscaDireta();
};
