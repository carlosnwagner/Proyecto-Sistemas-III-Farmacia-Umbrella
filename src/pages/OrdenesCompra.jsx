import { useState } from "react";
import { ClipboardList, Plus, Search } from "lucide-react";

const estados = ["Todos", "Borrador", "Pendiente", "Aprobada", "Recibida"];

export default function OrdenesCompra() {
  const [searchTerm, setSearchTerm] = useState("");
  const [estado, setEstado] = useState("Todos");

  return (
    <section style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: "700", color: "#111827", margin: 0 }}>Orden de compra</h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>Gestioná las compras a proveedores</p>
        </div>
        <button
          type="button"
          onClick={() => alert("La creación de órdenes de compra estará disponible próximamente.")}
          style={{ backgroundColor: "#65482b", color: "#ffffff", border: "none", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
        >
          <Plus size={18} /> Nueva orden
        </button>
      </header>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 300px" }}>
          <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="search"
            placeholder="Buscar por número o proveedor..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            style={{ width: "100%", padding: "0.625rem 0.625rem 0.625rem 2.5rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <select
          aria-label="Filtrar por estado"
          value={estado}
          onChange={(event) => setEstado(event.target.value)}
          style={{ minWidth: "180px", padding: "0.625rem 2rem 0.625rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#374151" }}
        >
          {estados.map((opcion) => <option key={opcion}>{opcion}</option>)}
        </select>
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: "0.75rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
          <ClipboardList size={40} color="#8a7a6c" style={{ marginBottom: "0.75rem" }} />
          <h2 style={{ fontSize: "1.1rem", color: "#374151", margin: 0 }}>Todavía no hay órdenes de compra</h2>
          <p style={{ color: "#6b7280", margin: "0.5rem 0 0" }}>Las órdenes creadas aparecerán en esta tabla.</p>
        </div>
      </div>
    </section>
  );
}