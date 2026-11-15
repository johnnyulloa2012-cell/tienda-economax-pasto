# Registro de Errores y Mejoras - Tienda ECONOMAX Pasto

Este documento recopila el estado de las correcciones y mejoras del proyecto.

---

## 1. Críticos (Seguridad y Acceso)

- [ ] **Proteger el Panel de Administración (`admin.html`) con contraseña o PIN**
  - Implementar un PIN de acceso sencillo para que solo Doña Angela o tú puedan entrar.
- [ ] **Autenticar y proteger las rutas de la API en `server.js`**
  - Proteger los endpoints de modificación de catálogo.
- [x] **Eliminar la desactivación de verificación SSL/TLS en `server.js`** *(Corregido ✅)*
  - Se retiró la línea insegura `NODE_TLS_REJECT_UNAUTHORIZED = '0'`.

---

## 2. Moderados (Persistencia y Memoria Permanente)

- [x] **Subida de fotos indestructible a la nube de GitHub** *(Corregido ✅)*
  - Se eliminó el servicio externo inestable (Catbox que fallaba con error 412).
  - Ahora tanto el servidor (`server.js`) como el panel (`admin.js`) suben las fotos de productos directamente a `images/uploads/` en el repositorio oficial de GitHub (`johnnyulloa2012-cell/tienda-economax-pasto`).
  - Las fotos quedan guardadas con enlaces permanentes de GitHub que **nunca caducan, nunca se borran y no se pierden al reiniciarse Render**.
- [x] **Persistencia y respaldo de pedidos (`orders.json`)** *(Corregido ✅)*
  - Ahora cada pedido que entra se sincroniza automáticamente a GitHub Gist junto con el catálogo de productos y ajustes, evitando pérdidas tras reinicios de Render.
- [x] **Eliminación del conflicto de sobreescritura de datos** *(Corregido ✅)*
  - Se corrigió la sincronización en `admin.js`: la nube (servidor / Gist) es la fuente de verdad. Ya no hay riesgo de que un dispositivo con caché vieja sobreescriba los cambios nuevos de Doña Angela.

---

## 3. Menores (Detalles visuales y limpieza)

- [ ] **Limpiar dependencias no utilizadas en `package.json` (`ws`)**
- [ ] **Actualizar la documentación en `README.md`**
