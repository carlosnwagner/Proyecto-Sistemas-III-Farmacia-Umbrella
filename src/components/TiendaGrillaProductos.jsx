import React, { useState } from 'react';

export default function TiendaGrillaProductos({ productos = [], titulo = "", onAgregarAlCarrito }) {
  const [hoveredId, setHoveredId] = useState(null);

  const listaProductos = productos.length > 0 ? productos : [
    { id: 4, name: 'Paracetamol 500mg', category: 'Medicamentos', price: 1200.00, image: 'https://via.placeholder.com/250x250?text=Paracetamol' },
    { id: 5, name: 'Ibuprofeno 400mg', category: 'Medicamentos', price: 1500.00, image: 'https://via.placeholder.com/250x250?text=Ibuprofeno' },
    { id: 6, name: 'Alcohol en Gel', category: 'Cuidado Personal', price: 850.00, image: 'https://via.placeholder.com/250x250?text=Alcohol+Gel' },
  ];

  return (
    <div>
      {titulo && (
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', borderBottom: '2px solid #555934', paddingBottom: '8px', display: 'inline-block', color: '#111827' }}>
            {titulo}
          </h2>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        {listaProductos.map((p) => {
          const isHovered = hoveredId === p.id;

          return (
            <div 
              key={p.id}
              onMouseEnter={() => setHoveredId(p.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e7eb', 
                borderRadius: '8px', 
                padding: '15px', 
                textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ 
                position: 'relative', 
                height: '180px', 
                backgroundColor: '#f3f4f6', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                borderRadius: '4px', 
                marginBottom: '15px',
                overflow: 'hidden' 
              }}>
                <img 
                  src={p.image} 
                  alt={p.name} 
                  style={{ maxHeight: '130px', maxWidth: '130px', objectFit: 'contain', transition: 'transform 0.3s' }} 
                />

                <div style={{
                  position: 'absolute',
                  bottom: isHovered ? '65px' : '-60px',
                  left: 0,
                  right: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  transition: 'bottom 0.3s ease-in-out',
                  zIndex: 2
                }}>
                  <button 
                    onClick={() => onAgregarAlCarrito && onAgregarAlCarrito(p)}
                    style={{ 
                      width: '50px', 
                      height: '50px', 
                      borderRadius: '50%', 
                      backgroundColor: '#fff', 
                      border: 'none', 
                      boxShadow: '0 4px 8px rgba(0,0,0,0.2)', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      color: '#111827', 
                      transition: 'background 0.2s, color 0.2s' 
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#555934'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.color = '#111827'; }}
                    title="Añadir al carrito"
                  >
                    <i className="fa fa-shopping-cart" style={{ fontSize: '20px' }}></i>
                  </button>
                </div>
              </div>

              <div>
                {p.category && <span style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '5px' }}>{p.category}</span>}
                <h4 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#1f2937' }}>{p.name}</h4>
                <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '5px', color: '#555934' }}>
                  ${typeof p.price === 'number' ? p.price.toFixed(2) : p.price}
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}