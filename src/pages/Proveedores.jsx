import { useState } from "react";
import DataTable from "../components/DataTable.jsx";
import EditModal from "../components/EditModal.jsx";
import { Plus, Search } from "lucide-react";

export default function Proveedores() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProveedor, setSelectedProveedor] = useState(null);

  // Arreglo vacío listo para recibir los datos de la base de datos
  const [proveedores, setProveedores] = useState([]);

  // Configuración de los campos del modal
  const editFields = [
    { key: "id", label: "ID" },
    { key: "razonSocial", label: "Razón Social" },
    { key: "cuit", label: "CUIT" },
    { key: "contacto", label: "Contacto" },
    { key: "telefono", label: "Teléfono" },
    { key: "email", label: "Email", type: "email" },
    { key: "fechaRegistro", label: "Fecha de Registro", type: "date" }, // Clave en camelCase y tipo date
  ];

  // Abrir para crear (limpia la selección)
  const handleOpenCreate = () => {
    setSelectedProveedor(null);
    setIsModalOpen(true);
  };

  // Abrir para editar
  const handleOpenEdit = (proveedor) => {
    setSelectedProveedor(proveedor);
    setIsModalOpen(true);
  };

  // Guardar datos localmente (aquí irá la llamada a fetch/axios POST o PUT)
  const handleSaveProveedor = (formData) => {
    if (selectedProveedor) {
      setProveedores((prev) =>
        prev.map((item) => (item.id === formData.id ? formData : item))
      );
    } else {
      // Si el usuario no ingresó un ID al crear, generamos uno temporal
      const newEntry = {
        ...formData,
        id: formData.id || `PROV-${String(proveedores.length + 1).padStart(3, "0")}`,
      };
      setProveedores((prev) => [...prev, newEntry]);
    }
  };

  const filteredProveedores = proveedores.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.razonSocial?.toLowerCase().includes(term) ||
      p.cuit?.toLowerCase().includes(term) ||
      p.contacto?.toLowerCase().includes(term)
    );
  });

  const columns = [
    { header: "ID", accessor: "id" },
    {
      header: "RAZÓN SOCIAL",
      render: (p) => <span style={{ fontWeight: "600" }}>{p.razonSocial}</span>,
    },
    { header: "CUIT", accessor: "cuit" },
    { header: "CONTACTO", accessor: "contacto" },
    { header: "TELÉFONO", accessor: "telefono" },
    { header: "EMAIL", accessor: "email" },
    { header: "FECHA DE REGISTRO", accessor: "fechaRegistro" }, // Columna agregada aquí
  ];

  return (
    <>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: "700", color: "#111827", margin: 0 }}>Proveedores</h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>{proveedores.length} proveedores registrados</p>
        </div>
        <button
          onClick={handleOpenCreate}
          style={{
            backgroundColor: "#65482b",
            color: "#ffffff",
            border: "none",
            padding: "0.625rem 1.25rem",
            borderRadius: "0.5rem",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            cursor: "pointer",
          }}
        >
          <Plus size={18} /> Nuevo proveedor
        </button>
      </header>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Buscar por Razón Social, CUIT o Contacto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "0.625rem 0.625rem 0.625rem 2.5rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none", boxSizing: "border-box" }}
          />
        </div>
      </div>

      <DataTable columns={columns} data={filteredProveedores} onEdit={handleOpenEdit} />

      <EditModal
        key={selectedProveedor ? selectedProveedor.id : "nuevo-proveedor"}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProveedor}
        title={selectedProveedor ? "Editar Proveedor" : "Nuevo Proveedor"}
        fields={editFields.map((field) =>
          field.key === "id" ? { ...field, readOnly: !!selectedProveedor } : field
        )}
        initialData={selectedProveedor}
      />
    </>
  );
}