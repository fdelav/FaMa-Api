// ============================================================================
// kpi-filtro.js  (ARCHIVO NUEVO — reemplaza a kpi-detalle.js)
// Los KPIs "crítico", "advertencia" y "fallas recurrentes" muestran el conteo y,
// al hacer clic, filtran la grilla de equipos del home. No toca endpoints ni
// modelos: usa los datos que dashboard.js ya descarga (equipos + ClientStatistics).
//
// Cada fila de ClientStatistics es una "foto" del equipo cada ~5 min (la crea
// EstadisticasWorker) con su ComputerHealth (0 sano, 1 advertencia, 2 crítico).
// Con eso se estiman minutos en crítico y episodios, sin las lecturas crudas.
// ============================================================================
(function (global) {
  'use strict';

  // ---- Parámetros del criterio (ajustar con TIC cuando haya datos reales) ----
  const CONFIG = {
    VENTANA_DIAS: 7,          // Ventana fija de "recurrente" (incluye hoy)
    STAT_INTERVALO_MIN: 5,    // Cada estadística representa ~5 min (EstadisticasWorker)
    MIN_CRITICO_DIA: 30,      // Un día cuenta como "con falla" si acumula >= X min en crítico...
    EPISODIOS_DIA: 2,         // ...o si tuvo >= N episodios (recaída tras estabilizarse)
    PAUSA_EPISODIO_MIN: 12,   // Dos críticos separados por más de esto = episodios distintos
    DIAS_RECURRENTE: 2        // Equipo recurrente = >= M días con falla en la ventana
  };

  // Mismos umbrales que EstadisticasWorker.EvaluatedComputerStatus (solo para
  // explicar QUÉ métrica llevó al equipo a ese estado).
  const METRICAS = [
    { clave: 'temp',  nombre: 'Temp',  crit: 85, warn: 75, unidad: '°C' },
    { clave: 'cpu',   nombre: 'CPU',   crit: 98, warn: 80, unidad: '%' },
    { clave: 'ram',   nombre: 'RAM',   crit: 95, warn: 85, unidad: '%' },
    { clave: 'disco', nombre: 'Disco', crit: 95, warn: 85, unidad: '%' }
  ];

  const FILTROS = {
    criticos:    { titulo: 'En estado crítico',      vacio: 'Ningún equipo en estado crítico en este momento.' },
    advertencia: { titulo: 'En advertencia',         vacio: 'Ningún equipo en estado de advertencia en este momento.' },
    recurrentes: { titulo: 'Con fallas recurrentes', vacio: `Ningún equipo cumple el criterio de falla recurrente en los últimos ${CONFIG.VENTANA_DIAS} días.` }
  };

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------
  const pad = n => String(n).padStart(2, '0');

  // Si el servidor manda la fecha sin zona horaria se asume UTC (igual que dashboard.js)
  function parseFecha(raw) {
    if (!raw) return null;
    const s = String(raw);
    const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : `${s}Z`);
    return isNaN(d) ? null : d;
  }

  const claveDia = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  function fmtFecha(d) {
    return d ? d.toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '-';
  }

  // Hora si es de hoy; fecha corta + hora si es de otro día
  function fmtCorto(d, ahora = new Date()) {
    const hora = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    if (claveDia(d) === claveDia(ahora)) return hora;
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hora}`;
  }

  const fmtNum = n => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 1 });

  function esc(txt) {
    return String(txt ?? '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function nombreEquipo(e) {
    const id = e.id ?? e.Id;
    const host = (e.hostName ?? e.HostName ?? '').trim();
    return host !== '' ? host : `PC-${pad(id)}`;
  }

  const estadoDe = e => e.status ?? e.Status ?? 0;
  const idDe = e => e.id ?? e.Id;

  // ---------------------------------------------------------------------------
  // { pcId -> [estadísticas ordenadas de más antigua a más reciente] }
  // ---------------------------------------------------------------------------
  function estadisticasPorPc(estadisticas) {
    const mapa = {};
    if (!Array.isArray(estadisticas)) return mapa;
    estadisticas.forEach(s => {
      const pcId = s.pcId ?? s.PcId;
      const fecha = parseFecha(s.createdAt ?? s.CreatedAt);
      if (pcId == null || !fecha) return;
      (mapa[pcId] ||= []).push({
        fecha,
        salud: s.computerHealth ?? s.ComputerHealth ?? 0,
        temp: s.tempMean ?? s.TempMean ?? 0,
        cpu: s.cpuMean ?? s.CpuMean ?? 0,
        ram: s.ramMean ?? s.RamMean ?? 0,
        disco: s.diskActivityMean ?? s.DiskActivityMean ?? 0
      });
    });
    Object.values(mapa).forEach(arr => arr.sort((a, b) => a.fecha - b.fecha));
    return mapa;
  }

  // Un episodio nuevo empieza cuando la pausa respecto al crítico anterior
  // supera PAUSA_EPISODIO_MIN (fechas en orden ascendente).
  function contarEpisodios(fechasAsc) {
    let episodios = 0;
    let previa = null;
    fechasAsc.forEach(f => {
      if (previa === null || (f - previa) / 60000 > CONFIG.PAUSA_EPISODIO_MIN) episodios++;
      previa = f;
    });
    return episodios;
  }

  function metricasQueSuperan(stat, nivel) {
    return METRICAS
      .filter(m => stat[m.clave] >= m[nivel])
      .map(m => `${m.nombre} ${fmtNum(stat[m.clave])}${m.unidad} (umbral ${m[nivel]})`);
  }

  // ---------------------------------------------------------------------------
  // Equipos conectados cuya ÚLTIMA estadística tiene la salud indicada
  // (misma regla que renderKpis en dashboard.js)
  // ---------------------------------------------------------------------------
  function conSaludActual(equipos, estadisticas, salud) {
    const porPc = estadisticasPorPc(estadisticas);
    const filas = [];
    (Array.isArray(equipos) ? equipos : []).filter(e => estadoDe(e) === 1).forEach(e => {
      const id = idDe(e);
      const stats = porPc[id];
      if (!stats || stats.length === 0) return;
      const ultima = stats[stats.length - 1];
      if (ultima.salud !== salud) return;

      // Desde cuándo: se retrocede mientras las estadísticas sigan en ese estado,
      // sin pausas largas entre una y otra.
      let desde = ultima.fecha;
      for (let i = stats.length - 2; i >= 0; i--) {
        if (stats[i].salud !== salud) break;
        if ((stats[i + 1].fecha - stats[i].fecha) / 60000 > CONFIG.PAUSA_EPISODIO_MIN) break;
        desde = stats[i].fecha;
      }

      const causas = metricasQueSuperan(ultima, salud === 2 ? 'crit' : 'warn');
      filas.push({
        id,
        host: nombreEquipo(e),
        metrica: causas.length ? causas.join(' · ') : (salud === 2 ? 'Estado crítico' : 'Advertencia'),
        desde,
        ultimoReporte: ultima.fecha
      });
    });
    filas.sort((a, b) => a.desde - b.desde); // el que lleva más tiempo, primero
    return filas;
  }

  const calcularCriticos = (equipos, estadisticas) => conSaludActual(equipos, estadisticas, 2);
  const calcularAdvertencia = (equipos, estadisticas) => conSaludActual(equipos, estadisticas, 1);

  // ---------------------------------------------------------------------------
  // Fallas recurrentes en la ventana de VENTANA_DIAS (equipos enrolados)
  //  - Día con falla = >= MIN_CRITICO_DIA min en crítico  O  >= EPISODIOS_DIA episodios
  //  - Recurrente    = >= DIAS_RECURRENTE días con falla
  // ---------------------------------------------------------------------------
  function ventana(ahora) {
    const inicio = new Date(ahora);
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(inicio.getDate() - (CONFIG.VENTANA_DIAS - 1));
    return { inicio, fin: ahora };
  }

  function calcularRecurrentes(equipos, estadisticas, ahora = new Date()) {
    const porPc = estadisticasPorPc(estadisticas);
    const { inicio } = ventana(ahora);
    const filas = [];

    (Array.isArray(equipos) ? equipos : []).filter(e => estadoDe(e) !== 0).forEach(e => {
      const id = idDe(e);
      const criticas = (porPc[id] || []).filter(s => s.salud === 2 && s.fecha >= inicio && s.fecha <= ahora);
      if (criticas.length === 0) return;

      const porDia = {};
      criticas.forEach(s => (porDia[claveDia(s.fecha)] ||= []).push(s.fecha));

      let diasConFalla = 0;
      let episodiosTotal = 0;
      Object.values(porDia).forEach(fechas => {
        const episodios = contarEpisodios(fechas);
        episodiosTotal += episodios;
        if (fechas.length * CONFIG.STAT_INTERVALO_MIN >= CONFIG.MIN_CRITICO_DIA || episodios >= CONFIG.EPISODIOS_DIA) {
          diasConFalla++;
        }
      });

      if (diasConFalla >= CONFIG.DIAS_RECURRENTE) {
        filas.push({ id, host: nombreEquipo(e), diasConFalla, episodios: episodiosTotal, ultimaAlerta: criticas[criticas.length - 1].fecha });
      }
    });

    filas.sort((a, b) => b.diasConFalla - a.diasConFalla || b.ultimaAlerta - a.ultimaAlerta);
    return filas;
  }

  // ---------------------------------------------------------------------------
  // Estado del filtro y caché de resultados (se recalcula en cada ciclo de polling)
  // ---------------------------------------------------------------------------
  let filtro = null; // null | 'criticos' | 'advertencia' | 'recurrentes'
  let cache = { criticos: new Map(), advertencia: new Map(), recurrentes: new Map() };

  const aMapa = filas => new Map(filas.map(f => [f.id, f]));

  function actualizarDatos(equipos, estadisticas) {
    cache = {
      criticos: aMapa(calcularCriticos(equipos, estadisticas)),
      advertencia: aMapa(calcularAdvertencia(equipos, estadisticas)),
      recurrentes: aMapa(calcularRecurrentes(equipos, estadisticas))
    };
  }

  const activo = () => filtro;
  const conteo = clave => cache[clave].size;

  function alternar(clave) {
    filtro = filtro === clave ? null : clave;
    document.dispatchEvent(new CustomEvent('kpi-filtro-cambio'));
  }

  // Deja solo los equipos del filtro activo (sin filtro, devuelve la lista intacta)
  function filtrar(equipos) {
    if (!filtro || !Array.isArray(equipos)) return equipos;
    return equipos.filter(e => cache[filtro].has(idDe(e)));
  }

  function mensajeVacio() {
    return esc(filtro ? FILTROS[filtro].vacio : '');
  }

  // Notas dentro de la tarjeta del equipo (siempre visibles, no solo con filtro)
  function nota(id) {
    const out = [];
    const crit = cache.criticos.get(id);
    if (crit) out.push(`<div class="nota-kpi nota-crit">Crítico desde ${esc(fmtCorto(crit.desde))}</div>`);
    const adv = cache.advertencia.get(id);
    if (adv) out.push(`<div class="nota-kpi nota-warn" title="${esc(adv.metrica)}">Advertencia desde ${esc(fmtCorto(adv.desde))}</div>`);
    const rec = cache.recurrentes.get(id);
    if (rec) {
      const tip = `${rec.episodios} episodios en ${CONFIG.VENTANA_DIAS} días. Día con falla = ≥ ${CONFIG.MIN_CRITICO_DIA} min en crítico o ≥ ${CONFIG.EPISODIOS_DIA} episodios.`;
      out.push(`<div class="nota-kpi nota-rec" title="${esc(tip)}">Recurrente · ${rec.diasConFalla} de ${CONFIG.VENTANA_DIAS} días con falla</div>`);
    }
    return out.join('');
  }

  // Resumen junto al título del panel "Equipos"
  function actualizarChip(mostrados, total) {
    const el = document.getElementById('filtro-activo');
    if (!el) return;
    if (!filtro) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <span class="filtro-chip">
        Filtro: <strong>${esc(FILTROS[filtro].titulo)}</strong> · ${mostrados} de ${total}
        <button type="button" class="kpi-btn" data-accion="csv">Exportar CSV</button>
        <button type="button" class="kpi-btn" data-accion="quitar">Quitar filtro</button>
      </span>`;
  }

  // ---------------------------------------------------------------------------
  // Exportar CSV del filtro activo (para documentar quiénes estaban en ese estado)
  // ---------------------------------------------------------------------------
  function construirCsv(ahora = new Date()) {
    if (!filtro) return null;
    const filas = [...cache[filtro].values()];
    let meta, columnas, datos;

    if (filtro === 'recurrentes') {
      const { inicio } = ventana(ahora);
      meta = [
        `Últimos ${CONFIG.VENTANA_DIAS} días (${inicio.toLocaleDateString('es-CO')} al ${ahora.toLocaleDateString('es-CO')})`,
        `Día con falla = >= ${CONFIG.MIN_CRITICO_DIA} min en crítico o >= ${CONFIG.EPISODIOS_DIA} episodios (separados por más de ${CONFIG.PAUSA_EPISODIO_MIN} min sin estado crítico). Recurrente = >= ${CONFIG.DIAS_RECURRENTE} días con falla.`
      ];
      columnas = ['Equipo', 'Días con falla', 'Días de la ventana', 'Episodios', 'Última alerta'];
      datos = filas.map(f => [f.host, f.diasConFalla, CONFIG.VENTANA_DIAS, f.episodios, fmtFecha(f.ultimaAlerta)]);
    } else {
      const nivel = filtro === 'criticos' ? 'crit' : 'warn';
      meta = [`Estado según la estadística más reciente de cada equipo conectado (umbral: ${METRICAS.map(m => `${m.nombre} >= ${m[nivel]}`).join(', ')}).`];
      columnas = ['Equipo', 'Métrica', `${filtro === 'criticos' ? 'En crítico' : 'En advertencia'} desde`, 'Último reporte'];
      datos = filas.map(f => [f.host, f.metrica, fmtFecha(f.desde), fmtFecha(f.ultimoReporte)]);
    }

    const celda = v => `"${String(v).replace(/"/g, '""')}"`;
    const lineas = [
      [`Equipos ${FILTROS[filtro].titulo.toLowerCase()}`],
      [`Generado: ${fmtFecha(ahora)}`],
      ...meta.map(m => [m]),
      [],
      columnas,
      ...(datos.length ? datos : [[FILTROS[filtro].vacio]])
    ].map(f => f.map(celda).join(';'));
    // BOM para que Excel respete los acentos; ';' porque Excel en es-CO lo usa como separador
    return { texto: '\ufeff' + lineas.join('\r\n'), nombre: `equipos-${filtro}-${claveDia(ahora)}.csv` };
  }

  function exportarCsv() {
    const csv = construirCsv();
    if (!csv) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv.texto], { type: 'text/csv;charset=utf-8' }));
    a.download = csv.nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  // ---------------------------------------------------------------------------
  // Eventos. Los KPIs y el chip se redibujan con innerHTML, así que se delega
  // en contenedores fijos.
  // ---------------------------------------------------------------------------
  function activarEventos() {
    const fila = document.getElementById('fila-kpis');
    if (fila) {
      const disparar = ev => {
        const tarjeta = ev.target.closest('[data-filtro]');
        if (tarjeta) alternar(tarjeta.dataset.filtro);
      };
      fila.addEventListener('click', disparar);
      fila.addEventListener('keydown', ev => {
        if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.closest('[data-filtro]')) {
          ev.preventDefault();
          disparar(ev);
        }
      });
    }
    const chip = document.getElementById('filtro-activo');
    if (chip) {
      chip.addEventListener('click', ev => {
        const accion = ev.target.closest('[data-accion]')?.dataset.accion;
        if (accion === 'quitar') alternar(filtro);
        else if (accion === 'csv') exportarCsv();
      });
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', activarEventos);
  }

  global.kpiFiltro = {
    CONFIG, actualizarDatos, activo, conteo, filtrar, nota, mensajeVacio, actualizarChip,
    calcularCriticos, calcularAdvertencia, calcularRecurrentes, construirCsv
  };
  if (typeof module !== 'undefined') module.exports = global.kpiFiltro; // solo para pruebas en Node
})(typeof window !== 'undefined' ? window : globalThis);
