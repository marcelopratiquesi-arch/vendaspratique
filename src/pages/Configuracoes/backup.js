// ==========================================
// BACKUP (Configurações → Backup, só o Admin; decisão do dono, 19/11/2026)
// Para quando o projeto voltar ao plano grátis do Supabase (que não faz cópia diária sozinho).
//
// - Cópia dos DADOS: lê tabela por tabela (de 1.000 em 1.000, sem corte) e baixa UM arquivo compactado
//   `backup-pratique-AAAA-MM-DD.json.gz`. Inclui o HISTÓRICO (auditoria de vendas/lixeira, cadastros, acessos,
//   permissões), decisão do dono. Tabela que o banco não deixa ler aparece como erro (nunca esconde).
// - Cópia dos ARQUIVOS (fotos e PDFs dos exames, imagens/PDFs/vídeos dos Comunicados): só os novos desde a última
//   cópia de arquivos, em partes de até ~50 MB (`backup-pratique-arquivos-AAAA-MM-DD-parte-N.json.gz`).
// - Conferir um arquivo: abre o arquivo no computador e compara as linhas com o banco de hoje (só contagem).
// - NÃO restaura nada (vendas são intocáveis, regra 12): restaurar é feito à parte, com cópia e conferência.
// - Não guarda a estrutura do banco (funções, regras de acesso, travas): isso é a cópia completa mensal (pg_dump).
// Cada cópia baixa o banco inteiro e conta no Egress do Supabase (~140 MB em 19/11/2026): uma por semana.
// Histórico das cópias: tabela `backups_log` (sql/2026-11-19-backup). Sem ela, a cópia funciona e a tela avisa.
// ==========================================
import { supabase } from '../../supabaseClient.js';

// Tabelas do dia a dia (o que o sistema usa)
export const TABELAS_PRINCIPAIS = [
    'vendas', 'alunos', 'alunos_unidades', 'catalogo', 'catalogo_grupos', 'colaboradores', 'unidades', 'setores',
    'usuarios_sistema', 'mentor_unidades', 'metas_unidades', 'unidades_sem_personal', 'movimento_diario',
    'meta_produtos_pessoa', 'comissoes_pagamentos', 'vendas_duplicidade_legitima',
    'avaliacoes_realizadas', 'avaliacao_perguntas', 'comunicados', 'comunicado_inbox',
    'leads', 'historico_leads', 'crm_contatos_feitos', 'crm_mensagens_prontas', 'crm_migracao', 'crm_nao_contatar',
    'crm_resgate', 'crm_resultados_contato', 'relatorios_fechamento_envios', 'relatorios_fechamento_conferencia',
    'permissoes_papel', 'permissoes_excecao', 'permissoes_padrao', 'sistema_config',
    'acessos_temporarios', 'lideres_historico', 'acesso_solicitacoes'
];

// Histórico (quem fez o quê): auditoria e lixeira das vendas, cadastros, avaliações apagadas, acessos, permissões
export const TABELAS_HISTORICO = [
    'vendas_auditoria', 'auditoria_cadastros', 'avaliacoes_lixeira', 'acessos_log', 'acesso_alertas',
    'permissoes_log', 'mentor_unidades_log', 'backups_log'
];

export const TODAS_TABELAS_BACKUP = [...TABELAS_PRINCIPAIS, ...TABELAS_HISTORICO];

// Pastas de arquivos (Storage) que entram na cópia de arquivos
export const PASTAS_ARQUIVOS = ['exames_inbody', 'comunicados-media'];

export const DIAS_AVISO_BACKUP = 7;        // depois disso: amarelo e aviso ao entrar
export const DIAS_BACKUP_VERMELHO = 15;    // a partir disso: vermelho
const POR_PAGINA = 1000;
const PAGINAS_JUNTAS = 4;
const TAMANHO_PARTE_ARQUIVOS = 50 * 1024 * 1024;

