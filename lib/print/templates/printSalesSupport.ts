import escapeHtml from "../escapeHtml";
import openPrintWindow from "../openPrintWindow";

type SaleSupportPrintData = {
  supportCode: string;
  documentDate: string;
  documentTime: string;
  analystName?: string | null;
  preparedBy?: string | null;
  managerName?: string | null;
  internalNumber?: string | null;
  customerName: string;
  documentNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  birthDate?: string | null;
  eps?: string | null;
  address?: string | null;
  nutraceuticals: string[];
  healthServices: string[];
  wellnessServices: string[];
  orderingRequired?: string | null;
  prescriberName?: string | null;
  sessionsUnits?: string | null;
  validity?: string | null;
  nutraceuticalsAmount?: number | null;
  healthServicesAmount?: number | null;
  wellnessServicesAmount?: number | null;
  totalAmount: number;
  paymentMethod: string;
};

function formatMoney(value: number | null | undefined) {
  if (!value || value <= 0) return "";
  return `$ ${value.toLocaleString("es-CO")}`;
}

function renderNumberedLines(items: string[], count = 4) {
  return Array.from({ length: count }).map((_, index) => {
    const value = items[index] || "";
    return `
      <div class="numbered-line">
        <span class="line-index">${index + 1}.</span>
        <span class="line-text">${escapeHtml(value)}</span>
      </div>
    `;
  }).join("");
}

function renderTaxValue(value: number | null | undefined) {
  return escapeHtml(formatMoney(value) || "");
}

const styles = `
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: white; color: #111; font-family: Arial, Helvetica, sans-serif; }
    .page {
      width: 980px;
      margin: 0 auto;
      padding: 22px 26px 28px;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    .top-row {
      display: grid;
      grid-template-columns: 1fr 280px;
      gap: 18px;
      align-items: start;
      margin-bottom: 14px;
    }
    .brand-wrap {
      display: grid;
      grid-template-columns: 110px 1fr;
      gap: 14px;
      align-items: center;
    }
    .logo-box {
      width: 96px;
      height: 96px;
      border: 1px solid #c8c8c8;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: #5f7d66;
      font-size: 18px;
      text-align: center;
      line-height: 1.1;
    }
    .company h1 {
      margin: 0 0 4px;
      font-size: 24px;
      line-height: 1.15;
    }
    .company p {
      margin: 2px 0;
      font-size: 13px;
    }
    .support-box {
      border: 2px solid #2b2b2b;
      background: #1f1f1f;
      color: white;
      padding: 10px 14px;
      min-height: 96px;
    }
    .support-box h2 {
      margin: 0;
      text-align: center;
      font-size: 15px;
      line-height: 1.2;
    }
    .support-box .code-label {
      margin-top: 8px;
      text-align: center;
      font-size: 13px;
    }
    .support-box .code-row {
      margin-top: 6px;
      display: grid;
      grid-template-columns: 42px 1fr;
      border: 1px solid #ececec;
      background: white;
      color: black;
      min-height: 38px;
      align-items: center;
      font-size: 14px;
      font-weight: 700;
    }
    .support-box .code-prefix {
      border-right: 1px solid #d2d2d2;
      text-align: center;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f6f6f6;
    }
    .support-box .code-value {
      padding: 0 10px;
      letter-spacing: 1px;
    }
    .section-title {
      margin-top: 10px;
      background: #2b2b2b;
      color: white;
      padding: 5px 10px;
      font-size: 15px;
      font-weight: 700;
      text-transform: uppercase;
    }
    table.form-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    .form-table td,
    .form-table th {
      border: 1px solid #808080;
      padding: 6px 8px;
      font-size: 13px;
      vertical-align: middle;
    }
    .label-cell {
      width: 130px;
      font-weight: 700;
      background: #fafafa;
    }
    .value-cell {
      min-height: 30px;
      font-weight: 500;
    }
    .dark-head th {
      background: #434343;
      color: white;
      text-align: center;
      font-size: 13px;
      padding-top: 8px;
      padding-bottom: 8px;
    }
    .dark-head small {
      display: block;
      font-size: 11px;
      font-weight: 400;
      margin-top: 3px;
      color: #f0f0f0;
    }
    .numbered-cell {
      vertical-align: top;
      height: 120px;
    }
    .numbered-line {
      display: grid;
      grid-template-columns: 16px 1fr;
      gap: 8px;
      min-height: 22px;
      border-bottom: 1px solid #9b9b9b;
      align-items: end;
      margin-bottom: 4px;
      padding-bottom: 1px;
    }
    .line-index {
      font-size: 13px;
    }
    .line-text {
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tiny-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-top: 8px;
      font-size: 12px;
    }
    .tiny-row div { min-height: 18px; }
    .totals-table td,
    .totals-table th {
      border: 1px solid #808080;
      padding: 7px 8px;
      font-size: 13px;
    }
    .totals-table th {
      background: #2b2b2b;
      color: white;
      text-align: left;
    }
    .payment-row {
      border: 1px solid #808080;
      padding: 8px 10px;
      font-size: 13px;
      margin-bottom: 10px;
    }
    .legal-box {
      border: 1px solid #808080;
      padding: 8px 10px;
      font-size: 12px;
      line-height: 1.4;
    }
    .legal-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    .page-header-small {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      margin-bottom: 10px;
    }
    .clauses p {
      margin: 0 0 7px;
      font-size: 12px;
      line-height: 1.42;
    }
    .checks p {
      margin: 0 0 6px;
      font-size: 12px;
      line-height: 1.4;
    }
    .signature-grid {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    .signature-grid td {
      border: 1px solid #808080;
      padding: 8px;
      vertical-align: top;
      font-size: 12px;
      min-height: 84px;
    }
    .box-title {
      font-weight: 700;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .fingerprint {
      height: 78px;
      border: 1px solid #bdbdbd;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6b7280;
      font-size: 11px;
      text-align: center;
      background: #fafafa;
    }
    .muted { color: #6b7280; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
`;

