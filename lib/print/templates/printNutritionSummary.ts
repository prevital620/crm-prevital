import escapeHtml from "../escapeHtml";
import openPrintWindow from "../openPrintWindow";
import sharedPrintStyles from "./sharedStyles";

type NutritionSummaryPrintData = {
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
  peso?: string | null;
  talla?: string | null;
  indiceMasaCorporal?: string | null;
  porcentajeMasaCorporal?: string | null;
  dinamometria?: string | null;
  masaMuscular?: string | null;
  metabolismoReposo?: string | null;
  grasaVisceral?: string | null;
  circunferenciaCintura?: string | null;
  clasificacionNutricional?: string | null;
  objetivoNutricional?: string | null;
  recomendacionesNutricionales?: string | null;
  datosAlimentarios?: string | null;
  planNutricional?: string | null;
  observacionesGenerales?: string | null;
};

function text(value: string | null | undefined, fallback = "Sin registrar") {
  return escapeHtml(value || fallback);
}

export default function printNutritionSummary(data: NutritionSummaryPrintData) {
  const html = `
    <head>
      ${sharedPrintStyles}
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="brand">
            <span class="pill">Prevital</span>
            <h1>Historia e indicaciones de nutricion</h1>
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
          <h2>Historia clinica nutricional</h2>
          <div class="grid">
            <div><div class="item-label">Antecedentes patologicos</div><div class="item-value">${text(data.antecedentesPatologicos)}</div></div>
            <div><div class="item-label">Cirugias</div><div class="item-value">${text(data.cirugias)}</div></div>
            <div><div class="item-label">Toxicos</div><div class="item-value">${text(data.toxicos)}</div></div>
            <div><div class="item-label">Alergicos</div><div class="item-value">${text(data.alergicos)}</div></div>
            <div><div class="item-label">Medicamentos</div><div class="item-value">${text(data.medicamentos)}</div></div>
            <div><div class="item-label">Antecedentes familiares</div><div class="item-value">${text(data.familiares)}</div></div>
          </div>
        </div>

        <div class="box">
          <h2>Valoracion</h2>
          <div class="grid">
            <div><div class="item-label">Peso</div><div class="item-value">${text(data.peso)}</div></div>
            <div><div class="item-label">Talla</div><div class="item-value">${text(data.talla)}</div></div>
            <div><div class="item-label">IMC</div><div class="item-value">${text(data.indiceMasaCorporal)}</div></div>
            <div><div class="item-label">Grasa corporal</div><div class="item-value">${text(data.porcentajeMasaCorporal)}</div></div>
            <div><div class="item-label">Dinamometria</div><div class="item-value">${text(data.dinamometria)}</div></div>
            <div><div class="item-label">Masa muscular</div><div class="item-value">${text(data.masaMuscular)}</div></div>
            <div><div class="item-label">Metabolismo reposo</div><div class="item-value">${text(data.metabolismoReposo)}</div></div>
            <div><div class="item-label">Grasa visceral</div><div class="item-value">${text(data.grasaVisceral)}</div></div>
            <div><div class="item-label">Circunferencia cintura</div><div class="item-value">${text(data.circunferenciaCintura)}</div></div>
            <div><div class="item-label">Clasificacion</div><div class="item-value">${text(data.clasificacionNutricional)}</div></div>
          </div>
        </div>

        <div class="box">
          <h2>Indicaciones y formulacion</h2>
          <p class="text-block"><strong>Objetivo nutricional:</strong>
${text(data.objetivoNutricional)}</p>
          <p class="text-block"><strong>Recomendaciones:</strong>
${text(data.recomendacionesNutricionales)}</p>
          <p class="text-block"><strong>Datos alimentarios:</strong>
${text(data.datosAlimentarios)}</p>
          <p class="text-block"><strong>Plan nutricional:</strong>
${text(data.planNutricional)}</p>
          <p class="text-block"><strong>Medicamentos reportados:</strong>
${text(data.medicamentos)}</p>
          <p class="text-block"><strong>Observaciones generales:</strong>
${text(data.observacionesGenerales)}</p>
        </div>

        <div class="signatures">
          <div class="signature-line">Firma paciente</div>
          <div class="signature-line">Firma nutricion / recepcion</div>
        </div>
      </div>
      <script>window.onload = function(){ window.print(); };</script>
    </body>
  `;

  openPrintWindow({
    title: "Historia e indicaciones de nutricion",
    html,
  });
}
