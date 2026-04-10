import escapeHtml from "../escapeHtml";
import openPrintWindow from "../openPrintWindow";
import sharedPrintStyles from "./sharedStyles";

type AppointmentPrintData = {
  patientName: string;
  phone?: string | null;
  city?: string | null;
  source?: string | null;
  appointmentDate: string;
  appointmentTime: string;
  statusLabel: string;
  serviceType?: string | null;
  notes?: string | null;
};

export default function printAppointment(data: AppointmentPrintData) {
  const html = `
    <head>
      ${sharedPrintStyles}
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="brand">
            <span class="pill">Prevital</span>
            <h1>Comprobante de cita</h1>
            <p>Agenda de recepción</p>
          </div>
          <div>
            <div class="item-label">Fecha de impresión</div>
            <div class="item-value">${escapeHtml(new Date().toLocaleString("es-CO"))}</div>
          </div>
        </div>

        <div class="box">
          <h2>Datos del cliente</h2>
          <div class="grid">
            <div><div class="item-label">Nombre</div><div class="item-value">${escapeHtml(data.patientName || "Sin nombre")}</div></div>
            <div><div class="item-label">Teléfono</div><div class="item-value">${escapeHtml(data.phone || "Sin teléfono")}</div></div>
            <div><div class="item-label">Ciudad</div><div class="item-value">${escapeHtml(data.city || "Sin ciudad")}</div></div>
            <div><div class="item-label">Fuente</div><div class="item-value">${escapeHtml(data.source || "Sin fuente")}</div></div>
          </div>
        </div>

        <div class="box">
          <h2>Información de la cita</h2>
          <div class="grid">
            <div><div class="item-label">Fecha</div><div class="item-value">${escapeHtml(data.appointmentDate)}</div></div>
            <div><div class="item-label">Hora</div><div class="item-value">${escapeHtml(data.appointmentTime)}</div></div>
            <div><div class="item-label">Estado</div><div class="item-value">${escapeHtml(data.statusLabel)}</div></div>
            <div><div class="item-label">Servicio</div><div class="item-value">${escapeHtml(data.serviceType || "Valoración")}</div></div>
          </div>
        </div>

        <div class="box">
          <h2>Indicaciones importantes</h2>
          <ul>
            <li>Llegar 10 a 15 minutos antes de la cita.</li>
            <li>Presentar documento si es requerido.</li>
            <li>Informar con anticipación si no puede asistir.</li>
            <li>Seguir las recomendaciones dadas por Prevital.</li>
          </ul>
          <p class="muted" style="margin-top:10px;">Conserva este comprobante para tu control de asistencia.</p>
        </div>

        <div class="box">
          <h2>Notas</h2>
          <p class="text-block">${escapeHtml(data.notes || "Sin notas registradas.")}</p>
        </div>

        <div class="signatures">
          <div class="signature-line">Firma del cliente</div>
          <div class="signature-line">Firma de recepción</div>
        </div>
      </div>
      <script>window.onload = function(){ window.print(); };</script>
    </body>
  `;

  openPrintWindow({
    title: "Comprobante de cita",
    html,
  });
}
