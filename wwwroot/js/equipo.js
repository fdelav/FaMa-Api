/* Página de detalle de equipo (html/equipo.html?id=<id>).
 *
 * Archivo NUEVO e independiente: no modifica dashboard.js ni style.css.
 * - Pide los datos al endpoint nuevo GET /admin/equipo-detalle/{id}; si ese endpoint aún no está
 *   registrado en Program.cs (404), usa los endpoints que ya existen y filtra en el navegador.
 * - Se actualiza sola cada 5 s mientras la pestaña está visible.
 */
(function () {
  'use strict';

  const BASE = '';
  const REFRESCO_MS = 5000;
  const UMBRAL_SIN_DATOS_MS = 3 * 60 * 1000;
  const LOGIN_URL = '/html/login.html';

  const ETIQUETA_ESTADO = { 0: 'No enrolado', 1: 'Online', 2: 'Offline' };
  const CLASE_ESTADO = { 0: 'neutro', 1: 'ok', 2: 'offline' };
  const ETIQUETA_SALUD = { 0: 'Saludable', 1: 'Advertencia', 2: 'Crítico' };
  const CLASE_SALUD = { 0: 'ok', 1: 'warn', 2: 'crit' };
  const CLASE_TIPO_NOTIF = { info: 'ok', ok: 'ok', warning: 'warn', warn: 'warn', error: 'crit', critical: 'crit', crit: 'crit' };

  // Espejo de EstadisticasWorker.EvaluatedComputerStatus (solo para colorear las barras)
  const UMBRALES = {
    cpu: { warn: 80, crit: 98 },
    ram: { warn: 85, crit: 95 },
    temp: { warn: 75, crit: 85 },
    // Solo visual: el worker todavía no evalúa el disco para la salud del equipo
    disk: { warn: 80, crit: 95 }
  };

  const $ = (id) => document.getElementById(id);
  const elHost = $('eq-host'), elBadges = $('eq-badges'), elFlujo = $('eq-flujo');
  const elGrid = $('eq-grid'), elFuente = $('eq-fuente'), elAct = $('eq-actualizado');

  // ---------- Utilidades ----------
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Acepta camelCase o PascalCase
  const g = (o, k) => (o ? (o[k] ?? o[k.charAt(0).toUpperCase() + k.slice(1)]) : undefined);

  const fmtNum = (v, suf = '', dec = 0) => (v == null ? '—' : `${Number(v).toFixed(dec)}${suf}`);

  function fmtFecha(raw, seg = false) {
    if (!raw) return '—';
    const f = new Date(raw);
    if (isNaN(f)) return '—';
    return f.toLocaleString('es-CO', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      ...(seg ? { second: '2-digit' } : {})
    });
  }

  const fmtHora = (raw) => {
    const f = new Date(raw);
    return isNaN(f) ? '—' : f.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  function hace(raw) {
    if (!raw) return '—';
    const s = Math.max(0, Math.round((Date.now() - new Date(raw).getTime()) / 1000));
    if (s < 60) return `hace ${s} s`;
    if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
    if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
    return `hace ${Math.floor(s / 86400)} d`;
  }

  function nivel(clave, valor) {
    const u = UMBRALES[clave];
    if (!u || valor == null) return 'ok';
    return valor >= u.crit ? 'crit' : valor >= u.warn ? 'warn' : 'ok';
  }

  const porFechaDesc = (a, b) => new Date(g(b, 'createdAt')) - new Date(g(a, 'createdAt'));

  async function pedir(url) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      let data = null;
      if (res.ok) { try { data = await res.json(); } catch (_) { /* cuerpo vacío */ } }
      return { ok: res.ok, status: res.status, data };
    } catch (_) {
      return { ok: false, status: 0, data: null };
    }
  }

  // ---------- Carga de datos ----------
  async function obtenerDetalle(id) {
    const r = await pedir(`${BASE}/admin/equipo-detalle/${id}`);
    if (r.ok && r.data) return { ...r.data, origen: 'dedicado' };
    if (r.status === 401) return { sesion: true };

    // Modo compatibilidad: endpoints existentes + filtro en el navegador
    const [eq, rep, est, not] = await Promise.all([
      pedir(`${BASE}/admin/clientcomputer/${id}`),
      pedir(`${BASE}/admin/statusreport`),
      pedir(`${BASE}/admin/clientstatistics`),
      pedir(`${BASE}/api/notifications/pc/${id}?pageSize=50`) // 404 = sin notificaciones
    ]);
    if (eq.status === 401) return { sesion: true };
    if (!eq.ok || !eq.data) return { error: 'No se pudo obtener la información del equipo. Verifica que exista y que el servidor esté activo.' };

    const delPc = (lista) => (Array.isArray(lista) ? lista : []).filter(x => g(x, 'pcId') === id);
    return {
      equipo: eq.data,
      reportes: delPc(rep.data).sort(porFechaDesc).slice(0, 60),
      estadisticas: delPc(est.data).sort(porFechaDesc).slice(0, 12),
      notificaciones: (not.ok && Array.isArray(not.data) ? not.data : []).sort(porFechaDesc).slice(0, 10),
      origen: 'compatibilidad'
    };
  }

  // ---------- Render ----------
  function filaMetrica(etiqueta, clave, valor, unidad) {
    const pct = valor == null ? 0 : Math.min(Math.max(valor, 0), 100);
    return `
      <div class="eq-metric">
        <span class="lbl">${etiqueta}</span>
        <div class="bar"><div class="fill ${nivel(clave, valor)}" style="width:${pct}%"></div></div>
        <span class="val mono">${fmtNum(valor, unidad, 1)}</span>
      </div>`;
  }

  // Fila de texto (sin barra) para valores que no son porcentaje, como los ms del disco
  function filaTexto(etiqueta, nota, valor, unidad, dec = 1) {
    return `
      <div class="eq-metric">
        <span class="lbl">${etiqueta}</span>
        <span class="sub">${nota}</span>
        <span class="val mono">${fmtNum(valor, unidad, dec)}</span>
      </div>`;
  }

  function grafico(reportesDesc) {
    const datos = [...reportesDesc].reverse(); // del más viejo al más nuevo
    if (datos.length < 2) return '<div class="eq-vacio">Se necesitan al menos 2 reportes para graficar.</div>';

    const W = 900, H = 200, PL = 30, PR = 8, PT = 8, PB = 20;
    const t = datos.map(r => new Date(g(r, 'createdAt')).getTime());
    const span = Math.max(t[t.length - 1] - t[0], 1);
    const x = i => PL + ((t[i] - t[0]) / span) * (W - PL - PR);
    const y = v => PT + (1 - Math.min(Math.max(v ?? 0, 0), 100) / 100) * (H - PT - PB);

    const series = [
      { k: 'cpu', n: 'CPU %', c: 'var(--accent)' },
      { k: 'ram', n: 'RAM %', c: '#6fb7e9' },
      { k: 'gpu', n: 'GPU %', c: '#b78ae0' },
      { k: 'temp', n: 'Temp °C', c: 'var(--warn)' },
      { k: 'diskActivity', n: 'Disco %', c: '#4fd1c5' }
    ];

    const rejilla = [0, 25, 50, 75, 100].map(v => `
      <line x1="${PL}" x2="${W - PR}" y1="${y(v)}" y2="${y(v)}" class="g-line"/>
      <text x="${PL - 4}" y="${y(v) + 3}" class="g-txt" text-anchor="end">${v}</text>`).join('');

    const lineas = series.map(s => {
      // Los reportes antiguos no traen disco: se omiten en vez de dibujarlos en 0
      const pts = datos.map((r, i) => (g(r, s.k) == null ? null : `${x(i).toFixed(1)},${y(g(r, s.k)).toFixed(1)}`))
        .filter(Boolean);
      if (pts.length < 2) return '';
      return `<polyline points="${pts}" fill="none" stroke-width="1.8" style="stroke:${s.c}"/>`;
    }).join('');

    return `
      <svg viewBox="0 0 ${W} ${H}" class="eq-grafico" role="img" aria-label="Historial de métricas">
        ${rejilla}${lineas}
        <text x="${PL}" y="${H - 4}" class="g-txt">${fmtHora(t[0])}</text>
        <text x="${W - PR}" y="${H - 4}" class="g-txt" text-anchor="end">${fmtHora(t[t.length - 1])}</text>
      </svg>
      <div class="eq-leyenda">${series.map(s => `<span><i style="background:${s.c}"></i>${s.n}</span>`).join('')}</div>`;
  }

  function render({ equipo, reportes, estadisticas, notificaciones, origen }) {
    const ultimo = reportes[0] || null;
    const stat = estadisticas[0] || null;
    const status = g(equipo, 'status') ?? 0;
    const id = g(equipo, 'id');
    const nombre = (g(equipo, 'hostName') || '').trim() || `PC-${String(id).padStart(2, '0')}`;

    // Cabecera
    elHost.textContent = nombre;
    document.title = `${nombre} · FaMa`;
    let badges = `<span class="eq-pill ${CLASE_ESTADO[status] || 'neutro'}">${ETIQUETA_ESTADO[status] || 'Desconocido'}</span>`;
    if (stat) {
      const s = g(stat, 'computerHealth') ?? 0;
      badges += `<span class="eq-pill ${CLASE_SALUD[s] || 'ok'}">Salud: ${ETIQUETA_SALUD[s] || '—'}</span>`;
    }
    elBadges.innerHTML = badges;

    // Flujo de datos
    const fechaUltimo = ultimo ? g(ultimo, 'createdAt') : null;
    const recibiendo = fechaUltimo && (Date.now() - new Date(fechaUltimo).getTime()) < UMBRAL_SIN_DATOS_MS;
    if (status === 0) elFlujo.innerHTML = '<span class="eq-pill neutro">Sin enrolar</span><span class="eq-nota m-0">El equipo aún no confirmó su enrolamiento.</span>';
    else if (!ultimo) elFlujo.innerHTML = '<span class="eq-pill offline">Sin datos</span><span class="eq-nota m-0">Todavía no se ha recibido ningún reporte de este equipo.</span>';
    else if (recibiendo) elFlujo.innerHTML = `<span class="eq-pill ok">Recibiendo datos</span><span class="eq-nota m-0">Último reporte ${hace(fechaUltimo)}</span>`;
    else elFlujo.innerHTML = `<span class="eq-pill warn">Sin datos recientes</span><span class="eq-nota m-0">Último reporte ${hace(fechaUltimo)}</span>`;

    // Información general
    const info = [
      ['ID', id],
      ['Ubicación', g(equipo, 'location') || '—'],
      ['IP', g(equipo, 'ipAddress') || '—'],
      ['MAC', g(equipo, 'macAddress') || '—'],
      ['UUID', g(equipo, 'uuid') || '—'],
      ['Último enrolamiento', fmtFecha(g(equipo, 'lastEnrollment'))],
      ['Último reporte (equipo)', fmtFecha(g(equipo, 'lastStatusReport'), true)]
    ].map(([k, v]) => `<div><dt>${k}</dt><dd class="mono">${esc(v)}</dd></div>`).join('');

    // Métricas actuales
    const metricas = ultimo ? `
      ${filaMetrica('CPU', 'cpu', g(ultimo, 'cpu'), '%')}
      ${filaMetrica('RAM', 'ram', g(ultimo, 'ram'), '%')}
      ${filaMetrica('GPU', 'gpu', g(ultimo, 'gpu'), '%')}
      ${filaMetrica('Temp', 'temp', g(ultimo, 'temp'), '°C')}
      ${filaMetrica('Disco', 'disk', g(ultimo, 'diskActivity'), '%')}
      ${g(ultimo, 'diskResponseMs') != null ? filaTexto('Resp.', 'tiempo de respuesta del disco', g(ultimo, 'diskResponseMs'), ' ms') : ''}
      <div class="eq-nota">Medido: ${fmtFecha(fechaUltimo, true)}</div>`
      : '<div class="eq-vacio">Sin métricas todavía.</div>';

    // Estadísticas calculadas por el servidor
    const estHtml = stat ? `
      <table class="eq-tabla mono">
        <thead><tr><th></th><th>Promedio</th><th>Máx</th></tr></thead>
        <tbody>
          <tr><td>CPU</td><td>${fmtNum(g(stat, 'cpuMean'), '%', 1)}</td><td>${fmtNum(g(stat, 'cpuMax'), '%', 1)}</td></tr>
          <tr><td>RAM</td><td>${fmtNum(g(stat, 'ramMean'), '%', 1)}</td><td>${fmtNum(g(stat, 'ramMax'), '%', 1)}</td></tr>
          <tr><td>GPU</td><td>${fmtNum(g(stat, 'gpuMean'), '%', 1)}</td><td>${fmtNum(g(stat, 'gpuMax'), '%', 1)}</td></tr>
          <tr><td>Temp</td><td>${fmtNum(g(stat, 'tempMean'), '°C', 1)}</td><td>${fmtNum(g(stat, 'tempMax'), '°C', 1)}</td></tr>
          <tr><td>Disco</td><td>${fmtNum(g(stat, 'diskMean'), '%', 1)}</td><td>${fmtNum(g(stat, 'diskMax'), '%', 1)}</td></tr>
          ${g(stat, 'diskMsMean') != null ? `<tr><td>Disco (ms)</td><td>${fmtNum(g(stat, 'diskMsMean'), ' ms', 1)}</td><td>${fmtNum(g(stat, 'diskMsMax'), ' ms', 1)}</td></tr>` : ''}
        </tbody>
      </table>
      <div class="eq-nota">Calculado ${hace(g(stat, 'createdAt'))} · el servidor las recalcula cada 5 min</div>`
      : '<div class="eq-vacio">Aún no hay estadísticas calculadas (se generan cada 5 min).</div>';

    // Últimos reportes recibidos
    const hayMs = reportes.some(r => g(r, 'diskResponseMs') != null);
    const filas = reportes.slice(0, 30).map(r => `
      <tr><td>${fmtHora(g(r, 'createdAt'))}</td><td>${fmtNum(g(r, 'cpu'), '%', 1)}</td><td>${fmtNum(g(r, 'ram'), '%', 1)}</td>
      <td>${fmtNum(g(r, 'gpu'), '%', 1)}</td><td>${fmtNum(g(r, 'temp'), '°C', 1)}</td>
      <td>${fmtNum(g(r, 'diskActivity'), '%', 1)}</td>${hayMs ? `<td>${fmtNum(g(r, 'diskResponseMs'), ' ms', 1)}</td>` : ''}</tr>`).join('');
    const tabla = reportes.length ? `
      <div class="eq-scroll"><table class="eq-tabla mono">
        <thead><tr><th>Hora</th><th>CPU</th><th>RAM</th><th>GPU</th><th>Temp</th><th>Disco</th>${hayMs ? '<th>Disco ms</th>' : ''}</tr></thead>
        <tbody>${filas}</tbody></table></div>
      <div class="eq-nota">Mostrando ${Math.min(30, reportes.length)} de ${reportes.length} reportes cargados</div>`
      : '<div class="eq-vacio">No hay reportes registrados para este equipo.</div>';

    // Notificaciones del equipo
    const notifs = notificaciones.length ? `<div class="eq-notif-lista">${notificaciones.map(n => {
      const lvl = CLASE_TIPO_NOTIF[String(g(n, 'type') || 'info').toLowerCase()] || 'ok';
      const leida = Number(g(n, 'isRead')) === 1;
      return `
        <div class="eq-notif${leida ? ' leida' : ''}">
          <span class="dot ${lvl}"></span>
          <div><div class="msg">${esc(g(n, 'message') || 'Sin mensaje')}</div>
          <div class="time mono">${fmtFecha(g(n, 'createdAt'))}${leida ? '' : ' · sin leer'}</div></div>
        </div>`;
    }).join('')}</div>` : '<div class="eq-vacio">Este equipo no tiene notificaciones.</div>';

    const scrollTabla = elGrid.querySelector('.eq-scroll')?.scrollTop || 0; // el refresco no debe reiniciar el scroll interno
    elGrid.innerHTML = `
      <section class="eq-card"><h3 class="eq-title">Información del equipo</h3><dl class="eq-info">${info}</dl></section>
      <section class="eq-card"><h3 class="eq-title">Métricas actuales</h3>${metricas}</section>
      <section class="eq-card ancha"><h3 class="eq-title">Historial reciente</h3>${grafico(reportes)}</section>
      <section class="eq-card"><h3 class="eq-title">Estadísticas (cálculo del servidor)</h3>${estHtml}</section>
      <section class="eq-card"><h3 class="eq-title">Notificaciones del equipo</h3>${notifs}</section>
      <section class="eq-card ancha"><h3 class="eq-title">Datos que está enviando</h3>${tabla}</section>`;
    const nuevaTabla = elGrid.querySelector('.eq-scroll');
    if (nuevaTabla) nuevaTabla.scrollTop = scrollTabla;

    elFuente.textContent = `Fuente: ${origen === 'dedicado' ? 'endpoint /admin/equipo-detalle' : 'endpoints existentes (modo compatibilidad)'} · se actualiza cada 5 s`;
    elAct.textContent = `Actualizado ${fmtHora(Date.now())}`;
  }

  function mostrarMensaje(html) {
    elFlujo.innerHTML = '';
    elGrid.innerHTML = `<div class="eq-card ancha"><div class="eq-vacio">${html}</div></div>`;
  }

  // ---------- Arranque ----------
  const id = Number(new URLSearchParams(location.search).get('id'));
  if (!localStorage.getItem('token')) {
    location.href = LOGIN_URL;
    return;
  }
  if (!Number.isInteger(id) || id <= 0) {
    mostrarMensaje('Falta el equipo a mostrar. Vuelve al dashboard y selecciona un equipo.');
    return;
  }
  elHost.textContent = `Equipo #${id}`;

  let cargando = false;
  async function refrescar() {
    if (cargando) return;
    cargando = true;
    try {
      const detalle = await obtenerDetalle(id);
      if (detalle.sesion) {
        mostrarMensaje(`La sesión expiró. <a href="${LOGIN_URL}">Iniciar sesión de nuevo</a>.`);
        clearInterval(timer);
      } else if (detalle.error) {
        mostrarMensaje(esc(detalle.error));
      } else {
        render(detalle);
      }
    } finally {
      cargando = false;
    }
  }

  const timer = setInterval(() => { if (!document.hidden) refrescar(); }, REFRESCO_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refrescar(); });
  refrescar();
})();