// ---------- Situação da última cópia ----------
/** { dias, nivel: 'nunca' | 'ok' | 'atencao' | 'atrasado' } */
export const situacaoBackup = (ultimaIso, agora = new Date()) => {
    if (!ultimaIso) return { dias: null, nivel: 'nunca' };
    const dias = Math.floor((agora.getTime() - Date.parse(ultimaIso)) / 86400000);
    if (!Number.isFinite(dias)) return { dias: null, nivel: 'nunca' };
    if (dias >= DIAS_BACKUP_VERMELHO) return { dias, nivel: 'atrasado' };
    if (dias > DIAS_AVISO_BACKUP) return { dias, nivel: 'atencao' };
    return { dias, nivel: 'ok' };
};
export const precisaAvisarBackup = (ultimaIso, agora = new Date()) => {
    const s = situacaoBackup(ultimaIso, agora);
    return s.nivel === 'nunca' || s.nivel === 'atencao' || s.nivel === 'atrasado';
};

export const formatarTamanho = (bytes) => {
    const n = Number(bytes) || 0;
    if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
    if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    if (n >= 1024) return `${Math.round(n / 1024)} KB`;
    return `${n} B`;
};

const hojeIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---------- Pedido para abrir a aba Backup (vindo do aviso ao entrar) ----------
export const EVENTO_ABRIR_BACKUP = 'pratique:abrir-backup';
let pedidoAbrirBackup = false;
export const pedirAbaBackup = () => {
    pedidoAbrirBackup = true;
    try { window.dispatchEvent(new Event(EVENTO_ABRIR_BACKUP)); } catch { /* sem janela */ }
};
export const consumirPedidoBackup = () => { const p = pedidoAbrirBackup; pedidoAbrirBackup = false; return p; };

// ---------- Ler uma tabela inteira ----------
const tabelaNaoExiste = (erro) => erro?.code === '42P01' || erro?.code === 'PGRST205' || /does not exist|could not find the table/i.test(erro?.message || '');
const semColunaId = (erro) => erro?.code === '42703' || /column .*id.* does not exist/i.test(erro?.message || '');

/**
 * Lê todas as linhas de uma tabela. Ordena pelo `id` quando a tabela tem (para não pular nem repetir linha
 * entre as páginas). Devolve { linhas, erro, aviso }.
 */
export const lerTabelaInteira = async (tabela, aoProgresso) => {
    let ordenarPorId = true;
    const montar = (comTotal) => {
        let q = supabase.from(tabela).select('*', comTotal ? { count: 'exact' } : undefined);
        if (ordenarPorId) q = q.order('id', { ascending: true });
        return q;
    };
    let primeira = await montar(true).range(0, POR_PAGINA - 1);
    if (primeira.error && semColunaId(primeira.error)) {
        ordenarPorId = false;
        primeira = await montar(true).range(0, POR_PAGINA - 1);
    }
    if (primeira.error) {
        return { linhas: null, erro: tabelaNaoExiste(primeira.error) ? 'não existe no banco' : (primeira.error.message || 'erro ao ler') };
    }
    let linhas = primeira.data || [];
    const total = Number.isFinite(primeira.count) ? primeira.count : null;
    aoProgresso?.(linhas.length, total);
    if (linhas.length < POR_PAGINA) return { linhas, erro: null };

    const paginas = total ? Math.ceil(total / POR_PAGINA) : null;
    for (let p = 1; paginas === null || p < paginas; p += PAGINAS_JUNTAS) {
        const lote = [];
        for (let k = p; k < p + PAGINAS_JUNTAS && (paginas === null || k < paginas); k++) {
            lote.push(montar(false).range(k * POR_PAGINA, k * POR_PAGINA + POR_PAGINA - 1));
        }
        const respostas = await Promise.all(lote);
        let acabou = false;
        for (const r of respostas) {
            if (r.error) return { linhas: null, erro: r.error.message || 'erro ao ler' };
            linhas = linhas.concat(r.data || []);
            if (!r.data || r.data.length < POR_PAGINA) acabou = true;
        }
        aoProgresso?.(linhas.length, total);
        if (acabou) break;
    }
    const aviso = !ordenarPorId && linhas.length > POR_PAGINA ? 'tabela sem número (id): conferir a contagem' : null;
    return { linhas, erro: null, aviso };
};

// ---------- Compactar / descompactar ----------
const compactar = async (partes) => {
    const blob = new Blob(partes, { type: 'application/json' });
    if (typeof CompressionStream === 'undefined') return { blob, gz: false };
    const fluxo = blob.stream().pipeThrough(new CompressionStream('gzip'));
    return { blob: await new Response(fluxo).blob(), gz: true };
};

export const baixarArquivo = (blob, nome) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
};

