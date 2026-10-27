// ---- Pestaña de notificaciones ----
// Muestra todas las notificaciones y permite filtrarlas por estado (leída / no leída) y por fecha.
//
// IMPORTANTE (mientras el backend no tenga filtros): GET /api/notifications solo acepta
// ?unreadOnly, ?page y ?pageSize. Por eso aquí se descargan todas por lotes y se filtra
// en el navegador. Cuando el backend soporte filtros, solo hay que cambiar
// obtenerNotificaciones() (ver comentario dentro de la función).

const API_BASE_URL = '';
const ENDPOINT = `${API_BASE_URL}/api/notifications`;

const TAM_LOTE = 100;        // notificaciones pedidas por request
const MAX_LOTES = 50;        // tope de seguridad (5.000 notificaciones)
const POR_PAGINA = 15;       // filas visibles por página
const REFRESCO_MS = 15000;   // recarga silenciosa

// Mismo criterio de colores que dashboard.js (NotificationDto.Type -> clase)
const TIPOS = {
  info:     { clase: 'ok',   etiqueta: 'Info' },
  ok:       { clase: 'ok',   etiqueta: 'OK' },
  warning:  { clase: 'warn', etiqueta: 'Advertencia' },
  warn:     { clase: 'warn', etiqueta: 'Advertencia' },
  error:    { clase: 'crit', etiqueta: 'Error' },
  critical: { clase: 'crit', etiqueta: 'Crítico' },
  crit:     { clase: 'crit', etiqueta: 'Crítico' }
};
const COLOR = { ok: 'var(--ok)', warn: 'var(--warn)', crit: 'var(--crit)' };

// ---- Estado de la pantalla ----
let todas = [];                       // todas las notificaciones descargadas
let filtradas = [];                   // resultado de aplicar filtros
let pagina = 1;
const seleccion = new Set();          // ids marcados con el checkbox
const filtros = { estado: 'todas', desde: '', hasta: '' };

// ---- Utilidades ----
const $ = (id) => document.getElementById(id);

function escapar(texto) {
  const d = document.createElement('div');
  d.textContent = texto ?? '';
  return d.innerHTML;
}

function token() { return localStorage.getItem('token'); }

function cerrarSesion() {
  localStorage.removeItem('token');
  window.location.href = '/html/login.html';
}

function leida(n) { return Number(n.isRead ?? n.IsRead ?? 0) === 1; }
function idDe(n) { return n.id ?? n.Id; }

function fechaDe(n) {
  const raw = n.createdAt ?? n.CreatedAt;
  if (!raw) return null;
  // Si el servidor manda la fecha sin zona horaria, se asume UTC
  const texto = /[zZ]|[+-]\d\d:\d\d$/.test(raw) ? raw : `${raw}Z`;
  const f = new Date(texto);
  return isNaN(f) ? null : f;
}

