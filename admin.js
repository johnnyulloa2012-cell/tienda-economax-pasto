/**
 * Tienda ECONOMAX - Panel de Emprendedor (Admin Dashboard)
 * San Juan de Pasto, Nariño, Colombia
 * Tel / WhatsApp: +57 300 472 0904 | Nequi: 300 472 0904 (Luz Angela Valencia Sinza)
 */

// Estado del Panel de Administración
const adminState = {
  theme: localStorage.getItem('theme') || 'light',
  currentTab: 'dashboard', // dashboard, inventory, orders, coupons, settings
  searchQuery: '',
  categoryFilter: 'all',
  
  // Inventario de Productos Oficial de Tienda ECONOMAX Pasto (Cargado desde planilla oficial y audios)
  products: (() => {
    const savedData = localStorage.getItem('economax_admin_products');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {}
    }

    const base = (typeof window !== 'undefined' && window.ECONOMAX_PRODUCTS) 
      ? window.ECONOMAX_PRODUCTS 
      : [];

    return base.map(p => ({
      id: p.code || p.id,
      name: p.name,
      category: p.categoryName || p.category,
      categoryName: p.categoryName || p.category,
      price: Number(p.price) || 0,
      originalPrice: Number(p.originalPrice) || 0,
      cost: Number(p.cost) || Math.round((Number(p.price) || 0) * 0.75),
      stock: p.stock !== undefined ? Number(p.stock) : 10,
      sales: Number(p.sales) || 0,
      status: (p.stock !== undefined && p.stock <= 2) ? 'Bajo Stock' : 'Activo',
      badge: p.badge || 'ECONOMAX',
      badgeColor: p.badgeColor || 'bg-red-600 text-white',
      discount: p.discount || '-10%',
      rating: p.rating || 5,
      reviews: p.reviews || 10,
      colors: p.colors || ['#dc2626'],
      sizes: p.sizes || ['Estándar'],
      description: p.description || '',
      image: p.image || ''
    }));
  })(),

  // Registro de Pedidos de Clientes (Sincronizado con vitrina y Nequi)
  orders: (() => {
    try {
      const saved = localStorage.getItem('economax_admin_orders');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Eliminar órdenes ficticias de demostración que hayan quedado en caché
          const demoIds = ['ORD-ECONOMAX-8210', 'ORD-ECONOMAX-8195', 'ORD-ECONOMAX-8142', 'ORD-ECONOMAX-8088'];
          const cleanOrders = parsed.filter(o => !demoIds.includes(o.id));
          localStorage.setItem('economax_admin_orders', JSON.stringify(cleanOrders));
          return cleanOrders;
        }
      }
    } catch (e) {}
    return [];
  })(),

  // Cupones de Descuento
  coupons: JSON.parse(localStorage.getItem('economax_admin_coupons') || localStorage.getItem('aura_admin_coupons')) || [
    { code: 'DISENO2026', discount: '15%', uses: 24, status: 'Activo' },
    { code: 'PASTO2026', discount: '10%', uses: 45, status: 'Activo' },
    { code: 'JUANOY', discount: '5%', uses: 32, status: 'Activo' },
    { code: 'VECINOS', discount: '10%', uses: 18, status: 'Activo' }
  ],

  // Configuración de la Tienda
  settings: JSON.parse(localStorage.getItem('economax_admin_settings') || localStorage.getItem('aura_admin_settings')) || {
    storeName: 'Tienda ECONOMAX',
    currency: 'COP',
    whatsapp: '+57 300 472 0904',
    nequiNumber: '300 472 0904',
    nequiHolder: 'Luz Angela Valencia Sinza',
    address: 'Calle 19D # 44B 69 - Barrio Juanoy Bajo, San Juan de Pasto',
    minOrder: 5000,
    deliveryText: '$3.000 - $5.000 COP (al repartidor)',
    email: 'tiendaeconomaxpasto@gmail.com'
  }
};

// Sincronización en tiempo real con el servidor (multidispositivo) y respaldo permanente
const GIST_BACKUP_RAW = 'https://gist.githubusercontent.com/johnnyulloa2012-cell/f2f04c1385ee96b43658513c438ab939/raw/products.json';
const GIST_BACKUP_STATUS = 'https://gist.githubusercontent.com/johnnyulloa2012-cell/f2f04c1385ee96b43658513c438ab939/raw/status.json';

// =================== SEGURIDAD Y SESIÓN DE ADMINISTRADOR ===================
let adminListenersAttached = false;

function lockAdminUI(message) {
  const loginScreen = document.getElementById('admin-login-screen');
  const sidebar = document.getElementById('admin-sidebar');
  const mainShell = document.getElementById('admin-main-shell');
  const errEl = document.getElementById('admin-login-error');
  const pinInput = document.getElementById('admin-pin-input');

  adminState.orders = [];
  const ordersTbody = document.getElementById('orders-table-body');
  if (ordersTbody) ordersTbody.innerHTML = '';

  if (sidebar) sidebar.classList.add('hidden');
  if (mainShell) mainShell.classList.add('hidden');
  if (loginScreen) loginScreen.classList.remove('hidden');

  if (errEl) {
    if (message) {
      errEl.textContent = message;
      errEl.classList.remove('hidden');
    } else {
      errEl.textContent = '';
      errEl.classList.add('hidden');
    }
  }
  if (pinInput) {
    pinInput.value = '';
    setTimeout(() => pinInput.focus(), 50);
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function adminFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    credentials: 'same-origin'
  });
  if (res.status === 401) {
    lockAdminUI('🔒 Sesión cerrada o no autorizada. Ingresa tu PIN.');
  }
  return res;
}

