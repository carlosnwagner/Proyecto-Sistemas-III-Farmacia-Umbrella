import React, { useState } from 'react';
import TiendaHeader from '../components/TiendaHeader';
import TiendaGrillaProductos from '../components/TiendaGrillaProductos';
import Swal from 'sweetalert2';

export default function TiendaCatalogo() {
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [precioMaximo, setPrecioMaximo] = useState(10000);
  
  // Estado del carrito
  const [carrito, setCarrito] = useState([]);

  const categorias = [
    'Medicamentos',
    'Cuidado Personal',
    'Suplementos',
    'Bebés y Mamás',
    'Primeros Auxilios',
    'Dermocosmética',
    'Antibióticos',
    'Analgésicos',
    'Vitaminas',
    'Ortopedia'
  ];

  // Funciones del carrito
  const agregarAlCarrito = (producto) => {
    // Sanitizamos el precio por si viene como String con formato extraño
    const precioLimpio = typeof producto.price === 'string' 
      ? parseFloat(producto.price.replace(/\\/g, '').replace('\$', '')) 
      : Number(producto.price);

    const productoSeguro = { 
      ...producto, 
      price: isNaN(precioLimpio) ? 0 : precioLimpio 
    };

    setCarrito(prevCarrito => {
      const carritoActual = Array.isArray(prevCarrito) ? prevCarrito : [];
      const existe = carritoActual.find(item => item.id === productoSeguro.id);
      
      if (existe) {
        return carritoActual.map(item => 
          item.id === productoSeguro.id ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      }
      return [...carritoActual, { ...productoSeguro, cantidad: 1 }];
    });
  };

  const cambiarCantidad = (id, delta) => {
    setCarrito(prev => prev.map(item => {
      if (item.id === id) {
        const nuevaCantidad = item.cantidad + delta;
        return nuevaCantidad > 0 ? { ...item, cantidad: nuevaCantidad } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const eliminarProducto = (id) => {
    setCarrito(prev => prev.filter(item => item.id !== id));
  };

  const manejarConfirmacionPago = () => {
    if (carrito.length === 0) return;

    Swal.fire({
      title: '¡Pago Exitoso!',
      text: 'Tu pedido ha sido procesado correctamente.',
      icon: 'success',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#555934'
    });

    vaciarCarrito();
  };

  const vaciarCarrito = () => {
    setCarrito([]);
  };

  const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);
  const subtotal = carrito.reduce((acc, item) => acc + ((item.price || 0) * (item.cantidad || 0)), 0);
  const envio = subtotal * 0.10; // 10% de envío
  const totalGeneral = subtotal + envio;

  const tituloDinamico = categoriaActiva 
    ? `Catálogo General - ${categoriaActiva}` 
    : "Catálogo General";

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#f9fafb', minHeight: '100vh', color: '#333' }}>
      
      {/* 1. Header */}
      <TiendaHeader />

      {/* 2. Banner Superior */}
      <div style={{ 
        backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('/BannerEcom.jpg')`, 
        backgroundSize: 'cover', 
        backgroundPosition: 'center', 
        padding: '50px 20px', 
        textAlign: 'center',
        color: '#fff',
        marginBottom: '30px'
      }}>
        <h1 style={{ fontSize: '38px', fontWeight: 'bold', margin: '0 0 10px 0' }}>Catálogo Umbrella</h1>
        <p style={{ fontSize: '14px', margin: 0, fontWeight: '500' }}>
          <span style={{ opacity: 0.8 }}>Home</span> <span style={{ margin: '0 5px' }}>-</span> <span style={{ color: '#d9f99d' }}>Shop</span>
        </p>
      </div>

      {/* 3. Contenedor Principal de 3 Columnas */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'flex-start', 
        maxWidth: '1400px', 
        margin: '0 auto 50px auto', 
        padding: '0 20px', 
        gap: '25px' 
      }}>
        
        {/* COLUMNA 1: ASIDE IZQUIERDO */}
        <aside style={{ 
          width: '240px', 
          flexShrink: 0,
          position: 'sticky', 
          top: '20px',         
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto'
        }}>
          <div style={{ marginBottom: '20px', backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '12px', borderBottom: '2px solid #555934', paddingBottom: '6px', color: '#111827' }}>
              Departamentos
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {categorias.map((cat, idx) => (
                <li key={idx} style={{ marginBottom: '8px' }}>
                  <button 
                    onClick={() => setCategoriaActiva(cat)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: categoriaActiva === cat ? '#555934' : '#6b7280', 
                      fontWeight: categoriaActiva === cat ? 'bold' : 'normal',
                      cursor: 'pointer', 
                      fontSize: '13px', 
                      textAlign: 'left',
                      padding: 0
                    }}
                  >
                    {cat}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '12px', borderBottom: '2px solid #555934', paddingBottom: '6px', color: '#111827' }}>
              Precio
            </h3>
            <div style={{ marginBottom: '12px' }}>
              <input 
                type="range" 
                min="0" 
                max="20000" 
                step="500" 
                value={precioMaximo}
                onChange={(e) => setPrecioMaximo(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#555934', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginTop: '6px', fontWeight: 'bold' }}>
                <span>\$0</span>
                <span style={{ color: '#555934' }}>Hasta: \${precioMaximo.toLocaleString()}</span>
              </div>
            </div>
            <button style={{ 
              width: '100%', 
              backgroundColor: '#555934', 
              color: '#fff', 
              border: 'none', 
              padding: '8px', 
              borderRadius: '4px', 
              fontWeight: 'bold', 
              fontSize: '11px', 
              cursor: 'pointer' 
            }}>
              FILTRAR PRECIO
            </button>
          </div>
        </aside>

        {/* COLUMNA 2: MAIN CENTRAL */}
        <main style={{ flexGrow: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '15px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', color: '#4b5563' }}>
              Ordenar por: <select style={{ marginLeft: '8px', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff' }}>
                <option>Predeterminado</option>
                <option>Precio: Menor a Mayor</option>
                <option>Precio: Mayor a Menor</option>
              </select>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#4b5563' }}>
              {totalItems} items en el carrito
            </div>
          </div>

          <TiendaGrillaProductos 
            titulo={tituloDinamico} 
            onAgregarAlCarrito={agregarAlCarrito} 
          />
        </main>

        {/* COLUMNA 3: CARRITO FIJO A LA DERECHA */}
        <aside style={{ 
          width: '320px', 
          flexShrink: 0,
          position: 'sticky',
          top: '20px',
          backgroundColor: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 40px)'
        }}>
          {/* Cabecera del Carrito Fijo */}
          <div style={{ padding: '15px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
              {totalItems} productos
            </h3>
            {carrito.length > 0 && (
              <button 
                onClick={vaciarCarrito}
                style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Vaciar carrito
              </button>
            )}
          </div>

          {/* Lista de Productos del Carrito */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {carrito.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#6b7280', marginTop: '40px', fontSize: '14px' }}>
                <p>Tu carrito está vacío</p>
              </div>
            ) : (
              carrito.map((item) => (
                <div key={item.id} style={{ display: 'flex', gap: '10px', paddingBottom: '12px', borderBottom: '1px solid #f3f4f6', alignItems: 'center' }}>
                  <img src={item.image} alt={item.name} style={{ width: '50px', height: '50px', objectFit: 'contain', backgroundColor: '#f9fafb', borderRadius: '4px', padding: '4px' }} />
                  
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#1f2937', margin: '0 0 4px 0', lineHeight: '1.2' }}>
                      {item.name}
                    </h4>
                    
                    {/* AQUÍ ESTÁ EL TRUCO: .replace(/\\/g, '') borra cualquier barra que traiga el precio */}
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#555934' }}>
                      ${String((item.price * item.cantidad).toFixed(2)).replace(/\\/g, '')}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: '4px', padding: '2px' }}>
                        <button 
                          onClick={() => cambiarCantidad(item.id, -1)}
                          style={{ width: '22px', height: '22px', border: 'none', background: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                        >
                          -
                        </button>
                        <span style={{ padding: '0 8px', fontSize: '12px', fontWeight: 'bold' }}>{item.cantidad}</span>
                        <button 
                          onClick={() => cambiarCantidad(item.id, 1)}
                          style={{ width: '22px', height: '22px', border: 'none', background: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                        >
                          +
                        </button>
                      </div>

                      <button 
                        onClick={() => eliminarProducto(item.id)}
                        style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '10px', cursor: 'pointer' }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Resumen de Costos y Pago */}
          {carrito.length > 0 && (
            <div style={{ padding: '15px 20px', borderTop: '1px solid #e5e7eb', backgroundColor: '#fafafa', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', color: '#4b5563' }}>
                <span>Subtotal:</span>
                <span style={{ fontWeight: 'bold', color: '#111827' }}>\${subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px', color: '#4b5563' }}>
                <span>Envío (10%):</span>
                <span style={{ fontWeight: 'bold', color: '#111827' }}>\${envio.toFixed(2)}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '16px', fontWeight: 'bold', color: '#111827', borderTop: '1px dashed #d1d5db', paddingTop: '8px' }}>
                <span>Total:</span>
                <span style={{ color: '#555934' }}>\${totalGeneral.toFixed(2)}</span>
              </div>

             <button 
                onClick={manejarConfirmacionPago}
                style={{ 
                  width: '100%', 
                  backgroundColor: '#555934', 
                  color: '#fff', 
                  border: 'none', 
                  padding: '12px', 
                  borderRadius: '6px', 
                  fontSize: '14px', 
                  fontWeight: 'bold', 
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                Proceder al pago
              </button>
            </div>
          )}
        </aside>

      </div>

    </div>
  );
}