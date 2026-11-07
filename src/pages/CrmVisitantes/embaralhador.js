// ==========================================
// EMBARALHADOR DE MENSAGENS DO WHATSAPP (decisão do dono, 04/11/2026)
// Cada situação tem VÁRIAS versões do mesmo recado (separadas por uma linha "---").
// Dentro da versão, [Oi|Olá|E aí] sorteia uma das palavras.
// {saudacao} = Bom dia/Boa tarde/Boa noite · {nome} = primeiro nome · {unidade} = unidade.
// A cada clique sai uma mensagem nova, nunca igual à anterior da mesma situação
// (ajuda a não parecer mensagem em massa para o WhatsApp).
// Admin, Líder e Mentor editam pelo botão "Mensagens" (tabela crm_mensagens_prontas, uma linha por situação).
// ==========================================

export const SEPARADOR_VERSOES = '\n---\n';

const v = (...versoes) => versoes.join(SEPARADOR_VERSOES);

// Situações e nomes que aparecem no editor
export const ROTULOS_MENSAGENS = {
    FASE_NOVO_VISITANTE: 'Novo · Visitante / interessado',
    FASE_NOVO_INATIVO: 'Novo · Cancelado / inativo',
    FASE_CONTATO_VISITANTE: 'Em Contato · Visitante / interessado',
    FASE_CONTATO_INATIVO: 'Em Contato · Cancelado / inativo',
    FASE_FECHADO_VISITANTE: 'Fechado · Aluno novo',
    FASE_FECHADO_INATIVO: 'Fechado · Aluno que voltou',
    FASE_PERDIDO: 'Perdido',
    VISITANTE_24H: 'Visitante 24h',
    VISITANTE_48H: 'Visitante 48h',
    ANIVERSARIO: 'Aniversário',
    MIGRACAO: 'Migração (Nutri)',
    VISITANTE_BOAS_VINDAS: 'Boas-vindas (visitante)'
};

