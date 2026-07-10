import { createClient } from '@supabase/supabase-js';

// A URL do seu banco de dados (Project URL)
const supabaseUrl = 'https://livtoslncxrgvrvwtjpw.supabase.co';

// A sua chave PÚBLICA (Publishable key) - Nunca coloque a Secret Key aqui!
const supabaseAnonKey = 'sb_publishable_rHWR5B0R5enSblJVhn3pLg_XbgEPL1V';

// Cria e exporta a conexão para o resto do aplicativo usar
export const supabase = createClient(supabaseUrl, supabaseAnonKey);