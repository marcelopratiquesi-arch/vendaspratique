---
name: checkup-sistema
description: Check-up do sistema de vendas e do banco Supabase (velocidade, memória, cota de disco, avisos). Use quando o dono pedir "check-up", "o banco vai estourar?", "o sistema está lento", "caiu" ou "dá uma olhada no Supabase".
---

# Check-up do sistema

Tudo só de leitura. Nada é alterado sem o "pode fazer" do dono. Responder em português simples.

## 1. Testar de fora (fazer sozinho)
Com a chave PÚBLICA de `src/supabaseClient.js` (`supabaseAnonKey`), 3 vezes, com `curl -m 30`:
- `https://<projeto>.supabase.co/rest/v1/unidades?select=nome&limit=1` (banco)
- `https://<projeto>.supabase.co/auth/v1/health` (login)

Bom: menos de 1 s. Atenção: 1 a 3 s. Ruim: mais de 3 s, 503 ou sem resposta. Às 7h quase ninguém usa: não prova o horário de movimento.

## 2. Pedir ao dono (dizer onde clicar)
1. **Observability → Overview** e **Database**, em "Last 24 hours", no horário de movimento.
2. Se houver faixa laranja no topo, print dela.
3. Uma vez por semana: **Advisors → Performance** e **Security** → Warnings → **Export**.

## 3. Como ler (computador Micro, referência de 27/11/2026)
| O que | Bom | Olhar |
|---|---|---|
| Disk IO Balance | estável ou alto | caindo ao longo do dia |
| Swap (memória usando o disco; RAM = 434 MB) | perto de 350 MB | voltando para ~700 MB (como antes da queda de 26/11) |
| CPU | abaixo de 50% | alto por muito tempo |
| Conexões | bem abaixo de 60 | perto de 60 |
| Disco usado | abaixo de 70% | acima disso |

Swap alto + cota caindo no movimento: apresentar o upgrade para o Small como decisão (conferir preço na tela). Quem clica e paga é o dono.

## 4. Se estiver lento ou fora
Um comando por vez no SQL Editor (arquivo inteiro com o banco travado dá "connection timeout").
1. `pg_stat_activity` (o que está rodando).
2. `pg_statio_user_tables` + `pg_stat_user_tables` (`seq_scan` alto em tabela grande = provável índice faltando). Cache 100% NÃO descarta problema de memória: olhar o swap.
3. `pg_stat_statements` ordenado por `total_exec_time` (zerado pela última vez em 26/11/2026 22h53; reset só com OK do dono).
Reiniciar não devolve cota de disco.

## 5. Resposta
Começar com **Bom / Atenção / Ruim**, depois a tabela, o que não deu para verificar e o próximo passo.
Histórico do caso: memória `queda-disk-io-26-11`.