// ---- Acceso a la API ----
async function pedir(url, opciones = {}) {
  const res = await fetch(url, {
    ...opciones,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token()}`,
      ...(opciones.headers || {})
    }
  });
  if (res.status === 401) { cerrarSesion(); throw new Error('401'); }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

/**
 * Descarga todas las notificaciones por lotes.
 *
 * CUANDO EL BACKEND TENGA FILTROS: reemplazar este bucle por una sola consulta, por ejemplo
 *   `${ENDPOINT}?isRead=${...}&from=${...}&to=${...}&page=${pagina}&pageSize=${POR_PAGINA}`
 * y usar el total que devuelva el servidor para la paginación.
 */
async function obtenerNotificaciones() {
  const porId = new Map();            // evita duplicados si el orden del servidor cambia entre lotes
  for (let p = 1; p <= MAX_LOTES; p++) {
    const res = await pedir(`${ENDPOINT}?page=${p}&pageSize=${TAM_LOTE}`);
    const lote = await res.json();
    if (!Array.isArray(lote) || lote.length === 0) break;
    lote.forEach(n => porId.set(idDe(n), n));
    if (lote.length < TAM_LOTE) break;
  }
  return Array.from(porId.values());
}

// ---- Filtrado ----
function aplicarFiltros() {
  // Fechas "de calendario" en hora local: desde 00:00:00 y hasta 23:59:59
  const desde = filtros.desde ? new Date(`${filtros.desde}T00:00:00`).getTime() : null;
  const hasta = filtros.hasta ? new Date(`${filtros.hasta}T23:59:59.999`).getTime() : null;

  filtradas = todas.filter(n => {
    if (filtros.estado === 'no-leidas' && leida(n)) return false;
    if (filtros.estado === 'leidas' && !leida(n)) return false;

    if (desde !== null || hasta !== null) {
      const f = fechaDe(n);
      if (!f) return false;
      const t = f.getTime();
      if (desde !== null && t < desde) return false;
      if (hasta !== null && t > hasta) return false;
    }
    return true;
  });

  // Más recientes primero
  filtradas.sort((a, b) => (fechaDe(b)?.getTime() ?? 0) - (fechaDe(a)?.getTime() ?? 0));

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  if (pagina > totalPaginas) pagina = totalPaginas;
}

// ---- Renderizado ----
function render() {
  aplicarFiltros();

  const lista = $('nt-lista');
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const inicio = (pagina - 1) * POR_PAGINA;
  const visibles = filtradas.slice(inicio, inicio + POR_PAGINA);

  if (visibles.length === 0) {
    const hayFiltros = filtros.estado !== 'todas' || filtros.desde || filtros.hasta;
    lista.innerHTML = `<div class="nt-vacio">${
      todas.length === 0
        ? 'No hay notificaciones.'
        : hayFiltros ? 'Ninguna notificación coincide con los filtros.' : 'No hay notificaciones.'
    }</div>`;
  } else {
    lista.innerHTML = visibles.map(n => {
      const id = idDe(n);
      const esLeida = leida(n);
      const tipoCrudo = String(n.type ?? n.Type ?? 'info').toLowerCase();
      const tipo = TIPOS[tipoCrudo] || { clase: 'ok', etiqueta: tipoCrudo };
      const f = fechaDe(n);
      const fechaTxt = f
        ? f.toLocaleString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        : '—';
      const pc = n.pcId ?? n.PcId;
      const marcada = seleccion.has(id) ? 'checked' : '';

      return `
        <div class="nt-fila ${esLeida ? 'leida' : ''}">
          <input type="checkbox" data-id="${id}" ${marcada} ${esLeida ? 'disabled' : ''}
                 title="${esLeida ? 'Ya está leída' : 'Seleccionar'}">
          <span class="dot" style="background:${COLOR[tipo.clase]}"></span>
          <div>
            <div class="nt-msg">${escapar(n.message ?? n.Message ?? 'Sin mensaje')}</div>
            <div class="nt-tipo mono">${escapar(tipo.etiqueta)}</div>
          </div>
          <div class="nt-col-pc mono">${pc != null ? `PC-${String(pc).padStart(2, '0')}` : '—'}</div>
          <div class="nt-col-fecha mono">${fechaTxt}</div>
          <div class="nt-col-estado">
            <span class="nt-badge ${esLeida ? 'leida' : 'nueva'}">${esLeida ? 'Leída' : 'No leída'}</span>
          </div>
        </div>`;
    }).join('');
  }

  const sinLeer = todas.filter(n => !leida(n)).length;
  $('nt-contador').textContent =
    `${filtradas.length} de ${todas.length} · ${sinLeer} sin leer`;
  $('nt-pagina').textContent = `Página ${pagina} de ${totalPaginas}`;
  $('nt-prev').disabled = pagina <= 1;
  $('nt-next').disabled = pagina >= totalPaginas;

  actualizarSeleccion();
}

function actualizarSeleccion() {
  // Descarta ids que ya no existen o que ya fueron leídos
  const vigentes = new Set(todas.filter(n => !leida(n)).map(idDe));
  Array.from(seleccion).forEach(id => { if (!vigentes.has(id)) seleccion.delete(id); });

  const btn = $('nt-marcar');
  btn.disabled = seleccion.size === 0;
  btn.textContent = seleccion.size > 0
    ? `Marcar ${seleccion.size} como leída${seleccion.size === 1 ? '' : 's'}`
    : 'Marcar seleccionadas como leídas';

  // Checkbox "seleccionar todas" de la página (solo cuenta las no leídas)
  const checks = Array.from(document.querySelectorAll('#nt-lista input[type="checkbox"]:not(:disabled)'));
  const todos = $('nt-todas-pagina');
  todos.disabled = checks.length === 0;
  todos.checked = checks.length > 0 && checks.every(c => c.checked);
}

// ---- Acciones ----
async function cargar(silencioso = false) {
  try {
    todas = await obtenerNotificaciones();
    $('nt-actualizado').textContent =
      `Actualizado: ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    render();
  } catch (err) {
    if (err.message === '401') return;
    console.error('No se pudieron cargar las notificaciones', err);
    if (!silencioso) {
      $('nt-lista').innerHTML = '<div class="nt-vacio">No se pudieron cargar las notificaciones. Intenta de nuevo.</div>';
    }
  }
}

