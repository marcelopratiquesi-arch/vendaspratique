// Teste da regra das permissões (Configurações → Permissões, 06/11/2026).
// Rodar: node scripts/teste-permissoes.mjs
import fs from 'fs';
import { temPermissao, CATALOGO_PERMISSOES } from '../src/permissoes/catalogoPermissoes.js';
import { linhasPadraoSql } from './gerar-padroes-permissoes.mjs';

let falhas = 0;
const confere = (nome, obtido, esperado) => {
    if (obtido !== esperado) { falhas++; console.log(`❌ ${nome}: veio ${obtido}, esperado ${esperado}`); }
};

// 1) Sem mudança do Admin, o menu é exatamente o de antes (App.jsx até 06/11/2026)
const MENU_ANTES = {
    '001': ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], '002': ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'],
    '003': ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], '004': ['ADMIN', 'MENTOR', 'LIDER'],
    '005': ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], '006': ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'],
    '007': ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], '008': ['ADMIN', 'MENTOR', 'LIDER'],
    '009': ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], '010': ['ADMIN', 'MENTOR'], '011': ['ADMIN'],
};
for (const [codigo, papeis] of Object.entries(MENU_ANTES)) {
    for (const papel of ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO']) {
        confere(`menu ${codigo} ${papel}`, temPermissao({ codigo, papel }), papeis.includes(papel));
    }
}

// 2) Números únicos e com 3 dígitos
const codigos = CATALOGO_PERMISSOES.map(p => p.codigo);
confere('números únicos', new Set(codigos).size, codigos.length);
confere('3 dígitos', codigos.every(c => /^\d{3}$/.test(c)), true);

// 3) Mudança por nível vale; Admin não perde nada
const regras = new Map([['RECEPCAO|004', true], ['LIDER|302', false], ['MENTOR|011', true]]);
confere('Recepção ganha Fechamento', temPermissao({ codigo: '004', papel: 'RECEPCAO', regrasPapel: regras }), true);
confere('Líder perde Metas', temPermissao({ codigo: '302', papel: 'LIDER', regrasPapel: regras }), false);
confere('Configurações travada (Mentor não ganha)', temPermissao({ codigo: '011', papel: 'MENTOR', regrasPapel: regras }), false);
confere('Admin sempre', temPermissao({ codigo: '302', papel: 'ADMIN', regrasPapel: new Map([['ADMIN|302', false]]) }), true);

// 4) Exceção do login vence o nível
const exc = new Map([['302', true]]);
confere('exceção libera para um login', temPermissao({ codigo: '302', papel: 'LIDER', regrasPapel: regras, excecoes: exc }), true);
confere('exceção bloqueia', temPermissao({ codigo: '005', papel: 'RECEPCAO', excecoes: new Map([['005', false]]) }), false);

// 5) "rede" não liga para Líder/Recepção
confere('Ranking global não liga para Líder', temPermissao({ codigo: '304', papel: 'LIDER', regrasPapel: new Map([['LIDER|304', true]]) }), false);

// 6) Etapa 2: ações
confere('padrão: Recepção não grava metas', temPermissao({ codigo: '307', papel: 'RECEPCAO' }), false);
confere('exceção libera 307 para a Recepção de uma unidade', temPermissao({ codigo: '307', papel: 'RECEPCAO', excecoes: new Map([['307', true]]) }), true);
confere('sem a função do banco, 307 fica no padrão', temPermissao({ codigo: '307', papel: 'RECEPCAO', excecoes: new Map([['307', true]]), bancoPronto: false }), false);
confere('ação só de tela (311) muda mesmo sem a função do banco', temPermissao({ codigo: '311', papel: 'RECEPCAO', excecoes: new Map([['311', true]]), bancoPronto: false }), true);
confere('bloquear excluir venda do Líder', temPermissao({ codigo: '205', papel: 'LIDER', regrasPapel: new Map([['LIDER|205', false]]) }), false);
confere('catálogo (805) travado', temPermissao({ codigo: '805', papel: 'LIDER', excecoes: new Map([['805', true]]) }), false);
confere('restaurar venda (207) travado por enquanto', temPermissao({ codigo: '207', papel: 'LIDER', excecoes: new Map([['207', true]]) }), false);
confere('cobrança do relatório (903) não liga para o Líder', temPermissao({ codigo: '903', papel: 'LIDER', excecoes: new Map([['903', true]]) }), false);
confere('cobrança do relatório (903) desliga para a Recepção', temPermissao({ codigo: '903', papel: 'RECEPCAO', excecoes: new Map([['903', false]]) }), false);
confere('Admin não ganha a janela de cobranças (902)', temPermissao({ codigo: '902', papel: 'ADMIN' }), false);
confere('Monitoramento (310, rede) não liga para Líder', temPermissao({ codigo: '310', papel: 'LIDER', excecoes: new Map([['310', true]]) }), false);

// 7) O padrão gravado no banco (sql/2026-11-06-permissoes-acoes/1_seg_pode.sql) é igual ao catálogo
const sqlPadrao = fs.readFileSync(new URL('../sql/2026-11-06-permissoes-acoes/1_seg_pode.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
confere('SQL do padrão igual ao catálogo (rode node scripts/gerar-padroes-permissoes.mjs)', sqlPadrao.includes(linhasPadraoSql()), true);
confere('número que não existe', temPermissao({ codigo: '999', papel: 'ADMIN' }), false);

console.log(falhas === 0 ? `✅ Todos os testes passaram (${CATALOGO_PERMISSOES.length} permissões no catálogo).` : `❌ ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
