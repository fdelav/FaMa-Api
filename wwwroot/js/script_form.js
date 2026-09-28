const API_URL = "/user/userform";

const $ = id => document.getElementById(id);

// Datos del equipo desde el QR: ?idPc=1&pcCode=504-17&location=Sala%20504
const params = new URLSearchParams(location.search);
const idPc = parseInt(params.get("idPc"), 10);
$("idpc").value = Number.isInteger(idPc) ? idPc : "";
$("pccode").value = params.get("pcCode") || "";
$("location").value = params.get("location") || "";

function aviso(t, e) {
  const el = $("fb");
  el.textContent = t;
  el.className = "msg" + (e ? " err" : "");
  setTimeout(() => el.textContent = "", 4000);
}

if (!Number.isInteger(idPc)) {
  $("enviar").disabled = true;
  aviso("Escanea el código QR del equipo para reportar", true);
}

$("enviar").onclick = async () => {
  // Id y CreatedAt los asigna la API
  const report = {
    Email: $("email").value.trim(),
    IdPc: idPc,
    Location: $("location").value,
    PcCode: $("pccode").value,
    Ticket: $("ticket").value,
    Description: $("description").value.trim()
  };

  if (!report.Email || !report.Ticket || !report.Description) {
    aviso("Completa los campos marcados con *", true);
    return;
  }

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report)
    });
    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      throw new Error(errorBody?.message || `Error HTTP ${res.status}`);
    }
    ["ticket", "description"].forEach(i => $(i).value = "");
    aviso("Reporte enviado ✓");
  } catch (e) {
    alert(`Error al enviar el reporte: ${e.message}`, true);
    aviso("No se pudo guardar el reporte", true);
  }
};