// ---------- Cópia dos dados ----------
/**
 * Lê todas as tabelas e baixa o arquivo. aoProgresso({ tabela, feitos, total, situacao: 'lendo'|'ok'|'erro' }).
 * Devolve { nome, tamanho, linhas, erros, avisos }.
 */
export const fazerBackupDados = async ({ quem, aoProgresso }) => {
    const criadoEm = new Date().toISOString();
    const linhasPorTabela = {};
    const erros = {};
    const avisos = {};
    const partes = [`{"formato":"pratique-backup","versao":1,"criado_em":${JSON.stringify(criadoEm)},"criado_por":${JSON.stringify(quem || '')},"tabelas":{`];
    let primeira = true;
    for (const tabela of TODAS_TABELAS_BACKUP) {
        aoProgresso?.({ tabela, feitos: 0, total: null, situacao: 'lendo' });
        const r = await lerTabelaInteira(tabela, (feitos, total) => aoProgresso?.({ tabela, feitos, total, situacao: 'lendo' }));
        if (r.erro) {
            erros[tabela] = r.erro;
            aoProgresso?.({ tabela, feitos: 0, total: null, situacao: 'erro', erro: r.erro });
            continue;
        }
        if (r.aviso) avisos[tabela] = r.aviso;
        linhasPorTabela[tabela] = r.linhas.length;
        partes.push(`${primeira ? '' : ','}${JSON.stringify(tabela)}:${JSON.stringify(r.linhas)}`);
        primeira = false;
        aoProgresso?.({ tabela, feitos: r.linhas.length, total: r.linhas.length, situacao: 'ok' });
    }
    partes.push(`},"linhas":${JSON.stringify(linhasPorTabela)},"erros":${JSON.stringify(erros)},"avisos":${JSON.stringify(avisos)}}`);
    const { blob, gz } = await compactar(partes);
    const nome = `backup-pratique-${hojeIso()}.json${gz ? '.gz' : ''}`;
    baixarArquivo(blob, nome);
    return { nome, tamanho: blob.size, linhas: linhasPorTabela, erros, avisos, criadoEm };
};

// ---------- Cópia dos arquivos (fotos e PDFs) ----------
/** Lista todos os arquivos de uma pasta do Storage (entra nas subpastas). */
const listarArquivosDaPasta = async (pasta, prefixo = '') => {
    const achados = [];
    for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.storage.from(pasta).list(prefixo, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
        if (error) throw new Error(`${pasta}: ${error.message}`);
        for (const item of data || []) {
            const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
            if (item.id === null || item.id === undefined) {
                achados.push(...await listarArquivosDaPasta(pasta, caminho)); // é uma subpasta
            } else if (item.name !== '.emptyFolderPlaceholder') {
                achados.push({ pasta, caminho, criado_em: item.created_at || item.updated_at || null, tamanho: Number(item.metadata?.size) || 0, tipo: item.metadata?.mimetype || '' });
            }
        }
        if (!data || data.length < 1000) break;
    }
    return achados;
};

/** Arquivos que entram na próxima cópia (os criados depois de `desdeIso`; sem data = todos). */
export const listarArquivosNovos = async (desdeIso) => {
    const todos = [];
    for (const pasta of PASTAS_ARQUIVOS) todos.push(...await listarArquivosDaPasta(pasta));
    const limite = desdeIso ? Date.parse(desdeIso) : null;
    const novos = limite ? todos.filter(a => !a.criado_em || Date.parse(a.criado_em) > limite) : todos;
    return { arquivos: novos, tamanho: novos.reduce((s, a) => s + a.tamanho, 0) };
};

const blobParaBase64 = (blob) => new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(',')[1] || '');
    leitor.onerror = reject;
    leitor.readAsDataURL(blob);
});

/**
 * Baixa os arquivos e gera partes de até ~50 MB. aoProgresso({ feitos, total }).
 * Devolve { partes: [nomes], tamanho, quantidade, falhas: [caminhos], arquivosAte }.
 */
