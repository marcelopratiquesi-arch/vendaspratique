// Teste das regras dos AVISOS NO CELULAR (api/_avisos.js). Rodar: node scripts/teste-avisos-celular.mjs
import { validarAviso, separarDestinatarios, montarMensagem, aparelhoMorto } from '../api/_avisos.js';

let falhas = 0;
const confere = (nome, obtido, esperado) => {
    const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
    if (!ok) { falhas += 1; console.log(`❌ ${nome}\n   esperado: ${JSON.stringify(esperado)}\n   obtido:   ${JSON.stringify(obtido)}`); }
    else console.log(`✅ ${nome}`);
};

const base = { titulo: 'Reunião', texto: 'Amanhã 9h', destino: { tipo: 'todos' } };
confere('aviso completo passa', validarAviso(base), null);
confere('sem título', validarAviso({ ...base, titulo: '  ' }), 'Escreva o título do aviso.');
confere('sem texto', validarAviso({ ...base, texto: '' }), 'Escreva o texto do aviso.');
confere('título longo', validarAviso({ ...base, titulo: 'x'.repeat(61) }), 'O título passa de 60 letras.');
confere('texto longo', validarAviso({ ...base, texto: 'x'.repeat(241) }), 'O texto passa de 240 letras.');
confere('link para fora do sistema é recusado', validarAviso({ ...base, link: 'https://golpe.com' }), 'Tela para abrir inválida.');
confere('link //outro-site é recusado', validarAviso({ ...base, link: '//golpe.com' }), 'Tela para abrir inválida.');
confere('link interno passa', validarAviso({ ...base, link: '/?tela=comunicados' }), null);
confere('destino inválido', validarAviso({ ...base, destino: { tipo: 'qualquer' } }), 'Escolha para quem vai o aviso.');
confere('pessoas sem ninguém', validarAviso({ ...base, destino: { tipo: 'pessoas', emails: [] } }), 'Escolha pelo menos uma pessoa.');
confere('comunicado sem número', validarAviso({ ...base, destino: { tipo: 'comunicado' } }), 'Comunicado sem número.');

const linhas = [
    { email: 'Lider@x.com', nome: 'Ana', papel: 'LIDER', unidade: 'SI2', endpoint: 'e1', p256dh: 'p', auth: 'a' },
    { email: 'lider@x.com', nome: 'Ana', papel: 'LIDER', unidade: 'SI2', endpoint: 'e2', p256dh: 'p', auth: 'a' }, // 2º aparelho
    { email: 'rec@x.com', nome: 'Recepção', papel: 'RECEPCAO', unidade: 'VENEZA', endpoint: null, p256dh: null, auth: null },
    { email: 'mentor@x.com', nome: 'Beto', papel: 'MENTOR', unidade: 'TODAS', endpoint: 'e1', p256dh: 'p', auth: 'a' }, // endpoint repetido não duplica
    { email: '', nome: 'sem email' },
];
const r = separarDestinatarios(linhas);
confere('pessoas diferentes (e-mail sem diferenciar maiúscula)', r.pessoas, 3);
confere('aparelhos sem repetir', r.aparelhos.map(a => a.endpoint), ['e1', 'e2']);
confere('quem não ativou', r.semAparelho.map(p => p.email), ['mentor@x.com', 'rec@x.com']);
confere('mensagem', JSON.parse(montarMensagem({ titulo: ' Oi ', texto: ' tudo ', link: '' })), { titulo: 'Oi', texto: 'tudo', link: '/' });
confere('aparelho morto 410', aparelhoMorto(410), true);
confere('erro passageiro 500 não apaga', aparelhoMorto(500), false);

console.log(falhas ? `\n${falhas} teste(s) falharam.` : '\n✅ Todos os testes dos avisos passaram.');
process.exit(falhas ? 1 : 0);