export const MENSAGENS_PADRAO = {
    FASE_NOVO_VISITANTE: v(
        '{saudacao}, {nome}! Tudo bem? 😊 Vi que você tem interesse em treinar com a gente aqui na Pratique {unidade}! [Posso te ajudar com alguma dúvida?|Quer que eu te conte como funcionam os nossos planos?]',
        'Oi, {nome}! Aqui é da Pratique {unidade} 💙 Que alegria saber que você quer treinar com a gente! [Qual é o seu objetivo hoje?|Me conta: qual é o seu objetivo?]',
        '{saudacao}, {nome}! [Tudo certo|Tudo bem] por aí? ✨ Recebemos seu interesse na Pratique {unidade} e eu fiquei muito feliz! Posso te mostrar os nossos planos?',
        'Olá, {nome}! 👋 Passando para te dar as boas-vindas da Pratique {unidade}. Temos planos para todos os objetivos: musculação, acompanhamento com nutricionista e personal. [Quer saber mais?|Posso te explicar rapidinho?]',
        'E aí, {nome}, tudo bem? 😄 Vi que você quer começar a treinar e a equipe da Pratique {unidade} está pronta para te receber! Qual o melhor horário para você?',
        '{saudacao}, {nome}! 🌟 Que bom ter seu contato aqui na Pratique {unidade}! Tá uma alegria receber gente nova chegando. [Bora marcar sua visita?|Quer vir conhecer a academia?]',
        'Oi, {nome}! 💪 Aqui é da equipe Pratique {unidade}. Soube que você tem interesse em treinar, e isso já é o primeiro passo! Posso te ajudar a escolher o plano ideal?',
        '{saudacao}, {nome}! Tudo bem com você? 😊 Sou da Pratique {unidade} e quero te ajudar a começar com o pé direito. [Você já treina ou vai começar agora?|Você já treinou antes ou vai ser a primeira vez?]',
        'Olá, {nome}! 🙌 Obrigado pelo interesse na Pratique {unidade}! Nossos alunos estão amando os planos e eu adoraria te apresentar. Tem um minutinho?',
        'Oi, {nome}, tudo joia? ✨ A Pratique {unidade} está de portas abertas para você! Me conta o que você procura e eu te indico o melhor caminho. 😉'
    ),
    FASE_NOVO_INATIVO: v(
        '{saudacao}, {nome}! Sentimos sua falta aqui na Pratique {unidade}! 💙 Tudo bem com você?',
        'Oi, {nome}! 😊 Aqui é da Pratique {unidade}. A academia não é a mesma sem você! Como você está?',
        '{saudacao}, {nome}! Faz um tempinho que a gente não se vê por aqui... [Tá tudo bem?|Como andam as coisas?] 🤗',
        'Olá, {nome}! 👋 Passando para saber como você está. A equipe da Pratique {unidade} lembrou de você com carinho!',
        'E aí, {nome}, tudo bem? 💪 Bateu saudade de te ver treinando aqui na Pratique {unidade}! Como você está?',
        'Oi, {nome}! ✨ A Pratique {unidade} está cheia de novidades e a gente pensou logo em você. Tudo bem por aí?',
        '{saudacao}, {nome}! 😄 Aqui é da Pratique {unidade}. Que saudade! Você está treinando em algum lugar ou deu uma pausa?',
        'Olá, {nome}! 🌟 Seu lugar no treino continua guardado aqui na Pratique {unidade}. Como você está?',
        'Oi, {nome}, tudo joia? 🙌 A turma da Pratique {unidade} perguntou de você! Bora conversar um pouquinho?',
        '{saudacao}, {nome}! 💙 Lembramos de você aqui na Pratique {unidade} e quisemos dar um oi. Está tudo bem?'
    ),
    FASE_CONTATO_VISITANTE: v(
        '{nome}, vem conhecer a PRATIQUE! 💪\n\nAgende sua visita e monte seu treino com a gente.\n\n✅ Sem taxa de matrícula\n✅ Sem fidelidade\n\n[Qual o melhor horário para você vir?|Que dia fica bom para você?]',
        'Oi, {nome}! 😊 Que tal vir treinar com a gente na Pratique {unidade}?\n\n✅ Zero taxa de matrícula\n✅ Sem fidelidade nenhuma\n✅ Equipe pronta para montar seu treino\n\nQual dia fica melhor para você?',
        '{saudacao}, {nome}! ✨ Já pensou em começar essa semana?\n\nNa Pratique {unidade} você:\n✅ Não paga matrícula\n✅ Não tem fidelidade\n✅ Treina com acompanhamento\n\nBora marcar sua visita? 💪',
        '{nome}, tá uma alegria ver a academia cheia de gente nova! 🎉 Vem fazer parte também!\n\n✅ Sem taxa de matrícula\n✅ Sem fidelidade\n\nMe fala o melhor horário que eu já deixo tudo pronto para você. 😉',
        'Oi, {nome}! 💙 Temos planos para todo objetivo: musculação, nutricionista e personal.\n\n✅ Sem taxa de matrícula\n✅ Sem fidelidade\n\nQuer vir conhecer [hoje ou amanhã?|ainda essa semana?]',
        '{saudacao}, {nome}! 🔥 Sua nova rotina de treino começa aqui na Pratique {unidade}!\n\n✅ Matrícula grátis\n✅ Sem fidelidade\n\nQual horário combina mais com você: manhã, tarde ou noite?',
        'E aí, {nome}! 😄 Bora tirar o treino do papel?\n\nNa Pratique é assim:\n✅ Sem taxa de matrícula\n✅ Sem fidelidade\n✅ Treino montado para você\n\nQuando você pode vir?',
        '{nome}, vem sentir a energia da Pratique {unidade}! ⚡\n\nAgende sua visita, conheça a estrutura e monte seu treino com a nossa equipe.\n\n✅ Sem matrícula\n✅ Sem fidelidade\n\nQual o melhor dia para você?',
        'Oi, {nome}! 🏋️ Nossos alunos estão amando os planos da Pratique, e eu quero muito que você conheça também!\n\n✅ Sem taxa de matrícula\n✅ Sem fidelidade\n\nPosso agendar sua visita?',
        '{saudacao}, {nome}! 🌟 Que tal começar a cuidar de você com a gente?\n\n✅ Zero matrícula\n✅ Zero fidelidade\n✅ Muita energia boa\n\nMe conta o melhor horário e eu te espero aqui! 💪'
    ),
    FASE_CONTATO_INATIVO: v(
        '{nome}, a Pratique mudou e melhorou muito o atendimento! Queremos que você volte para conhecer nossa nova estrutura. 🚀\n\nE agora o nosso plano está super simples e fácil de voltar:\n✅ ZERO taxa de matrícula\n✅ SEM fidelidade\n✅ NÃO ocupa o limite do seu cartão\n\nBora treinar hoje?',
        'Oi, {nome}! 😊 Tem muita novidade boa na Pratique {unidade} e a gente quer você de volta!\n\n✅ Sem taxa de matrícula\n✅ Sem fidelidade\n✅ Não ocupa o limite do cartão\n\n[Bora voltar essa semana?|Que tal voltar essa semana?] 💪',
        '{saudacao}, {nome}! 🔥 Voltar a treinar ficou muito mais fácil:\n\n✅ ZERO matrícula\n✅ SEM fidelidade\n✅ NÃO compromete o limite do seu cartão\n\nA equipe da Pratique {unidade} está te esperando! Quando você vem?',
        '{nome}, que saudade! 💙 A Pratique {unidade} está de cara nova, com atendimento ainda melhor.\n\nPara voltar é simples:\n✅ Sem taxa de matrícula\n✅ Sem fidelidade\n✅ Não ocupa o limite do cartão\n\nVamos marcar seu retorno?',
        'E aí, {nome}! 🚀 Bora retomar os treinos?\n\nNossos planos estão uma alegria:\n✅ Matrícula zero\n✅ Sem fidelidade\n✅ Sem ocupar o limite do cartão\n\nMe fala o melhor dia que eu deixo tudo pronto!',
        'Oi, {nome}! ✨ A Pratique {unidade} evoluiu muito e eu queria muito te mostrar.\n\n✅ ZERO taxa de matrícula\n✅ SEM fidelidade\n✅ NÃO ocupa o limite do seu cartão\n\nPosso te esperar [hoje?|amanhã?]',
        '{saudacao}, {nome}! 💪 Seu corpo vai agradecer essa volta!\n\nNa Pratique agora é assim:\n✅ Sem matrícula\n✅ Sem fidelidade\n✅ Não ocupa o limite do cartão\n\nBora voltar com tudo?',
        '{nome}, a família Pratique está com saudade de você! 🤗\n\nPreparamos uma volta bem fácil:\n✅ Taxa de matrícula: zero\n✅ Fidelidade: nenhuma\n✅ Limite do cartão: livre\n\nQual o melhor horário para você?',
        'Oi, {nome}! 🌟 Melhoramos o atendimento, a estrutura e os planos da Pratique {unidade}!\n\n✅ Sem taxa de matrícula\n✅ Sem fidelidade\n✅ Não ocupa o limite do cartão\n\nVem ver de perto? Te espero! 😉',
        '{saudacao}, {nome}! 🎉 Que tal recomeçar com a gente?\n\n✅ ZERO matrícula\n✅ SEM fidelidade\n✅ NÃO ocupa o limite do cartão\n\nA Pratique {unidade} está pronta para o seu retorno. Bora treinar hoje? 💪'
    ),
    FASE_FECHADO_VISITANTE: v(
        'Parabéns, {nome}! 🎉 Seja muito bem-vindo(a) à família Pratique! Que bom ter você com a gente!',
        '{nome}, que alegria ter você na Pratique {unidade}! 💙 Seja muito bem-vindo(a)! Qualquer dúvida, conte com a gente.',
        'Bem-vindo(a) à família Pratique, {nome}! 💪 Agora é foco, treino e resultado. Estamos juntos nessa!',
        'Oi, {nome}! 🥳 Matrícula feita! A equipe da Pratique {unidade} está muito feliz com a sua chegada!',
        '{nome}, você acabou de tomar uma das melhores decisões! 🌟 Seja bem-vindo(a) à Pratique {unidade}!',
        'Parabéns pela escolha, {nome}! 🙌 A Pratique {unidade} é sua casa agora. Bons treinos!',
        'Que notícia boa, {nome}! 🎉 Seja bem-vindo(a)! Tá uma alegria ter você treinando com a gente na Pratique {unidade}.',
        '{nome}, seja muito bem-vindo(a)! 💪 Conte com toda a equipe da Pratique {unidade} para chegar no seu objetivo.',
        'Oi, {nome}! ✨ Agora você faz parte da família Pratique! Estamos aqui para te ajudar em cada treino.',
        'Bem-vindo(a), {nome}! 🔥 Começa agora uma nova fase. A Pratique {unidade} está com você!'
    ),
    FASE_FECHADO_INATIVO: v(
        'Que bom ter você de volta, {nome}! 🎉 A família Pratique estava com saudades de ver você quebrando tudo nos treinos!',
        '{nome}, bem-vindo(a) de volta! 💙 A Pratique {unidade} não era a mesma sem você!',
        'Ebaaa, {nome} voltou! 🥳 Bora retomar com tudo! A equipe da Pratique {unidade} está muito feliz.',
        'Que alegria, {nome}! 💪 Seu retorno à Pratique {unidade} deixou a gente muito feliz. Bons treinos!',
        '{nome}, que bom te ver de novo por aqui! 🌟 Seja bem-vindo(a) de volta à família Pratique!',
        'Bem-vindo(a) de volta, {nome}! 🔥 Agora é recomeçar firme. Conte com a gente!',
        'Oi, {nome}! 🙌 Retorno confirmado! A Pratique {unidade} estava com saudade da sua energia.',
        '{nome}, voltar é sempre uma vitória! 🏆 Seja muito bem-vindo(a) de novo à Pratique {unidade}!',
        'Que notícia boa, {nome}! 🎉 Bem-vindo(a) de volta! Vamos juntos atrás do seu objetivo.',
        '{nome}, a família Pratique está completa de novo! 💙 Que bom ter você de volta!'
    ),
    FASE_PERDIDO: v(
        'Poxa, {nome}, que pena! Mas nossas portas estão sempre abertas para quando você quiser focar na sua saúde. Um abraço de toda a equipe! 💙',
        'Tudo bem, {nome}! 😊 Quando quiser voltar a pensar nos treinos, a Pratique {unidade} estará aqui. Um grande abraço!',
        '{nome}, obrigado pela atenção! 🙏 Se mudar de ideia, é só chamar. Estamos sempre de portas abertas.',
        'Entendemos, {nome}! 💙 Fica o convite: quando for a hora certa, a Pratique {unidade} te espera.',
        'Sem problemas, {nome}! 😉 Qualquer dia que quiser conhecer ou voltar, é só me chamar aqui.',
        'Poxa, {nome}! Fica para uma próxima então. 🤗 A equipe da Pratique {unidade} te deseja tudo de bom!',
        'Obrigado por responder, {nome}! 🌟 Nossas portas continuam abertas para você. Um abraço!',
        'Tudo certo, {nome}! 💪 Quando bater a vontade de treinar, lembra da gente. A Pratique {unidade} estará aqui.',
        '{nome}, valeu pelo retorno! 🙌 Se precisar de qualquer coisa, pode contar com a Pratique {unidade}.',
        'Entendido, {nome}! 💙 Cuide-se bem e, quando quiser, estamos aqui para te ajudar. Abraço de toda a equipe!'
    ),
    VISITANTE_24H: v(
        'Olá, {nome}! Aqui é da equipe da Pratique {unidade}. Muito obrigado pela sua visita ontem! 😊 O que você achou da academia e do atendimento? Ficou com alguma dúvida que a gente possa te ajudar?',
        'Oi, {nome}! 💙 Foi muito bom receber você ontem na Pratique {unidade}! Me conta: o que você achou?',
        '{saudacao}, {nome}! ✨ Obrigado por vir nos conhecer ontem! Gostou da estrutura? Posso te ajudar com alguma dúvida sobre os planos?',
        'Oi, {nome}, tudo bem? 😄 Ficamos muito felizes com a sua visita ontem! [O que mais chamou sua atenção?|Do que você mais gostou?]',
        '{saudacao}, {nome}! 🙌 Passando para agradecer sua visita de ontem à Pratique {unidade}. Como foi a sua experiência?',
        'Olá, {nome}! 💪 Que alegria ter você aqui ontem! Ficou alguma dúvida sobre os planos ou horários? Estou à disposição.',
        'Oi, {nome}! 🌟 Obrigado pela visita de ontem! A equipe da Pratique {unidade} adorou te receber. O que achou da academia?',
        '{saudacao}, {nome}! 😊 Sua visita de ontem deixou a gente muito feliz! Quer que eu te explique os planos com calma?',
        'E aí, {nome}! 🤗 Gostou de conhecer a Pratique {unidade} ontem? Me conta sua opinião, ela é muito importante para nós!',
        'Oi, {nome}! 🎉 Obrigado por ter vindo ontem! Posso te ajudar a escolher o plano ideal para o seu objetivo?'
    ),
    VISITANTE_48H: v(
        'Oi, {nome}! Tudo bem? Aqui é da equipe da Pratique {unidade}. Passando para dizer que as portas estão abertas para você voltar e começar a treinar com a gente. 💪 Quer ajuda para escolher o plano ideal e já deixar sua matrícula pronta?',
        '{saudacao}, {nome}! 😊 Ainda pensando em começar? A Pratique {unidade} está te esperando! Posso te ajudar a escolher o plano?',
        'Oi, {nome}! 💙 Lembra da sua visita na Pratique {unidade}? Que tal começar essa semana? Sem taxa de matrícula e sem fidelidade!',
        '{saudacao}, {nome}! 🔥 Bora transformar aquela visita em rotina de treino? Me fala qual plano te interessou que eu deixo tudo pronto.',
        'Olá, {nome}! ✨ Nossos alunos estão amando os planos da Pratique, e tem um que é a sua cara! Quer que eu te mostre?',
        'Oi, {nome}, tudo bem? 🙌 Separei um tempinho para te ajudar a começar na Pratique {unidade}. Qual o melhor horário para você treinar?',
        '{saudacao}, {nome}! 💪 O primeiro passo você já deu ao visitar a gente. Bora para o segundo? Posso deixar sua matrícula pronta!',
        'E aí, {nome}! 😄 Ficou alguma dúvida sobre os planos da Pratique {unidade}? Estou aqui para te ajudar a decidir.',
        'Oi, {nome}! 🌟 A academia está cheia de energia boa e só falta você! Quer começar [hoje?|amanhã?]',
        '{saudacao}, {nome}! 🎯 Qual é o seu objetivo: emagrecer, ganhar massa ou ter mais saúde? Te ajudo a escolher o plano certo na Pratique {unidade}!'
    ),
    ANIVERSARIO: v(
        'Feliz aniversário, {nome}! 🎉 Toda a equipe da Pratique {unidade} deseja a você um novo ano de vida cheio de saúde, alegria e conquistas. Um grande abraço!',
        'Parabéns, {nome}! 🎂 Que seu dia seja incrível e o seu novo ano cheio de saúde e momentos felizes! Com carinho, equipe Pratique {unidade}. 💙',
        '{nome}, feliz aniversário! 🥳 Muita saúde, paz e muitas conquistas. Um abraço apertado de toda a família Pratique!',
        'Hoje o dia é seu, {nome}! 🎈 A equipe da Pratique {unidade} deseja um aniversário maravilhoso e um ano cheio de alegria! 🎉',
        'Parabéns pelo seu dia, {nome}! 🌟 Que não faltem saúde, energia e motivos para sorrir. Felicidades! Equipe Pratique {unidade}.',
        'Feliz aniversário, {nome}! 🎂✨ Que esse novo ciclo venha com muita saúde e realizações. Um grande abraço da Pratique {unidade}!',
        '{nome}, muitas felicidades! 🥳 Toda a equipe da Pratique {unidade} está celebrando com você hoje. Aproveite muito o seu dia! 💙',
        'Oi, {nome}! 🎉 Passando para desejar um feliz aniversário! Que o seu novo ano seja leve, saudável e cheio de conquistas.',
        'Parabéns, {nome}! 🎁 Que a vida te presenteie com saúde, amor e muitas alegrias. Felicidades de toda a família Pratique!',
        'Feliz aniversário, {nome}! 🎈💙 Hoje é dia de comemorar você! Um abraço carinhoso de toda a equipe da Pratique {unidade}.'
    ),
    MIGRACAO: v(
        'Oi, {nome}! Tudo bem? Aqui é da equipe da Pratique {unidade}. 😊 Temos uma novidade para você: com o plano com nutricionista, você treina com acompanhamento da alimentação e chega mais rápido no seu objetivo. 🥗💪 Quer que eu te explique como funciona a troca do seu plano?',
        '{saudacao}, {nome}! 💙 Sabia que treino + alimentação certa é a combinação que mais traz resultado? Com o plano com nutricionista da Pratique {unidade} você tem os dois! 🥗 Quer saber como funciona?',
        'Oi, {nome}! ✨ Nossos alunos que estão com nutricionista estão amando os resultados! Quer que eu te mostre como colocar a Nutri no seu plano? 🥗💪',
        '{nome}, tudo bem? 😄 Tenho uma dica para você chegar mais rápido no seu objetivo: o plano com nutricionista da Pratique! Posso te explicar?',
        'Olá, {nome}! 🥗 Que tal ter um nutricionista te acompanhando junto com os treinos? Na Pratique {unidade} isso já é possível! Quer saber mais?',
        'Oi, {nome}! 🔥 Treinar você já treina, agora imagina com a alimentação ajustada por um nutricionista! Quer conhecer o plano com Nutri?',
        '{saudacao}, {nome}! 🌟 Uma novidade que tá fazendo sucesso aqui: o plano com nutricionista! Resultado mais rápido e com acompanhamento. Te explico?',
        'E aí, {nome}! 💪 Bora turbinar seus treinos? Com a nutricionista da Pratique {unidade} você treina e come do jeito certo. 🥗 Quer saber como trocar o plano?',
        'Oi, {nome}! 😊 Sua dedicação nos treinos merece ainda mais resultado! O plano com nutricionista pode te ajudar muito. Posso te contar como funciona?',
        '{saudacao}, {nome}! 🥗✨ Já pensou em ter um cardápio feito para o seu objetivo? Com o plano com Nutri da Pratique {unidade} você tem! Quer que eu te explique?'
    ),
    // Cadastro de Visitante (07/11/2026, decisão do dono): só recepcionar e colocar-se à disposição.
    // Não oferecer valores nem planos.
    VISITANTE_BOAS_VINDAS: v(
        'Oi, {nome}, tudo bem? Aqui é da Pratique {unidade}! 😊 Foi muito bom te receber aqui hoje. Ficou alguma dúvida? Estou à disposição!',
        '{saudacao}, {nome}! Aqui é da Pratique {unidade}. 💙 Obrigado pela visita de hoje, foi um prazer te receber! Se quiser saber mais alguma coisa, é só me chamar por aqui.',
        'Olá, {nome}! Tudo bem? Que bom que você veio conhecer a Pratique {unidade} hoje! 😄 Qualquer dúvida, pode contar comigo.',
        'Oi, {nome}! 😊 Aqui é da Pratique {unidade}. Passando para agradecer a sua visita e dizer que você foi muito bem-vindo(a)! Ficou alguma dúvida?',
        '{saudacao}, {nome}! Foi um prazer receber você hoje na Pratique {unidade}. ✨ A gente faz questão de esclarecer qualquer dúvida, é só chamar!',
        'Oi, {nome}, tudo certo? Aqui é da Pratique {unidade}! 💪 Obrigado por vir nos conhecer hoje. Quer saber mais alguma informação?',
        'Olá, {nome}! 😊 Aqui é da recepção da Pratique {unidade}. Muito obrigado pela visita! Se ficou alguma dúvida, estou aqui para te ajudar.',
        '{saudacao}, {nome}! 💙 Que alegria ter recebido você hoje aqui na Pratique {unidade}. Qualquer coisa que precisar, é só me mandar mensagem!',
        'Oi, {nome}! Tudo bem? Foi muito bom te receber hoje na Pratique {unidade}. 🙌 Ficou com alguma dúvida? Respondo com todo o prazer.',
        'E aí, {nome}! 😄 Aqui é da Pratique {unidade}. Obrigado pela visita de hoje, você é sempre bem-vindo(a) por aqui! Quer saber mais alguma informação?'
    )
};