export const fazerBackupArquivos = async ({ arquivos, aoProgresso }) => {
    const data = hojeIso();
    const nomes = [];
    const falhas = [];
    let tamanhoTotal = 0;
    let parte = 1;
    let atual = [];
    let tamanhoAtual = 0;
    let maisNovo = null;
    const fecharParte = async () => {
        if (!atual.length) return;
        const partes = [`{"formato":"pratique-backup-arquivos","versao":1,"criado_em":${JSON.stringify(new Date().toISOString())},"parte":${parte},"arquivos":[`, atual.join(','), ']}'];
        const { blob, gz } = await compactar(partes);
        const nome = `backup-pratique-arquivos-${data}-parte-${parte}.json${gz ? '.gz' : ''}`;
        baixarArquivo(blob, nome);
        nomes.push(nome);
        tamanhoTotal += blob.size;
        parte += 1;
        atual = [];
        tamanhoAtual = 0;
    };
    for (let i = 0; i < arquivos.length; i++) {
        const a = arquivos[i];
        try {
            const { data: blob, error } = await supabase.storage.from(a.pasta).download(a.caminho);
            if (error || !blob) throw error || new Error('vazio');
            const base64 = await blobParaBase64(blob);
            atual.push(JSON.stringify({ pasta: a.pasta, caminho: a.caminho, tipo: a.tipo || blob.type, criado_em: a.criado_em, base64 }));
            tamanhoAtual += blob.size;
            if (a.criado_em && (!maisNovo || Date.parse(a.criado_em) > Date.parse(maisNovo))) maisNovo = a.criado_em;
        } catch (erro) {
            falhas.push(`${a.pasta}/${a.caminho}`);
            console.warn('Backup: não foi possível baixar o arquivo', a.caminho, erro);
        }
        aoProgresso?.({ feitos: i + 1, total: arquivos.length });
        if (tamanhoAtual >= TAMANHO_PARTE_ARQUIVOS) await fecharParte();
    }
    await fecharParte();
    return { partes: nomes, tamanho: tamanhoTotal, quantidade: arquivos.length - falhas.length, falhas, arquivosAte: maisNovo };
};

// ---------- Histórico das cópias (tabela backups_log) ----------
/** { ok, lista, erro } — ok=false quando a tabela ainda não foi criada (SQL não rodado). */
export const carregarHistoricoBackups = async (limite = 30) => {
    const { data, error } = await supabase.from('backups_log').select('*').order('criado_em', { ascending: false }).limit(limite);
    if (error) return { ok: false, lista: [], erro: error };
    return { ok: true, lista: data || [] };
};

export const registrarBackup = async (registro) => {
    const { error } = await supabase.from('backups_log').insert([registro]);
    if (error) console.warn('Backup feito, mas não foi possível guardar no histórico (rodou o SQL de 19/11/2026?):', error);
    return !error;
};

/** Data da última cópia de dados (ou null). Sem a tabela: { semTabela: true }. */
export const ultimaCopiaDados = async () => {
    const { data, error } = await supabase.from('backups_log').select('criado_em, criado_por_nome').eq('tipo', 'DADOS').order('criado_em', { ascending: false }).limit(1);
    if (error) return { semTabela: true };
    return { semTabela: false, ultima: data?.[0] || null };
};

// ---------- Conferir um arquivo de backup ----------
/** Lê um arquivo baixado (.json ou .json.gz) e devolve { criado_em, criado_por, linhas, erros } ou lança erro. */
export const lerArquivoBackup = async (arquivo) => {
    let texto;
    const compactado = /\.gz$/i.test(arquivo.name);
    if (compactado) {
        if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não abre arquivo .gz. Use o Chrome atualizado.');
        texto = await new Response(arquivo.stream().pipeThrough(new DecompressionStream('gzip'))).text();
    } else {
        texto = await arquivo.text();
    }
    const dados = JSON.parse(texto);
    if (dados?.formato === 'pratique-backup-arquivos') {
        return { tipo: 'ARQUIVOS', criado_em: dados.criado_em, parte: dados.parte, quantidade: (dados.arquivos || []).length };
    }
    if (dados?.formato !== 'pratique-backup') throw new Error('Este arquivo não é um backup do sistema.');
    const linhas = dados.linhas || Object.fromEntries(Object.entries(dados.tabelas || {}).map(([t, l]) => [t, (l || []).length]));
    return { tipo: 'DADOS', criado_em: dados.criado_em, criado_por: dados.criado_por, linhas, erros: dados.erros || {} };
};

/** Quantas linhas cada tabela tem hoje no banco (só contagem, não baixa as linhas). */
export const contarLinhasHoje = async (tabelas) => {
    const resultado = {};
    await Promise.all(tabelas.map(async (t) => {
        const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
        resultado[t] = error ? null : count;
    }));
    return resultado;
};
