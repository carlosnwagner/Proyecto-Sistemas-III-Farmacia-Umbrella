import Swal from 'sweetalert2';

export const showAlert = {
  // Modal centrado automático (exactamente como en la imagen)
  successSave: (title = 'Guardado correctamente') => {
    Swal.fire({
      position: 'center', // 👈 Centra la modal en la pantalla
      icon: 'success',
      title: title,
      showConfirmButton: false,
      timer: 1500, // 👈 Se cierra solo tras 1.5s
    });
  },

  // Modal centrado reutilizable para creación o edición
  successAction: (entityName = 'registro', isEdit = false) => {
    const title = isEdit 
      ? `¡${entityName} editado correctamente!` 
      : `¡${entityName} creado correctamente!`;

    Swal.fire({
      position: 'center',
      icon: 'success',
      title,
      showConfirmButton: false,
      timer: 1500,
    });
  },

  // Modal centrado de error (opcional)
  errorSave: (title = 'No se pudo guardar la información') => {
    Swal.fire({
      position: 'center',
      icon: 'error',
      title,
      showConfirmButton: false,
      timer: 6000,
    });
  },
};