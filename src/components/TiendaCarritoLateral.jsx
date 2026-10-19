import React from 'react';

export default function TiendaCarritoLateral({ isOpen, onClose, carrito = [], onCambiarCantidad, onEliminarProducto, onVaciarCarrito }) {
  const listaCarrito = Array.isArray(carrito) ? carrito : [];

  const totalProductos = listaCarrito.reduce((acc, item) => acc + (item.cantidad || 0), 0);
  const subtotal = listaCarrito.reduce((acc, item) => acc + ((item.price || 0) * (item.cantidad || 0)), 0);
  const envio = subtotal * 0.10;
  const totalGeneral = subtotal + envio;

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '380px',
      height: '100vh',
      backgroundColor: '#ffffff',
      boxShadow: '-4px 0 15px rgba(0,0,0,0.1)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'sans-serif'
    }}>
      {/* Cabecera del Carrito */}
      <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
          {totalProductos} productos
        </h3>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          {listaCarrito.length > 0 && (
            <button 
              onClick={onVaciarCarrito}
              style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Vaciar carrito
            </button>
          )}
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6b7280' }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Lista de Productos en el Carrito */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {listaCarrito.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#6b7280', marginTop: '50px' }}>
            <p>Tu carrito está vacío</p>
          </div>
        ) : (
          listaCarrito.map((item) => (
            <div key={item.id} style={{ display: 'flex', gap: '12px', paddingBottom: '15px', borderBottom: '1px solid #f3f4f6', alignItems: 'center' }}>
              <img src={item.image} alt={item.name} style={{ width: '60px', height: '60px', objectFit: 'contain', backgroundColor: '#f9fafb', borderRadius: '4px', padding: '5px' }} />
              
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#1f2937', margin: '0 0 5px 0', lineHeight: '1.2' }}>
                  {item.name}
                </h4>
                {/* Precio limpio forzando remoción de cualquier barra */}
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#555934' }}>
                  ${String((item.price * item.cantidad).toFixed(2)).replace(/\\/g, '')}
                </div>

                {/* Controles de cantidad */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: '4px', padding: '2px' }}>
                    <button 
                      onClick={() => onCambiarCantidad && onCambiarCantidad(item.id, -1)}
                      style={{ width: '24px', height: '24px', border: 'none', background: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      -
                    </button>
                    <span style={{ padding: '0 10px', fontSize: '13px', fontWeight: 'bold' }}>{item.cantidad}</span>
                    <button 
                      onClick={() => onCambiarCantidad && onCambiarCantidad(item.id, 1)}
                      style={{ width: '24px', height: '24px', border: 'none', background: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      +
                    </button>
                  </div>

                  <button 
                    onClick={() => onEliminarProducto && onEliminarProducto(item.id)}
                    style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '11px', cursor: 'pointer' }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Resumen de Costos y Botón de Pago */}
      {listaCarrito.length > 0 && (
        <div style={{ padding: '20px', borderTop: '1px solid #e5e7eb', backgroundColor: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#4b5563' }}>
            <span>Subtotal:</span>
            <span style={{ fontWeight: 'bold', color: '#111827' }}>${String(subtotal.toFixed(2)).replace(/\\/g, '')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '14px', color: '#4b5563' }}>
            <span>Envío (10%):</span>
            <span style={{ fontWeight: 'bold', color: '#111827' }}>${String(envio.toFixed(2)).replace(/\\/g, '')}</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '18px', fontWeight: 'bold', color: '#111827', borderTop: '1px dashed #e5e7eb', paddingTop: '10px' }}>
            <span>Total:</span>
            <span style={{ color: '#555934' }}>${String(totalGeneral.toFixed(2)).replace(/\\/g, '')}</span>
          </div>

          <button 
            onClick={() => alert('Procediendo al pago...')}
            style={{ 
              width: '100%', 
              backgroundColor: '#555934', 
              color: '#fff', 
              border: 'none', 
              padding: '14px', 
              borderRadius: '8px', 
              fontSize: '15px', 
              fontWeight: 'bold', 
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            Proceder al pago
          </button>
        </div>
      )}
    </div>
  );
}