import { createClient } from '@supabase/supabase-js';

// A URL do seu banco de dados (Project URL)
const supabaseUrl = 'https://livtoslncxrgvrvwtjpw.supabase.co';

// A sua chave PÚBLICA (Publishable key) - Nunca coloque a Secret Key aqui!
const supabaseAnonKey = 'sb_publishable_rHWR5B0R5enSblJVhn3pLg_XbgEPL1V';

// Cria e exporta a conexão para o resto do aplicativo usar
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Conexão separada, SÓ para criar login novo (Configurações → Acessos).
// Criar login pela conexão principal troca a sessão do navegador para a pessoa nova,
// e aí o Admin deixa de ser Admin no meio da gravação (o banco barra). Esta não guarda sessão nenhuma.
let clienteCriarLogin = null;
export const conexaoParaCriarLogin = () => {
    if (!clienteCriarLogin) {
        clienteCriarLogin = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'pratique-criar-login' }
        });
    }
    return clienteCriarLogin;
};