import escapeHtml from "../escapeHtml";
import openPrintWindow from "../openPrintWindow";
import sharedPrintStyles from "./sharedStyles";

type InstallmentItem = {
  number: number;
  date: string;
  value: number;
};

type PlanInstructionsPrintData = {
  customerName: string;
  phone?: string | null;
  city?: string | null;
  commercialDate?: string | null;
  serviceName: string;
  paymentMethod: string;
  volumeAmount: number;
  cashAmount: number;
  portfolioAmount: number;
  nextStep: string;
  receptionSummary?: string[];
  assessment?: string | null;
  proposal?: string | null;
  closingNotes?: string | null;
  nextAppointmentDate?: string | null;
  nextAppointmentTime?: string | null;
  nextNotes?: string | null;
  installmentPlan?: InstallmentItem[];
};

export default function printPlanInstructions(data: PlanInstructionsPrintData) {
  const installments =
    data.installmentPlan && data.installmentPlan.length > 0
      ? `<table class="table">
          <thead>
            <tr>
              <th>Cuota</th>
              <th>Fecha</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            ${data.installmentPlan
              .map(
                (item) => `
                  <tr>
                    <td>${item.number}</td>
                    <td>${escapeHtml(item.date)}</td>
                    <td>$${escapeHtml(item.value.toLocaleString("es-CO"))}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>`
      : `<p class="text-block">No aplica plan de cuotas.</p>`;

  const receptionSummary =
    data.receptionSummary && data.receptionSummary.length > 0
      ? `<ul>${data.receptionSummary.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
      : `<p class="text-block">Sin resumen visible de recepción.</p>`;

  const html = `
    <head>
      ${sharedPrintStyles}
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="brand">
            <span class="pill">Prevital</span>
            <h1>Instrucciones del plan</h1>
            <p>Módulo comercial</p>
          </div>
          <div>
            <div class="item-label">Fecha de impresión</div>
            <div class="item-value">${escapeHtml(new Date().toLocaleString("es-CO"))}</div>
          </div>
        </div>

        <div class="box">
          <h2>Datos del cliente</h2>
          <div class="grid">
            <div><div class="item-label">Nombre</div><div class="item-value">${escapeHtml(data.customerName)}</div></div>
            <div><div class="item-label">Teléfono</div><div class="item-value">${escapeHtml(data.phone || "Sin teléfono")}</div></div>
            <div><div class="item-label">Ciudad</div><div class="item-value">${escapeHtml(data.city || "Sin ciudad")}</div></div>
            <div><div class="item-label">Ingreso comercial</div><div class="item-value">${escapeHtml(data.commercialDate || "Sin fecha")}</div></div>
          </div>
        </div>

        <div class="box">
          <h2>Información del plan</h2>
          <div class="grid">
            <div><div class="item-label">Servicio o plan</div><div class="item-value">${escapeHtml(data.serviceName)}</div></div>
            <div><div class="item-label">Forma de pago</div><div class="item-value">${escapeHtml(data.paymentMethod)}</div></div>
            <div><div class="item-label">Volumen</div><div class="item-value">$${escapeHtml(data.volumeAmount.toLocaleString("es-CO"))}</div></div>
            <div><div class="item-label">Caja</div><div class="item-value">$${escapeHtml(data.cashAmount.toLocaleString("es-CO"))}</div></div>
            <div><div class="item-label">Cartera</div><div class="item-value">$${escapeHtml(data.portfolioAmount.toLocaleString("es-CO"))}</div></div>
            <div><div class="item-label">Siguiente paso</div><div class="item-value">${escapeHtml(data.nextStep)}</div></div>
          </div>
        </div>

        <div class="box">
          <h2>Resumen de recepción</h2>
          ${receptionSummary}
        </div>

        <div class="box">
          <h2>Valoración y propuesta comercial</h2>
          <p class="text-block"><strong>Valoración:</strong>
${escapeHtml(data.assessment || "Sin valoración registrada.")}</p>
          <p class="text-block"><strong>Propuesta:</strong>
${escapeHtml(data.proposal || "Sin propuesta registrada.")}</p>
        </div>

        <div class="box">
          <h2>Observaciones de cierre</h2>
          <p class="text-block">${escapeHtml(data.closingNotes || "Sin observaciones adicionales.")}</p>
        </div>

        <div class="box">
          <h2>Continuidad o siguiente cita</h2>
          <div class="grid">
            <div><div class="item-label">Fecha</div><div class="item-value">${escapeHtml(data.nextAppointmentDate || "No definida")}</div></div>
            <div><div class="item-label">Hora</div><div class="item-value">${escapeHtml(data.nextAppointmentTime || "No definida")}</div></div>
          </div>
          <p class="text-block" style="margin-top:14px;"><strong>Notas de continuidad:</strong>
${escapeHtml(data.nextNotes || "Sin notas de continuidad.")}</p>
        </div>

        <div class="box">
          <h2>Detalle de cartera</h2>
          ${installments}
        </div>

        <div class="box">
          <h2>Recomendaciones importantes</h2>
          <ul>
            <li>Conserva este documento como soporte de las indicaciones entregadas.</li>
            <li>En caso de reprogramación o dudas, comunícate con Prevital con anticipación.</li>
            <li>Asiste puntualmente a tus citas y lleva tus documentos si son requeridos.</li>
            <li>Sigue las indicaciones del personal de salud y del área comercial.</li>
            <li>Si existe cartera, respeta el plan de cuotas acordado.</li>
          </ul>
        </div>

        <div class="signatures">
          <div class="signature-line">Firma cliente</div>
          <div class="signature-line">Firma asesor comercial</div>
        </div>
      </div>
      <script>window.onload = function(){ window.print(); };</script>
    </body>
  `;

  openPrintWindow({
    title: "Instrucciones del plan",
    html,
  });
}
