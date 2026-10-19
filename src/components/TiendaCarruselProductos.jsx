import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';


export default function TiendaCarruselProductos({ 
  titulo = "Productos Destacados", 
  elementos = [] 
}) {
  const scrollRef = useRef(null);

  // Datos estaticos para modelo 
  const elementosFallback = [
    { id: 1, nombre: 'PROD1', imagen: 'https://via.placeholder.com/200x200?text=Drink+Fruits' },
    { id: 2, nombre: 'PROD2', imagen: 'https://via.placeholder.com/200x200?text=Fresh+Meat' },
    { id: 3, nombre: 'PROD3', imagen: 'https://via.placeholder.com/200x200?text=Fresh+Fruit' },
    { id: 4, nombre: 'PROD4', imagen: 'https://via.placeholder.com/200x200?text=Dried+Fruit' },
    { id: 5, nombre: 'PROD5', imagen: 'https://via.placeholder.com/200x200?text=Suplementos' },
    { id: 6, nombre: 'PROD6', imagen: 'https://via.placeholder.com/200x200?text=Higiene' },
  ];

  
  const listaElementos = elementos.length > 0 ? elementos : elementosFallback;

  // Efecto desplazamiento
  useEffect(() => {
    const contenedor = scrollRef.current;
    if (!contenedor) return;

    const intervalo = setInterval(() => {
      if (contenedor.scrollLeft + contenedor.clientWidth >= contenedor.scrollWidth - 10) {
        contenedor.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        contenedor.scrollBy({ left: 270, behavior: 'smooth' });
      }
    }, 3000);

    return () => clearInterval(intervalo);
  }, []);

  return (
    <div style={{ margin: '40px 0' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '22px', fontWeight: 'bold', color: '#111827', borderLeft: '4px solid #555934', paddingLeft: '12px', margin: 0 }}>
          {titulo}
        </h3>
      </div>

      <div 
        ref={scrollRef}
        onMouseEnter={() => { scrollRef.current.style.scrollBehavior = 'auto'; }}
        style={{ 
          display: 'flex', 
          gap: '20px', 
          overflowX: 'auto', 
          scrollSnapType: 'x mandatory', 
          scrollbarWidth: 'none', 
          paddingBottom: '10px',
          scrollBehavior: 'smooth'
        }}
      >
        {listaElementos.map((item) => (
          <div 
            key={item.id || item.nombre}
            style={{ 
              flex: '0 0 250px', 
              height: '270px',
              scrollSnapAlign: 'start', 
              backgroundColor: '#f3f4f6', 
              border: '1px solid #e5e7eb', 
              borderRadius: '4px', 
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            <img 
              src={item.imagen} 
              alt={item.nombre} 
              style={{ maxHeight: '150px', maxWidth: '150px', objectFit: 'contain' }} 
            />

            <div style={{ 
              position: 'absolute', 
              bottom: '15px', 
              left: '15px', 
              right: '15px', 
              backgroundColor: '#ffffff', 
              padding: '12px', 
              textAlign: 'center',
              borderRadius: '2px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <Link 
                to={item.ruta || "/catalogo"} 
                style={{ 
                  fontSize: '13px', 
                  fontWeight: '800', 
                  color: '#111827', 
                  textDecoration: 'none',
                  letterSpacing: '0.5px'
                }}
              >
                {item.nombre}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}