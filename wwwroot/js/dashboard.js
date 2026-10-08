// ---- Configuración Backend (API C#) ----
// Si frontend y backend están en servidores o puertos distintos en desarrollo, coloca 'http://localhost:5000'
// Si el frontend lo sirve el propio backend, deja API_BASE_URL en ''
const API_BASE_URL = '';

const ENDPOINTS = {
  adminStatusReport: `${API_BASE_URL}/admin/statusreport`,
  clientStadistics: `${API_BASE_URL}/admin/clientstatistics`,
  notifications: `${API_BASE_URL}/api/notifications`,
  clientComputers: `${API_BASE_URL}/clientcomputer`
};

// Mapeo de enums numéricos de Status
const MAPA_ESTADOS = {
  0: { clave: 'plantilla', color: 'var(--panel-border)' }, // 0: No enrolado / Plantilla
  1: { clave: 'Online',        color: 'var(--ok)' },           // 1: Online / Saludable
  2: { clave: 'offline',   color: 'var(--offline)' },       // 2: Offline  
};

const MAPA_SALUD = {
  1: { clave: 'ok',          color: 'var(--ok)' },           // 1: Saludable
  2: { clave: 'warn',        color: 'var(--warn)' },         // 2: Advertencia
  3: { clave: 'crit',        color: 'var(--crit)' }          // 3: Crítico
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
 * Renderiza la fila de KPIs globales
 * Soporta tanto la respuesta de un reporte consolidado como de la lista de StatusReport
 */
function renderKpis(statusData, equipos) {
  const contenedor = document.getElementById('fila-kpis');
  if (!contenedor) return;

  let conectados = 0;
  let cpuPromedio = 0;
  let ramPromedio = 0;
  let tempPromedio = 0;

  if (Array.isArray(equipos)) {
    conectados = equipos.filter(e => e.status === 1 || e.Status === 1).length;
  }

  // Si /admin/statusreport retorna la lista de reportes individuales (StatusReport)
  if (Array.isArray(statusData) && statusData.length > 0) {
    const total = statusData.length;
    const cpuSum = statusData.reduce((acc, r) => acc + (r.cpu ?? r.Cpu ?? 0), 0);
    const ramSum = statusData.reduce((acc, r) => acc + (r.ram ?? r.Ram ?? 0), 0);
    const tempSum = statusData.reduce((acc, r) => acc + (r.temp ?? r.Temp ?? 0), 0);

    cpuPromedio = Math.round(cpuSum / total);
    ramPromedio = Math.round(ramSum / total);
    tempPromedio = Math.round(tempSum / total);
  } else if (statusData && typeof statusData === 'object') {
    // Si la API retorna un DTO consolidado en lugar de una lista
    cpuPromedio = Math.round(statusData.cpuAverage ?? statusData.cpuPromedio ?? 0);
    ramPromedio = Math.round(statusData.ramAverage ?? statusData.ramPromedio ?? 0);
    tempPromedio = Math.round(statusData.tempAverage ?? statusData.tempPromedio ?? 0);
    if (statusData.connectedCount != null) conectados = statusData.connectedCount;
  }

  const kpis = [
    { label: 'Equipos conectados', value: conectados > 0 ? conectados : '-' },
    { label: 'Promedio CPU', value: cpuPromedio > 0 ? `${cpuPromedio}%` : '-' },
    { label: 'Promedio RAM', value: ramPromedio > 0 ? `${ramPromedio}%` : '-' },
    { label: 'Promedio Temperatura', value: tempPromedio > 0 ? `${tempPromedio}°C` : '-' },
    { label: 'Clasificación de estado', value: conectados > 0 ? 'Normal' : '-' }
  ];

  contenedor.innerHTML = kpis.map(k => `
    <div class="col-6 col-md-4 col-lg">
      <div class="kpi">
        <div class="label">${k.label}</div>
        <div class="value mono">${k.value}</div>
      </div>
    </div>
  `).join('');
}

/**
 * Renderiza la lista basada en NotificationDto
 */
function renderNotificaciones(notificaciones) {
  const contenedor = document.getElementById('lista-notificaciones');
  if (!contenedor) return;

  if (!Array.isArray(notificaciones) || notificaciones.length === 0) {
    contenedor.innerHTML = '<div class="text-muted p-2">Sin notificaciones recientes</div>';
    return;
  }

  contenedor.innerHTML = notificaciones.map(n => {
    const rawType = (n.type || n.Type || 'info').toLowerCase();
    const nivelClase = MAPA_TIPO_NOTIF[rawType] || 'ok';
    const color = MAPA_ESTADOS[nivelClase === 'ok' ? 1 : nivelClase === 'warn' ? 3 : 3]?.color || 'var(--ok)';
    
    const mensaje = n.message || n.Message || 'Sin mensaje';
    const rawFecha = n.createdAt || n.CreatedAt;
    const hora = rawFecha 
      ? new Date(rawFecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) 
      : '-';

    return `
      <div class="notif-item">
        <span class="dot" style="background:${color}"></span>
        <div>
          <div class="msg">${mensaje}</div>
          <div class="time mono">${hora}</div>
        </div>
      </div>
    `;
  }).join('');
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
    const infoSalud = MAPA_SALUD[lastEstadistica?.HealthStatus ?? 1] || MAPA_SALUD[1];
    const esPlantilla = status === 0 || hostName.trim() === '';

    // Obtener las métricas actuales desde el StatusReport vinculado
    const reporteActual = reportesPorPc[id];
    
    const cpuVal = reporteActual ? (reporteActual.cpu ?? reporteActual.Cpu) : null;
    const ramVal = reporteActual ? (reporteActual.ram ?? reporteActual.Ram) : null;
    const tempVal = reporteActual ? (reporteActual.temp ?? reporteActual.Temp) : null;

    const cpuStr = cpuVal != null ? `${Math.round(cpuVal)}%` : '—';
    const ramStr = ramVal != null ? `${Math.round(ramVal)}%` : '—';
    const tempStr = tempVal != null ? `${Math.round(tempVal)}°C` : '—';

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
        </div>
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

async function fetchJSON(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

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

async function cargarDatos() {
  // Consultas paralelas a los endpoints GET de C#
  const [reportes, notificaciones, equipos, estadisticas] = await Promise.all([
    fetchJSON(ENDPOINTS.adminStatusReport),
    fetchJSON(ENDPOINTS.notifications),
    fetchJSON(ENDPOINTS.clientComputers),
    fetchJSON(ENDPOINTS.clientStadistics)
  ]);

  renderKpis(reportes, equipos);
  if (notificaciones) renderNotificaciones(notificaciones);
  if (equipos && estadisticas) renderEquipos(equipos, reportes, estadisticas);

  actualizarReloj();
}

// ---- Inicialización ----

document.addEventListener('DOMContentLoaded', () => {
  cargarDatos();
  actualizarReloj();

  setInterval(actualizarReloj, 1000);
  setInterval(cargarDatos, 5000); // Polling cada 5 segundos
});