async function marcarSeleccionadas() {
  const ids = Array.from(seleccion);
  if (ids.length === 0) return;
  if (!confirm(`¿Marcar ${ids.length} notificación(es) como leída(s)?`)) return;

  try {
    await pedir(`${ENDPOINT}/read-batch`, { method: 'PATCH', body: JSON.stringify(ids) });
    seleccion.clear();
    await cargar();
  } catch (err) {
    if (err.message === '401') return;
    console.error('Error al marcar como leídas', err);
    alert('No se pudieron marcar las notificaciones como leídas.');
  }
}

// ---- Eventos ----
function iniciarEventos() {
  $('f-estado').addEventListener('change', e => { filtros.estado = e.target.value; pagina = 1; render(); });
  $('f-desde').addEventListener('change', e => { filtros.desde = e.target.value; pagina = 1; render(); });
  $('f-hasta').addEventListener('change', e => { filtros.hasta = e.target.value; pagina = 1; render(); });

  $('f-limpiar').addEventListener('click', () => {
    filtros.estado = 'todas'; filtros.desde = ''; filtros.hasta = '';
    $('f-estado').value = 'todas'; $('f-desde').value = ''; $('f-hasta').value = '';
    pagina = 1;
    render();
  });

  $('nt-prev').addEventListener('click', () => { if (pagina > 1) { pagina--; render(); } });
  $('nt-next').addEventListener('click', () => { pagina++; render(); });

  // Un solo listener para todos los checkboxes de la lista
  $('nt-lista').addEventListener('change', e => {
    const cb = e.target;
    if (cb.type !== 'checkbox') return;
    const id = Number(cb.dataset.id);
    if (cb.checked) seleccion.add(id); else seleccion.delete(id);
    actualizarSeleccion();
  });

  $('nt-todas-pagina').addEventListener('change', e => {
    document.querySelectorAll('#nt-lista input[type="checkbox"]:not(:disabled)').forEach(cb => {
      cb.checked = e.target.checked;
      const id = Number(cb.dataset.id);
      if (cb.checked) seleccion.add(id); else seleccion.delete(id);
    });
    actualizarSeleccion();
  });

  $('nt-marcar').addEventListener('click', marcarSeleccionadas);
  $('nt-cerrar-sesion').addEventListener('click', cerrarSesion);
  $('nt-filtros').addEventListener('submit', e => e.preventDefault());
}

document.addEventListener('DOMContentLoaded', () => {
  if (!token()) {
    window.location.href = '/html/login.html';
    return;
  }
  iniciarEventos();
  cargar();
  setInterval(() => cargar(true), REFRESCO_MS);
});
