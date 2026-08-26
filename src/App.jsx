import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import RegistrarPagoProveedor from './components/RegistrarPagoProveedor';
import RegistrarNotaCreditoDebito from './components/RegistrarNotaCreditoDebito';
import './App.css';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<MainLayout />}>
          {/* Tus pantallas */}
          <Route path="/pagos-proveedores" element={<RegistrarPagoProveedor />} />
          <Route path="/notas-credito-debito" element={<RegistrarNotaCreditoDebito />} />
          {/* 🆕 Ruta por defecto: entra directo a Pagos para que NUNCA quede blanco */}
          <Route path="/" element={<Navigate to="/pagos-proveedores" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}