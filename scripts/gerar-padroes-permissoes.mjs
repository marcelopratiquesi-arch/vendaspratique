// Gera o bloco SQL com o PADRÃO de cada permissão (tabela permissoes_padrao do banco), a partir do catálogo
// src/permissoes/catalogoPermissoes.js — assim o banco e as telas seguem a mesma lista.
// Rodar: node scripts/gerar-padroes-permissoes.mjs   (copiar a saída para o SQL, se o catálogo mudar)
// O teste (node scripts/teste-permissoes.mjs) avisa se o SQL ficou diferente do catálogo.
import { CATALOGO_PERMISSOES } from '../src/permissoes/catalogoPermissoes.js';

const lista = (arr) => (arr && arr.length ? `array[${arr.map(x => `'${x}'`).join(', ')}]` : 'null');

export const linhasPadraoSql = () => CATALOGO_PERMISSOES.map(p =>
    `  ('${p.codigo}', ${lista(p.padrao)}, ${p.travada ? 'true' : 'false'}, ${p.rede ? 'true' : 'false'}, ${lista(p.mudavelPara)})`
).join(',\n');

if (String(process.argv[1] || '').replace(/\\/g, '/').endsWith('gerar-padroes-permissoes.mjs')) {
    console.log(linhasPadraoSql() + ';');
}
