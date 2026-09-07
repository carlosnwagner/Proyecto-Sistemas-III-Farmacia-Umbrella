import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase.js";
import { showAlert } from "../lib/alerts.js";
import { FileText, Search, CreditCard, CheckCircle2 } from "lucide-react";
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

  // Cabecera del pago (HU 33)
  const [fechaPago, setFechaPago] = useState(() => new Date().toISOString().split("T")[0]);
  const [idMedioPago, setIdMedioPago] = useState("");
  const [tipoCancelacion, setTipoCancelacion] = useState("Parcial");

  // Facturas y saldos (HU 34)
  const [facturas, setFacturas] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("PENDIENTES");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [comprobanteDetalle, setComprobanteDetalle] = useState(null);

  // Imputaciones: { [id_factura_proveedor]: { seleccionado: boolean, montoAplicado: number | string } }
  const [aplicaciones, setAplicaciones] = useState({});
  
  
  const formatearFecha = (fechaStr) => {
  if (!fechaStr) return "-";
  const [anio, mes, dia] = fechaStr.split("-");
  if (!dia || !mes || !anio) return fechaStr;
  return `${dia}/${mes}/${anio}`;
};

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
      if (mediosRes.data) {
        setMediosPago(mediosRes.data);
        if (mediosRes.data.length > 0) setIdMedioPago(mediosRes.data[0].id_medio_pago);
      }
    }
    loadCatalogos();
  }, []);

  useEffect(() => {
    if (!selectedProveedorId) {
      setFacturas([]);
      setAplicaciones({});
      return;
    }

    async function fetchFacturasProveedor() {
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
        .eq("id_proveedor", selectedProveedorId)
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
            const esNC = n.tipo_nota?.toUpperCase().includes("NC") || n.tipo_nota?.toLowerCase().includes("crédito");
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
    }

    fetchFacturasProveedor();
  }, [selectedProveedorId]);

  const resumen = useMemo(() => {
    let saldoTotalAdeudado = 0;
    let totalOriginal = 0;
    let totalNotas = 0;

    facturas.forEach((f) => {
      saldoTotalAdeudado += f.saldoPendiente;
      totalOriginal += f.totalOriginal;
      totalNotas += f.impactoNotas;
    });

    return { saldoTotalAdeudado, totalOriginal, totalNotas };
  }, [facturas]);

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
      // 1. Insertar cabecera pago_proveedor
      const { data: pagoData, error: pagoErr } = await supabase
        .from("pago_proveedor")
        .insert([
          {
            id_proveedor: Number(selectedProveedorId),
            fecha_pago: fechaPago,
            importe_total: totalPagoCalculado,
            id_medio_pago: Number(idMedioPago),
            tipo_cancelacion: itemsAImputar.length > 1 ? "Multiple" : tipoCancelacion,
          },
        ])
        .select("id_pago")
        .single();

      if (pagoErr) throw pagoErr;

      // 2. Insertar detalles 1 a N y actualizar estado en factura_proveedor
      for (const item of itemsAImputar) {
        const { error: detErr } = await supabase.from("detalle_pago").insert([
          {
            id_pago: pagoData.id_pago,
            id_factura_proveedor: item.id_factura_proveedor,
            importe_aplicado: item.monto,
          },
        ]);

        if (detErr) throw detErr;

        const factActual = facturas.find((f) => f.id_factura_proveedor === item.id_factura_proveedor);
        const nuevoSaldo = Math.max(0, factActual.saldoPendiente - item.monto);
        const nuevoEstado = nuevoSaldo === 0 ? "Pagada Total" : "Pagada Parcial";

        const { error: updErr } = await supabase
          .from("factura_proveedor")
          .update({ estado: nuevoEstado })
          .eq("id_factura_proveedor", item.id_factura_proveedor);

        if (updErr) throw updErr;
      }

      showAlert.successSave("¡Pago registrado e imputado exitosamente!");

      const provActual = selectedProveedorId;
      setSelectedProveedorId("");
      setTimeout(() => setSelectedProveedorId(provActual), 100);
    } catch (err) {
      showAlert.errorSave(err.message || "Error al registrar el pago.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pagos-pagina" style={{ maxWidth: "1300px", margin: "0 auto", width: "100%" }}>
      {/* Encabezado estándar */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 className="titulo-pagina" style={{ margin: 0, fontSize: "1.9rem" }}>
            Pagos a Proveedores
          </h1>
          <p className="subtitulo" style={{ margin: "0.25rem 0 0" }}>
            Consulta de cuentas corrientes y aplicación de pagos
          </p>
        </div>
      </header>

      {/* Formulario de Cabecera */}
      <div className="tarjeta-formulario" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          <div className="grupo-campo">
            <label>Proveedor *</label>
            <select
              className="campo-entrada"
              value={selectedProveedorId}
              onChange={(e) => setSelectedProveedorId(e.target.value)}
            >
              <option value="">-- Seleccionar proveedor --</option>
              {proveedores.map((p) => (
                <option key={p.id_proveedor} value={p.id_proveedor}>
                  {p.razon_social} {p.identificacion_fiscal ? `(${p.identificacion_fiscal})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grupo-campo">
            <label>Fecha de Pago *</label>
            <input
              type="date"
              className="campo-entrada"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
            />
          </div>

          <div className="grupo-campo">
            <label>Medio de Pago *</label>
            <select
              className="campo-entrada"
              value={idMedioPago}
              onChange={(e) => setIdMedioPago(e.target.value)}
            >
              {mediosPago.map((m) => (
                <option key={m.id_medio_pago} value={m.id_medio_pago}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="grupo-campo">
            <label>Tipo de Cancelación</label>
            <select
              className="campo-entrada"
              value={tipoCancelacion}
              onChange={(e) => setTipoCancelacion(e.target.value)}
            >
              <option value="Parcial">Parcial</option>
              <option value="Total">Total</option>
            </select>
          </div>
        </div>
      </div>

      {/* Panel de Estadísticas (HU 34) */}
      {selectedProveedorId && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
          <StatCard
            title="SALDO TOTAL ADEUDADO"
            value={`$${resumen.saldoTotalAdeudado.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`}
            subtitle="Saldo neto a cancelar"
            alert={resumen.saldoTotalAdeudado > 0}
          />
          <StatCard
            title="TOTAL COMPROBANTES"
            value={`$${resumen.totalOriginal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`}
            subtitle="Importe facturado original"
          />
          <StatCard
            title="NOTAS CRÉDITO / DÉBITO"
            value={`${resumen.totalNotas < 0 ? "-" : ""}$${Math.abs(resumen.totalNotas).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`}
            subtitle={resumen.totalNotas < 0 ? "A favor de la farmacia" : "Ajustes aplicados"}
          />
        </div>
      )}

      {/* Tabla e Imputación de Facturas */}
      <div className="tarjeta-formulario">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
          <h2 className="subtitulo-seccion" style={{ margin: 0 }}>
            Comprobantes del Proveedor
          </h2>

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
        {selectedProveedorId && (
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
        )}

        {!selectedProveedorId ? (
          <div className="aviso" style={{ textAlign: "center", padding: "3rem" }}>
            Selecciona un proveedor para consultar su saldo y comprobantes pendientes.
          </div>
        ) : loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--texto-secundario)" }}>
            Cargando comprobantes...
          </div>
        ) : facturasFiltradas.length === 0 ? (
          <div className="aviso" style={{ textAlign: "center", padding: "2.5rem" }}>
            No se encontraron comprobantes para el filtro seleccionado.
          </div>
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla-facturas">
              <thead>
                <tr>
                  <th style={{ width: "40px", textAlign: "center" }}>Pagar</th>
                  <th>Comprobante</th>
                  <th>Emisión</th>
                  {/* Presentación contable exigida para HU 34 */}
                  <th>Haber (Comprobante)</th>
                  <th>Debe (Pagado / NC)</th>
                  <th>Saldo Pendiente</th>
                  <th>Estado</th>
                  <th style={{ minWidth: "140px", textAlign: "right" }}>Importe a Aplicar ($)</th>
                </tr>
              </thead>
              <tbody>
                {facturasFiltradas.map((f) => {
                  const isChecked = aplicaciones[f.id_factura_proveedor]?.seleccionado || false;
                  const monto = aplicaciones[f.id_factura_proveedor]?.montoAplicado || "";
                  
                  // Haber: Lo facturado originalmente (+ ND si hubiera)
                  const haber = f.totalOriginal + (f.impactoNotas > 0 ? f.impactoNotas : 0);
                  
                  // Debe: Pagos acumulados + Notas de Crédito
                  const debe = f.totalPagado + (f.impactoNotas < 0 ? Math.abs(f.impactoNotas) : 0);

                  return (
                    <tr key={f.id_factura_proveedor} style={{ backgroundColor: isChecked ? "#faf8f5" : "transparent" }}>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          disabled={f.saldoPendiente <= 0}
                          checked={isChecked}
                          onChange={() => handleToggleSelect(f)}
                          style={{ cursor: f.saldoPendiente > 0 ? "pointer" : "not-allowed", width: "16px", height: "16px" }}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setComprobanteDetalle(f)}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--marron-principal)" }}
                        >
                          <FileText size={16} />
                          <span style={{ fontWeight: "600", textDecoration: "underline" }}>
                            {f.tipo_comprobante || "Factura"} {f.tipo_factura || ""} {f.numero_comprobante || `#${f.id_factura_proveedor}`}
                          </span>
                        </button>
                      </td>
                      <td style={{ color: "var(--texto-secundario)" }}>
                        {formatearFecha(f.fecha)}
                      </td>

                      {/* HABER: Importe deudor generado */}
                      <td style={{ fontWeight: "500" }}>
                        ${haber.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </td>

                      {/* DEBE: Reducciones por pago o NC */}
                      <td style={{ color: debe > 0 ? "#166534" : "var(--texto-secundario)", fontWeight: "500" }}>
                        ${debe.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </td>

                      {/* SALDO PENDIENTE */}
                      <td className="saldo-pendiente">
                        ${f.saldoPendiente.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </td>

                      <td>
                        <Badge variant={f.estadoCalculado === "Pagada Total" ? "success" : f.estadoCalculado === "Pagada Parcial" ? "warning" : "danger"}>
                          {f.estadoCalculado}
                        </Badge>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <input
                          type="number"
                          placeholder="0.00"
                          className="input-aplicacion"
                          disabled={f.saldoPendiente <= 0}
                          value={monto}
                          onChange={(e) => handleMontoChange(f.id_factura_proveedor, f.saldoPendiente, e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tarjeta de Totalización y Botón de Pago */}
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
            onClick={handleRegistrarPago}
          >
            {submitting ? "Procesando..." : "Confirmar y Registrar Pago"}
          </button>
        </div>
      </div>
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
      {/* Cabecera con Punto de Venta y Número de Comprobante arriba */}
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

      {/* Desglose Impositivo y Fiscal */}
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

      {/* Historial de Cancelación y Saldo Vivo */}
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

      {/* Botón de Cierre */}
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
      </div>
    
  );
}