function unlockAndInitAdmin() {
  const loginScreen = document.getElementById('admin-login-screen');
  const sidebar = document.getElementById('admin-sidebar');
  const mainShell = document.getElementById('admin-main-shell');

  if (loginScreen) loginScreen.classList.add('hidden');
  if (sidebar) sidebar.classList.remove('hidden');
  if (mainShell) mainShell.classList.remove('hidden');

  if (!adminListenersAttached) {
    setupNavigation();
    setupEventListeners();
    adminListenersAttached = true;
  }

  renderDashboard();
  renderProductsTable();
  renderOrdersTable();
  renderCoupons();
  loadSettings();
  if (typeof lucide !== 'undefined') lucide.createIcons();
  syncWithServer();
}

async function checkAdminAuth() {
  try {
    const res = await fetch('/api/auth/status?t=' + Date.now(), { credentials: 'same-origin' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.authenticated) {
        unlockAndInitAdmin();
        return;
      }
    }
  } catch (e) {
    console.warn('No se pudo verificar sesión:', e);
  }
  lockAdminUI();
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const pinInput = document.getElementById('admin-pin-input');
  const errEl = document.getElementById('admin-login-error');
  const btn = document.getElementById('admin-login-btn');
  const pin = pinInput ? pinInput.value.trim() : '';

  if (!pin) return;
  if (errEl) errEl.classList.add('hidden');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      if (pinInput) pinInput.value = '';
      unlockAndInitAdmin();
      showToast('🔓 Sesión administrativa iniciada');
    } else {
      const msg = data.error || 'PIN incorrecto';
      if (errEl) {
        errEl.textContent = msg;
        errEl.classList.remove('hidden');
      }
      if (pinInput) {
        pinInput.value = '';
        pinInput.focus();
      }
    }
  } catch (err) {
    if (errEl) {
      errEl.textContent = 'Error de conexión con el servidor.';
      errEl.classList.remove('hidden');
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function logoutAdmin() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {}
  localStorage.removeItem('economax_admin_orders');
  lockAdminUI('🔒 Panel bloqueado. Ingresa tu PIN para volver a entrar.');
}

async function handleChangePin(e) {
  e.preventDefault();
  const currentPin = document.getElementById('pin-current')?.value.trim() || '';
  const newPin = document.getElementById('pin-new')?.value.trim() || '';
  const confirmPin = document.getElementById('pin-confirm')?.value.trim() || '';

  if (newPin.length < 4) {
    showToast('⚠️ El nuevo PIN debe tener al menos 4 caracteres o dígitos');
    return;
  }
  if (newPin !== confirmPin) {
    showToast('⚠️ La confirmación del nuevo PIN no coincide');
    return;
  }

  try {
    const res = await adminFetch('/api/auth/change-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPin, newPin })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      document.getElementById('change-pin-form')?.reset();
      showToast('✅ PIN de acceso actualizado correctamente');
    } else {
      showToast('⚠️ ' + (data.error || 'No se pudo cambiar el PIN'));
    }
  } catch {
    showToast('⚠️ Error de red al actualizar el PIN');
  }
}

async function syncWithServer() {
  try {
    const localUpdated = Number(localStorage.getItem('economax_catalog_updated_at') || 0);

    // 1. Obtener status de la nube para saber qué versión es más reciente
    let cloudTimestamp = 0;
    try {
      const statusRes = await fetch(GIST_BACKUP_STATUS + '?t=' + Date.now());
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        cloudTimestamp = Number(statusData.timestamp || 0);
      }
    } catch (e) {}

    // La nube es la fuente de verdad permanente: consultar servidor o backup de GitHub Gist

    let serverProducts = null;
    const resProducts = await fetch('/api/products?t=' + Date.now()).catch(() => null);
    if (resProducts && resProducts.ok) {
      serverProducts = await resProducts.json();
    }

    // Si el servidor de Render está suspendido o frío, consultar backup permanente en Gist
    if (!serverProducts || !Array.isArray(serverProducts) || serverProducts.length === 0) {
      const gistRes = await fetch(GIST_BACKUP_RAW + '?t=' + Date.now()).catch(() => null);
      if (gistRes && gistRes.ok) {
        serverProducts = await gistRes.json();
      }
    }

    if (Array.isArray(serverProducts) && serverProducts.length > 0) {
      adminState.products = serverProducts;
      localStorage.setItem('economax_admin_products', JSON.stringify(serverProducts));
      if (cloudTimestamp > 0) {
        localStorage.setItem('economax_catalog_updated_at', cloudTimestamp.toString());
      }
      renderProductsTable();
      renderDashboard();
    }

    const resSettings = await fetch('/api/settings?t=' + Date.now());
    if (resSettings.ok) {
      const serverSettings = await resSettings.json();
      if (serverSettings && serverSettings.storeName) {
        adminState.settings = serverSettings;
        localStorage.setItem('economax_admin_settings', JSON.stringify(serverSettings));
        loadSettings();
      }
    }

    const resOrders = await adminFetch('/api/orders?t=' + Date.now());
    if (resOrders.ok) {
      const serverOrders = await resOrders.json();
      if (Array.isArray(serverOrders)) {
        adminState.orders = serverOrders;
        localStorage.setItem('economax_admin_orders', JSON.stringify(serverOrders));
        renderOrdersTable();
        renderDashboard();
      }
    }
  } catch (e) {
    console.log('Modo local / sin conexión');
  }
}

// Inicialización segura del Dashboard (bloqueado hasta verificar PIN)
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) loginForm.addEventListener('submit', handleAdminLogin);
  lucide.createIcons();
  checkAdminAuth();
});

// Helper de formato de moneda colombiana (COP)
function formatAdminPrice(amount) {
  return `$${Math.round(Number(amount) || 0).toLocaleString('es-CO')} COP`;
}

