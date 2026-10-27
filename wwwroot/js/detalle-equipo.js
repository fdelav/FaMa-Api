/* Lanzador del detalle de equipo.
 *
 * Archivo NUEVO e independiente: no modifica dashboard.js ni style.css.
 * Al hacer clic (o Enter) en una tarjeta de #grid-equipos navega, en la MISMA pestaña, a
 * html/equipo.html?id=<id>, donde se muestra todo el detalle del equipo
 * (como moverse entre páginas de un sitio; el botón "atrás" del navegador vuelve al dashboard).
 */
(function () {
  'use strict';

  const grid = document.getElementById('grid-equipos');
  if (!grid) return;

  // Lee la config de dashboard.js (solo lectura); si no existe, mismo origen
  const BASE = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : '';

  const g = (o, k) => (o ? (o[k] ?? o[k.charAt(0).toUpperCase() + k.slice(1)]) : undefined);

  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'css/detalle-equipo.css';
  document.head.appendChild(css);

  // La grilla se vuelve a dibujar cada 5 s: se re-aplican los atributos de accesibilidad
  function marcarTarjetas() {
    grid.querySelectorAll('.equipo').forEach(el => {
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'link');
    });
  }
  new MutationObserver(marcarTarjetas).observe(grid, { childList: true });
  marcarTarjetas();

  // dashboard.js no deja el id en la tarjeta, así que se cruza con la lista de equipos
  // usando lo que sí pinta: nombre + IP + MAC (en el atributo title).
  async function resolverId(tarjeta) {
    let lista = null;
    try {
      const res = await fetch(`${BASE}/admin/clientcomputer`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) lista = await res.json();
    } catch (_) { /* sin red */ }
    if (!Array.isArray(lista)) return null;

    const hostEl = tarjeta.querySelector('.host');
    const texto = (hostEl?.textContent || '').trim();
    const m = /^IP: (.*) \| MAC: (.*)$/.exec(hostEl?.title || '');

    const candidatos = lista.filter(e => {
      const id = g(e, 'id');
      const hn = g(e, 'hostName') || '';
      const nombre = hn.trim() !== '' ? hn : `PC-${String(id).padStart(2, '0')}`;
      if (nombre.trim() !== texto) return false;
      if (!m) return true;
      return (g(e, 'ipAddress') || 'N/A') === m[1] && (g(e, 'macAddress') || 'N/A') === m[2];
    });
    if (candidatos.length === 1) return g(candidatos[0], 'id');

    // Respaldo: misma posición que en la grilla
    const idx = [...grid.querySelectorAll('.equipo')].indexOf(tarjeta);
    return idx >= 0 && lista[idx] ? g(lista[idx], 'id') : null;
  }

  let abriendo = false;

  // Al volver con el botón "atrás" el navegador puede restaurar esta página tal como estaba
  // (con el cursor en "progress" y el bloqueo de doble clic activo): se reinicia el estado.
  window.addEventListener('pageshow', () => {
    abriendo = false;
    document.body.style.cursor = '';
  });

  async function abrir(tarjeta) {
    if (abriendo) return; // evita doble clic mientras se identifica el equipo
    abriendo = true;
    document.body.style.cursor = 'progress';

    const id = await resolverId(tarjeta);
    if (id == null) {
      abriendo = false;
      document.body.style.cursor = '';
      alert('No se pudo identificar el equipo seleccionado. Inténtalo de nuevo.');
      return;
    }
    window.location.href = `${BASE}/html/equipo.html?id=${encodeURIComponent(id)}`;
  }

  grid.addEventListener('click', (ev) => {
    const t = ev.target.closest('.equipo');
    if (t) abrir(t);
  });
  grid.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const t = ev.target.closest('.equipo');
    if (t) { ev.preventDefault(); abrir(t); }
  });
})();
