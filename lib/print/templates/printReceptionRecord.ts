import escapeHtml from "../escapeHtml";
import openPrintWindow from "../openPrintWindow";
import sharedPrintStyles from "./sharedStyles";

type ReceptionRecordPrintData = {
  customerName: string;
  phone?: string | null;
  city?: string | null;
  document?: string | null;
  source?: string | null;
  sourceDetailLabel?: string | null;
  sourceDetail?: string | null;
  hasEps?: string | null;
  affiliation?: string | null;
  age?: string | null;
  bringsId?: string | null;
  smartphone?: string | null;
  occupation?: string | null;
  hasDetoxTime?: string | null;
  hypertension?: string | null;
  diabetes?: string | null;
  surgeries?: string | null;
  surgeriesDetail?: string | null;
  medications?: string | null;
  medicationsDetail?: string | null;
  diseases?: string | null;
  diseasesDetail?: string | null;
  companionName?: string | null;
  companionRelationship?: string | null;
  observations?: string | null;
};

const LEGAL_NOTICE = `
Autorizo de manera libre y voluntaria a PREVITAL ANTIOQUIA S.A.S. para que la informacion consignada en este registro sea tratada de acuerdo con las disposiciones de la Ley 1581 de 2012 sobre proteccion de datos personales. Es de mi conocimiento que la empresa no tiene convenio con ninguna EPS ni con instituciones publicas del Estado. Hoy me presento de manera voluntaria y particular. Por medio del presente documento se deja constancia de que la evaluacion realizada no constituye una consulta medica y que se actua desde la prevencion y la concientizacion de habitos.
`.trim();

export default function printReceptionRecord(data: ReceptionRecordPrintData) {
  const html = `
    <head>
      ${sharedPrintStyles}
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="brand">
            <span class="pill">Prevital</span>
            <h1>Registro de recepcion</h1>
            <p>Soporte de ingreso comercial</p>
          </div>
          <div>
            <div class="item-label">Fecha de impresion</div>
            <div class="item-value">${escapeHtml(new Date().toLocaleString("es-CO"))}</div>
          </div>
        </div>

        <div class="box">
          <h2>Datos del cliente</h2>
          <div class="grid">
            <div><div class="item-label">Nombre</div><div class="item-value">${escapeHtml(data.customerName || "Sin nombre")}</div></div>
            <div><div class="item-label">Telefono</div><div class="item-value">${escapeHtml(data.phone || "Sin telefono")}</div></div>
            <div><div class="item-label">Ciudad</div><div class="item-value">${escapeHtml(data.city || "Sin ciudad")}</div></div>
            <div><div class="item-label">Documento</div><div class="item-value">${escapeHtml(data.document || "Sin documento")}</div></div>
            <div><div class="item-label">Fuente</div><div class="item-value">${escapeHtml(data.source || "Sin fuente")}</div></div>
            <div><div class="item-label">${escapeHtml(data.sourceDetailLabel || "Detalle fuente")}</div><div class="item-value">${escapeHtml(data.sourceDetail || "No aplica")}</div></div>
          </div>
        </div>

        <div class="box">
          <h2>Informacion brindada</h2>
          <div class="grid">
            <div><div class="item-label">Tiene EPS</div><div class="item-value">${escapeHtml(data.hasEps || "Sin definir")}</div></div>
            <div><div class="item-label">Afiliacion</div><div class="item-value">${escapeHtml(data.affiliation || "Sin definir")}</div></div>
            <div><div class="item-label">Edad</div><div class="item-value">${escapeHtml(data.age || "Sin dato")}</div></div>
            <div><div class="item-label">Asiste con cedula</div><div class="item-value">${escapeHtml(data.bringsId || "Sin definir")}</div></div>
            <div><div class="item-label">Celular inteligente</div><div class="item-value">${escapeHtml(data.smartphone || "Sin definir")}</div></div>
            <div><div class="item-label">Acepta 30 min para terapia detox</div><div class="item-value">${escapeHtml(data.hasDetoxTime || "Sin definir")}</div></div>
            <div><div class="item-label">Ocupacion</div><div class="item-value">${escapeHtml(data.occupation || "Sin definir")}</div></div>
            <div><div class="item-label">Acompanante</div><div class="item-value">${escapeHtml(data.companionName || "No aplica")}</div></div>
            <div><div class="item-label">Parentesco del acompanante</div><div class="item-value">${escapeHtml(data.companionRelationship || "No aplica")}</div></div>
          </div>
        </div>

        <div class="box">
          <h2>Antecedentes basicos</h2>
          <div class="grid">
            <div><div class="item-label">Hipertenso</div><div class="item-value">${escapeHtml(data.hypertension || "Sin definir")}</div></div>
            <div><div class="item-label">Diabetico</div><div class="item-value">${escapeHtml(data.diabetes || "Sin definir")}</div></div>
            <div><div class="item-label">Cirugias</div><div class="item-value">${escapeHtml(data.surgeries || "Sin definir")}</div></div>
            <div><div class="item-label">Cual cirugia</div><div class="item-value">${escapeHtml(data.surgeriesDetail || "No aplica")}</div></div>
            <div><div class="item-label">Medicamentos</div><div class="item-value">${escapeHtml(data.medications || "Sin definir")}</div></div>
            <div><div class="item-label">Cuales medicamentos</div><div class="item-value">${escapeHtml(data.medicationsDetail || "No aplica")}</div></div>
            <div><div class="item-label">Enfermedades</div><div class="item-value">${escapeHtml(data.diseases || "Sin definir")}</div></div>
            <div><div class="item-label">Cuales enfermedades</div><div class="item-value">${escapeHtml(data.diseasesDetail || "No aplica")}</div></div>
          </div>
        </div>

        <div class="box">
          <h2>Observaciones de recepcion</h2>
          <p class="text-block">${escapeHtml(data.observations || "Sin observaciones registradas.")}</p>
        </div>

        <div class="box">
          <h2>Autorizacion</h2>
          <p class="text-block">${escapeHtml(LEGAL_NOTICE)}</p>
        </div>

        <div class="signatures">
          <div class="signature-line">Firma del cliente</div>
          <div class="signature-line">Firma de recepcion</div>
        </div>
      </div>
      <script>window.onload = function(){ window.print(); };</script>
    </body>
  `;

  openPrintWindow({
    title: "Registro de recepcion",
    html,
  });
}
