// Texto EXATO do período para o recibo (nunca "este mês", "mês passado" ou "últimos 30 dias").
// Recebe as datas do filtro em AAAA-MM-DD; o "fim" NÃO entra (é o dia seguinte ao último dia).
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const paraData = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
const br = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export const periodoExato = (inicioIso, fimIso) => {
    if (!inicioIso || !fimIso) return '';
    const ini = paraData(inicioIso);
    const ultimo = paraData(fimIso);
    ultimo.setDate(ultimo.getDate() - 1);
    if (ultimo < ini) return '';
    const fimDoMes = new Date(ultimo.getFullYear(), ultimo.getMonth() + 1, 0).getDate();
    const mesesInteiros = ini.getDate() === 1 && ultimo.getDate() === fimDoMes;
    if (mesesInteiros) {
        if (ini.getFullYear() === ultimo.getFullYear() && ini.getMonth() === ultimo.getMonth()) return `${cap(MESES[ini.getMonth()])} de ${ini.getFullYear()}`;
        if (ini.getFullYear() === ultimo.getFullYear()) return `${cap(MESES[ini.getMonth()])} a ${MESES[ultimo.getMonth()]} de ${ini.getFullYear()}`;
        return `${cap(MESES[ini.getMonth()])} de ${ini.getFullYear()} a ${MESES[ultimo.getMonth()]} de ${ultimo.getFullYear()}`;
    }
    if (ini.getTime() === ultimo.getTime()) return `Dia ${br(ini)}`;
    return `${br(ini)} a ${br(ultimo)}`;
};