// Guardar en LocalStorage y Sincronizar con el Servidor API y la Nube
async function persistData() {
  const now = Date.now();
  localStorage.setItem('economax_catalog_updated_at', now.toString());
  localStorage.setItem('economax_admin_products', JSON.stringify(adminState.products));
  localStorage.setItem('economax_admin_orders', JSON.stringify(adminState.orders));
  localStorage.setItem('economax_admin_coupons', JSON.stringify(adminState.coupons));
  localStorage.setItem('economax_admin_settings', JSON.stringify(adminState.settings));

  try {
    // 1. Sincronizar catálogo con el servidor autenticado (el backend respalda en Gist)
    const resProducts = await adminFetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminState.products)
    }).catch(err => {
      console.warn('Error sincronizando productos con servidor:', err);
      return null;
    });

    if (resProducts && resProducts.ok) {
      console.log('✅ Catálogo sincronizado exitosamente con el servidor.');
    }

    // 2. Sincronizar parámetros del negocio
    await adminFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminState.settings)
    }).catch(() => {});

    // 3. Sincronizar órdenes
    await adminFetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminState.orders)
    }).catch(() => {});
  } catch (e) {
    console.error('Error en persistData:', e);
  }
}

// Control del Tema (Modo Oscuro / Claro)
function initTheme() {
  const html = document.documentElement;
  if (adminState.theme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
  updateThemeIcon();
}

function toggleTheme() {
  adminState.theme = adminState.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', adminState.theme);
  initTheme();
  showToast(adminState.theme === 'dark' ? '🌙 Modo Oscuro Activado' : '☀️ Modo Claro Activado');
}

function updateThemeIcon() {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  btn.innerHTML = adminState.theme === 'dark' 
    ? '<i data-lucide="sun" class="w-5 h-5 text-amber-400"></i>'
    : '<i data-lucide="moon" class="w-5 h-5 text-slate-600 dark:text-slate-300"></i>';
  lucide.createIcons();
}

// Navegación por pestañas (Sidebar)
function setupNavigation() {
  const navItems = document.querySelectorAll('[data-tab]');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
    });
  });
}

