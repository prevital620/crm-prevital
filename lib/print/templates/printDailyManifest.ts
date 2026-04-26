import escapeHtml from "../escapeHtml";
import openPrintWindow from "../openPrintWindow";
import sharedPrintStyles from "./sharedStyles";

type ManifestRow = {
  horaLlegada: string;
  horaSalida: string;
  nombreCompleto: string;
  codigoTMK: string;
  codigoOPC: string;
  calificacion: string;
  valorVenta: string;
  formaPago: string;
  observaciones: string;
};

type DailyManifestPrintData = {
  fecha: string;
  generatedAt: string;
  shiftLabel?: string;
  rows: ManifestRow[];
};

export default function printDailyManifest(data: DailyManifestPrintData) {
  const rowsHtml =
    data.rows.length > 0
      ? data.rows
          .map(
            (row, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(row.horaLlegada || "-")}</td>
                <td>${escapeHtml(row.horaSalida || "-")}</td>
                <td>${escapeHtml(row.nombreCompleto || "Sin nombre")}</td>
                <td>${escapeHtml(row.codigoTMK || "-")}</td>
                <td>${escapeHtml(row.codigoOPC || "-")}</td>
                <td>${escapeHtml(row.calificacion || "Sin definir")}</td>
                <td>${escapeHtml(row.valorVenta || "-")}</td>
                <td>${escapeHtml(row.formaPago || "-")}</td>
                <td>${escapeHtml(row.observaciones || "-")}</td>
              </tr>
            `
          )
          .join("")
      : `
        <tr>
          <td colspan="10" style="text-align:center; color:#607368;">No hay registros para esta fecha y jornada.</td>
        </tr>
      `;

  const html = `
    <head>
      ${sharedPrintStyles}
      <style>
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #d9e9de; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #eef7f1; color: #4f6f5b; text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="brand">
            <span class="pill">Recepcion</span>
            <h1>Manifiesto diario</h1>
            <p>Registro operativo del dia en orden de llegada</p>
          </div>
          <div>
            <div class="item-label">Fecha de impresion</div>
            <div class="item-value">${escapeHtml(data.generatedAt)}</div>
          </div>
        </div>

        <div class="box">
          <div class="grid">
            <div>
              <div class="item-label">Fecha del manifiesto</div>
              <div class="item-value">${escapeHtml(data.fecha)}</div>
            </div>
            <div>
              <div class="item-label">Jornada</div>
              <div class="item-value">${escapeHtml(data.shiftLabel || "Todas")}</div>
            </div>
            <div>
              <div class="item-label">Total registros</div>
              <div class="item-value">${escapeHtml(String(data.rows.length))}</div>
            </div>
          </div>
        </div>

        <div class="box">
          <h2>Clientes del dia</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Hora llegada</th>
                <th>Hora salida</th>
                <th>Nombre completo</th>
                <th>Codigo TMK</th>
                <th>Codigo OPC</th>
                <th>Calificacion</th>
                <th>Valor venta</th>
                <th>Forma de pago</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>

        <script>window.onload = function(){ window.print(); };</script>
      </div>
    </body>
  `;

  openPrintWindow({
    title: `Manifiesto diario${data.shiftLabel ? ` ${data.shiftLabel}` : ""}`,
    html,
  });
}
