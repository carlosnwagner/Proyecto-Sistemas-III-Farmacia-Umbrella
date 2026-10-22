import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Baby, Boxes, Droplets, HeartPulse, Pill, Search, ShieldCheck, ShoppingCart, Sparkles, Store, Truck, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../hooks/useCart.ts";
import { CartDrawer } from "../components/CartDrawer.tsx";
import { getProductosCatalogoPublico, getSucursalesCatalogoPublico } from "../services/catalogoPublico.js";
import { FarmaceuticoA, FarmaceuticoB } from "./PersonajesFarmacia.jsx";
import EnvaseProducto from "./EnvasesProducto.jsx";
import "./CatalogoPublico.tema.css";

const moneda = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

function imagenSegura(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function iconoCategoria(nombre = "") {
  const n = nombre.toLocaleLowerCase("es");
  if (/analg|medic|antibi|inflam|vitamin|suplem|fiebre|dolor/.test(n)) return Pill;
  if (/beb|pañal|infan|niñ/.test(n)) return Baby;
  if (/higiene|cuidado|piel|dermo|cosm|belleza|solar/.test(n)) return Sparkles;
  if (/libre|botiqu|antisep|primeros|curaci/.test(n)) return Droplets;
  return Boxes;
}

function ProductoImagen({ url, nombre, categoria }) {
  const [fallo, setFallo] = useState(false);
  if (url && !fallo) {
    return <img src={url} alt={nombre} loading="lazy" referrerPolicy="no-referrer" onError={() => setFallo(true)} />;
  }
  return <EnvaseProducto nombre={nombre} categoria={categoria} />;
}

export default function CatalogoPublico() {
  const { profile } = useAuth();
  const puedeGestionarCatalogo = profile?.rol === "administrador";
  const [sucursales, setSucursales] = useState([]);
  const [sucursal, setSucursal] = useState("");
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [cargandoSucursales, setCargandoSucursales] = useState(true);
  const [cargandoProductos, setCargandoProductos] = useState(false);
  const [error, setError] = useState("");

  // Control del Drawer lateral y Notificación Toast
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [mensajeToast, setMensajeToast] = useState("");
  const { addToCart, getTotalItems, setSucursalId } = useCart();

  useEffect(() => {
    let vigente = true;
    getSucursalesCatalogoPublico().then(({ data, error: errorSucursales }) => {
      if (!vigente) return;
      if (errorSucursales) setError("No se pudieron cargar las sucursales. Intentalo nuevamente más tarde.");
      const activas = (data || []).filter((item) => item.codigo?.trim() && item.descripcion?.trim());
      setSucursales(activas);
      const idInicial = activas.length ? String(activas[0].id_sucursal) : "";
      setSucursal(idInicial);
      if (idInicial) setSucursalId(Number(idInicial));
      setCargandoSucursales(false);
    }).catch(() => {
      if (!vigente) return;
      setError("No se pudieron cargar las sucursales. Intentalo nuevamente más tarde.");
      setCargandoSucursales(false);
    });
    return () => { vigente = false; };
  }, [setSucursalId]);

  useEffect(() => {
    if (!sucursal) {
      setProductos([]);
      return undefined;
    }
    let vigente = true;
    setCargandoProductos(true);
    setError("");
    getProductosCatalogoPublico(sucursal).then(({ data, error: errorCatalogo }) => {
      if (!vigente) return;
      if (errorCatalogo) {
        setError("No se pudo cargar el catálogo de esta sucursal. Revisá la conexión e intentá de nuevo.");
        setProductos([]);
      } else {
        setProductos(data || []);
      }
      setCargandoProductos(false);
    }).catch(() => {
      if (!vigente) return;
      setError("No se pudo cargar el catálogo de esta sucursal. Revisá la conexión e intentá de nuevo.");
      setProductos([]);
      setCargandoProductos(false);
    });
    return () => { vigente = false; };
  }, [sucursal]);

  const categorias = useMemo(() => [
    ...new Set(productos.map((producto) => producto.categoria).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "es")), [productos]);

  const productosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase("es");
    return productos.filter((producto) => {
      const coincideTexto = !termino
        || `${producto.nombre || ""} ${producto.descripcion || ""} ${producto.categoria || ""}`.toLocaleLowerCase("es").includes(termino);
      const coincideCategoria = categoria === "Todas" || producto.categoria === categoria;
      return coincideTexto && coincideCategoria;
    });
  }, [productos, busqueda, categoria]);

  const sucursalActual = sucursales.find((item) => String(item.id_sucursal) === sucursal);
  const irAlCatalogo = () => document.getElementById("catalogo-productos")?.scrollIntoView({ behavior: "smooth" });

  const handleCambioSucursal = (nuevoIdStr) => {
    setSucursal(nuevoIdStr);
    setCategoria("Todas");
    if (nuevoIdStr) {
      setSucursalId(Number(nuevoIdStr));
    }
  };

  const handleAgregarAlCarrito = (producto) => {
    const agregado = addToCart({
      id_articulo: producto.id_articulo,
      codigo: producto.codigo || `ART-${producto.id_articulo}`,
      nombre: producto.nombre,
      precio_venta: Number(producto.precio_final) || 0,
      stock_disponible: Math.max(0, Math.floor(Number(producto.stock_actual) || 0)),
      imagen_url: producto.imagen_url
    }, 1);
    if (!agregado) return;

    // Mostrar toast flotante estilo Farmacity
    setMensajeToast(producto.nombre);
    setTimeout(() => {
      setMensajeToast("");
    }, 3500);
  };

  return (
    <main className="um">
      <div className="um-aviso">Precios finales de la lista vigente · Elegí tu sucursal y revisá la disponibilidad antes de acercarte</div>

      <header className="um-header">
        <Link to="/" className="um-marca" aria-label="Farmacia Umbrella, inicio">
          <span className="um-logo"><img src="/Umbrellafarmacia.svg" alt="" /></span>
          <span><strong>Farmacia Umbrella</strong><small>Catálogo digital</small></span>
        </Link>

        <label className="um-buscador" style={{ flex: 1, minWidth: "200px" }}>
          <Search size={18} aria-hidden="true" />
          <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar producto o categoría" type="search" aria-label="Buscar productos" />
        </label>

        <label className="um-sucursal">
          <Store size={18} aria-hidden="true" />
          <select aria-label="Sucursal de retiro" value={sucursal} onChange={(event) => handleCambioSucursal(event.target.value)} disabled={cargandoSucursales || !sucursales.length}>
            {cargandoSucursales && <option value="">Cargando sucursales...</option>}
            {!cargandoSucursales && !sucursales.length && <option value="">No hay sucursales disponibles</option>}
            {sucursales.map((item) => <option key={item.id_sucursal} value={item.id_sucursal}>{item.codigo} — {item.descripcion}</option>)}
          </select>
        </label>

        {/* Botón Carrito y Acceso al Sistema */}
        <div className="um-header-actions">
          <button 
            type="button" 
            style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", background: "#15803d", color: "#ffffff", padding: "10px 18px", borderRadius: "8px", border: "none", fontWeight: "600" }}
            onClick={() => setIsCartOpen(true)}
          >
            <ShoppingCart size={18} />
            <span>Carrito</span>
            {getTotalItems() > 0 && (
              <span style={{ background: "#ef4444", color: "#ffffff", borderRadius: "9999px", padding: "2px 8px", fontSize: "12px", fontWeight: "bold" }}>
                {getTotalItems()}
              </span>
            )}
          </button>

          <Link className="um-acceso" to="/pedido" style={{ whiteSpace: "nowrap" }}>Mis pedidos</Link>
          <Link className="um-acceso" to="/login" style={{ whiteSpace: "nowrap" }}>Acceso al sistema</Link>
        </div>
      </header>

      {/* Modal Lateral (Drawer) */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} sucursalNombre={sucursalActual ? `${sucursalActual.codigo} — ${sucursalActual.descripcion}` : ""} />

      {/* Toast Flotante Estilo Farmacity al agregar producto */}
      {mensajeToast && (
        <div style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", zIndex: 99999, backgroundColor: "#15803d", color: "#ffffff", padding: "14px 24px", borderRadius: "10px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: "12px", animation: "fadeInUp 0.3s ease" }}>
          <CheckCircle2 size={22} color="#ffffff" />
          <span style={{ fontSize: "14px", fontWeight: "500" }}>¡Agregaste un producto correctamente!</span>
          <button 
            onClick={() => { setMensajeToast(""); setIsCartOpen(true); }}
            style={{ backgroundColor: "#ffffff", color: "#15803d", border: "none", padding: "6px 12px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "13px", marginLeft: "8px" }}
          >
            Ver Carrito
          </button>
        </div>
      )}

      {/* Resto de secciones del catálogo */}
      <nav className="um-categorias-nav" aria-label="Categorías">
        <button type="button" className={categoria === "Todas" ? "is-activa" : ""} onClick={() => setCategoria("Todas")}>Todas</button>
        {categorias.map((item) => (
          <button type="button" key={item} className={categoria === item ? "is-activa" : ""} onClick={() => setCategoria(item)}>{item}</button>
        ))}
      </nav>

      <section className="um-banners" aria-label="Destacados">
        <div className="um-banner um-banner-principal">
          <div className="um-banner-texto">
            <h1>Tu bienestar,<br />más cerca.</h1>
            <p>Encontrá tus productos de farmacia, consultá precios vigentes y revisá la disponibilidad antes de acercarte.</p>
            <button type="button" className="um-boton" onClick={irAlCatalogo}>Ver productos</button>
          </div>
          <div className="um-banner-equipo" aria-hidden="true">
            <FarmaceuticoA className="um-personaje" />
            <FarmaceuticoB className="um-personaje" />
          </div>
        </div>
        <div className="um-banner um-banner-verde">
          <Store size={34} aria-hidden="true" />
          <strong>Elegí tu sucursal</strong>
          <span>Cada sucursal muestra sus propios precios y disponibilidad.</span>
        </div>
        <div className="um-banner um-banner-claro">
          <ShieldCheck size={34} aria-hidden="true" />
          <strong>Precios actualizados</strong>
          <span>Precios finales de la lista vigente.</span>
        </div>
      </section>

      <section className="um-beneficios" aria-label="Beneficios">
        <div><Store size={22} /><span><strong>Elegí tu sucursal</strong>Retirá donde te quede cerca</span></div>
        <div><ShieldCheck size={22} /><span><strong>Precios al día</strong>Lista de precios vigente</span></div>
        <div><Truck size={22} /><span><strong>Consultá antes de ir</strong>Disponibilidad por sucursal</span></div>
        <div><HeartPulse size={22} /><span><strong>Cuidamos de vos</strong>Atención farmacéutica</span></div>
      </section>

      {categorias.length > 1 && (
        <section className="um-categorias" aria-label="Comprá por categoría">
          <h2>Comprá por categoría</h2>
          <div className="um-categorias-fila">
            {categorias.map((item) => {
              const Icono = iconoCategoria(item);
              return (
                <button type="button" key={item} className="um-categoria-item" onClick={() => { setCategoria(item); irAlCatalogo(); }}>
                  <span className="um-categoria-circulo"><Icono size={34} strokeWidth={1.5} /></span>
                  <span>{item}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section id="catalogo-productos" className="um-productos">
        <div className="um-productos-cabecera">
          <div>
            <h2>{categoria === "Todas" ? "Todos los productos" : categoria}</h2>
            <span>{sucursalActual?.descripcion || "Elegí una sucursal"} · {productosFiltrados.length} {productosFiltrados.length === 1 ? "producto" : "productos"}</span>
          </div>
        </div>

        {error && <div className="um-mensaje um-mensaje-error" role="alert"><AlertCircle size={19} />{error}</div>}

        {cargandoProductos ? (
          <div className="um-mensaje" role="status">Cargando productos de la sucursal...</div>
        ) : !error && productos.length === 0 ? (
          <div className="um-vacio"><Boxes size={32} /><h3>Estamos preparando el catálogo</h3><p>Pronto vas a encontrar aquí los productos publicados para esta sucursal. También podés consultar otra sucursal.</p>{puedeGestionarCatalogo && <div className="um-admin-ayuda"><span>Como administrador, publicá los artículos desde Productos → Editar → «Visible en catálogo público».</span><Link to="/inventario">Ir a Productos</Link></div>}</div>
        ) : !error && productosFiltrados.length === 0 ? (
          <div className="um-vacio"><Search size={32} /><h3>No encontramos resultados</h3><p>Probá con otro nombre o elegí una categoría diferente.</p></div>
        ) : !error ? (
          <div className="um-grid">
            {productosFiltrados.map((producto) => {
              const imagen = imagenSegura(producto.imagen_url);
              const precioValido = Number(producto.precio_final) > 0;
              const disponible = producto.disponible === true && precioValido;
              return (
                <article className={`um-producto${disponible ? "" : " is-sin-stock"}`} key={producto.id_articulo}>
                  <div className="um-producto-imagen"><ProductoImagen url={imagen} nombre={producto.nombre} categoria={producto.categoria} /></div>
                  <div className="um-producto-cuerpo">
                    <span className="um-producto-categoria">{producto.categoria || "Sin categoría"}</span>
                    <h3>{producto.nombre}</h3>
                    {producto.descripcion && <p>{producto.descripcion}</p>}
                    <div className="um-producto-pie">
                      <strong className={precioValido ? "um-precio" : "um-precio-sin"}>{precioValido ? moneda.format(Number(producto.precio_final)) : "Sin precio vigente"}</strong>
                      <span className={`um-estado ${disponible ? "is-disponible" : "is-no-disponible"}`}>{disponible ? "Disponible" : precioValido ? "Sin disponibilidad" : "No disponible"}</span>
                    </div>

                    <button
                      type="button"
                      disabled={!disponible}
                      onClick={() => handleAgregarAlCarrito(producto)}
                      style={{
                        marginTop: "12px",
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #16a34a",
                        backgroundColor: disponible ? "#f0fdf4" : "#f3f4f6",
                        color: disponible ? "#166534" : "#9ca3af",
                        fontWeight: "600",
                        cursor: disponible ? "pointer" : "not-allowed",
                        transition: "all 0.2s ease"
                      }}
                    >
                      {disponible ? "+ Agregar al carrito" : "No disponible"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      <footer className="um-footer"><span>Farmacia Umbrella</span><span>La disponibilidad y los precios corresponden a la sucursal seleccionada.</span><Link to="/login">Acceso al sistema</Link></footer>
    </main>
  );
}
