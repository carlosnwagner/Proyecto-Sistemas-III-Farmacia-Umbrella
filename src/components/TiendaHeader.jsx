import React from 'react';
import { Link } from 'react-router-dom';

export default function TiendaHeader() {
  return (
    <header style={{ 
      backgroundColor: '#ffffff', 
      borderBottom: '1px solid #e5e7eb', 
      padding: '15px 20px', 
      display: 'flex', 
      flexWrap: 'wrap',
      alignItems: 'center', 
      justifyContent: 'space-between',
      gap: '15px',
      position: 'relative',
      zIndex: 10
    }}>
      {/* LOGO Y NOMBRE DE LA MARCA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img 
          src="/Umbrellafarmacia.svg" 
          alt="Logo Umbrella" 
          style={{ width: '35px', height: '35px', objectFit: 'contain' }} 
        />
        <Link to="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#555934', letterSpacing: '0.5px' }}>
            Umbrella
          </div>
        </Link>
      </div>

      {/* MENÚ DE NAVEGACIÓN */}
      <nav style={{ display: 'flex', gap: '25px', fontWeight: 'bold', fontSize: '14px', flexWrap: 'wrap' }}>
        <Link to="/" style={{ color: '#555934', textDecoration: 'none' }}>HOME</Link>
        <Link to="/catalogo" style={{ color: '#333', textDecoration: 'none' }}>CATÁLOGO</Link>
      </nav>

      {/* BOTÓN DE LOGIN / INICIO DE SESIÓN */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Link 
          to="/login" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            textDecoration: 'none', 
            color: '#374151', 
            fontSize: '14px', 
            fontWeight: 'bold',
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
        >
          <i className="fa fa-user" style={{ fontSize: '15px', color: '#555934' }}></i>
          <span>Iniciar sesión</span>
        </Link>
      </div>
    </header>
  );
}