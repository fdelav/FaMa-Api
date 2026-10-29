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
  1: { clave: 'Online',        color: 'var(--ok)' },           // 1: Online / Saludable
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

  const ultReporte = ultimoPorPc(reportes);
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

  let calificacion = '-';
  let colorCal = '';
  if (hayConectados) {
    if (criticos > 0) { calificacion = 'Crítico'; colorCal = 'var(--crit)'; }
    else if (advertencias > 0) { calificacion = 'Advertencia'; colorCal = 'var(--warn)'; }
    else { calificacion = 'Normal'; }
  }

  const kpis = [
    { label: 'Equipos conectados', value: enrolados.length > 0 ? `${conectados.length} de ${enrolados.length}` : '-' },
    { label: 'Equipos en estado crítico', value: hayConectados ? criticos : '-', color: criticos > 0 ? 'var(--crit)' : '', filtro: 'criticos' },
    { label: 'Equipos en advertencia', value: hayConectados ? advertencias : '-', color: advertencias > 0 ? 'var(--warn)' : '', filtro: 'advertencia' },
    { label: 'Equipos con fallas recurrentes', value: enrolados.length > 0 ? recurrentes : '-', color: recurrentes > 0 ? 'var(--warn)' : '', filtro: 'recurrentes' },
    { label: 'Estado de flota', value: calificacion, color: colorCal }
  ];

  // El redibujado cada 5 s haría perder el foco del teclado en la tarjeta
  const filtroConFoco = document.activeElement?.dataset?.filtro;
  const filtroActivo = window.kpiFiltro ? window.kpiFiltro.activo() : null;

  contenedor.innerHTML = kpis.map(k => `
    <div class="col-6 col-md">
      <div class="kpi${k.filtro ? ' kpi-click' : ''}${k.filtro && k.filtro === filtroActivo ? ' kpi-activo' : ''}"${k.filtro ? ` data-filtro="${k.filtro}" role="button" tabindex="0" aria-pressed="${k.filtro === filtroActivo}"` : ''}>
        <div class="label">${k.label}</div>
        <div class="value mono"${k.color ? ` style="color:${k.color}"` : ''}>${k.value}</div>
        ${k.filtro ? `<div class="ver-detalle">${k.filtro === filtroActivo ? 'Filtro activo · clic para quitar' : 'Clic para filtrar'}</div>` : ''}
      </div>
    </div>
  `).join('');

  if (filtroConFoco) contenedor.querySelector(`[data-filtro="${filtroConFoco}"]`)?.focus();
}