// Textos antigos (antes das versões). Se o banco ainda tiver um deles sem mudança, valem as versões novas;
// se alguém tinha personalizado, o texto dele vira a 1ª versão e as novas vêm junto.
const TEXTOS_ANTIGOS = {
    VISITANTE_24H: 'Olá, {nome}! Aqui é da equipe da Pratique {unidade}. Muito obrigado pela sua visita ontem! 😊 O que você achou da academia e do atendimento? Ficou com alguma dúvida que a gente possa te ajudar?',
    VISITANTE_48H: 'Oi, {nome}! Tudo bem? Aqui é da equipe da Pratique {unidade}. Passando para dizer que as portas estão abertas para você voltar e começar a treinar com a gente. 💪 Quer ajuda para escolher o plano ideal e já deixar sua matrícula pronta?',
    ANIVERSARIO: 'Feliz aniversário, {nome}! 🎉 Toda a equipe da Pratique {unidade} deseja a você um novo ano de vida cheio de saúde, alegria e conquistas. Um grande abraço!',
    MIGRACAO: 'Oi, {nome}! Tudo bem? Aqui é da equipe da Pratique {unidade}. 😊 Temos uma novidade para você: com o plano com nutricionista, você treina com acompanhamento da alimentação e chega mais rápido no seu objetivo. 🥗💪 Quer que eu te explique como funciona a troca do seu plano?'
};

