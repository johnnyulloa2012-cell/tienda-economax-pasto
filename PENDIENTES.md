# Registro de Errores y Mejoras - Tienda ECONOMAX Pasto

Este documento recopila el estado de las correcciones y mejoras del proyecto.

---

## 1. Críticos (Seguridad y Acceso)

- [x] **Proteger el Panel de Administración (`admin.html`) con PIN de acceso** *(Corregido ✅)*
  - PIN inicial: `2026`, con hashing `scrypt` y comparación segura en tiempo constante.
  - Sesiones cifradas vía cookies `HttpOnly; SameSite=Lax`.
  - Botón de bloqueo/cierre de sesión y formulario para cambiar el PIN.
- [x] **Autenticar y proteger las rutas de la API en `server.js`** *(Corregido ✅)*
  - `GET /api/orders`, `POST /api/products`, `POST /api/settings`, `POST /api/orders` (lotes) y `DELETE /api/orders` requieren sesión activa.
  - Bloqueo contra fuerza bruta (máximo 5 intentos de PIN por IP, bloqueo temporal de 5 min).
  - Protección de archivos privados y de configuración del servidor (`403` Forbidden).
- [x] **Eliminar la desactivación de verificación SSL/TLS en `server.js`** *(Corregido ✅)*
  - Se retiró la línea insegura `NODE_TLS_REJECT_UNAUTHORIZED = '0'`.

---

## 2. Operaciones de Pedidos, WhatsApp y Notificaciones en Vivo

- [x] **Botón directo de WhatsApp en Confirmación (Paso 3 del Checkout)** *(Corregido ✅)*
  - Al completar la orden, el cliente tiene un botón directo para enviar a Doña Ángela (`300 472 0904`) el resumen detallado y comprobante de Nequi con 1 toque.
- [x] **Comunicación directa con el cliente desde el panel de Doña Ángela** *(Corregido ✅)*
  - Cada fila de pedido en `admin.html` cuenta con un botón verde `📲 WhatsApp` que abre chat con el cliente con mensaje redactado según el estado (verificación, empacando, en camino con domiciliario o entregado).
- [x] **Alerta sonora y visual de nuevo pedido en tiempo real** *(Corregido ✅)*
  - Cuando entra un pedido nuevo, el panel reproduce una campanilla de audio agradable (Web Audio API nativa sin archivos externos) y muestra un toast llamativo.
  - Polling en segundo plano cada 15 segundos para sincronizar automáticamente sin necesidad de recargar la página.
- [x] **Gestión y eliminación de pedidos (Limpieza de pruebas)** *(Corregido ✅)*
  - Botón de papelera para eliminar pedidos individuales con confirmación.
  - Botón "Limpiar Pruebas" para depurar en un solo clic los pedidos de prueba antiguos (Juan Perez, jose).
  - Soporte de `DELETE /api/orders/:id` en el servidor con autenticación de administrador.

---

## 3. Moderados (Persistencia y Memoria Permanente)

- [x] **Subida de fotos indestructible a la nube de GitHub** *(Corregido ✅)*
  - Tanto el servidor como el panel suben fotos a `images/uploads/` en el repositorio oficial.
- [x] **Persistencia y respaldo de pedidos (`orders.json`)** *(Corregido ✅)*
  - Sincronización automática con GitHub Gist junto al catálogo y ajustes.
- [x] **Eliminación del conflicto de sobreescritura de datos** *(Corregido ✅)*
  - Sincronización donde la nube es la fuente de verdad.

---

## 4. Menores (Detalles visuales y limpieza)

- [x] **Botón de checkout y footer fijo** *(Corregido ✅)*
  - Footer fijo permanente en móvil y escritorio, con colores de marca (morado oficial Nequi y verde esmeralda Contra Entrega).
- [x] **Limpiar dependencias no utilizadas en `package.json` (`ws`)** *(Corregido ✅)*
- [ ] **Actualizar la documentación en `README.md`**
