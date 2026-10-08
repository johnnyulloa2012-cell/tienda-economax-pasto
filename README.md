# 🛍️ AURA - Tienda Online (Prototipo de Diseño UI/UX)

Diseño moderno, limpio y de alta gama para tienda de comercio electrónico (E-Commerce). Desarrollado con enfoque en maquetación visual de primer nivel, micro-interacciones fluidas y cero dependencias de compilación.

---

## ✨ Características del Diseño

- **Header Completo**:
  - Barra de anuncios superior con código de descuento copiable en 1 clic (`DISENO2026`).
  - Navegación sticky con efecto *glassmorphism* (desenfoque translúcido).
  - Buscador reactivo en vivo.
  - Selector multimoneda (USD, EUR, MXN, GBP) con recálculo dinámico de precios.
  - Alternador de **Modo Oscuro / Modo Claro** con persistencia en `localStorage`.
  - Botón de favoritos con contador.
  - Carrito de compras con badge numérico.

- **Hero Banner de Alto Impacto**:
  - Tipografía editorial moderna (`Space Grotesk` + `Plus Jakarta Sans`).
  - Indicadores de confianza y rendimiento (Responsivo 100%, Carga instantánea).
  - Tarjeta 3D interactiva de producto destacado con insignias de garantía y estrellas de calificación.

- **Explorador de Categorías**:
  - 4 tarjetas con diseño minimalista, iconos vectoriales Lucide y numeración editorial.

- **Catálogo de Maquetas (Cards de Producto)**:
  - Tarjetas de producto en proporción áurea 4:5.
  - Insignias dinámicas de descuento y estado (`NUEVO`, `DESTACADO`, `EDICIÓN ESPECIAL`).
  - Muestrario interactivo de variantes de color.
  - Calificaciones con estrellas y cantidad de reseñas.
  - Botón flotante para **Vista Rápida (Quick View)**.
  - Botón interactivo de **Agregar al Carrito** con notificaciones *Toast*.

- **Ofertas Flash con Temporizador**:
  - Cuenta regresiva viva (Horas, Minutos, Segundos) para ofertas por tiempo limitado.

- **Bolsa de Compras Deslizante (Cart Drawer)**:
  - Despliegue lateral suave.
  - Barra de progreso interactiva para **Envío Gratis**.
  - Incremento y decremento de cantidades con recálculo de subtotal, impuestos y envío.
  - Canje interactivo de cupón de descuento (`DISENO2026` para 15% OFF).

- **Simulador de Checkout en 3 Pasos**:
  - Paso 1: Formulario de contacto y dirección de envío.
  - Paso 2: Pasarela con opciones de Tarjeta (con simulación visual de CVV/Vencimiento) y PayPal.
  - Paso 3: Pantalla de orden confirmada con número de referencia generado y botón de impresión de comprobante.

---

## 🚀 Las Dos Caras del Proyecto

El proyecto se divide de forma limpia y separada en dos entornos:

### 🛍️ 1. Tienda para Clientes (`index.html`)
La vitrina digital que ven tus compradores:
- Catálogo interactivo con filtros, categorías y búsqueda.
- Carrito de compras deslizante con cálculo de envío gratis y cupones.
- Proceso de checkout simulado en 3 pasos.
- Enlace directo en la cabecera hacia el Panel de Emprendedor.

### 📊 2. Panel para Emprendedores (`admin.html`)
El centro de mando privado del dueño del negocio:
- **Métricas comerciales**: Facturación mensual, pedidos por preparar, alertas de inventario bajo y gráfico de ventas semanales.
- **Gestión de inventario**: Tabla con margen de ganancia por producto, buscador, botón modal para "+ Agregar Producto", y edición rápida de precio y stock.
- **Control de pedidos**: Lista de órdenes recibidas con cambio de estado interactivo (Pendiente, Preparando, Enviado, Entregado).
- **Herramientas de marketing**: Creador de cupones con porcentaje de descuento y métricas de uso.
- **Configuración de tienda**: Nombre del negocio, WhatsApp de ventas y umbral de envío gratis.

---

## 🖥️ Cómo Visualizarlos en tu Navegador

Puedes abrir cualquiera de los dos con doble clic:
- **Tienda de Clientes**: `c:\Users\johnn\Documents\Codex\2026-07-08\ha\outputs\tienda-online\index.html`
- **Panel de Emprendedor**: `c:\Users\johnn\Documents\Codex\2026-07-08\ha\outputs\tienda-online\admin.html`

O ejecutar un servidor local con Node:
```bash
npx.cmd serve c:\Users\johnn\Documents\Codex\2026-07-08\ha\outputs\tienda-online
```

---

## 📦 Cómo Agregar Productos Reales Más Adelante

En el archivo `app.js` encontrarás el arreglo `designMockups`. Cada producto tiene esta estructura simple y editable:

```javascript
{
  id: 'prod-1',
  name: 'Nombre de tu Producto',
  category: 'minimal',
  categoryName: 'Categoría',
  price: 99.00,
  originalPrice: 129.00,
  discount: '-23%',
  rating: 4.9,
  reviews: 85,
  badge: 'NUEVO',
  badgeColor: 'bg-emerald-600 text-white',
  colors: ['#0f172a', '#e2e8f0'],
  sizes: ['S', 'M', 'L'],
  description: 'Descripción detallada del producto...',
  stock: 10
}
```
Solo reemplazas estos datos con tu catálogo real y las tarjetas se renderizarán automáticamente.