// Texto gravado no banco → texto com versões
export const textoDoBanco = (chave, texto) => {
    const t = String(texto || '').trim();
    if (!t) return MENSAGENS_PADRAO[chave];
    if (t.includes('---')) return t;
    if (TEXTOS_ANTIGOS[chave] && t === TEXTOS_ANTIGOS[chave].trim()) return MENSAGENS_PADRAO[chave];
    const padrao = separarVersoes(MENSAGENS_PADRAO[chave]).filter(x => x !== t);
    return [t, ...padrao].join(SEPARADOR_VERSOES);
};

export const separarVersoes = (texto) => String(texto || '')
    .replace(/\r\n/g, '\n')
    .split(/\n[ \t]*-{3,}[ \t]*(?:\n|$)/)
    .map(x => x.trim())
    .filter(Boolean);

// Mensagens em uso (padrão + o que veio do banco). Atualizado por definirMensagensEmUso.
let mensagensEmUso = { ...MENSAGENS_PADRAO };
export const definirMensagensEmUso = (mensagens) => { mensagensEmUso = { ...MENSAGENS_PADRAO, ...mensagens }; };
export const mensagensAtuais = () => mensagensEmUso;

const saudacaoAgora = () => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia';
    if (hora >= 12 && hora < 18) return 'Boa tarde';
    return 'Boa noite';
};
const capitalizar = (texto) => String(texto || '').toLowerCase().replace(/(^|\s)\S/g, l => l.toUpperCase());

