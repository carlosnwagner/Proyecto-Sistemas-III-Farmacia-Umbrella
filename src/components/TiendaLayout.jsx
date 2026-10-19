import React, { useState } from 'react';
import TiendaHeader from './TiendaHeader.jsx';
import TiendaSidebar from './TiendaSidebar.jsx';
import TiendaBeneficios from './TiendaBeneficios.jsx';
import TiendaCarruselProductos from './TiendaCarruselProductos.jsx';
import TiendaGrillaProductos from './TiendaGrillaProductos.jsx';

export default function TiendaLayout() {
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('Todas');

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      {/* 1. Header de la Tienda */}
      <TiendaHeader />

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        {/* 2. Sección Principal: Sidebar + Buscador & Banner */}
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '30px', marginBottom: '30px' }}>
          
          {/* Menú Lateral con handler de categorías */}
          <aside>
            <TiendaSidebar 
              categoriaActiva={categoriaSeleccionada}
              onSelectCategoria={(cat) => setCategoriaSeleccionada(cat)}
            />
          </aside>

          {/* Área Derecha: Buscador + Banner Hero */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            

            {/* Banner con degradado verde corporativo #555934 */}
            <div style={{ 
              position: 'relative', 
              borderRadius: '8px', 
              overflow: 'hidden', 
              height: '300px',
              backgroundImage: 'url("/BannerEcom.jpg")',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'center',
              padding: '40px'
            }}>
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(90deg, rgba(85,89,52,0.85) 0%, rgba(85,89,52,0.3) 100%)',
                zIndex: 1
              }} />

              <div style={{ position: 'relative', zIndex: 2, color: '#ffffff', maxWidth: '400px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', color: '#d9f99d' }}>
                  Farmacia Umbrella
                </span>
                <h2 style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0 15px 0', lineHeight: '1.2' }}>
                  Cuidamos tu salud y bienestar
                </h2>
                <p style={{ fontSize: '14px', marginBottom: '20px', opacity: 0.9 }}>
                  Encuentra medicamentos, cuidado personal y suplementos con envío rápido.
                </p>
                <a href="/catalogo" style={{
                  display: 'inline-block',
                  backgroundColor: '#ffffff',
                  color: '#555934',
                  padding: '10px 22px',
                  fontWeight: 'bold',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  fontSize: '13px'
                }}>
                  VER CATÁLOGO
                </a>
              </div>
            </div>

          </div>
        </div>

        {/* 3. Beneficios */}
        <TiendaBeneficios />

        {/* 4. Carrusel Automático estilo Ogani */}
        <TiendaCarruselProductos titulo="Productos Destacados" />

        {/* 🌟 SECCIÓN DE PRODUCTOS CON SCROLL */}
        <div id="seccion-productos" style={{ marginTop: '50px', paddingBottom: '50px' }}>
         <TiendaGrillaProductos 
           productos={[
             { id: 1, name: 'Paracetamol 500mg', category: 'Medicamentos', price: 1200.00, oldPrice: 1500.00, discount: '-20%', image: 'https://via.placeholder.com/250x250?text=Paracetamol' },
             { id: 2, name: 'Ibuprofeno 400mg', category: 'Medicamentos', price: 1500.00, image: 'https://via.placeholder.com/250x250?text=Ibuprofeno' },
             { id: 3, name: 'Alcohol en Gel 250ml', category: 'Cuidado Personal', price: 850.00, image: 'https://via.placeholder.com/250x250?text=Alcohol+Gel' },
             { id: 4, name: 'Vitamina C Efervescente', category: 'Suplementos', price: 3400.00, image: 'https://via.placeholder.com/250x250?text=Vitamina+C' }
           ]} 
           titulo={`Productos en ${categoriaSeleccionada}`} 
         />
        </div> 

      </main>
    </div>
  );
}