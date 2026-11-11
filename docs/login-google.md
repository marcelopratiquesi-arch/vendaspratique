# Login com Google — passo a passo (12/11/2026)

Quem entra com o Google: **Recepção** (e-mail da franquia), **Líder**, **Mentor** e **Admin**.
Tudo é gratuito (Google Cloud e Supabase no plano grátis). Faça uma vez só.

## 1. Google Cloud (criar a "credencial de login")

1. Abra <https://console.cloud.google.com> com a conta Google da Pratique e crie um projeto (ex.: "Pratique Vendas").
2. Menu **APIs e serviços → Tela de permissão OAuth** (OAuth consent screen):
   - Tipo de usuário: **Externo**.
   - Nome do app: `Pratique Vendas`; e-mail de suporte: o da diretoria.
   - Escopos: só os básicos (`email`, `profile`, `openid`). Não precisa pedir revisão do Google.
   - Em **Status de publicação**, clique em **Publicar app** ("Em produção"). Sem isso, só entram 100 contas de teste.
3. Menu **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**.
   - **Origens JavaScript autorizadas**: o endereço do sistema na Vercel (ex.: `https://SEU-SISTEMA.vercel.app`) e `http://localhost:5173` (para testes).
   - **URIs de redirecionamento autorizados**: `https://livtoslncxrgvrvwtjpw.supabase.co/auth/v1/callback`
   - Salve e copie o **ID do cliente** e a **Chave secreta do cliente**.

## 2. Supabase

1. **Authentication → Sign In / Providers → Google**: ligue, cole o ID do cliente e a chave secreta, salve.
2. **Authentication → URL Configuration**:
   - Site URL: o endereço do sistema na Vercel.
   - Redirect URLs: o endereço da Vercel e `http://localhost:5173`.
3. **SQL Editor**: rode, na ordem, `sql/2026-11-12-login-google/0_copia_de_seguranca.sql`, `1_acesso_pessoal.sql` e
   `2_trava_no_banco.sql`, e mande o resultado de cada um para conferência.
4. Ligue o botão do Google: `3_ligar_chaves.sql`, linha **A**.

## 3. Primeiros testes

- **Admin**: entre com o Google usando o MESMO e-mail do login de hoje → entra direto (o Supabase junta as duas formas de entrar).
  Confirme o telefone na janela que aparece.
- **Recepção**: no computador da unidade, entre com o Google no e-mail da franquia → entra direto, sem confirmar nada.
- **Líder novo**: entre com o Google pessoal → preenche nome, telefone e a unidade → o pedido aparece para o Mentor da
  unidade e para o Admin (janela ao entrar + Pendências → Acessos).

## 4. Rotina

- **Aprovar acesso**: Pendências → Acessos (ou a janela ao entrar). O Admin pode corrigir papel e unidade antes de aprovar.
  O Mentor aprova só Líder das unidades dele; Mentor novo só o Admin aprova.
- **Troca de líder**: quando alguém pede para ser Líder de uma unidade que já tem líder, aparece "TROCA DE LÍDER" com
  os dois lado a lado. Ao aprovar, o líder antigo fica **INATIVO** (nada dele é apagado) e vai para o histórico.
- **Alguém não consegue entrar com o Google** (ex.: Neves): aba Acessos → "Todos os logins" → botão **Senha** na linha da
  pessoa → 24 h, 3 dias ou 7 dias (dá para renovar até ela resolver ou pedir acesso com outro e-mail; "Encerrar" corta antes).
  Para 3 e 7 dias, rode uma vez `6_emergencia_ate_7_dias.sql`.
- **Sessão**: Líder, Mentor e Admin saem sozinhos depois de 15 minutos parados (aviso 1 minuto antes) e ao fechar o
  navegador. A Recepção continua com a cortina de 30 minutos.
- **Meus acessos**: ícone de relógio no menu, ao lado de "Sair". "Não fui eu" avisa a diretoria (Pendências → Acessos).

## 5. Virada (desligar o login com senha)

Quando a seção **"Adesão ao login com Google"** (Pendências → Acessos) zerar, rode `3_ligar_chaves.sql` linha **C**.
A partir daí só o Admin (emergência) e quem tiver a liberação de 24 h entram com senha. Para voltar atrás: troque
`'nao'` por `'sim'` na mesma linha.

Emergência total: `9_desfazer.sql` volta o login a como era antes.
