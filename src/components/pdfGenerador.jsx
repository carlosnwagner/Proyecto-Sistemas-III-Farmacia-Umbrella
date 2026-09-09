import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Función auxiliar para convertir el SVG de la carpeta public a Base64
const cargarSVGComoImagen = (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width || 100;
      canvas.height = img.height || 100;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
  });
};

export const generateStandardPDF = async ({
  title = "DOCUMENTO",
  subtitle = "",
  infoData = [],
  columns = [],
  rows = [],
  fileName = "documento.pdf"
}) => {
  const doc = new jsPDF();

  // 1. Barra superior decorativa (Verde claro original: #86C610 / RGB: 134, 198, 16)
  doc.setFillColor(134, 198, 16);
  doc.rect(0, 0, 210, 8, "F");

  // 2. Cargar e insertar el Logo SVG desde /public
  const logoBase64 = await cargarSVGComoImagen("/Umbrellafarmacia.svg");
  
  let textStartX = 14;
  let startY = 22;

  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", 14, 13, 18, 18);
    textStartX = 36;
  }

  // Encabezado principal
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("FARMACIA UMBRELLA", textStartX, startY);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Sistema de Gestión Integrado", textStartX, startY + 5);

  // Título y Subtítulo a la derecha
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(title, 196, startY, { align: "right" });

  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, 196, startY + 5, { align: "right" });
  }

  // Línea divisora superior
  doc.setDrawColor(220, 220, 220);
  doc.line(14, startY + 12, 196, startY + 12);

  // 3. Tarjeta de Datos de la Orden
  let infoY = startY + 20;
  if (infoData.length > 0) {
    const cardHeight = Math.ceil(infoData.length / 2) * 8 + 8;

    doc.setFillColor(248, 249, 250);
    doc.roundedRect(14, infoY, 182, cardHeight, 3, 3, "F");

    doc.setFontSize(9);
    infoData.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = col === 0 ? 20 : 105;
      const y = infoY + 8 + row * 8;

      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text(`${item.label}:`, x, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text(String(item.value), x + doc.getTextWidth(`${item.label}: `) + 1, y);
    });

    infoY += cardHeight + 10;
  }

  // 4. Tabla de Artículos
  autoTable(doc, {
    startY: infoY,
    head: [columns],
    body: rows,
    theme: "grid",
    headStyles: {
      fillColor: [40, 35, 30],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [50, 50, 50]
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250]
    },
    styles: {
      cellPadding: 4
    },
    didParseCell: function (data) {
      if (data.row.index === rows.length - 1) {
        data.cell.styles.fontWeight = "bold";
      }
    }
  });

  // 5. Franja decorativa inferior (Marrón: #65482b / RGB: 101, 72, 43)
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFillColor(101, 72, 43);
  doc.rect(0, pageHeight - 8, 210, 8, "F");

  // Guardar/Descargar el PDF
  doc.save(fileName);
};