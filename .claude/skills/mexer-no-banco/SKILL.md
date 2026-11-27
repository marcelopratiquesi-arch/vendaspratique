---
name: mexer-no-banco
description: Passo a passo seguro para qualquer mudança no banco Supabase do sistema de vendas (SQL, índices, travas, correção em massa). Use antes de escrever ou pedir para rodar qualquer SQL.
---

# Mexer no banco com segurança

Quem roda o SQL é o dono, no SQL Editor, depois do "pode fazer" (regras 3 e 12 do CLAUDE.md).

1. **Pasta** `sql/AAAA-MM-DD-assunto/` com passos numerados e `9_desfazer.sql`. Cada arquivo diz no topo o que faz e se mexe em dados.
2. **Cópia de segurança antes** de mudar dados, sempre com `enable row level security` na tabela de cópia (senão ela fica aberta pela chave pública).
3. **Prévia antes de mudar muita coisa:** quantas linhas, de que tipo. O dono vê o número antes.
4. **Conferência no fim:** antes (cópia) x agora. Em vendas: totais por unidade e por vendedor. O SQL Editor mostra só o último resultado.
5. **Testar o SQL antes de entregar** num Postgres em memória (`@electric-sql/pglite`, instalado no scratchpad), com um esquema de mentira parecido. Em 27/11/2026 isso achou um erro que falharia no banco real.
6. Sem tabela temporária (o SQL Editor pode rodar comandos separados). `x = any((select f())::text[])`.
7. **Banco lento ou travado:** um comando por vez.
8. **Muitas linhas de uma vez:** avisar o dono; o tempo real faz as telas abertas recarregarem.
9. **Código funciona com e sem o SQL**, e a tela avisa quando falta.
10. Depois que o dono rodar: conferir o print e registrar no CLAUDE.md o que foi rodado.
