import { useState, useEffect } from "react";
import { X } from "lucide-react";

// Agregamos initialData a las propiedades que recibe el componente
export default function EditModal({ isOpen, onClose, onSave, title, fields, initialData }) {
  const [formData, setFormData] = useState({});

  // Efecto FUNDAMENTAL para cargar los datos del registro a editar
  useEffect(() => {
    if (isOpen) {
      setFormData(initialData || {});
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  // Estilo común para inputs y selects para que se vean idénticos
  const commonInputStyle = (isReadOnly) => ({
    padding: "0.5rem 0.75rem",
    borderRadius: "0.375rem",
    border: "1px solid #d1d5db",
    fontSize: "0.875rem",
    outline: "none",
    backgroundColor: isReadOnly ? "#f3f4f6" : "#ffffff",
    width: "100%",
    boxSizing: "border-box",
  });

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "0.75rem",
          width: "100%",
          maxWidth: "600px",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
          overflow: "hidden",
        }}
      >
        {/* Cabecera Fija */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#111827", margin: 0 }}>
            {title || "Editar Registro"}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#6b7280",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Cuerpo con Scroll Interno y Grilla a 2 Columnas */}
          <div
            style={{
              padding: "1.5rem",
              overflowY: "auto",
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "1rem",
            }}
          >
            {fields.map((field) => (
              <div
                key={field.key}
                style={{
                  gridColumn: field.key === "descripcion" ? "span 2" : "span 1",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.375rem",
                }}
              >
                <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>
                  {field.label}
                </label>

                {/* AQUÍ ESTÁ LA MAGIA: Decidimos si pintar un <select> o un <input> */}
                {field.type === "select" ? (
                  <select
                    value={formData[field.key] ?? ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    disabled={field.readOnly}
                    style={commonInputStyle(field.readOnly)}
                    required
                  >
                    <option value="" disabled>Seleccione una opción...</option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type || "text"}
                    value={formData[field.key] ?? ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    disabled={field.readOnly}
                    style={commonInputStyle(field.readOnly)}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Botones Fijos Abajo */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
              padding: "1rem 1.5rem",
              borderTop: "1px solid #e5e7eb",
              backgroundColor: "#f9fafb",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                border: "1px solid #d1d5db",
                backgroundColor: "#ffffff",
                color: "#374151",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                border: "none",
                backgroundColor: "#65482b",
                color: "#ffffff",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}