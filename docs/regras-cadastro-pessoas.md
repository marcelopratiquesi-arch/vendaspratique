# Regras de cadastro de pessoas — modelo para levar a outros sistemas

Tirado do cadastro de aluno do Pratique Vendas (janela `src/components/Modals/ModalAluno.jsx`,
regras em `src/pages/CadastroGeral/utilsAlunos.js`, travas do banco descritas na regra 11 do CLAUDE.md).
Versão pronta para outro sistema (ex.: Gestão de Coletivas, cadastro de professores), sem matrícula.

---

## PROMPT: Regras de cadastro de pessoas (professores), sem duplicidade e sem espaços

Quero que o cadastro de professores deste sistema siga as regras abaixo, as mesmas que já usamos no nosso sistema de vendas. Cada professor é reconhecido por **CPF, e-mail e telefone**. Nenhum desses três dados pode se repetir entre duas pessoas. Também não pode ter espaço sobrando, para os dados ficarem corretos e as buscas funcionarem.

### 1. Limpeza antes de salvar (vale para todos os campos)
- Tirar os espaços do começo e do fim.
- Trocar espaço duplo no meio por um espaço só.
- Nome: salvar em MAIÚSCULAS, sem espaço sobrando (ex.: "  joão   da silva " vira "JOÃO DA SILVA").

### 2. CPF
- Obrigatório.
- Guardar no banco **só os números** (11 dígitos, sem ponto nem traço). Na tela ele aparece com a máscara 000.000.000-00.
- Validar os dígitos verificadores pela conta oficial. Recusar CPF com todos os números iguais (111.111.111-11 etc.).
- **Único:** antes de salvar, procurar se o CPF já existe, comparando com e sem máscara. Se existir, bloquear e dizer de quem é: "BLOQUEADO: o CPF 123.456.789-00 já está cadastrado para FULANO. Busque pelo CPF em vez de cadastrar de novo."

### 3. E-mail
- Obrigatório.
- **Não aceitar nenhum espaço** (nem no meio). Se tiver, bloquear com a mensagem: "Remova os espaços em branco do e-mail."
- Guardar em minúsculas.
- Formato válido: texto@texto.texto.
- **Único sem diferenciar maiúsculas** (Joao@Gmail.com = joao@gmail.com).
- Tratar como "e-mail de mentira" e não aceitar como e-mail de verdade: naoinformou@, naoinformado@, naotem@, sememail@, teste@, nao@ etc.

### 4. Telefone
- Obrigatório.
- Bloquear espaço no começo ou no fim, letras e símbolos (só aceitar números, parênteses, "+", "-" e espaço no meio).
- Guardar **só os números** e **sem o 55 do Brasil** na frente ("55 31 99999-8888" é salvo como "31999998888").
- Ter 10 ou 11 números (DDD + número). Menos = "telefone incompleto"; mais = "números demais".
- DDD válido (11 ou mais).
- Recusar número de preenchimento: todos iguais (99999999999) ou DDD + tudo igual (31999999999, 31000000000).
- **Único**, comparando também **com e sem o 9 da frente** (31 9888-7777 = 31 98888-7777) e já sem o 55.
- Conferir enquanto a pessoa digita e avisar na hora: "O telefone X já existe no cadastro."

### 5. Quando conferir
- **Na tela:** ao digitar (aviso na hora) e de novo ao clicar em Salvar (não salva se tiver erro).
- **Ao editar** um cadastro, a conferência ignora a própria pessoa (ela pode manter o CPF, o e-mail e o telefone dela).
- **Na importação de planilha:** as mesmas regras. A linha com CPF, e-mail ou telefone de outra pessoa não é importada e aparece na lista "dado de outra pessoa".
- **No banco de dados (obrigatório):** criar travas de único (índice único) para CPF, para e-mail em minúsculas e para telefone só com números. Assim, nem por outro caminho entra um cadastro repetido.
- **Antes de criar as travas:** fazer uma cópia de segurança da tabela, listar os repetidos que já existem e limpar (juntar a mesma pessoa cadastrada duas vezes). A trava não é criada se ainda houver repetidos.

### 6. Homônimos (nomes iguais)
- Nome igual com CPF, e-mail e telefone diferentes são pessoas diferentes e ficam como estão.
- Nome igual com algum desses dados em comum é a mesma pessoa cadastrada duas vezes e deve ser juntada.

### 7. Mensagens
- Sempre dizer qual campo bloqueou e, no caso de repetido, a quem o dado já pertence.
- Usar aviso na tela, nunca janela de alerta do navegador.

---

## Observações (só para o Pratique Vendas)
- Aqui também existe a regra da **matrícula** (sem espaço, única dentro da unidade, "0123" = "123"); ficou fora do prompt porque o outro sistema não tem matrícula.
- Diferença conhecida (17/11/2026): a trava do banco `alunos_telefone_unico` compara sem o 55, mas a conferência da janela do aluno compara com/sem o 9 e não tira o 55. O prompt pede as duas juntas.
