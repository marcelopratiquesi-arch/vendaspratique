// ==========================================
// APP NO CELULAR (25/11/2026, decisão do dono; receita _FERRAMENTAS/app-no-celular)
// - ehAppInstalado(): o sistema está aberto pelo ícone (app instalado), não pelo navegador.
// - Login no app: fica guardado por 12 HORAS (contadas da entrada) e depois sai sozinho. Fechar o app não sai,
//   e os 15 min parados de Líder/Mentor/Admin não valem no app (no navegador continua tudo como antes).
//   Só a tela confere: se um dia a chave "sessao_banco" for ligada, o banco volta a cortar em 15 min.
// ==========================================
export const HORAS_LOGIN_APP = 12;
const CHAVE_INICIO = 'pratique_app_login_em';
const seguro = (fn, padrao = null) => { try { return fn(); } catch { return padrao; } };

export const ehAppInstalado = () => seguro(() =>
    Boolean(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true), false);

/** Marca a hora da entrada no app (só na 1ª vez; reabrir o app não renova). */
export function marcarInicioLoginApp() {
    if (!ehAppInstalado()) return;
    seguro(() => { if (!localStorage.getItem(CHAVE_INICIO)) localStorage.setItem(CHAVE_INICIO, String(Date.now())); });
}

/** true quando o login do app já passou das 12 horas. */
export function loginDoAppVenceu(agora = Date.now()) {
    if (!ehAppInstalado()) return false;
    const inicio = Number(seguro(() => localStorage.getItem(CHAVE_INICIO))) || 0;
    return inicio > 0 && agora - inicio >= HORAS_LOGIN_APP * 60 * 60 * 1000;
}

export function esquecerInicioLoginApp() {
    if (!ehAppInstalado()) return;
    seguro(() => localStorage.removeItem(CHAVE_INICIO));
}
