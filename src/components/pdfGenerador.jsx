import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Genera un PDF estandarizado para Farmacia Umbrella
 * @param {Object} config
 * @param {string} config.title - Título del documento (ej: "ORDEN DE COMPRA")
 * @param {string} [config.subtitle] - Subtítulo opcional o ID de transacción
 * @param {Array<Object>} config.infoData - Datos clave en par clave/valor para el encabezado
 * @param {Array<string>} config.columns - Encabezados de las columnas de la tabla
 * @param {Array<Array>} config.rows - Filas de datos para la tabla
 * @param {string} [config.fileName] - Nombre con el que se descargará el archivo
 */
export const generateStandardPDF = ({
  title,
  subtitle = "",
  infoData = [],
  columns = [],
  rows = [],
  fileName = "documento.pdf",
}) => {
  const doc = new jsPDF();

  // --- PALETA DE COLORES DE LA MARCA ---
  const PRIMARY_COLOR = [45, 36, 30];   // #2d241e (Café oscuro)
  const ACCENT_COLOR = [132, 204, 22];  // #84cc16 (Verde Lima)
  const TEXT_DARK = [55, 65, 81];       // #374151
  const LIGHT_BG = [250, 250, 250];     // #fafafa

  // --- MEMBRETE / ENCABEZADO ---
  // Barra de acento superior
  doc.setFillColor(...ACCENT_COLOR);
  doc.rect(0, 0, 210, 4, "F");

  // Marca
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text("FARMACIA UMBRELLA", 14, 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text("Sistema de Gestión Integrado", 14, 23);

  // Título del Documento
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text(title.toUpperCase(), 196, 18, { align: "right" });

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(subtitle, 196, 23, { align: "right" });
  }

  // Línea divisoria de encabezado
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(14, 28, 196, 28);

  let currentY = 35;

  // --- BLOQUE DE INFORMACIÓN ADICIONAL (SI EXISTE) ---
  if (infoData && infoData.length > 0) {
    doc.setFillColor(...LIGHT_BG);
    const boxHeight = Math.ceil(infoData.length / 2) * 7 + 6;
    doc.roundedRect(14, currentY, 182, boxHeight, 2, 2, "F");

    let col = 0;
    let rowY = currentY + 6;

    infoData.forEach((item, index) => {
      const posX = col === 0 ? 18 : 108;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...PRIMARY_COLOR);
      doc.text(`${item.label}:`, posX, rowY);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_DARK);
      doc.text(`${item.value}`, posX + doc.getTextWidth(`${item.label}: `) + 2, rowY);

      if (col === 1) {
        col = 0;
        rowY += 6;
      } else {
        col = 1;
      }
    });

    currentY += boxHeight + 8;
  }

  // --- TABLA PRINCIPAL ---
  autoTable(doc, {
    startY: currentY,
    head: [columns],
    body: rows,
    theme: "grid",
    headStyles: {
      fillColor: PRIMARY_COLOR,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
      halign: "left",
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: TEXT_DARK,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    styles: {
      cellPadding: 3,
      lineColor: [229, 231, 235],
      lineWidth: 0.2,
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // --- PIE DE PÁGINA REUTILIZABLE ---
      const pageHeight = doc.internal.pageSize.height;
      const pageCount = doc.internal.getNumberOfPages();

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);

      // Fecha y Hora de emisión
      const fechaEmision = new Date().toLocaleString("es-AR");
      doc.text(`Generado el: ${fechaEmision}`, 14, pageHeight - 10);

      // Paginación
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}`,
        196,
        pageHeight - 10,
        { align: "right" }
      );
    },
  });

  // Guardar/Descargar
  doc.save(fileName);
};