function ConseguirCheckboxSeleccionados() {
  const checkboxes = document.querySelectorAll('#lista-notificaciones .notif-item input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => parseInt(cb.id.replace('notif-', '')));
}

/**
 * Renderiza la lista basada en NotificationDto
 */
function renderNotificaciones(notificaciones) {
  const contenedor = document.getElementById('lista-notificaciones');
  const checkboxSeleccionados = ConseguirCheckboxSeleccionados();
  if (!contenedor) return;

  if (!Array.isArray(notificaciones) || notificaciones.length === 0) {
    contenedor.innerHTML = '<div class="text-muted p-2">Sin notificaciones recientes</div>';
    return;
  }

  contenedor.innerHTML = notificaciones.filter(n => !n.isRead).map(n => {
    const rawType = (n.type || n.Type || 'info').toLowerCase();
    const nivelClase = MAPA_TIPO_NOTIF[rawType] || 'ok';
    const color = MAPA_ESTADOS[nivelClase === 'ok' ? 1 : nivelClase === 'warn' ? 3 : 3]?.color || 'var(--ok)';
    
    const mensaje = n.message || n.Message || 'Sin mensaje';
    const rawFecha = n.createdAt || n.CreatedAt;
    // Si el servidor manda la fecha sin zona horaria, se asume UTC (igual que en notificaciones.js)
    const fechaObj = rawFecha
      ? new Date(/[zZ]|[+-]\d\d:\d\d$/.test(rawFecha) ? rawFecha : `${rawFecha}Z`)
      : null;
    const hora = fechaObj && !isNaN(fechaObj)
      ? `${fechaObj.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' })} · ${fechaObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
      : '-';

    return `
      <div class="notif-item">
        <span class="dot" style="background:${color}"></span>
        <div>
          <div class="msg">${mensaje}</div>
          <div class="time mono">${hora}</div>
        </div>
        <input type="checkbox" class="check" id="notif-${n.id || n.Id}" />
      </div>
    `;
  }).join('');
  checkboxSeleccionados.forEach(id => {
    const cb = document.getElementById(`notif-${id}`);
    if (cb) cb.checked = true;
  });
}

/**
 * Renderiza la grilla vinculando GetClientComputerDto con StatusReport por PcId
 */
function renderEquipos(equipos, reportes, estadisticas) {
  const contenedor = document.getElementById('grid-equipos');
  if (!contenedor) return;

  if (!Array.isArray(equipos) || equipos.length === 0) {
    contenedor.innerHTML = '<div class="col-12 text-muted">No hay equipos registrados.</div>';
    return;
  }

  // Filtro activo desde los KPIs (kpi-filtro.js)
  if (window.kpiFiltro) {
    const totalEquipos = equipos.length;
    equipos = window.kpiFiltro.filtrar(equipos);
    window.kpiFiltro.actualizarChip(equipos.length, totalEquipos);
    if (equipos.length === 0) {
      contenedor.innerHTML = `<div class="kpi-vacio text-muted p-2">${window.kpiFiltro.mensajeVacio()}</div>`;
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

    const cpuStr = cpuVal != null ? `${Math.round(cpuVal)}%` : '—';
    const ramStr = ramVal != null ? `${Math.round(ramVal)}%` : '—';
    const tempStr = tempVal != null ? `${Math.round(tempVal)}°C` : '—';
    const diskStr = diskVal != null ? `${Math.round(diskVal)}%` : '—';

    // Texto de última actualización
    let vistoText = 'Aún no enrolado';
    if (!esPlantilla && lastReporteFecha) {
      const fecha = new Date(lastReporteFecha);
      const haceMasDeUnDia = Date.now() - fecha.getTime() > 24 * 60 * 60 * 1000;
      if (!haceMasDeUnDia) {
        vistoText = `Reportó: ${fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
      } else {
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);
        const esAyer = fecha.getFullYear() === ayer.getFullYear()
          && fecha.getMonth() === ayer.getMonth()
          && fecha.getDate() === ayer.getDate();
        const fechaText = esAyer
          ? 'Ayer'
          : fecha.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
        vistoText = `Reportó: ${fechaText}`;
      }
    }

    return `
      <div class="equipo ${infoEstado.clave} ${infoSalud.clave}">
        <div class="fila-superior">
          <span class="host mono" title="IP: ${e.ipAddress || e.IpAddress || 'N/A'} | MAC: ${e.macAddress || e.MacAddress || 'N/A'}">${host}</span>
          <span class="estado-dot" style="background:${infoSalud.color}"></span>
        </div>
        <div class="metricas">
          <div>CPU<span class="num mono">${cpuStr}</span></div>
          <div>RAM<span class="num mono">${ramStr}</span></div>
          <div>Temp<span class="num mono">${tempStr}</span></div>
          <div>Disco<span class="num mono">${diskStr}</span></div>
        </div>
        ${window.kpiFiltro ? window.kpiFiltro.nota(id) : ''}
        <div class="visto">${vistoText}</div>
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
  const confirmed = confirm(`¿Está seguro de marcar ${selectedIds.length} notificación(es) como leída(s)?`) || selectedIds.length === 0;
  if (!confirmed) return;
  if (selectedIds.length === 0) {
    alert("Seleccione al menos una notificación para marcar como leída.");
    return;
  }

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
      alert("Error al marcar notificaciones como leídas. Revise la consola para más detalles.");
    }
  } catch (err) {
    console.error("Error de red al marcar notificaciones como leídas:", err);
    alert("Error de red al marcar notificaciones como leídas. Revise la consola para más detalles.");
  }
}