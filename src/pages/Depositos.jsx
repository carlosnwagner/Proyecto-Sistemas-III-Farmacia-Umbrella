import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import InventarioDeposito from "./InventarioDeposito.jsx"; 
import { Plus, Search, Warehouse, MapPin, Tag, ArrowRight, Edit3, Lock } from "lucide-react";
import { showAlert } from "../lib/alerts.js"; 

const RUBROS_CATALOGO = [
  { codigo: "MED", label: "MED – Medicamentos" },
  { codigo: "PER", label: "PER – Perfumería" },
  { codigo: "ACC", label: "ACC – Accesorios" },
  { codigo: "DER", label: "DER – Dermocosmética" },
  { codigo: "HIG", label: "HIG – Higiene personal" },
  { codigo: "INF", label: "INF – Infantil" },
  { codigo: "NUT", label: "NUT – Nutrición" },
  { codigo: "ORT", label: "ORT – Ortopedia" },
  { codigo: "BUC", label: "BUC – Cuidado bucal" },
  { codigo: "SOL", label: "SOL – Protección solar" },
  { codigo: "MAQ", label: "MAQ – Maquillaje" },
  { codigo: "OPT", label: "OPT – Óptica" },
  { codigo: "DIET", label: "DIET – Dietética" },
  { codigo: "PA", label: "PA – Primeros auxilios" }
];

