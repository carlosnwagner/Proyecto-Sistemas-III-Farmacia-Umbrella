import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import { showAlert } from "../lib/alerts.js";
import { FileText, Search, Receipt, Eye } from "lucide-react";
import "../App.css";

// Componentes reutilizables con el diseño del proyecto
function StatCard({ title, value, subtitle, alert }) {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "0.75rem",
        padding: "1.25rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        border: "1px solid #e5e7eb",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div style={{ fontSize: "0.75rem", fontWeight: "600", color: "#6b7280", textTransform: "uppercase" }}>
          {title}
        </div>
        <div style={{ fontSize: "1.875rem", fontWeight: "700", color: alert ? "#dc2626" : "#111827", margin: "0.25rem 0" }}>
          {value}
        </div>
      </div>
      {subtitle && <div style={{ fontSize: "0.875rem", color: alert ? "#dc2626" : "#6b7280" }}>{subtitle}</div>}
    </div>
  );
}

function Badge({ children, variant = "default" }) {
  const styles = {
    default: { backgroundColor: "#f3f4f6", color: "#374151" },
    success: { backgroundColor: "#dcfce7", color: "#166534" },
    warning: { backgroundColor: "#fef3c7", color: "#92400e" },
    danger: { backgroundColor: "#fee2e2", color: "#991b1b" },
  };
  return (
    <span
      style={{
        padding: "0.25rem 0.625rem",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: "600",
        display: "inline-flex",
        alignItems: "center",
        ...styles[variant],
      }}
    >
      {children}
    </span>
  );
}

