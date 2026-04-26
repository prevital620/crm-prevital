import escapeHtml from "../escapeHtml";
import openPrintWindow from "../openPrintWindow";

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
Autorizo de manera libre y voluntaria a PREVITAL ANTIOQUIA S.A.S. para que la informacion consignada en esta ficha sea tratada segun disposicion de la Ley 1581 de 2012 de proteccion de datos personales. Es de mi conocimiento que la empresa no tiene convenio con ninguna EPS ni con instituciones publicas del Estado, y hoy me presento de manera voluntaria y particular. Por medio del presente documento se deja constancia de que la evaluacion realizada no constituye una consulta medica y se actua desde la prevencion y concientizacion de habitos.
`.trim();

function yesNoMark(value: string | null | undefined, expected: "si" | "no") {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === expected ? "X" : "";
}

function yesNoText(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "si" || normalized === "s") return "Si";
  if (normalized === "no") return "No";
  return "";
}

function buildAffiliationMarks(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return {
    cotizante: normalized.includes("cot"),
    beneficiario: normalized.includes("bene"),
    subsidiado: normalized.includes("sub"),
  };
}

function buildOtherConditions(data: ReceptionRecordPrintData) {
  const items: string[] = [];
  if (yesNoText(data.diseases) === "Si" && data.diseasesDetail) items.push(data.diseasesDetail);
  if (yesNoText(data.surgeries) === "Si" && data.surgeriesDetail) items.push(`Cirugias: ${data.surgeriesDetail}`);
  return items.join(", ");
}

export default function printReceptionRecord(data: ReceptionRecordPrintData) {
  const logoSrc =
    typeof window !== "undefined"
      ? `${window.location.origin}/prevital-logo.jpeg`
      : "/prevital-logo.jpeg";

  const now = new Date();
  const currentDate = now.toLocaleDateString("es-CO");
  const currentTime = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  const affiliation = buildAffiliationMarks(data.affiliation);
  const otherConditions = buildOtherConditions(data);

  const html = `
    <head>
      <meta charset="UTF-8" />
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; background: #fff; }
        .page {
          position: relative;
          max-width: 920px;
          margin: 0 auto;
          padding: 24px 26px 32px;
          overflow: hidden;
        }
        .watermark {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 0;
        }
        .watermark img {
          width: 500px;
          max-width: 72%;
          opacity: 0.06;
          object-fit: contain;
        }
        .content { position: relative; z-index: 1; }
        .top {
          display: grid;
          grid-template-columns: 140px 1fr 220px;
          gap: 14px;
          align-items: start;
          margin-bottom: 12px;
        }
        .logo-box {
          border: 1px solid #d0d7d2;
          min-height: 110px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px;
          background: rgba(255,255,255,0.92);
        }
        .logo-box img { width: 100%; max-width: 100px; object-fit: contain; }
        .company h1 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .company p {
          margin: 4px 0 0;
          font-size: 11px;
          line-height: 1.35;
        }
        .code-box {
          border: 1px solid #1f2937;
          background: rgba(255,255,255,0.96);
        }
        .code-head {
          background: #1f2937;
          color: white;
          text-align: center;
          font-size: 12px;
          font-weight: 700;
          padding: 10px 8px;
          line-height: 1.35;
        }
        .code-body {
          padding: 10px 12px;
          text-align: center;
          font-size: 14px;
          font-weight: 700;
          min-height: 44px;
        }
        .section-title {
          background: #1f2937;
          color: white;
          font-size: 12px;
          font-weight: 700;
          padding: 6px 10px;
          margin-top: 10px;
        }
        table.form {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          background: rgba(255,255,255,0.95);
        }
        table.form td, table.form th {
          border: 1px solid #444;
          padding: 5px 7px;
          vertical-align: top;
          font-size: 12px;
        }
        table.form td.label {
          width: 16%;
          font-weight: 700;
          background: #fafafa;
        }
        .small { font-size: 11px; }
        .mark { font-weight: 700; display: inline-block; min-width: 12px; text-align: center; }
        .legal {
          margin-top: 10px;
          font-size: 11px;
          line-height: 1.55;
          background: rgba(255,255,255,0.94);
          padding: 6px 2px 0;
        }
        .sign-row {
          margin-top: 18px;
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr;
          gap: 20px;
          align-items: end;
        }
        .line {
          border-top: 1px solid #111827;
          padding-top: 6px;
          font-size: 12px;
          min-height: 26px;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="watermark">
          <img src="${escapeHtml(logoSrc)}" alt="Prevital marca de agua" />
        </div>
        <div class="content">
          <div class="top">
            <div class="logo-box">
              <img src="${escapeHtml(logoSrc)}" alt="Prevital" />
            </div>
            <div class="company">
              <h1>PREVITAL ANTIOQUIA S.A.S.</h1>
              <p>NIT: 902046331-3</p>
              <p>Carrera 43A No. 1-71, Medellin, Antioquia</p>
              <p>Registro operativo de recepcion</p>
            </div>
            <div class="code-box">
              <div class="code-head">RADICADO</div>
              <div class="code-body">Pendiente</div>
            </div>
          </div>

          <table class="form">
            <tr>
              <td class="label">FECHA</td>
              <td>${escapeHtml(currentDate)}</td>
              <td class="label">HORA</td>
              <td>${escapeHtml(currentTime)}</td>
              <td class="label">CABINA</td>
              <td>&nbsp;</td>
            </tr>
            <tr>
              <td class="label">NOMBRE</td>
              <td colspan="3">${escapeHtml(data.customerName || "Sin nombre")}</td>
              <td class="label">VIVE EN</td>
              <td>${escapeHtml(data.city || "")}</td>
            </tr>
            <tr>
              <td class="label">EDAD</td>
              <td>${escapeHtml(data.age || "")}</td>
              <td class="label">EPS</td>
              <td>${escapeHtml(data.hasEps === "S" ? data.affiliation || "Si" : "No")}</td>
              <td class="label">ANALISTA</td>
              <td>${escapeHtml(data.sourceDetail || "")}</td>
            </tr>
            <tr>
              <td class="label">OCUPACION</td>
              <td colspan="3">${escapeHtml(data.occupation || "")}</td>
              <td class="label">FUENTE</td>
              <td>${escapeHtml(data.source || "")}</td>
            </tr>
            <tr>
              <td class="label">ACOMPANANTE</td>
              <td colspan="3">${escapeHtml(data.companionName && data.companionName !== "No aplica" ? data.companionName : "")}</td>
              <td class="label">PARENTESCO</td>
              <td>${escapeHtml(data.companionRelationship && data.companionRelationship !== "No aplica" ? data.companionRelationship : "")}</td>
            </tr>
            <tr>
              <td class="label">HIPERTENSO</td>
              <td>SI <span class="mark">${yesNoMark(data.hypertension, "si")}</span> &nbsp;&nbsp; NO <span class="mark">${yesNoMark(data.hypertension, "no")}</span></td>
              <td class="label">DIABETES</td>
              <td>SI <span class="mark">${yesNoMark(data.diabetes, "si")}</span> &nbsp;&nbsp; NO <span class="mark">${yesNoMark(data.diabetes, "no")}</span></td>
              <td class="label">COTIZANTE</td>
              <td><span class="mark">${affiliation.cotizante ? "X" : ""}</span></td>
            </tr>
            <tr>
              <td class="label">OTRA</td>
              <td colspan="3">${escapeHtml(otherConditions)}</td>
              <td class="label">BENEFICIARIO / SUBSIDIADO</td>
              <td>${affiliation.beneficiario ? "Beneficiario" : affiliation.subsidiado ? "Subsidiado" : ""}</td>
            </tr>
          </table>

          <div class="section-title">ANTECEDENTES Y REGISTRO</div>
          <table class="form">
            <tr>
              <td class="label">CIRUGIAS</td>
              <td>${escapeHtml(data.surgeries === "Si" ? data.surgeriesDetail || "Si" : "")}</td>
            </tr>
            <tr>
              <td class="label">MEDICAMENTOS</td>
              <td>${escapeHtml(data.medications === "Si" ? data.medicationsDetail || "Si" : "")}</td>
            </tr>
            <tr>
              <td class="label">OBSERVACIONES</td>
              <td>${escapeHtml(data.observations || "")}</td>
            </tr>
          </table>

          <div class="legal">
            ${escapeHtml(LEGAL_NOTICE)}
          </div>

          <div class="sign-row">
            <div class="line">FIRMA</div>
            <div class="line">CC: ${escapeHtml(data.document || "")}</div>
            <div class="line">TEL: ${escapeHtml(data.phone || "")}</div>
          </div>
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
