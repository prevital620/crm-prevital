import escapeHtml from "../escapeHtml";
import openPrintWindow from "../openPrintWindow";
import sharedPrintStyles from "./sharedStyles";

type PhysiotherapySummaryPrintData = {
  customerName: string;
  document?: string | null;
  phone?: string | null;
  city?: string | null;
  appointmentDate?: string | null;
  appointmentTime?: string | null;
  serviceName?: string | null;
  antecedentesPatologicos?: string | null;
  cirugias?: string | null;
  toxicos?: string | null;
  alergicos?: string | null;
  medicamentos?: string | null;
  familiares?: string | null;
  analisisComercial?: string | null;
  presionArterial?: string | null;
  frecuenciaCardiaca?: string | null;
  inspeccionGeneral?: string | null;
  dolor?: string | null;
  inflamacion?: string | null;
  limitacionMovilidad?: string | null;
  pruebaSemiologica?: string | null;
  flexibilidad?: string | null;
  fuerzaMuscular?: string | null;
  rangosMovimientoArticular?: string | null;
  planIntervencion?: string | null;
  observacionesGenerales?: string | null;
};

function text(value: string | null | undefined, fallback = "Sin registrar") {
  return escapeHtml(value || fallback);
}

export default function printPhysiotherapySummary(data: PhysiotherapySummaryPrintData) {
  const html = `
    <head>
      ${sharedPrintStyles}
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="brand">
            <span class="pill">Prevital</span>
            <h1>Historia e indicaciones de fisioterapia</h1>
            <p>Documento emitido desde recepcion</p>
          </div>
          <div>
            <div class="item-label">Fecha de impresion</div>
            <div class="item-value">${escapeHtml(new Date().toLocaleString("es-CO"))}</div>
          </div>
        </div>

        <div class="box">
          <h2>Datos del paciente</h2>
          <div class="grid">
            <div><div class="item-label">Nombre</div><div class="item-value">${text(data.customerName, "Paciente")}</div></div>
            <div><div class="item-label">Documento</div><div class="item-value">${text(data.document)}</div></div>
            <div><div class="item-label">Telefono</div><div class="item-value">${text(data.phone)}</div></div>
            <div><div class="item-label">Ciudad</div><div class="item-value">${text(data.city)}</div></div>
            <div><div class="item-label">Fecha cita</div><div class="item-value">${text(data.appointmentDate)}</div></div>
            <div><div class="item-label">Hora cita</div><div class="item-value">${text(data.appointmentTime)}</div></div>
          </div>
          <p class="text-block" style="margin-top:14px;"><strong>Servicio:</strong> ${text(data.serviceName)}</p>
        </div>

        <div class="box">
          <h2>Historia clinica</h2>
          <div class="grid">
            <div><div class="item-label">Antecedentes patologicos</div><div class="item-value">${text(data.antecedentesPatologicos)}</div></div>
            <div><div class="item-label">Cirugias</div><div class="item-value">${text(data.cirugias)}</div></div>
            <div><div class="item-label">Toxicos</div><div class="item-value">${text(data.toxicos)}</div></div>
            <div><div class="item-label">Alergicos</div><div class="item-value">${text(data.alergicos)}</div></div>
            <div><div class="item-label">Medicamentos</div><div class="item-value">${text(data.medicamentos)}</div></div>
            <div><div class="item-label">Antecedentes familiares</div><div class="item-value">${text(data.familiares)}</div></div>
            <div><div class="item-label">Analisis comercial</div><div class="item-value">${text(data.analisisComercial)}</div></div>
            <div><div class="item-label">Presion arterial</div><div class="item-value">${text(data.presionArterial)}</div></div>
            <div><div class="item-label">Frecuencia cardiaca</div><div class="item-value">${text(data.frecuenciaCardiaca)}</div></div>
            <div><div class="item-label">Inspeccion general</div><div class="item-value">${text(data.inspeccionGeneral)}</div></div>
            <div><div class="item-label">Dolor</div><div class="item-value">${text(data.dolor)}</div></div>
            <div><div class="item-label">Inflamacion</div><div class="item-value">${text(data.inflamacion)}</div></div>
            <div><div class="item-label">Limitacion movilidad</div><div class="item-value">${text(data.limitacionMovilidad)}</div></div>
            <div><div class="item-label">Prueba semiologica</div><div class="item-value">${text(data.pruebaSemiologica)}</div></div>
            <div><div class="item-label">Flexibilidad</div><div class="item-value">${text(data.flexibilidad)}</div></div>
            <div><div class="item-label">Fuerza muscular</div><div class="item-value">${text(data.fuerzaMuscular)}</div></div>
            <div><div class="item-label">Rangos movimiento articular</div><div class="item-value">${text(data.rangosMovimientoArticular)}</div></div>
          </div>
        </div>

        <div class="box">
          <h2>Indicaciones y formulacion</h2>
          <p class="text-block"><strong>Medicamentos reportados:</strong>
${text(data.medicamentos)}</p>
          <p class="text-block"><strong>Plan de intervencion:</strong>
${text(data.planIntervencion)}</p>
          <p class="text-block"><strong>Observaciones generales:</strong>
${text(data.observacionesGenerales)}</p>
        </div>

        <div class="signatures">
          <div class="signature-line">Firma paciente</div>
          <div class="signature-line">Firma fisioterapia / recepcion</div>
        </div>
      </div>
      <script>window.onload = function(){ window.print(); };</script>
    </body>
  `;

  openPrintWindow({
    title: "Historia e indicaciones de fisioterapia",
    html,
  });
}