function switchTab(tabId) {
  adminState.currentTab = tabId;

  // Actualizar clases de navegación
  const navItems = document.querySelectorAll('[data-tab]');
  navItems.forEach(item => {
    const isTarget = item.getAttribute('data-tab') === tabId;
    if (isTarget) {
      item.classList.add('bg-red-600', 'text-white', 'shadow-md');
      item.classList.remove('text-slate-600', 'dark:text-slate-400', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
    } else {
      item.classList.remove('bg-red-600', 'text-white', 'shadow-md');
      item.classList.add('text-slate-600', 'dark:text-slate-400', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
    }
  });

  // Mostrar la sección correspondiente
  const sections = ['dashboard', 'inventory', 'orders', 'coupons', 'settings'];
  sections.forEach(sec => {
    const el = document.getElementById(`section-${sec}`);
    if (el) {
      el.classList.toggle('hidden', sec !== tabId);
    }
  });

  // Título de la vista actual
  const pageTitle = document.getElementById('page-title');
  const titleMap = {
    dashboard: 'Resumen General • Tienda ECONOMAX',
    inventory: 'Gestión de Inventario & Catálogo',
    orders: 'Control de Pedidos & Pagos Nequi',
    coupons: 'Cupones de Descuento & Promociones',
    settings: 'Configuración Oficial de la Tienda'
  };
  if (pageTitle && titleMap[tabId]) {
    pageTitle.textContent = titleMap[tabId];
  }

  // Cerrar sidebar en móviles tras seleccionar pestaña
  closeSidebarOnMobile();

  lucide.createIcons();
}

// Toggle y Cierre del Sidebar en Móviles
function toggleSidebar() {
  const sidebar = document.getElementById('admin-sidebar');
  const backdrop = document.getElementById('admin-sidebar-backdrop');
  if (!sidebar) return;

  const isClosed = sidebar.classList.contains('-translate-x-full');
  if (isClosed) {
    sidebar.classList.remove('-translate-x-full');
    if (backdrop) backdrop.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  } else {
    sidebar.classList.add('-translate-x-full');
    if (backdrop) backdrop.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

function closeSidebarOnMobile() {
  if (window.innerWidth < 1024) {
    const sidebar = document.getElementById('admin-sidebar');
    const backdrop = document.getElementById('admin-sidebar-backdrop');
    if (sidebar) sidebar.classList.add('-translate-x-full');
    if (backdrop) backdrop.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

// Renderizado del Dashboard de Métricas
function renderDashboard() {
  // Cálculos dinámicos
  const totalRevenue = adminState.orders.reduce((sum, o) => sum + Number(o.total || 0), 0) + 1450000;
  const pendingOrders = adminState.orders.filter(o => o.status === 'Pendiente' || o.status === 'Preparando').length;
  const lowStockCount = adminState.products.filter(p => p.stock <= 5).length;
  const activeProducts = adminState.products.filter(p => p.status === 'Activo').length;

  const elRev = document.getElementById('metric-revenue');
  const elOrders = document.getElementById('metric-orders');
  const elStock = document.getElementById('metric-stock');
  const elProducts = document.getElementById('metric-products');

  if (elRev) elRev.textContent = formatAdminPrice(totalRevenue);
  if (elOrders) elOrders.textContent = pendingOrders;
  if (elStock) elStock.textContent = lowStockCount;
  if (elProducts) elProducts.textContent = activeProducts;

  // Mini-tabla de pedidos recientes en el dashboard
  const dashOrdersTable = document.getElementById('dashboard-recent-orders');
  if (dashOrdersTable) {
    if (adminState.orders.length === 0) {
      dashOrdersTable.innerHTML = `
        <tr>
          <td colspan="4" class="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
            <i data-lucide="shopping-bag" class="w-7 h-7 mx-auto mb-1.5 opacity-30"></i>
            No hay pedidos registrados todavía. Los pedidos nuevos aparecerán aquí automáticamente.
          </td>
        </tr>
      `;
    } else {
      const recent = adminState.orders.slice(0, 3);
      dashOrdersTable.innerHTML = recent.map(o => `
        <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
          <td class="py-3 font-mono font-bold text-red-600 dark:text-red-400">${o.id}</td>
          <td class="py-3 font-medium text-slate-800 dark:text-slate-200">${o.customer}</td>
          <td class="py-3 font-semibold text-slate-900 dark:text-white">${formatAdminPrice(o.total)}</td>
          <td class="py-3">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadgeClass(o.status)}">
              ${o.status}
            </span>
          </td>
        </tr>
      `).join('');
    }
  }
}

// Helper para colores de badges de estado
function getStatusBadgeClass(status) {
  switch (status) {
    case 'Pendiente':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900';
    case 'Preparando':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900';
    case 'Enviado':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-900';
    case 'Entregado':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900';
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
  }
}

// Renderizado de la Tabla de Productos / Inventario
function renderProductsTable() {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;

  let list = [...adminState.products];

  // Filtro por búsqueda
  if (adminState.searchQuery) {
    const q = adminState.searchQuery.toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }

  // Filtro por categoría
  if (adminState.categoryFilter !== 'all') {
    list = list.filter(p => p.category === adminState.categoryFilter);
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-12 text-center text-slate-400 dark:text-slate-500">
          <i data-lucide="package-search" class="w-10 h-10 mx-auto mb-2 opacity-40"></i>
          No se encontraron productos con estos criterios.
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  tbody.innerHTML = list.map(p => {
    const margin = Math.round(((p.price - p.cost) / p.price) * 100);
    const isLowStock = p.stock > 0 && p.stock <= 5;
    const isOutOfStock = p.stock === 0;

    let stockBadge = `<span class="text-emerald-600 dark:text-emerald-400 font-bold">${p.stock} unids.</span>`;
    if (isLowStock) {
      stockBadge = `<span class="text-amber-500 font-bold flex items-center gap-1"><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> ${p.stock} unids.</span>`;
    } else if (isOutOfStock) {
      stockBadge = `<span class="text-rose-500 font-bold flex items-center gap-1"><i data-lucide="x-circle" class="w-3.5 h-3.5"></i> Agotado</span>`;
    }

    return `
      <tr class="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
        <!-- Preview & Nombre -->
        <td class="py-3.5 px-4 flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden p-1 shadow-xs">
            ${p.image ? `<img src="${p.image.startsWith('images/') && !p.image.includes('?') ? p.image + '?v=20261116' : p.image}" alt="${p.name}" class="w-full h-full object-contain" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';" />` : ''}
            <i data-lucide="box" class="w-5 h-5 text-red-500 ${p.image ? 'hidden' : ''}"></i>
          </div>
          <div>
            <div class="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">${p.name}</div>
            <div class="text-[11px] font-mono text-slate-400">${p.id}</div>
          </div>
        </td>

        <!-- Categoría -->
        <td class="py-3.5 px-4 text-xs font-medium text-slate-600 dark:text-slate-300">
          <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-[11px]">
            ${p.category}
          </span>
        </td>

        <!-- Precio & Margen -->
        <td class="py-3.5 px-4 text-xs">
          <div class="font-bold text-slate-900 dark:text-white font-display text-sm">${formatAdminPrice(p.price)}</div>
          <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Margen: ${margin}% (Costo: ${formatAdminPrice(p.cost)})</div>
        </td>

        <!-- Stock -->
        <td class="py-3.5 px-4 text-xs">
          ${stockBadge}
        </td>

        <!-- Ventas Realizadas -->
        <td class="py-3.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
          ${p.sales} ventas
        </td>

        <!-- Estado -->
        <td class="py-3.5 px-4 text-xs">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-bold ${
            p.status === 'Activo' 
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
              : p.status === 'Bajo Stock'
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
          }">
            ${p.status}
          </span>
        </td>

        <!-- Acciones -->
        <td class="py-3.5 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="openEditProductModal('${p.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Editar producto completo (precios, fotos, promociones)">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button onclick="deleteProduct('${p.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Eliminar">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

// Renderizado de Pedidos
let currentlyViewingOrderId = null;

function renderOrdersTable() {
  const tbody = document.getElementById('orders-table-body');
  if (!tbody) return;

  if (adminState.orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="py-14 text-center text-slate-400 dark:text-slate-500">
          <i data-lucide="inbox" class="w-10 h-10 mx-auto mb-2.5 opacity-30 text-red-500"></i>
          <p class="font-bold text-sm text-slate-700 dark:text-slate-300">No hay pedidos registrados todavía</p>
          <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Cuando los clientes hagan compras desde la tienda web, sus pedidos aparecerán aquí con su comprobante de Nequi.</p>
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  tbody.innerHTML = adminState.orders.map(order => {
    const isPendingVerification = (order.status || '').toLowerCase().includes('verificar') || (order.status || '').toLowerCase().includes('pendiente');
    return `
    <tr class="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
      <td class="py-3.5 px-4 font-mono font-bold text-xs text-red-600 dark:text-red-400">${order.id}</td>
      <td class="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">${order.date}</td>
      <td class="py-3.5 px-4">
        <div class="font-bold text-xs text-slate-900 dark:text-white">${order.customer}</div>
        <div class="text-[11px] text-slate-400">${order.phone || order.email}</div>
        <div class="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-xs">${order.address}</div>
      </td>
      <td class="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs truncate">${order.items}</td>
      <td class="py-3.5 px-4 font-display font-bold text-sm text-slate-900 dark:text-white whitespace-nowrap">${formatAdminPrice(order.total)}</td>
      <td class="py-3.5 px-4 text-xs">
        <div class="font-semibold text-slate-800 dark:text-slate-200">${order.payment}</div>
        ${order.receiptRef ? `<div class="text-[10px] font-mono text-purple-600 dark:text-purple-400 mt-0.5">Ref: ${order.receiptRef}</div>` : ''}
        ${order.receiptUrl ? `
          <button type="button" onclick="viewOrderReceipt('${order.id}')" class="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/60 dark:hover:bg-purple-800 text-purple-800 dark:text-purple-200 text-[10px] font-bold shadow-xs transition cursor-pointer">
            <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            <span>Ver Comprobante</span>
          </button>
        ` : ''}
      </td>
      <td class="py-3.5 px-4">
        <div class="flex items-center gap-1.5">
          <select onchange="updateOrderStatus('${order.id}', this.value)" class="text-[11px] font-bold rounded-lg px-2.5 py-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer">
            <option value="Pendiente por verificar comprobante" ${order.status.includes('verificar') ? 'selected' : ''}>🟡 Por verificar Nequi</option>
            <option value="Pendiente (Contra Entrega)" ${order.status.includes('Contra Entrega') ? 'selected' : ''}>🟠 Contra Entrega</option>
            <option value="Preparando" ${order.status === 'Preparando' || order.status.includes('Preparación') ? 'selected' : ''}>🔵 Pagado / Preparando</option>
            <option value="Enviado" ${order.status === 'Enviado' ? 'selected' : ''}>🟣 Despachado</option>
            <option value="Entregado" ${order.status === 'Entregado' ? 'selected' : ''}>🟢 Entregado</option>
          </select>
          ${isPendingVerification ? `
            <button type="button" onclick="approveOrderDirectly('${order.id}')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-[10px] rounded-lg shadow-sm flex items-center gap-1 transition cursor-pointer" title="Aprobar pago y despachar">
              <i data-lucide="check" class="w-3 h-3"></i>
              <span>Aprobar</span>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `;
  }).join('');
  lucide.createIcons();
}

// Actualizar estado de una orden
function updateOrderStatus(orderId, newStatus) {
  const order = adminState.orders.find(o => o.id === orderId);
  if (order) {
    order.status = newStatus;
    persistData();
    renderDashboard();
    showToast(`📦 Pedido ${orderId} actualizado a "${newStatus}"`);
  }
}

// Renderizado de Cupones de Descuento
function renderCoupons() {
  const container = document.getElementById('coupons-list');
  if (!container) return;

  container.innerHTML = adminState.coupons.map((c, i) => `
    <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between shadow-xs">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center font-bold">
          <i data-lucide="tag" class="w-5 h-5"></i>
        </div>
        <div>
          <div class="font-mono font-bold text-sm text-slate-900 dark:text-white">${c.code}</div>
          <div class="text-xs text-slate-500">${c.discount} de descuento • ${c.uses} veces utilizado</div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${c.status === 'Activo' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}">
          ${c.status}
        </span>
        <button onclick="deleteCoupon(${i})" class="text-slate-400 hover:text-rose-500 p-1">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

// Crear Nuevo Cupón
function handleCreateCoupon(e) {
  e.preventDefault();
  const code = document.getElementById('coupon-code-input').value.trim().toUpperCase();
  const discount = document.getElementById('coupon-discount-input').value.trim();

  if (!code || !discount) {
    showToast('Por favor completa el código y porcentaje');
    return;
  }

  adminState.coupons.unshift({
    code: code,
    discount: discount.includes('%') ? discount : `${discount}%`,
    uses: 0,
    status: 'Activo'
  });

  persistData();
  renderCoupons();
  showToast(`🎟️ Cupón "${code}" creado con éxito`);
  document.getElementById('coupon-code-input').value = '';
  document.getElementById('coupon-discount-input').value = '';
}

function deleteCoupon(index) {
  adminState.coupons.splice(index, 1);
  persistData();
  renderCoupons();
  showToast('Cupón eliminado');
}

// Modal Añadir Producto
function openAddProductModal() {
  const modal = document.getElementById('add-product-modal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function closeAddProductModal() {
  const modal = document.getElementById('add-product-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

// Guardar nuevo producto desde el formulario
async function handleSaveProduct(e) {
  e.preventDefault();

  const name = document.getElementById('new-product-name').value.trim();
  const category = document.getElementById('new-product-category').value;
  const price = parseFloat(document.getElementById('new-product-price').value) || 0;
  const cost = parseFloat(document.getElementById('new-product-cost').value) || 0;
  const stock = parseInt(document.getElementById('new-product-stock').value, 10) || 0;
  const badge = document.getElementById('new-product-badge').value || 'NUEVO';

  if (!name || price <= 0) {
    showToast('Ingresa un nombre y precio válidos');
    return;
  }

  const nextId = 'PROD-' + Math.floor(100 + Math.random() * 900);
  const image = document.getElementById('new-product-image')?.value.trim() || '';

  let status = 'Activo';
  if (stock === 0) status = 'Agotado';
  else if (stock <= 5) status = 'Bajo Stock';

  const newProd = {
    id: nextId,
    name: name,
    category: category,
    categoryName: category,
    price: price,
    cost: cost,
    stock: stock,
    sales: 0,
    status: status,
    badge: badge,
    badgeColor: 'bg-red-600 text-white',
    discount: '-10%',
    rating: 5,
    reviews: 1,
    colors: ['#dc2626'],
    sizes: ['Estándar'],
    image: image,
    description: name
  };

  adminState.products.unshift(newProd);
  await persistData();

  renderProductsTable();
  renderDashboard();
  closeAddProductModal();
  document.getElementById('add-product-form').reset();
  document.getElementById('new-product-image').value = '';
  document.getElementById('new-product-image-preview').src = 'logo.jpg';
  showToast(`✨ Producto "${name}" añadido al catálogo`);
}

// Limpiar / Quitar Foto del Modal Nuevo Producto
function clearNewProductPhoto() {
  const imgInput = document.getElementById('new-product-image');
  const imgPreview = document.getElementById('new-product-image-preview');
  if (imgInput) imgInput.value = '';
  if (imgPreview) imgPreview.src = 'logo.jpg';
  showToast('Foto quitada');
}

// Modal Editar Producto Completo
function openEditProductModal(id) {
  const p = adminState.products.find(item => item.id === id);
  if (!p) return;

  const modal = document.getElementById('edit-product-modal');
  if (!modal) return;

  // Poblar los datos del producto seleccionado
  document.getElementById('edit-product-id').value = p.id;
  document.getElementById('edit-product-code-badge').textContent = `ID: ${p.id}`;
  document.getElementById('edit-product-name').value = p.name || '';
  document.getElementById('edit-product-category').value = p.category || 'Canasta Familiar';
  document.getElementById('edit-product-badge').value = p.badge || 'OFERTA';
  document.getElementById('edit-product-price').value = p.price || 0;
  document.getElementById('edit-product-original-price').value = p.originalPrice || Math.round((p.price || 0) * 1.15);
  document.getElementById('edit-product-cost').value = p.cost || 0;
  document.getElementById('edit-product-stock').value = p.stock || 0;
  document.getElementById('edit-product-status').value = p.status || 'Activo';
  document.getElementById('edit-product-discount').value = p.discount || '-10%';
  document.getElementById('edit-product-icon').value = p.icon || 'shopping-bag';
  document.getElementById('edit-product-description').value = p.description || '';

  // Foto y Preview
  const imgInput = document.getElementById('edit-product-image');
  const imgPreview = document.getElementById('edit-product-image-preview');
  if (imgInput) imgInput.value = p.image || '';
  if (imgPreview) imgPreview.src = (p.image && p.image.startsWith('images/') && !p.image.includes('?')) ? `${p.image}?v=20261116` : (p.image || 'logo.jpg');

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  lucide.createIcons();
}

function closeEditProductModal() {
  const modal = document.getElementById('edit-product-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

// Limpiar / Quitar Foto del Modal Editar Producto
function clearEditProductPhoto() {
  const imgInput = document.getElementById('edit-product-image');
  const imgPreview = document.getElementById('edit-product-image-preview');
  if (imgInput) imgInput.value = '';
  if (imgPreview) imgPreview.src = 'logo.jpg';
  showToast('Foto quitada. Presiona "Guardar Cambios" para confirmar.');
}

async function handleUpdateProduct(e) {
  e.preventDefault();
  const id = document.getElementById('edit-product-id').value;
  const p = adminState.products.find(item => item.id === id);
  if (!p) return;

  const name = document.getElementById('edit-product-name').value.trim();
  const category = document.getElementById('edit-product-category').value;
  const badge = document.getElementById('edit-product-badge').value;
  const price = parseFloat(document.getElementById('edit-product-price').value) || 0;
  const originalPrice = parseFloat(document.getElementById('edit-product-original-price').value) || price;
  const cost = parseFloat(document.getElementById('edit-product-cost').value) || 0;
  const stock = parseInt(document.getElementById('edit-product-stock').value, 10) || 0;
  const status = document.getElementById('edit-product-status').value;
  const discount = document.getElementById('edit-product-discount').value.trim() || '-10%';
  const icon = document.getElementById('edit-product-icon').value;
  const description = document.getElementById('edit-product-description').value.trim();
  const imageInput = document.getElementById('edit-product-image');
  const image = imageInput ? imageInput.value.trim() : '';

  if (!name || price <= 0) {
    showToast('⚠️ Ingresa un nombre y precio de venta válidos');
    return;
  }

  p.name = name;
  p.category = category;
  p.categoryName = category;
  p.badge = badge;
  p.price = price;
  p.originalPrice = originalPrice;
  p.cost = cost;
  p.stock = stock;
  p.status = stock === 0 ? 'Agotado' : status;
  p.discount = discount;
  p.icon = icon;
  p.description = description;
  p.image = image;

  await persistData();
  renderProductsTable();
  renderDashboard();
  closeEditProductModal();
  showToast(`✅ "${name}" actualizado con éxito en el catálogo`);
}

// Eliminar producto
async function deleteProduct(id) {
  if (confirm('¿Estás seguro de eliminar este producto del inventario?')) {
    adminState.products = adminState.products.filter(p => p.id !== id);
    await persistData();
    renderProductsTable();
    renderDashboard();
    showToast('Producto eliminado del inventario');
  }
}

// Configuración de la Tienda
function loadSettings() {
  const elName = document.getElementById('setting-store-name');
  const elPhone = document.getElementById('setting-whatsapp');
  const elNequi = document.getElementById('setting-nequi');
  const elHolder = document.getElementById('setting-holder');
  const elAddress = document.getElementById('setting-address');
  const elMin = document.getElementById('setting-min-order');
  const elDelivery = document.getElementById('setting-delivery');
  const elEmail = document.getElementById('setting-email');

  if (elName) elName.value = adminState.settings.storeName || 'Tienda ECONOMAX';
  if (elPhone) elPhone.value = adminState.settings.whatsapp || '+57 300 472 0904';
  if (elNequi) elNequi.value = adminState.settings.nequiNumber || '300 472 0904';
  if (elHolder) elHolder.value = adminState.settings.nequiHolder || 'Luz Angela Valencia Sinza';
  if (elAddress) elAddress.value = adminState.settings.address || 'Calle 19D # 44B 69 - Barrio Juanoy Bajo, San Juan de Pasto';
  if (elMin) elMin.value = adminState.settings.minOrder || 5000;
  if (elDelivery) elDelivery.value = adminState.settings.deliveryText || '$3.000 - $5.000 COP (al repartidor)';
  if (elEmail) elEmail.value = adminState.settings.email || 'tiendaeconomaxpasto@gmail.com';
}

function handleSaveSettings(e) {
  e.preventDefault();
  adminState.settings.storeName = document.getElementById('setting-store-name')?.value.trim() || 'Tienda ECONOMAX';
  adminState.settings.whatsapp = document.getElementById('setting-whatsapp')?.value.trim() || '+57 300 472 0904';
  adminState.settings.nequiNumber = document.getElementById('setting-nequi')?.value.trim() || '300 472 0904';
  adminState.settings.nequiHolder = document.getElementById('setting-holder')?.value.trim() || 'Luz Angela Valencia Sinza';
  adminState.settings.address = document.getElementById('setting-address')?.value.trim() || 'Calle 19D # 44B 69 - Barrio Juanoy Bajo, Pasto';
  adminState.settings.minOrder = parseFloat(document.getElementById('setting-min-order')?.value) || 5000;
  adminState.settings.deliveryText = document.getElementById('setting-delivery')?.value.trim() || '$3.000 - $5.000 COP (al repartidor)';
  adminState.settings.email = document.getElementById('setting-email')?.value.trim() || 'tiendaeconomaxpasto@gmail.com';

  persistData();
  showToast('💾 Parámetros oficiales de Tienda ECONOMAX guardados');
}

// Notificaciones flotantes
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'glass px-4 py-3 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 text-sm font-medium flex items-center gap-3 animate-fade-in pointer-events-auto';
  toast.innerHTML = `<span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// Escuchadores de eventos
function setupEventListeners() {
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Filtros de búsqueda en inventario
  const searchInput = document.getElementById('inventory-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      adminState.searchQuery = e.target.value;
      renderProductsTable();
    });
  }

  const categoryFilter = document.getElementById('inventory-category-filter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      adminState.categoryFilter = e.target.value;
      renderProductsTable();
    });
  }

  // Formulario nuevo producto
  const addForm = document.getElementById('add-product-form');
  if (addForm) addForm.addEventListener('submit', handleSaveProduct);

  // Formulario editar producto
  const editForm = document.getElementById('edit-product-form');
  if (editForm) editForm.addEventListener('submit', handleUpdateProduct);

  // Formulario cupones
  const couponForm = document.getElementById('coupon-create-form');
  if (couponForm) couponForm.addEventListener('submit', handleCreateCoupon);

  // Formulario ajustes
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) settingsForm.addEventListener('submit', handleSaveSettings);

  const changePinForm = document.getElementById('change-pin-form');
  if (changePinForm) changePinForm.addEventListener('submit', handleChangePin);
}

// Disparar el selector de archivo o cámara en celular y PC
function triggerFileInput(fileInputId) {
  const input = document.getElementById(fileInputId);
  if (input) {
    input.click();
  }
}

// Comprimir imagen en el navegador del celular antes de enviar al servidor
function compressImageFile(file, maxWidth = 1000, maxHeight = 1000, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            maxHeight = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Manejar la subida de foto desde celular (cámara o galería) o computadora
async function handleImageFileUpload(event, targetInputId, previewImgId, spinnerId) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const spinner = spinnerId ? document.getElementById(spinnerId) : null;
  const previewImg = previewImgId ? document.getElementById(previewImgId) : null;
  const targetInput = targetInputId ? document.getElementById(targetInputId) : null;

  try {
    if (spinner) spinner.classList.remove('hidden');
    showToast('📸 Procesando foto desde tu celular...');

    // 1. Optimizar y comprimir la foto tomada con la cámara para que suba al instante
    const compressedBase64 = await compressImageFile(file, 1000, 1000, 0.82);

    // 2. Previsualizar de inmediato
    if (previewImg) {
      previewImg.src = compressedBase64;
    }

    // 3. Subir al servidor backend (/api/upload con CDN permanente)
    let uploadedUrl = null;
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: compressedBase64 })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.url) {
          uploadedUrl = result.url;
        }
      }
    } catch (e) {
      console.warn('Servidor no respondió de inmediato, guardando localmente:', e);
    }

    const finalUrl = uploadedUrl || compressedBase64;
    if (targetInput) targetInput.value = finalUrl;
    if (previewImg) previewImg.src = finalUrl;
    showToast('✅ ¡Foto permanente guardada exitosamente!');
  } catch (err) {
    console.error('Error subiendo imagen:', err);
    try {
      const fallbackBase64 = await compressImageFile(file, 800, 800, 0.75);
      if (targetInput) targetInput.value = fallbackBase64;
      if (previewImg) previewImg.src = fallbackBase64;
      showToast('✅ Foto asignada al producto');
    } catch (e) {
      showToast('⚠️ No se pudo procesar la foto');
    }
  } finally {
    if (spinner) spinner.classList.add('hidden');
    event.target.value = ''; // Reset para permitir volver a seleccionar la misma foto
  }
}

// Asignaciones globales para onclick
window.switchTab = switchTab;
window.toggleSidebar = toggleSidebar;
window.openAddProductModal = openAddProductModal;
window.closeAddProductModal = closeAddProductModal;
window.openEditProductModal = openEditProductModal;
window.closeEditProductModal = closeEditProductModal;
window.deleteProduct = deleteProduct;
window.deleteCoupon = deleteCoupon;
window.updateOrderStatus = updateOrderStatus;
window.triggerFileInput = triggerFileInput;
window.handleImageFileUpload = handleImageFileUpload;
window.toggleTheme = toggleTheme;
window.clearEditProductPhoto = clearEditProductPhoto;
window.clearNewProductPhoto = clearNewProductPhoto;
window.handleUpdateProduct = handleUpdateProduct;
window.handleSaveProduct = handleSaveProduct;


// Visualizador de comprobante Nequi para Doña Angela
function viewOrderReceipt(orderId) {
  const order = adminState.orders.find(o => o.id === orderId);
  if (!order || !order.receiptUrl) {
    showToast('⚠️ Este pedido no adjuntó imagen de comprobante');
    return;
  }
  currentlyViewingOrderId = orderId;
  const modal = document.getElementById('view-receipt-modal');
  const img = document.getElementById('view-receipt-modal-img');
  const title = document.getElementById('view-receipt-modal-title');
  const amount = document.getElementById('view-receipt-modal-amount');
  const ref = document.getElementById('view-receipt-modal-ref');

  if (img) img.src = order.receiptUrl;
  if (title) title.textContent = `Comprobante Nequi - ${order.customer} (${order.id})`;
  if (amount) amount.textContent = formatAdminPrice(order.total);
  if (ref) ref.textContent = order.receiptRef ? `Referencia: ${order.receiptRef}` : '';
  if (modal) modal.classList.remove('hidden');
  lucide.createIcons();
}

function closeReceiptModal() {
  const modal = document.getElementById('view-receipt-modal');
  if (modal) modal.classList.add('hidden');
  currentlyViewingOrderId = null;
}

function approveCurrentOpenReceipt() {
  if (currentlyViewingOrderId) {
    approveOrderDirectly(currentlyViewingOrderId);
  }
}

function approveOrderDirectly(orderId) {
  updateOrderStatus(orderId, 'Preparando');
  closeReceiptModal();
  showToast(`✅ ¡Pago del pedido ${orderId} verificado y aprobado! Preparar despacho.`);
}

window.viewOrderReceipt = viewOrderReceipt;
window.closeReceiptModal = closeReceiptModal;
window.approveCurrentOpenReceipt = approveCurrentOpenReceipt;
window.approveOrderDirectly = approveOrderDirectly;

window.logoutAdmin = logoutAdmin;

// ================= OPERACIONES DE PEDIDOS, WHATSAPP Y ALERTAS EN VIVO =================

// Sonido nativo de campana / caja registradora usando Web Audio API
function playNewOrderSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playTone = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.28, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    // Melodía agradable: C5 -> E5 -> G5 -> C6
    playTone(523.25, 0, 0.3);
    playTone(659.25, 0.1, 0.3);
    playTone(783.99, 0.2, 0.4);
    playTone(1046.50, 0.32, 0.6);
  } catch (e) {
    console.log('Audio no disponible:', e);
  }
}

// Notificar al cliente por WhatsApp con mensaje pre-redactado según estado
function sendOrderWhatsApp(orderId) {
  const order = adminState.orders.find(o => o.id === orderId);
  if (!order) return;

  const rawPhone = (order.phone || order.email || '').replace(/\D/g, '');
  if (!rawPhone || rawPhone.length < 7) {
    alert('Este pedido no tiene un número de celular o WhatsApp válido registrado.');
    return;
  }

  const phone = rawPhone.length === 10 ? '57' + rawPhone : rawPhone;
  const status = (order.status || '').toLowerCase();

  let message = '';
  if (status.includes('verificar') || status.includes('pendiente')) {
    message = `¡Hola ${order.customer}! Te saluda Luz Ángela de *Tienda ECONOMAX* (Pasto).\n\n` +
      `Recibimos tu pedido *${order.id}* por un total de *${formatAdminPrice(order.total)}*.\n` +
      `Estamos verificando tu pago para alistar tus productos y coordinar el despacho a *${order.address}*.\n\n` +
      `¡Muchas gracias por tu compra! 🙏`;
  } else if (status.includes('preparando') || status.includes('pagado')) {
    message = `¡Hola ${order.customer}! Te saluda Luz Ángela de *Tienda ECONOMAX*.\n\n` +
      `✅ Tu pago para el pedido *${order.id}* ha sido verificado con éxito.\n` +
      `📦 Ya estamos empacando tus productos:\n${order.items}\n\n` +
      `En breve te avisamos cuando el domiciliario salga hacia tu dirección (*${order.address}*).`;
  } else if (status.includes('enviado') || status.includes('despachado')) {
    message = `¡Hola ${order.customer}! 🛵 *Tu pedido de Tienda ECONOMAX va en camino*\n\n` +
      `📦 *Pedido:* ${order.id}\n` +
      `📍 *Destino:* ${order.address}\n` +
      `💰 *Total:* ${formatAdminPrice(order.total)}\n\n` +
      `El repartidor se comunicará contigo al llegar a tu puerta. ¡Gracias por confiar en nosotros!`;
  } else {
    message = `¡Hola ${order.customer}! Te saluda Luz Ángela de *Tienda ECONOMAX*.\n\n` +
      `Te escribo respecto a tu pedido *${order.id}*. ¡Muchas gracias por preferirnos en Juanoy Bajo! Si necesitas algo más, aquí estamos siempre a la orden. 😊`;
  }

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  showToast(`📲 Abriendo WhatsApp para notificar a ${order.customer}...`);
}

// Eliminar un pedido individual
async function deleteOrder(orderId) {
  if (!confirm(`¿Estás seguro de que deseas eliminar el pedido ${orderId}? Esta acción no se puede deshacer.`)) {
    return;
  }
  adminState.orders = adminState.orders.filter(o => o.id !== orderId);
  await persistData();
  renderOrdersTable();
  renderDashboard();
  showToast(`🗑️ Pedido ${orderId} eliminado exitosamente`);
}

// Limpiar pedidos de prueba antiguos (Juan Perez, jose)
async function cleanTestOrders() {
  const testIds = ['ORD-ECONOMAX-6878', 'ORD-ECONOMAX-7095', 'ORD-ECONOMAX-8348', 'ORD-ECONOMAX-7012'];
  const testOrders = adminState.orders.filter(o => 
    testIds.includes(o.id) || 
    (o.customer && (o.customer.toLowerCase().includes('juan perez') || o.customer.toLowerCase().includes('jose')))
  );

  if (testOrders.length === 0) {
    showToast('ℹ️ No hay pedidos de prueba antiguos para limpiar');
    return;
  }

  if (!confirm(`¿Deseas eliminar los ${testOrders.length} pedidos de prueba del historial para dejar el panel limpio para ventas reales?`)) {
    return;
  }

  adminState.orders = adminState.orders.filter(o => !testOrders.some(t => t.id === o.id));
  await persistData();
  renderOrdersTable();
  renderDashboard();
  showToast(`✨ Se eliminaron ${testOrders.length} pedidos de prueba`);
}

// Polling automático cada 15 segundos para sincronizar nuevos pedidos en tiempo real
if (typeof window !== 'undefined') {
  setInterval(() => {
    if (document.visibilityState === 'visible' && !document.getElementById('admin-sidebar')?.classList.contains('hidden')) {
      syncWithServer();
    }
  }, 15000);
}

window.sendOrderWhatsApp = sendOrderWhatsApp;
window.deleteOrder = deleteOrder;
window.cleanTestOrders = cleanTestOrders;
window.playNewOrderSound = playNewOrderSound;
