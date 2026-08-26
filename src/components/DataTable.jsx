
import { Pencil } from "lucide-react";

export default function DataTable({ columns, data, onEdit }) {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "0.75rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        border: "1px solid #e5e7eb",
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
        <thead>
          <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            {columns.map((col, index) => (
              <th
                key={index}
                style={{
                  padding: "0.875rem 1.25rem",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {col.header}
              </th>
            ))}
            {/* Columna fija de acciones */}
            <th
              style={{
                padding: "0.875rem 1.25rem",
                fontSize: "0.75rem",
                fontWeight: "600",
                color: "#6b7280",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                textAlign: "center",
              }}
            >
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                style={{
                  borderBottom: rowIndex === data.length - 1 ? "none" : "1px solid #e5e7eb",
                }}
              >
                {columns.map((col, colIndex) => (
                  <td
                    key={colIndex}
                    style={{
                      padding: "1rem 1.25rem",
                      fontSize: "0.875rem",
                      color: "#374151",
                    }}
                  >
                    {col.render ? col.render(row) : row[col.accessor]}
                  </td>
                ))}
                {/* Botón de edición presente en cada fila */}
                <td style={{ padding: "1rem 1.25rem", textAlign: "center" }}>
                  <button
                    onClick={() => onEdit && onEdit(row)}
                    title="Modificar"
                    style={{
                      backgroundColor: "transparent",
                      border: "none",
                      color: "#65482b",
                      cursor: "pointer",
                      padding: "0.375rem",
                      borderRadius: "0.375rem",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "background-color 0.2s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f3f4f6")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <Pencil size={18} />
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length + 1}
                style={{
                  padding: "2rem",
                  textAlign: "center",
                  color: "#9ca3af",
                  fontSize: "0.875rem",
                }}
              >
                No se encontraron registros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}