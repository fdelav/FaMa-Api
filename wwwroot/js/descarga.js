// FaMa · descarga de todos los datos (notificaciones, monitoreo, equipos) en un ZIP
(function () {
  const URL_EXPORT = '/api/download/export-zip';
  const btn = document.getElementById('btn-descargar');
  if (!btn) return;
  const etiqueta = btn.textContent;

  btn.addEventListener('click', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/html/login.html'; return; }

    btn.disabled = true;
    btn.textContent = 'Preparando…';
    try {
      // El endpoint exige el Bearer token, por eso no sirve un <a href> directo
      const res = await fetch(URL_EXPORT, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.status === 401) { closeSession(); return; }
      if (res.status === 404) {
        toast('Descarga no disponible (HTTP 404): el servidor no tiene registrado el endpoint /api/download/export-zip.');
        return;
      }
      if (!res.ok) {
        const detalle = (await res.text().catch(() => '')).slice(0, 200);
        console.error(`[Descarga] HTTP ${res.status}`, detalle);
        toast(`No se pudo descargar el informe (HTTP ${res.status}). Revisa la consola del servidor.`);
        return;
      }

      const blob = await res.blob();
      const fecha = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `informe_completo_${fecha}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Descarga lista.');
    } catch (err) {
      console.error('[Descarga] Falla al exportar el ZIP', err);
      toast('Se cortó la descarga del ZIP (error de red o del servidor). Revisa la consola del servidor.');
    } finally {
      btn.disabled = false;
      btn.textContent = etiqueta;
    }
  });
})();