export default function Depositos() {
  const navigate = useNavigate();
  const [depositos, setDepositos] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [depositoEditando, setDepositoEditando] = useState(null);
  const [loading, setLoading] = useState(false);
  const [vistaActual, setVistaActual] = useState("tarjetas");
  const [depositoSeleccionadoInventario, setDepositoSeleccionadoInventario] = useState(null);
  
  // Estados para búsqueda y filtro de estado ("todos", "activos", "inactivos")
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  // Formulario de Depósito
  const [codigoAuto, setCodigoAuto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [idSucursal, setIdSucursal] = useState("");
  const [estado, setEstado] = useState(true); 
  const [aceptaTodos, setAceptaTodos] = useState(true);
  const [rubrosSeleccionados, setRubrosSeleccionados] = useState([]);

  useEffect(() => {
    fetchDepositos();
    fetchSucursales();
  }, []);

  async function fetchSucursales() {
    const { data } = await supabase.from("sucursal").select("id_sucursal, descripcion, codigo");
    if (data) setSucursales(data);
  }

  async function fetchDepositos() {
    const { data, error } = await supabase
      .from("deposito")
      .select("id_deposito, codigo, descripcion, rubros_permitidos, id_sucursal, estado, sucursal:id_sucursal(descripcion, codigo)")
      .order("id_deposito", { ascending: true });

    if (!error && data) setDepositos(data);
  }

  async function calcularSiguienteCodigoDeposito() {
    const { data } = await supabase.from("deposito").select("codigo");
    if (!data || data.length === 0) {
      setCodigoAuto("DEP-001");
      return;
    }

    let maxNum = 0;
    data.forEach(item => {
      if (item.codigo) {
        const limpio = item.codigo.replace(/\s+/g, "").toUpperCase();
        const parts = limpio.split("-");
        if (parts.length >= 2) {
          const num = parseInt(parts[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    });

    const siguiente = String(maxNum + 1).padStart(3, "0");
    setCodigoAuto(`DEP-${siguiente}`);
  }

  const handleAbrirCrear = async () => {
    setDepositoEditando(null);
    await calcularSiguienteCodigoDeposito();
    setDescripcion("");
    setIdSucursal(sucursales[0]?.id_sucursal || "");
    setEstado(true); // Por defecto activo al crear
    setAceptaTodos(true);
    setRubrosSeleccionados([]);
    setIsModalOpen(true);
  };

  const handleAbrirEditar = (dep) => {
    setDepositoEditando(dep);
    setCodigoAuto(dep.codigo.replace(/\s+/g, "").toUpperCase());
    setDescripcion(dep.descripcion);
    setIdSucursal(dep.id_sucursal || "");
    setEstado(dep.estado !== false);
    if (!dep.rubros_permitidos || dep.rubros_permitidos.trim() === "") {
      setAceptaTodos(true);
      setRubrosSeleccionados([]);
    } else {
      setAceptaTodos(false);
      setRubrosSeleccionados(dep.rubros_permitidos.split(",").map(r => r.trim()));
    }
    setIsModalOpen(true);
  };

  const handleToggleRubro = (codigo) => {
    if (rubrosSeleccionados.includes(codigo)) {
      setRubrosSeleccionados(rubrosSeleccionados.filter(c => c !== codigo));
    } else {
      setRubrosSeleccionados([...rubrosSeleccionados, codigo]);
    }
  };

  const handleGuardar = async (e) => {
    e.preventDefault();

    if (!descripcion.trim() || !idSucursal) {
      showAlert.errorSave("Por favor completa la descripción y selecciona la sucursal.");
      return;
    }

    setLoading(true);

    try {
      const rubrosFinales = aceptaTodos ? "" : rubrosSeleccionados.join(",");

      if (depositoEditando) {
        const { error } = await supabase
          .from("deposito")
          .update({
            descripcion: descripcion.trim(),
            id_sucursal: parseInt(idSucursal),
            rubros_permitidos: rubrosFinales,
            estado: estado 
          })
          .eq("id_deposito", depositoEditando.id_deposito);

        if (error) throw new Error(error.message);
        showAlert.successAction("Depósito", true);
      } else {
        const { data: todos } = await supabase.from("deposito").select("codigo");
        const yaExiste = todos?.some(
          d => d.codigo && d.codigo.replace(/\s+/g, "").toUpperCase() === codigoAuto
        );

        if (yaExiste) {
          throw new Error(`El código ${codigoAuto} ya existe. Recalculando...`);
        }

        const { error } = await supabase.from("deposito").insert([
          {
            codigo: codigoAuto,
            descripcion: descripcion.trim(),
            id_sucursal: parseInt(idSucursal),
            rubros_permitidos: rubrosFinales,
            estado: true // Al crear un nuevo depósito, el estado es siempre activo por defecto
          }
        ]);

        if (error) throw new Error(error.message);
        showAlert.successAction("Depósito", false);
      }

      setIsModalOpen(false);
      fetchDepositos();
    } catch (err) {
      showAlert.errorSave(err.message);
      if (!depositoEditando) {
        calcularSiguienteCodigoDeposito();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleIrAInventario = (dep) => {
    const activo = dep.estado !== false;
    if (!activo) {
      showAlert.errorSave("Este depósito se encuentra inactivo. Debe activarlo mediante la opción 'Modificar' para acceder a su inventario.");
      return;
    }
    navigate(`/depositos/${dep.id_deposito}/inventario`);
  };

  const filteredDepositos = depositos.filter((d) => {
    const term = searchTerm.toLowerCase().trim();
    const codigoLimpio = (d.codigo || "").toLowerCase();
    const descLimpia = (d.descripcion || "").toLowerCase();
    const coincideTexto = codigoLimpio.includes(term) || descLimpia.includes(term);

    const activo = d.estado !== false;
    if (filtroEstado === "activos") return coincideTexto && activo;
    if (filtroEstado === "inactivos") return coincideTexto && !activo;
    return coincideTexto; 
  });

  return (
    <div style={{ padding: "1rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.9rem", fontWeight: "700", color: "#111827" }}>Depósitos</h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0 0" }}>{filteredDepositos.length} de {depositos.length} centros de almacenamiento</p>
        </div>
        <button
          onClick={handleAbrirCrear}
          style={{ backgroundColor: "#65482b", color: "#ffffff", border: "none", padding: "0.65rem 1.25rem", borderRadius: "0.5rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
        >
          <Plus size={18} /> Nuevo Depósito
        </button>
      </header>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Buscar por código (ej. 22) o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "0.7rem 0.75rem 0.7rem 2.5rem",
              borderRadius: "0.5rem",
              border: "1px solid #d1d5db",
              fontSize: "0.95rem",
              outline: "none",
              boxSizing: "border-box",
              backgroundColor: "#fff"
            }}
          />
        </div>
        
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          style={{
            padding: "0.7rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid #d1d5db",
            fontSize: "0.95rem",
            outline: "none",
            backgroundColor: "#fff",
            cursor: "pointer",
            fontWeight: "500",
            color: "#374151",
            minWidth: "160px"
          }}
        >
          <option value="todos">Todos los estados</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
        {filteredDepositos.map((dep) => {
          const rubros = dep.rubros_permitidos ? dep.rubros_permitidos.split(",") : [];
          const activo = dep.estado !== false; 
          return (
            <div
              key={dep.id_deposito}
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "0.75rem",
                border: "1px solid #e5e7eb",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                opacity: activo ? 1 : 0.7,
                position: "relative"
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ backgroundColor: "#f3f4f6", padding: "0.5rem", borderRadius: "0.375rem", color: "#374151" }}>
                      <Warehouse size={20} />
                    </div>
                    <div>
                      <span style={{ fontSize: "1.2rem", fontWeight: "700", color: "#111827", display: "block" }}>
                        {dep.codigo}
                      </span>
                      <span style={{ 
                        fontSize: "0.68rem", 
                        fontWeight: "700", 
                        letterSpacing: "0.05em",
                        padding: "0.15rem 0.5rem", 
                        borderRadius: "4px", 
                        backgroundColor: activo ? "#f0fdf4" : "#fef2f2", 
                        color: activo ? "#15803d" : "#b91c1c",
                        border: `1px solid ${activo ? "#bbf7d0" : "#fecaca"}`,
                        display: "inline-block",
                        marginTop: "0.15rem"
                      }}>
                        {activo ? "ACTIVO" : "INACTIVO"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAbrirEditar(dep)}
                    style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: "0.375rem", padding: "0.35rem 0.6rem", color: "#4b5563", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", fontWeight: "600" }}
                    title="Modificar depósito"
                  >
                    <Edit3 size={14} /> Modificar
                  </button>
                </div>

                <p style={{ color: "#4b5563", fontSize: "0.95rem", margin: "0 0 1rem 0", minHeight: "2.8rem" }}>
                  {dep.descripcion}
                </p>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#6b7280", fontSize: "0.85rem", marginBottom: "1rem" }}>
                  <MapPin size={16} />
                  <span>{dep.sucursal?.descripcion || "Sucursal no asignada"}</span>
                </div>

                <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: "0.75rem", marginBottom: "1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "#6b7280", fontWeight: "600", marginBottom: "0.4rem" }}>
                    <Tag size={14} /> RUBROS ADMITIDOS:
                  </div>
                  <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                    {rubros.length === 0 ? (
                      <span style={{ backgroundColor: "#e0f2fe", color: "#0369a1", padding: "0.2rem 0.5rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: "bold" }}>
                        Todos los rubros
                      </span>
                    ) : (
                      rubros.map((r) => (
                        <span key={r} style={{ backgroundColor: "#f3f4f6", color: "#374151", padding: "0.15rem 0.45rem", borderRadius: "0.25rem", fontSize: "0.75rem", fontWeight: "600" }}>
                          {r}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleIrAInventario(dep)}
                style={{
                  width: "100%",
                  backgroundColor: activo ? "#365314" : "#9ca3af",
                  color: "#ffffff",
                  border: "none",
                  padding: "0.6rem 1rem",
                  borderRadius: "0.5rem",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  cursor: activo ? "pointer" : "not-allowed"
                }}
              >
                {activo ? (
                  <>Ver Inventario <ArrowRight size={16} /></>
                ) : (
                  <>Depósito Inactivo <Lock size={16} /></>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {filteredDepositos.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          No se encontraron depósitos que coincidan con los filtros de búsqueda.
        </div>
      )}

      {/* Modal Crear / Modificar Depósito */}
      {isModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
          <div style={{ backgroundColor: "#fff", padding: "1.75rem", borderRadius: "0.75rem", width: "100%", maxWidth: "520px", maxHeight: "88vh", overflowY: "auto" }}>
            <h2 style={{ margin: "0 0 1rem 0", fontSize: "1.3rem" }}>
              {depositoEditando ? `Modificar ${depositoEditando.codigo}` : "Nuevo Depósito"}
            </h2>

            <form onSubmit={handleGuardar} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ fontWeight: "600", fontSize: "0.85rem", display: "block", marginBottom: "0.25rem" }}>
                  Código de Depósito (Autogenerado correlativo)
                </label>
                <input
                  type="text"
                  value={codigoAuto}
                  readOnly
                  style={{
                    width: "100%",
                    padding: "0.55rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #d1d5db",
                    boxSizing: "border-box",
                    backgroundColor: "#f3f4f6",
                    color: "#374151",
                    fontWeight: "bold",
                    cursor: "not-allowed"
                  }}
                />
              </div>

              <div>
                <label style={{ fontWeight: "600", fontSize: "0.85rem", display: "block", marginBottom: "0.25rem" }}>Descripción *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Depósito de venta libre y perfumería"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  style={{ width: "100%", padding: "0.55rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontWeight: "600", fontSize: "0.85rem", display: "block", marginBottom: "0.25rem" }}>Sucursal *</label>
                <select
                  required
                  value={idSucursal}
                  onChange={(e) => setIdSucursal(e.target.value)}
                  style={{ width: "100%", padding: "0.55rem", borderRadius: "0.375rem", border: "1px solid #d1d5db" }}
                >
                  <option value="" disabled>Seleccione sucursal...</option>
                  {sucursales.map((s) => (
                    <option key={s.id_sucursal} value={s.id_sucursal}>[{s.codigo}] {s.descripcion}</option>
                  ))}
                </select>
              </div>

              {/* ESTADO: Solo visible si se está EDITANDO un depósito existente */}
              {depositoEditando && (
                <div>
                  <label style={{ fontWeight: "600", fontSize: "0.85rem", display: "block", marginBottom: "0.25rem" }}>Estado *</label>
                  <select
                    value={estado ? "true" : "false"}
                    onChange={(e) => setEstado(e.target.value === "true")}
                    style={{ width: "100%", padding: "0.55rem", borderRadius: "0.375rem", border: "1px solid #d1d5db" }}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              )}

              <div style={{ border: "1px solid #e5e7eb", padding: "0.85rem", borderRadius: "0.5rem", background: "#f9fafb" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "bold", fontSize: "0.9rem", cursor: "pointer", marginBottom: "0.6rem" }}>
                  <input
                    type="checkbox"
                    checked={aceptaTodos}
                    onChange={(e) => setAceptaTodos(e.target.checked)}
                  />
                  Permitir todos los rubros en este depósito
                </label>

                {!aceptaTodos && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", maxHeight: "150px", overflowY: "auto", borderTop: "1px solid #e5e7eb", paddingTop: "0.6rem" }}>
                    {RUBROS_CATALOGO.map((r) => (
                      <label key={r.codigo} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={rubrosSeleccionados.includes(r.codigo)}
                          onChange={() => handleToggleRubro(r.codigo)}
                        />
                        {r.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: "0.55rem 1rem", border: "1px solid #d1d5db", background: "#fff", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "500" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ padding: "0.55rem 1.25rem", background: "#65482b", color: "#fff", border: "none", borderRadius: "0.375rem", fontWeight: "bold", cursor: "pointer" }}
                >
                  {loading ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}