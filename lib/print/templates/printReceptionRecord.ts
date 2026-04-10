import escapeHtml from "../escapeHtml";
import openPrintWindow from "../openPrintWindow";
import sharedPrintStyles from "./sharedStyles";

type ReceptionRecordPrintData = {
  customerName: string;
  phone?: string | null;
  city?: string | null;
  document?: string | null;
  source?: string | null;
  referredBy?: string | null;
  initialClassification?: string | null;
  classificationReason?: string | null;
  hasEps?: string | null;
  affiliation?: string | null;
  age?: string | null;
  bringsId?: string | null;
  smartphone?: string | null;
  occupation?: string | null;
  disqualifyingConditions?: string[];
  observations?: string | null;
};

export default function printReceptionRecord(data: ReceptionRecordPrintData) {
  const conditions =
    data.disqualifyingConditions && data.disqualifyingConditions.length > 0
      ? `<ul>${data.disqualifyingConditions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : `<p class="text-block">Ninguna de las anteriores.</p>`;

  const html = `
    <head>
      ${sharedPrintStyles}
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="brand">
            <span class="pill">Prevital</span>
            <h1>Registro de recepción</h1>
            <p>Ingreso comercial y validación inicial del cliente</p>
          </div>
          <div>
            <div class="item-label">Fecha de impresión</div>
            <div class="item-value">${escapeHtml(new Date().toLocaleString("es-CO"))}</div>
          </div>
        </div>

        <div class="box">
          <h2>Datos del cliente</h2>
          <div class="grid">
            <div><div class="item-label">Nombre</div><div class="item-value">${escapeHtml(data.customerName || "Sin nombre")}</div></div>
            <div><div class="item-label">Teléfono</div><div class="item-value">${escapeHtml(data.phone || "Sin teléfono")}</div></div>
            <div><div class="item-label">Ciudad</div><div class="item-value">${escapeHtml(data.city || "Sin ciudad")}</div></div>
            <div><div class="item-label">Documento</div><div class="item-value">${escapeHtml(data.document || "Sin documento")}</div></div>
            <div><div class="item-label">Fuente</div><div class="item-value">${escapeHtml(data.source || "Sin fuente")}</div></div>
            <div><div class="item-label">Referido por</div><div class="item-value">${escapeHtml(data.referredBy || "No aplica")}</div></div>
          </div>
        </div>

        <div class="box">
          <h2>Clasificación inicial</h2>
          <div class="grid">
            <div><div class="item-label">Resultado</div><div class="item-value">${escapeHtml(data.initialClassification || "Sin definir")}</div></div>
            <div><div class="item-label">Motivo</div><div class="item-value">${escapeHtml(data.classificationReason || "Sin motivo")}</div></div>
          </div>
        </div>

        <div class="box">
          <h2>Información de validación</h2>
          <div class="grid">
            <div><div class="item-label">Tiene EPS</div><div class="item-value">${escapeHtml(data.hasEps || "Sin definir")}</div></div>
            <div><div class="item-label">Afiliación</div><div class="item-value">${escapeHtml(data.affiliation || "Sin definir")}</div></div>
            <div><div class="item-label">Edad</div><div class="item-value">${escapeHtml(data.age || "Sin dato")}</div></div>
            <div><div class="item-label">Asiste con cédula</div><div class="item-value">${escapeHtml(data.bringsId || "Sin definir")}</div></div>
            <div><div class="item-label">Celular inteligente</div><div class="item-value">${escapeHtml(data.smartphone || "Sin definir")}</div></div>
            <div><div class="item-label">Ocupación</div><div class="item-value">${escapeHtml(data.occupation || "Sin definir")}</div></div>
          </div>
        </div>

        <div class="box">
          <h2>Condiciones descalificantes</h2>
          ${conditions}
        </div>

        <div class="box">
          <h2>Observaciones de recepción</h2>
          <p class="text-block">${escapeHtml(data.observations || "Sin observaciones registradas.")}</p>
          <p class="muted" style="margin-top:10px;">Este formato puede usarse como soporte interno o para archivo del proceso de admisión.</p>
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
    title: "Registro de recepción",
    html,
  });
}