export default function printSalesSupport(data: SaleSupportPrintData) {
  const html = `
    <head>
      <meta charset="UTF-8" />
      ${styles}
    </head>
    <body>
      <div class="page">
        <div class="top-row">
          <div class="brand-wrap">
            <div class="logo-box">PREVITAL</div>
            <div class="company">
              <h1>PREVITAL ANTIOQUIA S.A.S.</h1>
              <p>NIT: 902046331-3 Matrícula: 21-841365-12</p>
              <p>Carrera 43A No. 1-71, Medellín, Antioquia  Tel: 3004937787</p>
              <p>Cod. Prestador REPS: 0500126243-01</p>
            </div>
          </div>
          <div class="support-box">
            <h2>SOPORTE DE VENTA<br/>PRE-FACTURA</h2>
            <div class="code-label">Código:</div>
            <div class="code-row">
              <div class="code-prefix">PF-</div>
              <div class="code-value">${escapeHtml(data.supportCode)}</div>
            </div>
          </div>
        </div>

        <div class="section-title">1. Datos del documento</div>
        <table class="form-table">
          <tr>
            <td class="label-cell">Fecha:</td>
            <td class="value-cell">${escapeHtml(data.documentDate)}</td>
            <td class="label-cell">Hora:</td>
            <td class="value-cell">${escapeHtml(data.documentTime)}</td>
            <td class="label-cell">Analista:</td>
            <td class="value-cell">${escapeHtml(data.analystName || "")}</td>
          </tr>
          <tr>
            <td class="label-cell">Elaborado por:</td>
            <td class="value-cell">${escapeHtml(data.preparedBy || "")}</td>
            <td class="label-cell">Gerente Comercial:</td>
            <td class="value-cell">${escapeHtml(data.managerName || "")}</td>
            <td class="label-cell">No. Interno:</td>
            <td class="value-cell">${escapeHtml(data.internalNumber || "")}</td>
          </tr>
        </table>

        <div class="section-title">2. Identificación del usuario</div>
        <table class="form-table">
          <tr>
            <td class="label-cell">Nombre completo:</td>
            <td class="value-cell">${escapeHtml(data.customerName)}</td>
            <td class="label-cell">C.C. / NIT:</td>
            <td class="value-cell">${escapeHtml(data.documentNumber || "")}</td>
          </tr>
          <tr>
            <td class="label-cell">Teléfono:</td>
            <td class="value-cell">${escapeHtml(data.phone || "")}</td>
            <td class="label-cell">Correo:</td>
            <td class="value-cell">${escapeHtml(data.email || "")}</td>
          </tr>
          <tr>
            <td class="label-cell">Ciudad:</td>
            <td class="value-cell">${escapeHtml(data.city || "")}</td>
            <td class="label-cell">F. Nacimiento:</td>
            <td class="value-cell">${escapeHtml(data.birthDate || "")}</td>
          </tr>
          <tr>
            <td class="label-cell">EPS / Seguro:</td>
            <td class="value-cell">${escapeHtml(data.eps || "")}</td>
            <td class="label-cell">Dirección:</td>
            <td class="value-cell">${escapeHtml(data.address || "")}</td>
          </tr>
        </table>

        <div class="section-title">3. Paquete integral personalizado — servicios y productos</div>
        <table class="form-table">
          <thead class="dark-head">
            <tr>
              <th>NUTRACÉUTICOS<small>Exento IVA  Decr.677/95</small></th>
              <th>SERVICIOS DE SALUD<small>Exento IVA  Art.476 E.T.</small></th>
              <th>SERVICIOS DE BIENESTAR<small>IVA 19%  Art.468 E.T.</small></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="numbered-cell">${renderNumberedLines(data.nutraceuticals)}</td>
              <td class="numbered-cell">${renderNumberedLines(data.healthServices)}</td>
              <td class="numbered-cell">${renderNumberedLines(data.wellnessServices)}</td>
            </tr>
          </tbody>
        </table>
        <div class="tiny-row">
          <div>Ordenamiento médico profesional: ${escapeHtml(data.orderingRequired || "")}</div>
          <div>Profesional prescriptor: ${escapeHtml(data.prescriberName || "")}</div>
        </div>
        <div class="tiny-row">
          <div>Sesiones/unidades: ${escapeHtml(data.sessionsUnits || "")}</div>
          <div>Vigencia: ${escapeHtml(data.validity || "")}</div>
        </div>

        <div class="section-title">4. Desglose tributario (Estatuto Tributario Colombiano)</div>
        <table class="totals-table" style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="width:46%;">Concepto</th>
              <th style="width:18%;">Valor base</th>
              <th style="width:18%;">IVA</th>
              <th style="width:18%;">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Nutracéuticos (prescripción profesional)</td>
              <td>${renderTaxValue(data.nutraceuticalsAmount)}</td>
              <td>EXENTO 0%<br/>Decr.677/95</td>
              <td>${renderTaxValue(data.nutraceuticalsAmount)}</td>
            </tr>
            <tr>
              <td>Servicios de Salud (nutrición, med. prev., fisiot.)</td>
              <td>${renderTaxValue(data.healthServicesAmount)}</td>
              <td>EXENTO 0%<br/>Art.476 E.T.</td>
              <td>${renderTaxValue(data.healthServicesAmount)}</td>
            </tr>
            <tr>
              <td>Servicios de Bienestar (detox)</td>
              <td>${renderTaxValue(data.wellnessServicesAmount)}</td>
              <td>GRAVADO 19%<br/>Art.468 E.T.</td>
              <td>${renderTaxValue(data.wellnessServicesAmount)}</td>
            </tr>
            <tr>
              <td><strong>TOTAL, PAQUETE INTEGRAL</strong></td>
              <td>${escapeHtml(formatMoney(data.totalAmount))}</td>
              <td>—</td>
              <td>${escapeHtml(formatMoney(data.totalAmount))}</td>
            </tr>
          </tbody>
        </table>

        <div class="payment-row">
          <strong>Forma de pago:</strong> ${escapeHtml(data.paymentMethod)}
        </div>

        <div class="section-title">5. Marco normativo aplicable</div>
        <div class="legal-box">
          <div class="legal-grid">
            <div>
              <strong>Salud:</strong> Ley 1751/2015 · Decr. 0858/2025 (MIAS) · Decr. 1599/2022 · Resolución REPS<br/>
              <strong>Nutracéuticos:</strong> Decreto 677/1995 · INVIMA · Registro sanitario vigente<br/>
              <strong>Consumidor:</strong> Ley 1480/2011 (Estatuto del Consumidor)
            </div>
            <div>
              <strong>Tributario:</strong> Art. 476 E.T. (Exento) · Art. 468 E.T. (19% IVA) · Res. DIAN vigentes<br/>
              <strong>Datos personales:</strong> Ley 1581/2012 · Decreto 1377/2013 · Habeas Data<br/>
              <strong>Facturación:</strong> Ley 527/1999 · Res. DIAN 000165/2023 · Factura electrónica CUFE
            </div>
          </div>
        </div>
      </div>

      <div class="page">
        <div class="page-header-small">
          <div>PREVITAL ANTIOQUIA S.A.S. · Soporte de Venta Continuación Pág. 2</div>
          <div>PF- ${escapeHtml(data.supportCode)} &nbsp;&nbsp; Fecha ${escapeHtml(data.documentDate)}</div>
        </div>

        <div class="section-title">6. Cláusulas de atención, adherencia y responsabilidad</div>
        <div class="clauses legal-box">
          <p>1. Personalización del servicio: Cada protocolo o paquete se define según la evaluación inicial, antecedentes y objetivos reportados por el usuario.</p>
          <p>2. Adherencia al tratamiento: El usuario se compromete a asistir a controles, seguir recomendaciones y reportar cambios relevantes en su estado de salud.</p>
          <p>3. Profesionales habilitados y calidad: Los servicios se prestan con personal idóneo y productos autorizados según la normativa aplicable.</p>
          <p>4. Tratamiento de datos personales y sensibles: Prevital podrá tratar los datos suministrados para fines operativos, comerciales y asistenciales autorizados por el usuario.</p>
          <p>5. Tributario - IVA: Los servicios de salud y nutracéuticos con prescripción profesional se manejan como exentos; los servicios de bienestar como detox se consideran gravados cuando aplique.</p>
          <p>6. Facturación y soporte: Este documento funciona como soporte de venta o pre-factura y servirá como base para la posterior facturación electrónica cuando corresponda.</p>
          <p>7. Responsabilidad del usuario: El usuario informa de manera veraz sus datos, antecedentes y condiciones relevantes para la prestación del servicio.</p>
        </div>

        <div class="section-title">7. Declaraciones del usuario</div>
        <div class="checks legal-box">
          <p>□ He recibido información clara y completa sobre los productos y servicios incluidos en este soporte.</p>
          <p>□ Conozco y acepto valores, forma de pago y condiciones comerciales descritas en este documento.</p>
          <p>□ Autorizo el tratamiento de mis datos personales y sensibles de salud para fines asistenciales y administrativos permitidos.</p>
          <p>□ Entiendo que este documento es una pre-factura o soporte operativo y que la factura electrónica se emitirá cuando aplique.</p>
          <p>□ Entiendo que una vez iniciado o ejecutado el servicio no aplica derecho de retracto sobre prestaciones efectivamente ejecutadas.</p>
          <p>□ Los servicios contratados corresponden a lo acordado con el analista y acepto el precio total aquí consignado.</p>
        </div>

        <div class="section-title">8. Aceptación y firmas</div>
        <table class="signature-grid">
          <tr>
            <td style="width:32%;">
              <div class="box-title">Firma usuario</div>
              <div>Nombre / Cargo: ${escapeHtml(data.customerName)}</div>
              <div>C.C. / NIT: ${escapeHtml(data.documentNumber || "")}</div>
              <div>Fecha: ${escapeHtml(data.documentDate)}</div>
            </td>
            <td style="width:14%;">
              <div class="box-title">Huella</div>
              <div class="fingerprint">Espacio para huella dactilar</div>
            </td>
            <td style="width:26%;">
              <div class="box-title">Firma analista</div>
              <div>Nombre / Cargo: ${escapeHtml(data.analystName || "")}</div>
              <div>Fecha: ${escapeHtml(data.documentDate)}</div>
            </td>
            <td style="width:28%;">
              <div class="box-title">Sello</div>
            </td>
          </tr>
          <tr>
            <td>
              <div class="box-title">Funcionario facturación</div>
              <div>Firma: _______________________</div>
              <div>Fecha FE: __________________</div>
            </td>
            <td colspan="2">
              <div class="box-title">N. factura electrónica DIAN</div>
              <div>FE: _______________________</div>
              <div>CUFE: _____________________</div>
            </td>
            <td>
              <div class="box-title">Aviso legal</div>
              <div class="muted">Soporte legal de venta. Los servicios son personalizados y se conservan para control documental y tributario interno.</div>
            </td>
          </tr>
        </table>
      </div>
      <script>window.onload = function(){ window.print(); };</script>
    </body>
  `;

  openPrintWindow({
    title: "Soporte de venta",
    html,
    width: 1100,
    height: 980,
  });
}
