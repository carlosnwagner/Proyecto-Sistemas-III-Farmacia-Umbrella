import { useState } from "react";
import DataTable from "../components/DataTable.jsx";
import EditModal from "../components/EditModal.jsx";
import { Plus, Search } from "lucide-react";

export default function Sucursales() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSucursal, setSelectedSucursal] = useState(null);

  // Estado vacío listo para conectar con la API/Base de Datos
  const [sucursales, setSucursales] = useState([]);

  // Configuración de los campos dinámicos para el Modal
  const editFields = [
    { key: "id", label: "ID" },
    { key: "nombre", label: "Nombre de Sucursal" },
    { key: "direccion", label: "Dirección" },
    { key: "telefono", label: "Teléfono" },
    { key: "encargado", label: "Encargado / Responsable" },
  ];

  // Abrir modal para Crear
  const handleOpenCreate = () => {
    setSelectedSucursal(null);
    setIsModalOpen(true);
  };

  // Abrir modal para Editar
  const handleOpenEdit = (sucursal) => {
    setSelectedSucursal(sucursal);
    setIsModalOpen(true);
  };

  // Guardar (Alta / Modificación)
  const handleSaveSucursal = (formData) => {
    if (selectedSucursal) {
      setSucursales((prev) =>
        prev.map((item) => (item.id === formData.id ? formData : item))
      );
    } else {
      const newEntry = {
        ...formData,
        id: formData.id || `SUC-${String(sucursales.length + 1).padStart(3, "0")}`,
      };
      setSucursales((prev) => [...prev, newEntry]);
    }
  };

  // Filtro de búsqueda
  const filteredSucursales = sucursales.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.nombre?.toLowerCase().includes(term) ||
      s.direccion?.toLowerCase().includes(term) ||
      s.encargado?.toLowerCase().includes(term)
    );
  });

  // Columnas para la DataTable
  const columns = [
    { header: "ID", accessor: "id" },
    {
      header: "SUCURSAL",
      render: (s) => <span style={{ fontWeight: "600" }}>{s.nombre}</span>,
    },
    { header: "Código", accessor: "codigo" },
    { header: "Descripción", accessor: "descriocion" },
    { header: "fecha de registro", accessor: "registro" },
    { header: "estado", accessor: "estado" }
  ];

  return (
    <>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: "700", color: "#111827", margin: 0 }}>Sucursales</h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>{sucursales.length} sucursales registradas</p>
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
          <Plus size={18} /> Nueva sucursal
        </button>
      </header>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Buscar por Sucursal, Dirección o Encargado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "0.625rem 0.625rem 0.625rem 2.5rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none", boxSizing: "border-box" }}
          />
        </div>
      </div>

      <DataTable columns={columns} data={filteredSucursales} onEdit={handleOpenEdit} />

      <EditModal
        key={selectedSucursal ? selectedSucursal.id : "nueva-sucursal"}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSucursal}
        title={selectedSucursal ? "Editar Sucursal" : "Nueva Sucursal"}
        fields={editFields.map((field) =>
          field.key === "id" ? { ...field, readOnly: !!selectedSucursal } : field
        )}
        initialData={selectedSucursal}
      />
    </>
  );
}