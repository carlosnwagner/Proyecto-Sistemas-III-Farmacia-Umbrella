import React from 'react';

export default function TiendaSidebar({ categoriaActiva, onSelectCategoria }) {
  const categorias = [
    "Medicamentos",
    "Cuidado Personal",
    "Suplementos",
    "Bebés y Mamás",
    "Primeros Auxilios",
    "Dermocosmética"
  ];

  const handleClick = (cat) => {
    if (onSelectCategoria) {
      onSelectCategoria(cat);
    }
    
    // Desplazamiento suave hacia la sección de productos
    const seccionProductos = document.getElementById("seccion-productos");
    if (seccionProductos) {
      seccionProductos.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '15px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', backgroundColor: '#555934', padding: '10px 15px', margin: '-15px -15px 15px -15px', borderTopLeftRadius: '7px', borderTopRightRadius: '7px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <i className="fa fa-bars"></i> CATEGORÍAS
      </h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {categorias.map((cat) => {
          const isActive = categoriaActiva === cat;
          return (
            <li key={cat}>
              <button 
                onClick={() => handleClick(cat)}
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  backgroundColor: isActive ? '#f3f4f6' : 'transparent', 
                  color: isActive ? '#555934' : '#374151', 
                  padding: '8px 12px', 
                  borderRadius: '4px', 
                  border: 'none', 
                  fontWeight: isActive ? 'bold' : 'normal',
                  cursor: 'pointer'
                }}
              >
                {cat}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}