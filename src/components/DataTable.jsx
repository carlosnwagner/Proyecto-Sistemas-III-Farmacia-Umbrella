import { useState, useEffect } from "react";
import { Pencil, Database, RefreshCw } from "lucide-react";

export default function DataTable({ columns, data = [], onEdit }) {
  // Estado de carga interno controlado por la presencia de datos
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Si aún no llegaron datos (o el arreglo viene vacío inicialmente), mantener activado el cargador
    if (data.length === 0) {
      setLoading(true);
    } else {
      // Cuando llegan los datos, asegurar que la animación se vea fluido pero termine justo al tener la información
      const timer = setTimeout(() => {
        setLoading(false);
      }, 300); // Pequeña transición suave de salida

      return () => clearTimeout(timer);
    }
  }, [data]);

  const totalColumns = columns.length + 1;

  return (
    <>
      {/* Estilos para las animaciones visuales */}
      <style>
        {`
          @keyframes spin-custom {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          @keyframes pulse-ring {
            0% { transform: scale(0.95); opacity: 0.8; }
            50% { transform: scale(1.15); opacity: 0.4; }
            100% { transform: scale(0.95); opacity: 0.8; }
          }

          .spin-icon {
            animation: spin-custom 0.8s linear infinite;
          }

          .pulse-container {
            animation: pulse-ring 1.4s ease-in-out infinite;
          }

          .table-row-hover {
            transition: background-color 0.15s ease-in-out;
          }

          .table-row-hover:hover {
            background-color: #f8fafc !important;
          }
        `}
      </style>

      <div
        style={{
          position: "relative",
          backgroundColor: "#ffffff",
          borderRadius: "0.875rem",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.025)",
          border: "1px solid #e5e7eb",
          overflow: "hidden",
          minHeight: "220px",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ backgroundColor: "#fafafa", borderBottom: "1px solid #e5e7eb" }}>
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
                  className="table-row-hover"
                  style={{
                    borderBottom: rowIndex === data.length - 1 ? "none" : "1px solid #f3f4f6",
                  }}
                >
                  {columns.map((col, colIndex) => (
                    <td
                      key={colIndex}
                      style={{
                        padding: "1rem 1.25rem",
                        fontSize: "0.875rem",
                        color: "#374151",
                        verticalAlign: "middle",
                      }}
                    >
                      {col.render ? col.render(row) : row[col.accessor]}
                    </td>
                  ))}
                  <td style={{ padding: "1rem 1.25rem", textAlign: "center", verticalAlign: "middle" }}>
                    <button
                      onClick={() => onEdit && onEdit(row)}
                      title="Modificar"
                      style={{
                        backgroundColor: "#f9fafb",
                        border: "1px solid #e5e7eb",
                        color: "#65482b",
                        cursor: "pointer",
                        padding: "0.4rem",
                        borderRadius: "0.5rem",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#65482b";
                        e.currentTarget.style.color = "#ffffff";
                        e.currentTarget.style.borderColor = "#65482b";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#f9fafb";
                        e.currentTarget.style.color = "#65482b";
                        e.currentTarget.style.borderColor = "#e5e7eb";
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))
            ) : !loading ? (
              <tr>
                <td
                  colSpan={totalColumns}
                  style={{
                    padding: "3.5rem 1.5rem",
                    textAlign: "center",
                    color: "#9ca3af",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.75rem",
                    }}
                  >
                    <Database size={36} style={{ color: "#d1d5db" }} />
                    <span style={{ fontSize: "0.875rem", fontWeight: "500", color: "#6b7280" }}>
                      No se encontraron registros en la tabla.
                    </span>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        {/* Overlay con Animación de Carga */}
        {loading && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(255, 255, 255, 0.92)",
              backdropFilter: "blur(2px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.875rem",
              zIndex: 10,
            }}
          >
            <div
              className="pulse-container"
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                backgroundColor: "#f0ece9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <RefreshCw size={26} className="spin-icon" style={{ color: "#65482b" }} />
            </div>
            <span
              style={{
                fontSize: "0.875rem",
                fontWeight: "600",
                color: "#65482b",
                letterSpacing: "0.025em",
              }}
            >
              Cargando datos...
            </span>
          </div>
        )}
      </div>
    </>
  );
}