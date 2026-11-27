---
name: publicar
description: Testar e publicar o sistema de vendas (push no main, a Vercel publica sozinha). Use somente quando o dono pedir para publicar ou subir para o GitHub.
---

# Publicar

Só quando o dono mandar. **Quem decide o momento é ele** (não propor regra de horário).

1. `git fetch` e `git status -sb`: ver se há algo de outra conversa que iria junto. Se houver, avisar antes.
2. `npm run build` (precisa terminar com "built").
3. `npm run lint` (o comando é o oxlint): nenhum erro e nenhum aviso novo (comparar com antes pelo `git stash -u`).
4. Todos os testes: `for t in scripts/teste-*.mjs; do node "$t"; done`.
5. Mudança visual: abrir com `npm run dev` e conferir. Se não der (precisa de login), dizer que a tela não foi conferida.
6. Commit só com os arquivos da tarefa (nunca segredos) e `git push origin main`.
7. Conferir que o site publicado trocou de versão (arquivo `/assets/index-XXXX.js` do `/index.html`), quando o código mudou.
8. Contar ao dono: o que mudou, o que falhou, o que ficou sem testar e qual SQL falta rodar.
