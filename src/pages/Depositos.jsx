import { useState } from "react";
import DataTable from "../components/DataTable.jsx";
import EditModal from "../components/EditModal.jsx";
import { Plus, Search } from "lucide-react";

export default function Depositos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDeposito, setSelectedDeposito] = useState(null);

  const [depositos, setDepositos] = useState([]);

  const editFields = [
    { key: "id", label: "ID" },
    { key: "nombre", label: "Nombre de Depósito" },
    { key: "ubicacion", label: "Ubicación" },
    { key: "capacidad", label: "Capacidad" },
    { key: "responsable", label: "Responsable" },
  ];

  const handleOpenCreate = () => {
    setSelectedDeposito(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (deposito) => {
    setSelectedDeposito(deposito);
    setIsModalOpen(true);
  };

  const handleSaveDeposito = (formData) => {
    if (selectedDeposito) {
      setDepositos((prev) =>
        prev.map((item) => (item.id === formData.id ? formData : item))
      );
    } else {
      const newEntry = {
        ...formData,
        id: formData.id || `DEP-${String(depositos.length + 1).padStart(3, "0")}`,
      };
      setDepositos((prev) => [...prev, newEntry]);
    }
  };

  const filteredDepositos = depositos.filter((d) => {
    const term = searchTerm.toLowerCase();
    return (
      d.nombre?.toLowerCase().includes(term) ||
      d.ubicacion?.toLowerCase().includes(term) ||
      d.responsable?.toLowerCase().includes(term)
    );
  });

  const columns = [
    { header: "ID", accessor: "id" },
    {
      header: "DEPÓSITO",
      render: (d) => <span style={{ fontWeight: "600" }}>{d.nombre}</span>,
    },
    { header: "Sucursal abastecida", accessor: "sucursal" },
    { header: "descripción", accessor: "cdescripcion" },
    { header: "fecha de regisro", accessor: "fecha de registro" },
    { header: "estado", accessor: "estado" }
  ];

  return (
    <>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: "700", color: "#111827", margin: 0 }}>Depósitos</h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>{depositos.length} depósitos registrados</p>
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
          <Plus size={18} /> Nuevo depósito
        </button>
      </header>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Buscar por Nombre, Ubicación o Responsable..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "0.625rem 0.625rem 0.625rem 2.5rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none", boxSizing: "border-box" }}
          />
        </div>
      </div>

      <DataTable columns={columns} data={filteredDepositos} onEdit={handleOpenEdit} />

      <EditModal
        key={selectedDeposito ? selectedDeposito.id : "nuevo-deposito"}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveDeposito}
        title={selectedDeposito ? "Editar Depósito" : "Nuevo Depósito"}
        fields={editFields.map((field) =>
          field.key === "id" ? { ...field, readOnly: !!selectedDeposito } : field
        )}
        initialData={selectedDeposito}
      />
    </>
  );
}