const sortear = (lista) => lista[Math.floor(Math.random() * lista.length)];
// [Oi|Olá|E aí] → uma das opções (primeira = true pega sempre a primeira, para a prévia)
const girarPalavras = (texto, primeira = false) => texto.replace(/\[([^[\]]*\|[^[\]]*)\]/g, (_, opcoes) => {
    const lista = opcoes.split('|');
    return primeira ? lista[0] : sortear(lista);
});

const preencher = (texto, { nome, unidade }) => {
    const primeiroNome = capitalizar(String(nome || '').trim().split(' ')[0]) || 'Tudo bem';
    const uni = capitalizar(String(unidade || '').trim());
    let t = texto.split('{saudacao}').join(saudacaoAgora()).split('{nome}').join(primeiroNome);
    // Sem unidade: tira o espaço antes do {unidade} ("Pratique {unidade}!" → "Pratique!")
    t = uni ? t.split('{unidade}').join(uni) : t.replace(/ ?\{unidade\}/g, '');
    return t;
};

// Última versão e último texto usados por situação (para nunca repetir em seguida)
const ultimas = new Map();

// Monta uma mensagem NOVA da situação (chave), diferente da anterior
export const montarMensagem = (chave, dados = {}, fonte = mensagensEmUso) => {
    const versoes = separarVersoes(fonte[chave] ?? MENSAGENS_PADRAO[chave] ?? '');
    if (versoes.length === 0) return '';
    const anterior = ultimas.get(chave) || {};
    let texto = '';
    for (let tentativa = 0; tentativa < 6; tentativa++) {
        let indice = Math.floor(Math.random() * versoes.length);
        if (versoes.length > 1 && indice === anterior.indice) indice = (indice + 1 + Math.floor(Math.random() * (versoes.length - 1))) % versoes.length;
        texto = preencher(girarPalavras(versoes[indice]), dados);
        if (texto !== anterior.texto || versoes.length === 1) { ultimas.set(chave, { indice, texto }); break; }
    }
    return texto;
};

// Prévia fixa (1ª versão, 1ª palavra de cada [a|b]) — para dicas na tela, que não podem mudar a cada desenho
export const previaMensagem = (chave, dados = {}, fonte = mensagensEmUso) => {
    const versoes = separarVersoes(fonte[chave] ?? MENSAGENS_PADRAO[chave] ?? '');
    return versoes.length ? preencher(girarPalavras(versoes[0], true), dados) : '';
};

// Situação do contato do funil (fase + tipo) → chave da mensagem
export const chaveDaFase = (status, inativo) => {
    if (status === 'Em Contato') return inativo ? 'FASE_CONTATO_INATIVO' : 'FASE_CONTATO_VISITANTE';
    if (status === 'Fechado') return inativo ? 'FASE_FECHADO_INATIVO' : 'FASE_FECHADO_VISITANTE';
    if (status === 'Perdido') return 'FASE_PERDIDO';
    return inativo ? 'FASE_NOVO_INATIVO' : 'FASE_NOVO_VISITANTE';
};
