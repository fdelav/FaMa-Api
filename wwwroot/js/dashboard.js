// ---- Configuración Backend (API C#) ----
// Si frontend y backend están en servidores o puertos distintos en desarrollo, coloca 'http://localhost:5000'
// Si el frontend lo sirve el propio backend, deja API_BASE_URL en ''
const API_BASE_URL = '';

const ENDPOINTS = {
  adminStatusReport: `${API_BASE_URL}/admin/statusreport`,
  clientStadistics: `${API_BASE_URL}/admin/clientstatistics`,
  notifications: `${API_BASE_URL}/api/notifications`,
  clientComputers: `${API_BASE_URL}/admin/clientcomputer`
};

// Mapeo de enums numéricos de Status
const MAPA_ESTADOS = {
  0: { clave: 'plantilla', color: 'var(--panel-border)' }, // 0: No enrolado / Plantilla
  1: { clave: 'online',        color: 'var(--ok)' },           // 1: Online / Saludable
  2: { clave: 'offline',   color: 'var(--offline)' },       // 2: Offline  
};

// Salud del equipo: mismos valores que el enum ComputerHealth del backend
const MAPA_SALUD = {
  0: { clave: 'ok',          color: 'var(--ok)' },           // 0: Saludable
  1: { clave: 'warn',        color: 'var(--warn)' },         // 1: Advertencia
  2: { clave: 'crit',        color: 'var(--crit)' }          // 2: Crítico
};

// Mapeo de severidad de NotificationDto.Type -> CSS
const MAPA_TIPO_NOTIF = {
  'info': 'ok',
  'ok': 'ok',
  'warning': 'warn',
  'warn': 'warn',
  'error': 'crit',
  'critical': 'crit',
  'crit': 'crit'
};

// ---- Funciones de Renderizado ----

/**
 * Devuelve { [pcId]: elemento más reciente } para una lista de reportes o estadísticas.
 */
function ultimoPorPc(lista) {
  const mapa = {};
  if (!Array.isArray(lista)) return mapa;
  lista.forEach(item => {
    const pcId = item.pcId ?? item.PcId;
    if (pcId == null) return;
    const fecha = new Date(item.createdAt ?? item.CreatedAt);
    const previo = mapa[pcId];
    if (!previo || fecha > new Date(previo.createdAt ?? previo.CreatedAt)) mapa[pcId] = item;
  });
  return mapa;
}

// ---- Utilidades visuales ----

// Umbrales solo visuales para colorear las barras (mismos que kpi-filtro.js)
const UMBRALES = {
  cpu: { warn: 80, crit: 98 },
  ram: { warn: 85, crit: 95 },
  temp: { warn: 75, crit: 85 },
  disk: { warn: 85, crit: 95 }
};
const COLOR_NIVEL = { ok: 'var(--ok)', warn: 'var(--warn)', crit: 'var(--crit)' };
const MAX_NOTIF_PANEL = 30;

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function nivelMetrica(clave, valor) {
  const u = UMBRALES[clave];
  if (!u || valor == null) return 'ok';
  return valor >= u.crit ? 'crit' : valor >= u.warn ? 'warn' : 'ok';
}

function fechaUTC(raw) {
  if (!raw) return null;
  const f = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(raw) ? raw : `${raw}Z`);
  return isNaN(f) ? null : f;
}

