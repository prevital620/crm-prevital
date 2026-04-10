type OpenPrintWindowOptions = {
  title: string;
  html: string;
  width?: number;
  height?: number;
};

export default function openPrintWindow({
  title,
  html,
  width = 980,
  height = 900,
}: OpenPrintWindowOptions) {
  if (typeof window === "undefined") return;

  const printWindow = window.open("", "_blank", `width=${width},height=${height}`);
  if (!printWindow) {
    alert("No se pudo abrir la ventana de impresión.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8" /><title>${title}</title></head><body>${html}</body></html>`);
  printWindow.document.close();
}