export default function RegistrarPagoProveedor() {
  const [proveedores, setProveedores] = useState([]);
  const [mediosPago, setMediosPago] = useState([]);
  const [selectedProveedorId, setSelectedProveedorId] = useState("");

  // Pestaña activa: "comprobantes" | "historial"
  const [tabActiva, setTabActiva] = useState("comprobantes");

  // Control del modal de pago y parámetros de la orden
  const [isModalPagoOpen, setIsModalPagoOpen] = useState(false);
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().slice(0, 10));
  const [idMedioPago, setIdMedioPago] = useState("");

  // Facturas y saldos (HU 34)
  const [facturas, setFacturas] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("PENDIENTES");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [comprobanteDetalle, setComprobanteDetalle] = useState(null);

  // Imputaciones: { [id_factura_proveedor]: { seleccionado: boolean, montoAplicado: number | string } }
  const [aplicaciones, setAplicaciones] = useState({});

  // Historial de Pagos Realizados
  const [historialPagos, setHistorialPagos] = useState([]);
  const [loadingPagos, setLoadingPagos] = useState(false);
  const [filtroTipoPago, setFiltroTipoPago] = useState("TODOS");
  const [searchTermPagos, setSearchTermPagos] = useState("");
  const [pagoDetalleModal, setPagoDetalleModal] = useState(null);

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return "-";
    const [anio, mes, dia] = fechaStr.split("-");
    if (!dia || !mes || !anio) return fechaStr;
    return `${dia}/${mes}/${anio}`;
  };

  // Cálculo automático del tipo de cancelación según las facturas afectadas
  const tipoCancelacion = useMemo(() => {
    const facturasSeleccionadas = facturas.filter(
      (f) => (aplicaciones[f.id_factura_proveedor]?.montoAplicado || 0) > 0
    );
    if (facturasSeleccionadas.length === 0) return "Parcial";

    const todasCompletas = facturasSeleccionadas.every((f) => {
      const aplicado = Number(aplicaciones[f.id_factura_proveedor]?.montoAplicado) || 0;
      return aplicado >= f.saldoPendiente;
    });

    return todasCompletas ? "Total" : "Parcial";
  }, [facturas, aplicaciones]);

  useEffect(() => {
    async function loadCatalogos() {
      const [provRes, mediosRes] = await Promise.all([
        supabase
          .from("proveedor")
          .select("id_proveedor, razon_social, identificacion_fiscal, estado")
          .eq("estado", true)
          .order("razon_social", { ascending: true }),
        supabase
          .from("medio_pago")
          .select("id_medio_pago, nombre, estado")
          .eq("estado", true),
      ]);

      if (provRes.data) setProveedores(provRes.data);
      if (mediosRes.data && mediosRes.data.length > 0) {
        setMediosPago(mediosRes.data);
        setIdMedioPago(String(mediosRes.data[0].id_medio_pago));
      }
    }
    loadCatalogos();
  }, []);

  const fetchFacturasProveedor = useCallback(async (idProveedor) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("factura_proveedor")
      .select(`
        id_factura_proveedor,
        tipo_comprobante,
        tipo_factura,
        numero_comprobante,
        punto_venta,
        subtotal,
        iva,
        conceptos_exentos,
        percepcion_iva,
        percepcion_iibb,
        fecha,
        importe_total,
        estado,
        detalle_pago (
          id_detalle_pago,
          importe_aplicado
        ),
        nota_credito_debito_proveedor (
          id_nota,
          tipo_nota,
          importe
        )
      `)
      .eq("id_proveedor", idProveedor)
      .order("fecha", { ascending: false });

    if (error) {
      showAlert.errorSave("Error al cargar comprobantes: " + error.message);
      setFacturas([]);
    } else {
      const procesadas = (data || []).map((f) => {
        const totalOriginal = Number(f.importe_total) || 0;

        const pagado = (f.detalle_pago || []).reduce(
          (acc, curr) => acc + (Number(curr.importe_aplicado) || 0),
          0
        );

        let impactoNotas = 0;
        (f.nota_credito_debito_proveedor || []).forEach((n) => {
          const imp = Number(n.importe) || 0;
          const esNC =
            n.tipo_nota?.toUpperCase().includes("NC") ||
            n.tipo_nota?.toLowerCase().includes("crédito");
          impactoNotas += esNC ? -imp : imp;
        });

        const saldoCalculado = Math.max(0, totalOriginal + impactoNotas - pagado);

        const estadoCalculado =
          saldoCalculado === 0
            ? "Pagada Total"
            : pagado > 0
            ? "Pagada Parcial"
            : "Pendiente";

        return {
          ...f,
          totalOriginal,
          totalPagado: pagado,
          impactoNotas,
          saldoPendiente: saldoCalculado,
          estadoCalculado,
        };
      });

      setFacturas(procesadas);

      const initApp = {};
      procesadas.forEach((p) => {
        initApp[p.id_factura_proveedor] = { seleccionado: false, montoAplicado: "" };
      });
      setAplicaciones(initApp);
    }
    setLoading(false);
  }, []);

  const fetchHistorialPagos = useCallback(async (idProveedor) => {
    setLoadingPagos(true);
    const { data, error } = await supabase
      .from("pago_proveedor")
      .select(`
        id_pago,
        fecha_pago,
        importe_total,
        tipo_cancelacion,
        id_medio_pago,
        medio_pago ( nombre ),
        detalle_pago (
          id_detalle_pago,
          importe_aplicado,
          id_factura_proveedor,
          factura_proveedor (
            id_factura_proveedor,
            tipo_comprobante,
            tipo_factura,
            numero_comprobante,
            punto_venta,
            importe_total
          )
        )
      `)
      .eq("id_proveedor", idProveedor)
      .order("fecha_pago", { ascending: false })
      .order("id_pago", { ascending: false });

    if (error) {
      console.error("Error al cargar historial de pagos:", error);
      setHistorialPagos([]);
    } else {
      setHistorialPagos(data || []);
    }
    setLoadingPagos(false);
  }, []);

  useEffect(() => {
    if (!selectedProveedorId) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFacturasProveedor(selectedProveedorId);
    fetchHistorialPagos(selectedProveedorId);
  }, [selectedProveedorId, fetchFacturasProveedor, fetchHistorialPagos]);

  const resumen = useMemo(() => {
    let saldoTotalAdeudado = 0;
    let totalOriginal = 0;
    let totalNotas = 0;

    facturas.forEach((f) => {
      saldoTotalAdeudado += f.saldoPendiente;
      totalOriginal += f.totalOriginal;
      totalNotas += f.impactoNotas;
    });

    const totalHistoricoPagado = historialPagos.reduce(
      (acc, p) => acc + (Number(p.importe_total) || 0),
      0
    );

    return { saldoTotalAdeudado, totalOriginal, totalNotas, totalHistoricoPagado };
  }, [facturas, historialPagos]);

  const facturasFiltradas = useMemo(() => {
    return facturas.filter((f) => {
      const matchSearch =
        (f.numero_comprobante || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.tipo_comprobante || "").toLowerCase().includes(searchTerm.toLowerCase());

      let matchEstado = true;
      if (filtroEstado === "PENDIENTES") matchEstado = f.saldoPendiente > 0;
      else if (filtroEstado === "PARCIALES") matchEstado = f.estadoCalculado === "Pagada Parcial";
      else if (filtroEstado === "PAGADOS") matchEstado = f.saldoPendiente === 0;

      return matchSearch && matchEstado;
    });
  }, [facturas, filtroEstado, searchTerm]);

  const pagosFiltrados = useMemo(() => {
    return historialPagos.filter((p) => {
      let matchTipo = true;
      if (filtroTipoPago === "TOTAL") {
        matchTipo = (p.tipo_cancelacion || "").toLowerCase() === "total";
      } else if (filtroTipoPago === "PARCIAL") {
        matchTipo = (p.tipo_cancelacion || "").toLowerCase() === "parcial";
      }

      if (!searchTermPagos.trim()) return matchTipo;

      const term = searchTermPagos.toLowerCase();
      const nroOp = `op-${String(p.id_pago).padStart(6, "0")}`.toLowerCase();
      const idPagoStr = String(p.id_pago);
      const fechaStr = formatearFecha(p.fecha_pago).toLowerCase();
      const medioStr = (p.medio_pago?.nombre || "").toLowerCase();
      const comprobantesStr = (p.detalle_pago || [])
        .map((d) => (d.factura_proveedor?.numero_comprobante || "").toLowerCase())
        .join(" ");

      const matchSearch =
        nroOp.includes(term) ||
        idPagoStr.includes(term) ||
        fechaStr.includes(term) ||
        medioStr.includes(term) ||
        comprobantesStr.includes(term);

      return matchTipo && matchSearch;
    });
  }, [historialPagos, filtroTipoPago, searchTermPagos]);

  const handleToggleSelect = (item) => {
    const id = item.id_factura_proveedor;
    const isSelected = !aplicaciones[id]?.seleccionado;

    setAplicaciones((prev) => ({
      ...prev,
      [id]: {
        seleccionado: isSelected,
        montoAplicado: isSelected ? item.saldoPendiente : "",
      },
    }));
  };

  const handleMontoChange = (id, saldoMaximo, valor) => {
    let num = valor === "" ? "" : Number(valor);

    if (num !== "" && num > saldoMaximo) {
      showAlert.errorSave(`El importe no puede superar el saldo pendiente de $${saldoMaximo.toFixed(2)}`);
      num = saldoMaximo;
    }
    if (num !== "" && num < 0) num = 0;

    setAplicaciones((prev) => ({
      ...prev,
      [id]: {
        seleccionado: num !== "" && Number(num) > 0,
        montoAplicado: num,
      },
    }));
  };

  const totalPagoCalculado = useMemo(() => {
    return Object.entries(aplicaciones).reduce((acc, [, val]) => {
      if (val.seleccionado && val.montoAplicado) {
        return acc + Number(val.montoAplicado);
      }
      return acc;
    }, 0);
  }, [aplicaciones]);

  const handleRegistrarPago = async () => {
    if (!selectedProveedorId) {
      showAlert.errorSave("Debe seleccionar un proveedor.");
      return;
    }
    if (!idMedioPago) {
      showAlert.errorSave("Debe seleccionar un medio de pago.");
      return;
    }

    const itemsAImputar = Object.entries(aplicaciones)
      .filter(([, val]) => val.seleccionado && Number(val.montoAplicado) > 0)
      .map(([idFactura, val]) => ({
        id_factura_proveedor: Number(idFactura),
        monto: Number(val.montoAplicado),
      }));

    if (itemsAImputar.length === 0) {
      showAlert.errorSave("Seleccione al menos un comprobante con importe mayor a $0.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Insertar cabecera pago_proveedor (respetando 'Total' o 'Parcial')
      const { data: pagoData, error: pagoErr } = await supabase
        .from("pago_proveedor")
        .insert([
          {
            id_proveedor: Number(selectedProveedorId),
            fecha_pago: fechaPago,
            importe_total: totalPagoCalculado,
            id_medio_pago: Number(idMedioPago),
            tipo_cancelacion: tipoCancelacion, // 'Total' o 'Parcial'
          },
        ])
        .select("id_pago")
        .single();

      if (pagoErr) throw pagoErr;

      // 2. Insertar todos los detalles de pago en una sola operación masiva
      const detallesAInsertar = itemsAImputar.map((item) => ({
        id_pago: pagoData.id_pago,
        id_factura_proveedor: item.id_factura_proveedor,
        importe_aplicado: item.monto,
      }));

      const { error: detErr } = await supabase
        .from("detalle_pago")
        .insert(detallesAInsertar);

      if (detErr) throw detErr;

      // 3. Actualizar el estado de cada factura según su saldo individual restante
      for (const item of itemsAImputar) {
        const factActual = facturas.find(
          (f) => Number(f.id_factura_proveedor) === item.id_factura_proveedor
        );
        const nuevoSaldo = Math.max(0, (factActual?.saldoPendiente || 0) - item.monto);
        const nuevoEstado = nuevoSaldo === 0 ? "Pagada Total" : "Pagada Parcial";

        const { error: updErr } = await supabase
          .from("factura_proveedor")
          .update({ estado: nuevoEstado })
          .eq("id_factura_proveedor", item.id_factura_proveedor);

        if (updErr) throw updErr;
      }

      // 4. Cierre ordenado y refresco de vista simultáneo
      showAlert.successSave("¡Pago registrado e imputado exitosamente!");
      setIsModalPagoOpen(false);

      // Limpia selección de montos e inputs
      setAplicaciones({});

      // Recarga los comprobantes y el historial de pagos de manera reactiva
      await Promise.all([
        fetchFacturasProveedor(selectedProveedorId),
        fetchHistorialPagos(selectedProveedorId)
      ]);

    } catch (err) {
      console.error("Error al registrar pago:", err);
      showAlert.errorSave(err.message || "Error al registrar el pago.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pagos-pagina" style={{ maxWidth: "1280px", margin: "0 auto", width: "100%" }}>
      {/* Encabezado */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 className="titulo-pagina" style={{ margin: 0, fontSize: "1.9rem" }}>
            Pagos a Proveedores
          </h1>
          <p className="subtitulo" style={{ margin: "0.25rem 0 0" }}>
            Consulta de cuentas corrientes, comprobantes e historial de pagos
          </p>
        </div>
      </header>

      {/* Selector de Proveedor */}
      <div className="card-formulario" style={{ marginBottom: "1.5rem", padding: "1.25rem", backgroundColor: "#fff", borderRadius: "0.75rem", border: "1px solid #e5e7eb" }}>
        <div style={{ maxWidth: "420px" }}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#374151", marginBottom: "0.4rem" }}>
            Proveedor *
          </label>
          <select
            value={selectedProveedorId}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedProveedorId(val);
              if (!val) {
                setFacturas([]);
                setHistorialPagos([]);
                setAplicaciones({});
              }
            }}
            className="select-proveedor"
            style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #d1d5db" }}
          >
            <option value="">Seleccione un proveedor...</option>
            {proveedores.map((p) => (
              <option key={p.id_proveedor} value={p.id_proveedor}>
                {p.razon_social} ({p.identificacion_fiscal || "Sin CUIT"})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Panel de Estadísticas / Conciliación (HU 34) */}
      {selectedProveedorId && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <StatCard
            title="SALDO TOTAL ADEUDADO"
            value={`$${resumen.saldoTotalAdeudado.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`}
            subtitle="Saldo neto actual a cancelar"
            alert={resumen.saldoTotalAdeudado > 0}
          />
          <StatCard
            title="TOTAL FACTURADO"
            value={`$${resumen.totalOriginal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`}
            subtitle="Importe facturado original"
          />
          <StatCard
            title="TOTAL HISTÓRICO PAGADO"
            value={`$${resumen.totalHistoricoPagado.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`}
            subtitle={`${historialPagos.length} orden(es) de pago realizadas`}
          />
          <StatCard
            title="NOTAS CRÉDITO / DÉBITO"
            value={`${resumen.totalNotas < 0 ? "-" : ""}$${Math.abs(resumen.totalNotas).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`}
            subtitle={resumen.totalNotas < 0 ? "A favor de la farmacia" : "Ajustes aplicados"}
          />
        </div>
      )}

      {/* Selector de Pestañas (Tabs) */}
      {selectedProveedorId && (
        <div style={{ display: "flex", gap: "0.5rem", borderBottom: "2px solid #e5e7eb", marginBottom: "1.5rem" }}>
          <button
            type="button"
            onClick={() => setTabActiva("comprobantes")}
            style={{
              padding: "0.75rem 1.25rem",
              fontWeight: "600",
              fontSize: "0.95rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              border: "none",
              borderBottom: tabActiva === "comprobantes" ? "3px solid var(--marron-principal)" : "3px solid transparent",
              backgroundColor: "transparent",
              color: tabActiva === "comprobantes" ? "var(--marron-principal)" : "#6b7280",
              cursor: "pointer",
              marginBottom: "-2px",
              transition: "all 0.2s ease",
            }}
          >
            <FileText size={18} />
            <span>Comprobantes y Liquidación</span>
            <span
              style={{
                backgroundColor: tabActiva === "comprobantes" ? "#f3ede7" : "#f3f4f6",
                color: tabActiva === "comprobantes" ? "#65482b" : "#6b7280",
                padding: "0.15rem 0.5rem",
                borderRadius: "9999px",
                fontSize: "0.75rem",
              }}
            >
              {facturas.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTabActiva("historial")}
            style={{
              padding: "0.75rem 1.25rem",
              fontWeight: "600",
              fontSize: "0.95rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              border: "none",
              borderBottom: tabActiva === "historial" ? "3px solid var(--marron-principal)" : "3px solid transparent",
              backgroundColor: "transparent",
              color: tabActiva === "historial" ? "var(--marron-principal)" : "#6b7280",
              cursor: "pointer",
              marginBottom: "-2px",
              transition: "all 0.2s ease",
            }}
          >
            <Receipt size={18} />
            <span>Historial de Pagos Realizados</span>
            <span
              style={{
                backgroundColor: tabActiva === "historial" ? "#f3ede7" : "#f3f4f6",
                color: tabActiva === "historial" ? "#65482b" : "#6b7280",
                padding: "0.15rem 0.5rem",
                borderRadius: "9999px",
                fontSize: "0.75rem",
              }}
            >
              {historialPagos.length}
            </span>
          </button>
        </div>
      )}

      {/* Aviso cuando no hay proveedor seleccionado */}
      {!selectedProveedorId && (
        <div className="tarjeta-formulario">
          <div className="aviso" style={{ textAlign: "center", padding: "3rem" }}>
            Selecciona un proveedor para consultar su saldo, comprobantes pendientes e historial de pagos.
          </div>
        </div>
      )}

      {/* PESTAÑA 1: Comprobantes del Proveedor */}
      {selectedProveedorId && tabActiva === "comprobantes" && (
        <div className="tarjeta-formulario">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h2 className="subtitulo-seccion" style={{ margin: 0 }}>
                Comprobantes del Proveedor
              </h2>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", color: "var(--texto-secundario)" }}>
                Seleccione los comprobantes que desea abonar total o parcialmente
              </p>
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              {["PENDIENTES", "PARCIALES", "PAGADOS", "TODOS"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFiltroEstado(st)}
                  style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: "0.375rem",
                    fontSize: "0.75rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    border: "1px solid var(--borde-suave)",
                    backgroundColor: filtroEstado === st ? "var(--marron-principal)" : "#ffffff",
                    color: filtroEstado === st ? "#ffffff" : "var(--texto-secundario)",
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Buscador interno */}
          <div style={{ position: "relative", marginBottom: "1.25rem" }}>
            <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input
              type="text"
              placeholder="Buscar por número o tipo de comprobante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="campo-entrada"
              style={{ paddingLeft: "2.5rem" }}
            />
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--texto-secundario)" }}>
              Cargando comprobantes...
            </div>
          ) : facturasFiltradas.length === 0 ? (
            <div className="aviso" style={{ textAlign: "center", padding: "2.5rem" }}>
              No se encontraron comprobantes para el filtro seleccionado.
            </div>
          ) : (
            <div className="tabla-contenedor" style={{ width: "100%", overflowX: "auto" }}>
              <table className="tabla-facturas" style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ width: "5%", textAlign: "center" }}>PAGAR</th>
                    <th style={{ width: "24%", textAlign: "left" }}>COMPROBANTE</th>
                    <th style={{ width: "11%", textAlign: "center" }}>EMISIÓN</th>
                    <th style={{ width: "14%", textAlign: "right" }}>HABER (FACTURA)</th>
                    <th style={{ width: "14%", textAlign: "right" }}>DEBE (PAGOS/NC)</th>
                    <th style={{ width: "12%", textAlign: "right" }}>SALDO PENDIENTE</th>
                    <th style={{ width: "10%", textAlign: "center" }}>ESTADO</th>
                    <th style={{ width: "10%", textAlign: "right" }}>IMPORTE ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {facturasFiltradas.map((f) => {
                    const isChecked = aplicaciones[f.id_factura_proveedor]?.seleccionado || false;
                    const monto = aplicaciones[f.id_factura_proveedor]?.montoAplicado || "";

                    const haber = f.totalOriginal + (f.impactoNotas > 0 ? f.impactoNotas : 0);
                    const debe = f.totalPagado + (f.impactoNotas < 0 ? Math.abs(f.impactoNotas) : 0);

                    return (
                      <tr key={f.id_factura_proveedor} style={{ backgroundColor: isChecked ? "#faf8f5" : "transparent" }}>
                        <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                          <input
                            type="checkbox"
                            disabled={f.saldoPendiente <= 0}
                            checked={isChecked}
                            onChange={() => handleToggleSelect(f)}
                            style={{
                              cursor: f.saldoPendiente > 0 ? "pointer" : "not-allowed",
                              width: "16px",
                              height: "16px",
                              margin: "0 auto",
                              display: "block"
                            }}
                          />
                        </td>
                        <td style={{ textAlign: "left", verticalAlign: "middle" }}>
                          <button
                            type="button"
                            onClick={() => setComprobanteDetalle(f)}
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              color: "var(--marron-principal)",
                              maxWidth: "100%"
                            }}
                          >
                            <FileText size={16} style={{ flexShrink: 0 }} />
                            <span style={{ fontWeight: "600", textDecoration: "underline", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {f.tipo_comprobante || "Factura"} {f.tipo_factura || ""} {String(f.numero_comprobante || f.id_factura_proveedor).padStart(8, "0")}
                            </span>
                          </button>
                        </td>
                        <td style={{ textAlign: "center", verticalAlign: "middle", color: "var(--texto-secundario)" }}>
                          {formatearFecha(f.fecha)}
                        </td>
                        <td style={{ textAlign: "right", verticalAlign: "middle", fontWeight: "500" }}>
                          ${haber.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: "right", verticalAlign: "middle", fontWeight: "500", color: debe > 0 ? "#166534" : "var(--texto-secundario)" }}>
                          ${debe.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: "right", verticalAlign: "middle", fontWeight: "700", color: f.saldoPendiente > 0 ? "#dc2626" : "#166534" }}>
                          ${f.saldoPendiente.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                          <Badge variant={f.estadoCalculado === "Pagada Total" ? "success" : f.estadoCalculado === "Pagada Parcial" ? "warning" : "danger"}>
                            {f.estadoCalculado}
                          </Badge>
                        </td>
                        <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                          <input
                            type="number"
                            placeholder="0.00"
                            className="input-aplicacion"
                            disabled={f.saldoPendiente <= 0}
                            value={monto}
                            onChange={(e) => handleMontoChange(f.id_factura_proveedor, f.saldoPendiente, e.target.value)}
                            style={{
                              width: "100%",
                              maxWidth: "100px",
                              textAlign: "right",
                              boxSizing: "border-box"
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Tarjeta de Totalización y Botón para Abrir Modal de Pago */}
          <div className="tarjeta-total" style={{ marginTop: "1.5rem" }}>
            <div>
              <span className="etiqueta-total">Total a Pagar:</span>
              <div className="valor-total">
                ${totalPagoCalculado.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <button
              type="button"
              className="boton-principal"
              disabled={submitting || totalPagoCalculado <= 0}
              onClick={() => setIsModalPagoOpen(true)}
            >
              Continuar al Pago
            </button>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: Historial de Pagos Realizados */}
      {selectedProveedorId && tabActiva === "historial" && (
        <div className="tarjeta-formulario">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h2 className="subtitulo-seccion" style={{ margin: 0 }}>
                Historial de Pagos Realizados
              </h2>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", color: "var(--texto-secundario)" }}>
                Registro de egresos y cancelaciones emitidas a este proveedor
              </p>
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              {["TODOS", "TOTAL", "PARCIAL"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFiltroTipoPago(st)}
                  style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: "0.375rem",
                    fontSize: "0.75rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    border: "1px solid var(--borde-suave)",
                    backgroundColor: filtroTipoPago === st ? "var(--marron-principal)" : "#ffffff",
                    color: filtroTipoPago === st ? "#ffffff" : "var(--texto-secundario)",
                  }}
                >
                  {st === "TODOS" ? "Todos los pagos" : `Cancelación ${st}`}
                </button>
              ))}
            </div>
          </div>

          {/* Buscador interno de pagos */}
          <div style={{ position: "relative", marginBottom: "1.25rem" }}>
            <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input
              type="text"
              placeholder="Buscar por N° de orden, fecha, medio de pago o comprobante..."
              value={searchTermPagos}
              onChange={(e) => setSearchTermPagos(e.target.value)}
              className="campo-entrada"
              style={{ paddingLeft: "2.5rem" }}
            />
          </div>

          {loadingPagos ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--texto-secundario)" }}>
              Cargando historial de pagos...
            </div>
          ) : pagosFiltrados.length === 0 ? (
            <div className="aviso" style={{ textAlign: "center", padding: "2.5rem" }}>
              No se encontraron pagos emitidos para este proveedor con los filtros aplicados.
            </div>
          ) : (
            <div className="tabla-contenedor" style={{ width: "100%", overflowX: "auto" }}>
              <table className="tabla-facturas" style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ width: "16%", textAlign: "left" }}>ORDEN DE PAGO</th>
                    <th style={{ width: "12%", textAlign: "center" }}>FECHA PAGO</th>
                    <th style={{ width: "18%", textAlign: "left" }}>MEDIO DE PAGO</th>
                    <th style={{ width: "14%", textAlign: "center" }}>CANCELACIÓN</th>
                    <th style={{ width: "22%", textAlign: "left" }}>COMPROBANTES APLICADOS</th>
                    <th style={{ width: "18%", textAlign: "right" }}>IMPORTE TOTAL</th>
                    <th style={{ width: "10%", textAlign: "center" }}>ACCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {pagosFiltrados.map((p) => {
                    const totalDetalles = p.detalle_pago?.length || 0;
                    return (
                      <tr key={p.id_pago}>
                        <td style={{ textAlign: "left", verticalAlign: "middle", fontWeight: "700", color: "var(--marron-principal)" }}>
                          #OP-{String(p.id_pago).padStart(6, "0")}
                        </td>
                        <td style={{ textAlign: "center", verticalAlign: "middle", color: "var(--texto-secundario)" }}>
                          {formatearFecha(p.fecha_pago)}
                        </td>
                        <td style={{ textAlign: "left", verticalAlign: "middle" }}>
                          <span style={{ fontWeight: "500", color: "#374151" }}>
                            {p.medio_pago?.nombre || "No especificado"}
                          </span>
                        </td>
                        <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                          <Badge variant={(p.tipo_cancelacion || "").toLowerCase() === "total" ? "success" : "warning"}>
                            {p.tipo_cancelacion || "Parcial"}
                          </Badge>
                        </td>
                        <td style={{ textAlign: "left", verticalAlign: "middle" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", alignItems: "center" }}>
                            {p.detalle_pago?.slice(0, 2).map((d) => (
                              <span
                                key={d.id_detalle_pago}
                                style={{
                                  fontSize: "0.75rem",
                                  backgroundColor: "#f3f4f6",
                                  color: "#374151",
                                  padding: "0.15rem 0.4rem",
                                  borderRadius: "0.25rem",
                                  fontWeight: "500",
                                }}
                              >
                                {d.factura_proveedor
                                  ? `${d.factura_proveedor.tipo_factura || ""} ${d.factura_proveedor.numero_comprobante || d.id_factura_proveedor}`
                                  : `#${d.id_factura_proveedor}`}
                              </span>
                            ))}
                            {totalDetalles > 2 && (
                              <span style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: "600" }}>
                                +{totalDetalles - 2} más
                              </span>
                            )}
                            {totalDetalles === 0 && (
                              <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Sin comprobantes</span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: "right", verticalAlign: "middle", fontWeight: "700", color: "#166534" }}>
                          ${Number(p.importe_total || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                          <button
                            type="button"
                            onClick={() => setPagoDetalleModal(p)}
                            title="Ver detalle del pago"
                            style={{
                              backgroundColor: "transparent",
                              border: "1px solid #d1d5db",
                              borderRadius: "0.375rem",
                              padding: "0.35rem 0.6rem",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.3rem",
                              fontSize: "0.75rem",
                              color: "var(--marron-principal)",
                              fontWeight: "600",
                            }}
                          >
                            <Eye size={14} />
                            Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Detalle del Pago Realizado (Auditoría) */}
      {pagoDetalleModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1150,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              width: "100%",
              maxWidth: "600px",
              padding: "1.5rem",
              border: "1px solid #e5e7eb",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "1.25rem",
                borderBottom: "1px solid #e5e7eb",
                paddingBottom: "0.85rem",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: "700",
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Detalle de Pago a Proveedor
                </span>
                <h3
                  style={{
                    margin: "0.2rem 0 0",
                    fontSize: "1.4rem",
                    fontWeight: "700",
                    color: "#111827",
                  }}
                >
                  Orden de Pago #OP-{String(pagoDetalleModal.id_pago).padStart(6, "0")}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setPagoDetalleModal(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1.25rem",
                  color: "#6b7280",
                  padding: "0.25rem",
                }}
              >
                ✕
              </button>
            </div>

            {/* Datos cabecera del pago */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "0.85rem",
                fontSize: "0.875rem",
                marginBottom: "1.25rem",
                backgroundColor: "#f9fafb",
                padding: "1rem",
                borderRadius: "0.5rem",
                border: "1px solid #e5e7eb",
              }}
            >
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: "0.75rem" }}>Fecha de Pago</span>
                <b style={{ color: "#111827" }}>{formatearFecha(pagoDetalleModal.fecha_pago)}</b>
              </div>
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: "0.75rem" }}>Medio de Pago</span>
                <b style={{ color: "#111827" }}>{pagoDetalleModal.medio_pago?.nombre || "No especificado"}</b>
              </div>
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: "0.75rem" }}>Tipo Cancelación</span>
                <Badge variant={(pagoDetalleModal.tipo_cancelacion || "").toLowerCase() === "total" ? "success" : "warning"}>
                  {pagoDetalleModal.tipo_cancelacion || "Parcial"}
                </Badge>
              </div>
            </div>

            {/* Comprobantes cancelados / imputados */}
            <div style={{ marginBottom: "1.25rem" }}>
              <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", color: "#374151", fontWeight: "600" }}>
                Comprobantes Imputados en este Pago
              </h4>
              <div style={{ border: "1px solid #e5e7eb", borderRadius: "0.5rem", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f3f4f6", borderBottom: "1px solid #e5e7eb" }}>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "#4b5563" }}>Comprobante</th>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: "#4b5563" }}>Total Factura</th>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "right", color: "#4b5563" }}>Monto Aplicado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pagoDetalleModal.detalle_pago || []).length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ padding: "1rem", textAlign: "center", color: "#6b7280" }}>
                          Sin comprobantes asociados registrados.
                        </td>
                      </tr>
                    ) : (
                      pagoDetalleModal.detalle_pago.map((det, idx) => {
                        const fac = det.factura_proveedor;
                        return (
                          <tr key={det.id_detalle_pago || idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                            <td style={{ padding: "0.6rem 0.75rem", color: "#111827", fontWeight: "500" }}>
                              {fac
                                ? `${fac.tipo_comprobante || "Factura"} ${fac.tipo_factura || ""} ${String(fac.punto_venta || 1).padStart(4, "0")}-${String(fac.numero_comprobante || fac.id_factura_proveedor).padStart(8, "0")}`
                                : `Comprobante #${det.id_factura_proveedor}`}
                            </td>
                            <td style={{ padding: "0.6rem 0.75rem", textAlign: "right", color: "#6b7280" }}>
                              {fac?.importe_total != null
                                ? `$${Number(fac.importe_total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`
                                : "-"}
                            </td>
                            <td style={{ padding: "0.6rem 0.75rem", textAlign: "right", fontWeight: "700", color: "#166534" }}>
                              ${Number(det.importe_aplicado || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Resumen Total */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#faf8f5",
                padding: "0.85rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid #ebd8c8",
                marginBottom: "1.25rem",
              }}
            >
              <span style={{ fontWeight: "600", color: "#785b46" }}>Total Abonado en la Orden:</span>
              <span style={{ fontSize: "1.3rem", fontWeight: "800", color: "var(--marron-principal)" }}>
                ${Number(pagoDetalleModal.importe_total || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setPagoDetalleModal(null)}
                className="boton-principal"
                style={{ padding: "0.5rem 1.5rem" }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalle de Comprobante (HU 34) */}
      {comprobanteDetalle && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              width: "100%",
              maxWidth: "560px",
              padding: "1.5rem",
              border: "1px solid #e5e7eb",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "1.25rem",
                borderBottom: "1px solid #e5e7eb",
                paddingBottom: "0.85rem",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: "700",
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {comprobanteDetalle.tipo_comprobante || "Factura"} Proveedor
                </span>
                <h3
                  style={{
                    margin: "0.2rem 0 0",
                    fontSize: "1.4rem",
                    fontWeight: "700",
                    color: "#111827",
                  }}
                >
                  {comprobanteDetalle.tipo_factura ? `${comprobanteDetalle.tipo_factura} ` : ""}
                  {String(comprobanteDetalle.punto_venta || 1).padStart(4, "0")}-
                  {String(comprobanteDetalle.numero_comprobante || comprobanteDetalle.id_factura_proveedor).padStart(8, "0")}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setComprobanteDetalle(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1.25rem",
                  color: "#6b7280",
                  padding: "0.25rem",
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.85rem",
                fontSize: "0.875rem",
                marginBottom: "1.25rem",
              }}
            >
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: "0.75rem" }}>Punto de Venta</span>
                <b style={{ color: "#111827" }}>{String(comprobanteDetalle.punto_venta || 1).padStart(4, "0")}</b>
              </div>
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: "0.75rem" }}>Tipo Comprobante</span>
                <b style={{ color: "#111827" }}>Factura {comprobanteDetalle.tipo_factura || "A"}</b>
              </div>
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: "0.75rem" }}>Subtotal Gravado</span>
                <b style={{ color: "#111827" }}>
                  ${Number(comprobanteDetalle.subtotal || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </b>
              </div>
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: "0.75rem" }}>IVA Liquidado</span>
                <b style={{ color: "#111827" }}>
                  ${Number(comprobanteDetalle.iva || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </b>
              </div>
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: "0.75rem" }}>Exentos / No gravados</span>
                <b style={{ color: "#111827" }}>
                  ${Number(comprobanteDetalle.conceptos_exentos || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </b>
              </div>
              <div>
                <span style={{ color: "#6b7280", display: "block", fontSize: "0.75rem" }}>Total Factura</span>
                <b style={{ color: "#111827" }}>
                  ${Number(comprobanteDetalle.importe_total || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </b>
              </div>
            </div>

            <div
              style={{
                backgroundColor: "#f9fafb",
                padding: "1rem",
                borderRadius: "0.5rem",
                border: "1px solid #e5e7eb",
                fontSize: "0.85rem",
                marginBottom: "1.25rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <span style={{ color: "#4b5563" }}>Ajuste NC/ND aplicadas:</span>
                <b
                  style={{
                    color:
                      (comprobanteDetalle.impactoNotas || 0) < 0
                        ? "#2563eb"
                        : (comprobanteDetalle.impactoNotas || 0) > 0
                        ? "#d97706"
                        : "#374151",
                  }}
                >
                  {(comprobanteDetalle.impactoNotas || 0) < 0 ? "-" : ""}
                  ${Math.abs(comprobanteDetalle.impactoNotas || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <span style={{ color: "#4b5563" }}>Total Pagado previamente:</span>
                <b style={{ color: "#166534" }}>
                  ${Number(comprobanteDetalle.totalPagado || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </b>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderTop: "1px solid #e5e7eb",
                  paddingTop: "0.5rem",
                  fontWeight: "700",
                }}
              >
                <span style={{ color: "#111827" }}>Saldo Pendiente Actual:</span>
                <span style={{ color: "#dc2626", fontSize: "1rem" }}>
                  ${Number(comprobanteDetalle.saldoPendiente || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setComprobanteDetalle(null)}
                className="boton-principal"
                style={{ padding: "0.5rem 1.5rem" }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
{/* Modal: Confirmación de Pago (HU 33) */}
{isModalPagoOpen && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1200,
      padding: "1rem",
    }}
  >
    <div
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "0.75rem",
        width: "100%",
        maxWidth: "520px",
        padding: "1.5rem",
        border: "1px solid #e5e7eb",
        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
      }}
    >
      {/* Cabecera */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: "0.75rem",
          marginBottom: "1.25rem",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#111827", fontWeight: "700" }}>
          Confirmar Orden de Pago
        </h3>
        <button
          type="button"
          onClick={() => setIsModalPagoOpen(false)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", color: "#6b7280" }}
        >
          ✕
        </button>
      </div>

      {/* Resumen del Monto a Pagar */}
      <div
        style={{
          backgroundColor: "#faf8f5",
          border: "1px solid #ebd8c8",
          borderRadius: "0.5rem",
          padding: "1rem",
          textAlign: "center",
          marginBottom: "1.25rem",
        }}
      >
        <span style={{ fontSize: "0.8rem", color: "#785b46", fontWeight: "600", textTransform: "uppercase" }}>
          Total a Desembolsar
        </span>
        <div style={{ fontSize: "2rem", fontWeight: "800", color: "var(--marron-principal)" }}>
          ${totalPagoCalculado.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
        </div>
      </div>

      {/* Campos de la Transacción */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          {/* Fecha */}
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#374151", marginBottom: "0.35rem" }}>
              Fecha de Pago *
            </label>
            <input
              type="date"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
              style={{
                width: "100%",
                padding: "0.55rem",
                borderRadius: "0.375rem",
                border: "1px solid #d1d5db",
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
              required
            />
          </div>

          {/* Tipo de Cancelación: Selector editable con sugerencia automática */}
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#374151", marginBottom: "0.35rem" }}>
              Tipo Cancelación *
            </label>
            <select
              value={tipoCancelacion}
              disabled
              style={{
                width: "100%",
                padding: "0.55rem",
                borderRadius: "0.375rem",
                border: "1px solid #d1d5db",
                fontSize: "0.875rem",
                boxSizing: "border-box",
                backgroundColor: "#f3f4f6",
                fontWeight: "600",
                color: tipoCancelacion === "Total" ? "#166534" : "#92400e",
              }}
            >
              <option value="Total">Cancelación Total</option>
              <option value="Parcial">Cancelación Parcial</option>
            </select>
          </div>
        </div>

        {/* Medio de Pago */}
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#374151", marginBottom: "0.35rem" }}>
            Medio de Pago *
          </label>
          <select
            value={idMedioPago}
            onChange={(e) => setIdMedioPago(e.target.value)}
            style={{
              width: "100%",
              padding: "0.55rem",
              borderRadius: "0.375rem",
              border: "1px solid #d1d5db",
              fontSize: "0.875rem",
              boxSizing: "border-box",
            }}
          >
            {mediosPago.map((m) => (
              <option key={m.id_medio_pago} value={m.id_medio_pago}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Botones de acción */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", borderTop: "1px solid #e5e7eb", paddingTop: "1rem" }}>
        <button
          type="button"
          onClick={() => setIsModalPagoOpen(false)}
          style={{
            padding: "0.55rem 1.25rem",
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
          type="button"
          disabled={submitting}
          onClick={handleRegistrarPago}
          className="boton-principal"
          style={{ padding: "0.55rem 1.5rem", fontWeight: "600" }}
        >
          {submitting ? "Registrando Pago..." : "Confirmar y Pagar"}
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}