function hace(fecha) {
  if (!fecha) return '-';
  const s = Math.max(0, Math.round((Date.now() - fecha.getTime()) / 1000));
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

function toast(texto) {
  const t = document.createElement('div');
  t.className = 'toast-fama';
  t.setAttribute('role', 'status');
  t.textContent = texto;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/**
 * Renderiza la fila de KPIs globales (se calculan con el último dato de cada equipo):
 *  1. Equipos conectados (online) de los enrolados
 *  2. Equipos en estado crítico (entre los conectados)
 *  3. Equipos en estado de advertencia (entre los conectados)
 *  4. Equipos con fallas recurrentes (ver kpi-filtro.js)
 *  5. Estado de la flota (el peor estado entre los conectados)
 * Los KPIs 2, 3 y 4 también funcionan como filtro de la grilla de equipos.
 */
function renderKpis(reportes, equipos, estadisticas) {
  const contenedor = document.getElementById('fila-kpis');
  if (!contenedor) return;

  const lista = Array.isArray(equipos) ? equipos : [];
  const estadoDe = e => e.status ?? e.Status ?? 0;
  const enrolados = lista.filter(e => estadoDe(e) !== 0);   // Online + Offline
  const conectados = lista.filter(e => estadoDe(e) === 1);  // Online

  const ultEstadistica = ultimoPorPc(estadisticas);

  let criticos = 0, advertencias = 0;
  conectados.forEach(e => {
    const id = e.id ?? e.Id;
    const est = ultEstadistica[id];
    const salud = est ? (est.computerHealth ?? est.ComputerHealth ?? 0) : 0;
    if (salud === 2) criticos++;
    else if (salud === 1) advertencias++;
  });

  const hayConectados = conectados.length > 0;
  if (window.kpiFiltro) window.kpiFiltro.actualizarDatos(lista, estadisticas);
  const recurrentes = window.kpiFiltro ? window.kpiFiltro.conteo('recurrentes') : 0;
  const sinConexion = enrolados.length - conectados.length;

  let calificacion = 'Sin datos', tonoCal = '', subCal = 'Aún no hay equipos conectados';
  if (hayConectados) {
    if (criticos > 0) { calificacion = 'Crítico'; tonoCal = 'crit'; subCal = `${criticos} equipo${criticos === 1 ? '' : 's'} requiere${criticos === 1 ? '' : 'n'} atención`; }
    else if (advertencias > 0) { calificacion = 'Advertencia'; tonoCal = 'warn'; subCal = `${advertencias} equipo${advertencias === 1 ? '' : 's'} cerca del límite`; }
    else { calificacion = 'Normal'; tonoCal = 'ok'; subCal = 'Todos los equipos dentro de rango'; }
  }

  const kpis = [
    { label: 'Equipos conectados', value: enrolados.length > 0 ? `${conectados.length} de ${enrolados.length}` : '-',
      sub: !enrolados.length ? 'Ningún equipo enrolado' : sinConexion ? `${sinConexion} sin conexión` : 'Toda la flota en línea',
      tono: enrolados.length && sinConexion ? 'warn' : enrolados.length ? 'ok' : '' },
    { label: 'Equipos en estado crítico', value: hayConectados ? criticos : '-', tono: criticos > 0 ? 'crit' : '', filtro: 'criticos' },
    { label: 'Equipos en advertencia', value: hayConectados ? advertencias : '-', tono: advertencias > 0 ? 'warn' : '', filtro: 'advertencia' },
    { label: 'Equipos con fallas recurrentes', value: enrolados.length > 0 ? recurrentes : '-', tono: recurrentes > 0 ? 'warn' : '', filtro: 'recurrentes' },
    { label: 'Estado de flota', value: calificacion, sub: subCal, tono: tonoCal, estado: true }
  ];

  // El redibujado cada 5 s haría perder el foco del teclado en la tarjeta
  const filtroConFoco = document.activeElement?.dataset?.filtro;
  const filtroActivo = window.kpiFiltro ? window.kpiFiltro.activo() : null;

  contenedor.innerHTML = kpis.map(k => {
    const activo = k.filtro && k.filtro === filtroActivo;
    return `
    <div class="col-6 col-xl">
      <div class="kpi ${k.tono || ''}${k.filtro ? ' kpi-click' : ''}${activo ? ' kpi-activo' : ''}"${k.filtro ? ` data-filtro="${k.filtro}" role="button" tabindex="0" aria-pressed="${activo}"` : ''}>
        <div class="label">${k.label}</div>
        <div class="value mono${k.estado ? ' estado' : ''}">${k.value}</div>
        ${k.filtro ? `<div class="ver-detalle">${activo ? 'Filtro activo · clic para quitar' : 'Clic para filtrar'}</div>` : `<div class="sub">${k.sub || '&nbsp;'}</div>`}
      </div>
    </div>`;
  }).join('');

  if (filtroConFoco) contenedor.querySelector(`[data-filtro="${filtroConFoco}"]`)?.focus();
}

function ConseguirCheckboxSeleccionados() {
  const checkboxes = document.querySelectorAll('#lista-notificaciones .notif-item input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => parseInt(cb.id.replace('notif-', '')));
}

/**
 * Panel de alertas sin leer (las críticas primero)
 */
function renderNotificaciones(notificaciones) {
  const contenedor = document.getElementById('lista-notificaciones');
  if (!contenedor) return;
  const seleccionados = ConseguirCheckboxSeleccionados();

  const sinLeer = (Array.isArray(notificaciones) ? notificaciones : []).filter(n => !(n.isRead ?? n.IsRead));
  const conteo = document.getElementById('conteo-notif');
  if (conteo) conteo.textContent = sinLeer.length ? `· ${sinLeer.length}` : '';
  const mas = document.getElementById('notif-mas');
  if (mas) mas.hidden = sinLeer.length <= MAX_NOTIF_PANEL;
  const btn = document.getElementById('btn-marcar-leidas');
  if (btn) btn.disabled = sinLeer.length === 0;

  if (sinLeer.length === 0) {
    contenedor.innerHTML = '<div class="vacio"><b>Todo en orden</b>No hay alertas pendientes.</div>';
    return;
  }

  const peso = { crit: 0, warn: 1, ok: 2 };
  const items = sinLeer.map(n => {
    const nivel = MAPA_TIPO_NOTIF[String(n.type ?? n.Type ?? 'info').toLowerCase()] || 'ok';
    return { n, nivel, fecha: fechaUTC(n.createdAt ?? n.CreatedAt) };
  }).sort((a, b) => peso[a.nivel] - peso[b.nivel] || (b.fecha?.getTime() ?? 0) - (a.fecha?.getTime() ?? 0));

  contenedor.innerHTML = items.slice(0, MAX_NOTIF_PANEL).map(({ n, nivel, fecha }) => {
    const id = n.id ?? n.Id;
    const abs = fecha
      ? `${fecha.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' })} · ${fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
      : '-';
    return `
      <div class="notif-item ${nivel}">
        <span class="dot" style="background:${COLOR_NIVEL[nivel]}"></span>
        <div class="body">
          <div class="msg">${esc(n.message ?? n.Message ?? 'Sin mensaje')}</div>
          <div class="time mono">${abs}<span class="rel"> · ${hace(fecha)}</span></div>
        </div>
        <input type="checkbox" class="check" id="notif-${id}" aria-label="Seleccionar notificación" />
      </div>`;
  }).join('');

  seleccionados.forEach(id => { const cb = document.getElementById(`notif-${id}`); if (cb) cb.checked = true; });
}

function metrica(etiqueta, clave, valor, unidad) {
  const txt = valor != null ? `${Math.round(valor)}${unidad}` : '—';
  const pct = valor != null ? Math.min(Math.max(valor, 0), 100) : 0;
  return `
    <div class="m ${nivelMetrica(clave, valor)}">
      <span>${etiqueta}</span><span class="m-v mono">${txt}</span>
      <span class="m-bar"><i style="width:${pct}%"></i></span>
    </div>`;
}

/**
 * Renderiza la grilla vinculando GetClientComputerDto con StatusReport por PcId
 */
function renderEquipos(equipos, reportes, estadisticas) {
  const contenedor = document.getElementById('grid-equipos');
  if (!contenedor) return;

  if (!Array.isArray(equipos) || equipos.length === 0) {
    contenedor.innerHTML = '<div class="vacio"><b>No hay equipos registrados</b>Cuando un equipo se enrole aparecerá aquí.</div>';
    return;
  }

  // Filtro activo desde los KPIs (kpi-filtro.js)
  if (window.kpiFiltro) {
    const totalEquipos = equipos.length;
    equipos = window.kpiFiltro.filtrar(equipos);
    window.kpiFiltro.actualizarChip(equipos.length, totalEquipos);
    if (equipos.length === 0) {
      contenedor.innerHTML = `<div class="kpi-vacio">${window.kpiFiltro.mensajeVacio()}</div>`;
      return;
    }
  }

  // Crear un mapa con el reporte más reciente por equipo (PcId)
  const reportesPorPc = {};
  if (Array.isArray(reportes)) {
    reportes.forEach(r => {
      const pcId = r.pcId ?? r.PcId;
      if (pcId) {
        // Almacena o actualiza con el reporte más reciente
        if (!reportesPorPc[pcId] || new Date(r.createdAt || r.CreatedAt) > new Date(reportesPorPc[pcId].createdAt || reportesPorPc[pcId].CreatedAt)) {
          reportesPorPc[pcId] = r;
        }
      }
    });
  }
  // crear un mapa de estadisticas por PcId si es necesario
  const estadisticasPorPc = {};
  if (Array.isArray(estadisticas)) {
    estadisticas.forEach(s => {
      const pcId = s.pcId ?? s.PcId;
      if (pcId) {
        // Almacena o actualiza con la estadistica más reciente
        if (!estadisticasPorPc[pcId] || new Date(s.createdAt || s.CreatedAt) > new Date(estadisticasPorPc[pcId].createdAt || estadisticasPorPc[pcId].CreatedAt)) {
          estadisticasPorPc[pcId] = s;
        }
      }
    });
  }

  const conteoEq = document.getElementById('conteo-equipos');
  if (conteoEq) conteoEq.textContent = `· ${equipos.length}`;

  contenedor.innerHTML = equipos.map((e, index) => {
    const id = e.id ?? e.Id;
    const hostName = e.hostName ?? e.HostName ?? '';
    const status = e.status ?? e.Status ?? 0;
    const lastReporteFecha = e.lastStatusReport ?? e.LastStatusReport;

    // Resolver nombre del host
    const host = hostName.trim() !== '' ? hostName : `PC-${String(id || index + 1).padStart(2, '0')}`;


    const lastEstadistica = estadisticasPorPc[id];
    // Estado visual y color
    const infoEstado = MAPA_ESTADOS[status] || MAPA_ESTADOS[4];
    const saludEquipo = lastEstadistica ? (lastEstadistica.computerHealth ?? lastEstadistica.ComputerHealth ?? 0) : 0;
    const infoSalud = MAPA_SALUD[saludEquipo] || MAPA_SALUD[0];
    const esPlantilla = status === 0 || hostName.trim() === '';

    // Obtener las métricas actuales desde el StatusReport vinculado
    const reporteActual = reportesPorPc[id];
    
    const cpuVal = reporteActual ? (reporteActual.cpu ?? reporteActual.Cpu) : null;
    const ramVal = reporteActual ? (reporteActual.ram ?? reporteActual.Ram) : null;
    const tempVal = reporteActual ? (reporteActual.temp ?? reporteActual.Temp) : null;
    const diskVal = reporteActual ? (reporteActual.diskActivity ?? reporteActual.DiskActivity) : null;

    const online = status === 1;
    let chipClase = 'offline', chipTxt = 'Sin conexión';
    if (esPlantilla) { chipClase = ''; chipTxt = 'Sin enrolar'; }
    else if (online) { chipClase = infoSalud.clave; chipTxt = ['Normal', 'Advertencia', 'Crítico'][saludEquipo] || 'Normal'; }
    const claseEstado = esPlantilla ? 'plantilla' : online ? infoSalud.clave : 'offline';

    // Texto de última actualización
    let vistoText = 'Aún no enrolado';
    if (!esPlantilla && lastReporteFecha) {
      const fecha = new Date(lastReporteFecha);
      vistoText = Date.now() - fecha.getTime() < 24 * 3600 * 1000
        ? `Reportó ${fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
        : `Reportó ${fecha.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' })}`;
    }
    const ip = e.ipAddress || e.IpAddress || 'N/A';
    const mac = e.macAddress || e.MacAddress || 'N/A';

    return `
      <div class="equipo ${claseEstado}" data-id="${id}">
        <div class="fila-superior">
          <span class="host mono" title="IP: ${esc(ip)} | MAC: ${esc(mac)}">${esc(host)}</span>
          <span class="chip ${chipClase}">${chipTxt}</span>
        </div>
        <div class="metricas">
          ${metrica('CPU', 'cpu', cpuVal, '%')}
          ${metrica('RAM', 'ram', ramVal, '%')}
          ${metrica('Temperatura', 'temp', tempVal, '°C')}
          ${metrica('Disco', 'disk', diskVal, '%')}
        </div>
        ${window.kpiFiltro ? window.kpiFiltro.nota(id) : ''}
        <div class="visto"><span>${vistoText}</span><span class="mono">${esc(ip)}</span></div>
      </div>
    `;
  }).join('');
}

function actualizarReloj() {
  const el = document.getElementById('ultima-actualizacion');
  if (el) {
    const ahora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    el.textContent = `Actualizado: ${ahora}`;
  }
}

// ---- Consulta a la API via Fetch ----

function closeSession() {
  localStorage.removeItem('token');
  window.location.href = '/html/login.html';
}

async function fetchJSON(url, token) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.status === 401) {
      console.warn(`[HTTP 401] No autorizado al consultar ${url}. Redirigiendo a login.`);
      closeSession();
      return null;
    }

    if (!res.ok) {
      console.warn(`[HTTP ${res.status}] Error consultando ${url}`);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error(`[Fetch Error] Falla al conectar con ${url}`, err);
    return null;
  }
}

// Últimos datos descargados: permiten re-dibujar al cambiar el filtro sin volver a consultar la API
let datosActuales = {};

document.addEventListener('kpi-filtro-cambio', () => {
  const { reportes, equipos, estadisticas } = datosActuales;
  if (!equipos) return;
  renderKpis(reportes, equipos, estadisticas);
  if (estadisticas) renderEquipos(equipos, reportes, estadisticas);
});

async function cargarDatos(token) {
  // Consultas paralelas a los endpoints GET de C#
  const [reportes, notificaciones, equipos, estadisticas] = await Promise.all([
    fetchJSON(ENDPOINTS.adminStatusReport, token),
    fetchJSON(ENDPOINTS.notifications, token),
    fetchJSON(ENDPOINTS.clientComputers, token),
    fetchJSON(ENDPOINTS.clientStadistics, token)
  ]);

  datosActuales = { reportes, equipos, estadisticas };
  renderKpis(reportes, equipos, estadisticas);
  if (notificaciones) renderNotificaciones(notificaciones);
  if (equipos && estadisticas) renderEquipos(equipos, reportes, estadisticas);

  actualizarReloj();
}

// ---- Inicialización ----

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error("No se encontró token de sesión. Redirigiendo a login.");
    window.location.href = '/html/login.html';
    return;
  } 
  cargarDatos(token);
  actualizarReloj();

  setInterval(actualizarReloj, 1000);
  setInterval(() => cargarDatos(token), 5000); // Polling cada 5 segundos
});

async function markAsRead() {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error("No se encontró token de sesión. Redirigiendo a login.");
    window.location.href = '/html/login.html';
    return;
  }

  const selectedIds = ConseguirCheckboxSeleccionados();
  if (selectedIds.length === 0) {
    toast('Selecciona al menos una alerta con la casilla de la derecha.');
    return;
  }
  if (!confirm(`¿Marcar ${selectedIds.length} alerta(s) como leída(s)?`)) return;

  try {
    const res = await fetch(`${ENDPOINTS.notifications}/read-batch`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: `[${selectedIds}]`
    });

    if (res.ok) {
      console.log("Notificaciones marcadas como leídas:", selectedIds);
      cargarDatos(token); // Recargar notificaciones
    } else {
      console.error("Error al marcar notificaciones como leídas:", res.status, await res.text());
      toast("No se pudieron marcar las alertas. Intenta de nuevo.");
    }
  } catch (err) {
    console.error("Error de red al marcar notificaciones como leídas:", err);
    toast("Error de red al marcar las alertas.");
  }
}