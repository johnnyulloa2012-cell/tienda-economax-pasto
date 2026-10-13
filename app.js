/**
 * Tienda ECONOMAX - Lógica de Interfaz y Experiencia de Usuario (UI/UX)
 * San Juan de Pasto, Nariño, Colombia
 * Teléfono / WhatsApp: +57 300 472 0904 | Nequi: 300 472 0904 (Luz Angela Valencia Sinza)
 */

// Estado global de la aplicación
const state = {
  theme: localStorage.getItem('theme') || 'light',
  currency: 'COP',
  currencySymbols: { COP: '$', USD: 'US$', EUR: '€' },
  rates: { COP: 1, USD: 0.00025, EUR: 0.00023 },
  minOrderAmount: 5000, // Pedido mínimo: $5.000 COP
  whatsappBusiness: '573004720904', // WhatsApp oficial Tienda ECONOMAX Pasto
  nequiNumber: '300 472 0904', // Nequi oficial
  nequiHolder: 'Luz Angela Valencia Sinza', // Titular de la cuenta
  storeAddress: 'Calle 19D # 44B 69 - Barrio Juanoy Bajo, San Juan de Pasto',
  deliveryCostText: '$3.000 - $5.000 COP (al repartidor)',
  cart: [
    {
      id: 'prod-leche-grande',
      name: 'Leche Entera Grande 1.000ml',
      category: 'canasta',
      categoryName: 'Canasta Familiar',
      price: 4800,
      originalPrice: 5200,
      quantity: 1,
      variant: '1 Litro',
      color: '#ffffff',
      badge: 'DESPENSA',
      image: 'images/prod-leche-grande.jpg'
    },
    {
      id: 'prod-pan-dulce-sal',
      name: 'Pan Tradicional de Dulce y de Sal',
      category: 'canasta',
      categoryName: 'Canasta Familiar',
      price: 250,
      originalPrice: 300,
      quantity: 4,
      variant: 'Unidad ($250)',
      color: '#d97706',
      badge: 'HORNEADO',
      image: 'images/prod-pan-dulce-sal.jpg'
    }
  ],
  wishlist: new Set(['prod-dessini', 'prod-swiss-home']),
  activeCategory: 'all',
  activeSort: 'popular',
  searchQuery: '',
  discountCoupon: null,
  activeQuickViewProduct: null,
  lastOrderData: null
};

// Catálogo Oficial de Productos - TIENDA ECONOMAX PASTO (Cargado desde planilla oficial y audios)
function getCatalogProducts() {
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
  return base;
}

let designMockups = getCatalogProducts();

// Sincronización en tiempo real con la API del servidor (multidispositivo) y respaldo permanente
const GIST_BACKUP_RAW = 'https://gist.githubusercontent.com/johnnyulloa2012-cell/f2f04c1385ee96b43658513c438ab939/raw/products.json';

async function syncStorefrontWithServer() {
  try {
    let serverProducts = null;
    const res = await fetch('/api/products?t=' + Date.now()).catch(() => null);
    if (res && res.ok) {
      serverProducts = await res.json();
    }

    // Si el servidor de Render está suspendido o frío, consultar backup permanente en Gist
    if (!serverProducts || !Array.isArray(serverProducts) || serverProducts.length === 0) {
      const gistRes = await fetch(GIST_BACKUP_RAW + '?t=' + Date.now()).catch(() => null);
      if (gistRes && gistRes.ok) {
        serverProducts = await gistRes.json();
      }
    }

    if (Array.isArray(serverProducts) && serverProducts.length > 0) {
      designMockups = serverProducts;
      localStorage.setItem('economax_admin_products', JSON.stringify(serverProducts));
      renderProducts();
    }

    const resSettings = await fetch('/api/settings?t=' + Date.now());
    if (resSettings.ok) {
      const settings = await resSettings.json();
      if (settings && settings.nequiNumber) {
        state.whatsappBusiness = (settings.whatsapp || '').replace(/[^0-9]/g, '') || state.whatsappBusiness;
        state.nequiNumber = settings.nequiNumber || state.nequiNumber;
        state.nequiHolder = settings.nequiHolder || state.nequiHolder;
        state.storeAddress = settings.address || state.storeAddress;
        state.minOrderAmount = Number(settings.minOrder) || state.minOrderAmount;
        state.deliveryCostText = settings.deliveryText || state.deliveryCostText;
      }
    }
  } catch (e) {
    console.log('Modo offline / datos locales');
  }
}

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  renderProducts();
  updateCartUI();
  updateWishlistUI();
  setupEventListeners();
  initCountdownTimer();
  lucide.createIcons();
  syncStorefrontWithServer();
});

// Gestión de Modo Oscuro / Claro
function initTheme() {
  const html = document.documentElement;
  if (state.theme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
  updateThemeIcon();
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', state.theme);
  initTheme();
  showToast(state.theme === 'dark' ? '🌙 Modo Oscuro Activado' : '☀️ Modo Claro Activado');
}

function updateThemeIcon() {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  btn.innerHTML = state.theme === 'dark' 
    ? '<i data-lucide="sun" class="w-5 h-5 text-amber-400"></i>'
    : '<i data-lucide="moon" class="w-5 h-5 text-slate-700 dark:text-slate-200"></i>';
  lucide.createIcons();
}

// Formateador de moneda adaptado a Pesos Colombianos (COP)
function formatPrice(amount) {
  const rate = state.rates[state.currency] || 1;
  const converted = amount * rate;
  if (state.currency === 'COP') {
    return '$' + Math.round(converted).toLocaleString('es-CO') + ' COP';
  }
  const symbol = state.currencySymbols[state.currency] || '$';
  return `${symbol}${converted.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Normalización de texto (sin tildes y en minúsculas) para búsqueda y filtros robustos
function normalizeStr(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Convertir cualquier variante o nombre de categoría a su identificador canónico
function normalizeCategorySlug(category) {
  if (!category || category === 'all') return 'all';
  const f = normalizeStr(category);
  if (f.includes('canasta') || f.includes('viveres') || f.includes('abarrote') || f.includes('despensa') || f.includes('lacteo')) return 'canasta';
  if (f.includes('snack') || f.includes('dulce') || f.includes('dulceria') || f.includes('golosina') || f.includes('mecato')) return 'snacks';
  if (f.includes('bebida') || f.includes('refresco') || f.includes('gaseosa') || f.includes('jugo')) return 'bebidas';
  if (f.includes('aseo') || f.includes('limpieza') || f.includes('higiene')) return 'aseo';
  if (f.includes('cocina') || f.includes('utensilio') || f.includes('olla') || f.includes('sarten') || f.includes('cuchillo') || f.includes('dessini') || f.includes('swiss')) return 'cocina';
  if (f.includes('ropa') || f.includes('prenda') || f.includes('vestir') || f.includes('moda')) return 'ropa';
  if (f.includes('ferreteria') || f.includes('herramienta') || f.includes('electrico') || f.includes('variedad')) return 'ferreteria';
  return f;
}

// Coincidencia inteligente y flexible entre producto y categoría seleccionada
function matchesCategory(item, filterCategory) {
  if (!filterCategory || filterCategory === 'all') return true;
  const targetSlug = normalizeCategorySlug(filterCategory);
  const catSlug = normalizeCategorySlug(item.category);
  const catName = normalizeStr(item.categoryName);

  if (targetSlug === catSlug) return true;

  if (targetSlug === 'canasta') {
    return catName.includes('canasta') || catName.includes('viveres') || catName.includes('despensa') || catSlug === 'canasta';
  }
  if (targetSlug === 'snacks') {
    return catName.includes('snack') || catName.includes('dulce') || catSlug === 'snacks';
  }
  if (targetSlug === 'cocina') {
    return catName.includes('utensilio') || catName.includes('cocina') || catSlug === 'cocina' || item.id === 'prod-dessini' || item.id === 'prod-swiss-home';
  }
  if (targetSlug === 'bebidas') {
    return catName.includes('bebida') || catName.includes('refresco') || catSlug === 'bebidas';
  }
  if (targetSlug === 'aseo') {
    return catName.includes('aseo') || catName.includes('limpieza') || catSlug === 'aseo';
  }
  if (targetSlug === 'ropa') {
    return catName.includes('prenda') || catName.includes('ropa') || catName.includes('vestir') || catSlug === 'ropa';
  }
  if (targetSlug === 'ferreteria') {
    return catName.includes('ferreter') || catName.includes('herramienta') || catSlug === 'ferreteria';
  }

  return catSlug.includes(targetSlug) || catName.includes(targetSlug);
}

// Renderizado de las tarjetas de diseño de producto
function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  let filtered = [...designMockups];

  // Filtro por categoría inteligente
  if (state.activeCategory !== 'all') {
    filtered = filtered.filter(item => matchesCategory(item, state.activeCategory));
  }

  // Filtro por búsqueda en vivo
  if (state.searchQuery) {
    const q = normalizeStr(state.searchQuery);
    filtered = filtered.filter(m => 
      normalizeStr(m.name).includes(q) || 
      normalizeStr(m.categoryName).includes(q) ||
      normalizeStr(m.description).includes(q)
    );
  }

  // Ordenamiento
  if (state.activeSort === 'price-low') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (state.activeSort === 'price-high') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (state.activeSort === 'rating') {
    filtered.sort((a, b) => b.rating - a.rating);
  }

  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-500 dark:text-slate-400">
        <i data-lucide="package-search" class="w-12 h-12 mx-auto mb-3 opacity-40 text-red-500"></i>
        <p class="text-lg font-medium">No se encontraron productos disponibles para este filtro.</p>
        <button onclick="selectCategoryFilter('all')" class="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all">
          Ver Todo el Catálogo
        </button>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  filtered.forEach(item => {
    const isWishlisted = state.wishlist.has(item.id);
    const colors = Array.isArray(item.colors) && item.colors.length > 0 ? item.colors : ['#dc2626'];
    const badgeColor = item.badgeColor || 'bg-red-600 text-white';
    const badge = item.badge || 'ECONOMAX';
    const discount = item.discount || '';
    const rating = item.rating || 5;
    const reviews = item.reviews || 12;
    const categoryName = item.categoryName || (normalizeCategorySlug(item.category) === 'cocina' ? 'Utensilios de Cocina' : normalizeCategorySlug(item.category) === 'snacks' ? 'Snacks & Dulcería' : 'Canasta Familiar');
    const description = item.description || '';
    const icon = item.icon || 'shopping-bag';
    const image = item.image || '';
    const stock = item.stock !== undefined ? item.stock : 10;
    
    const card = document.createElement('div');
    card.className = 'group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden hover:shadow-xl hover:shadow-red-900/10 dark:hover:shadow-slate-950/50 transition-all duration-300 flex flex-col justify-between';
    
    card.innerHTML = `
      <div>
        <!-- Imagen / Visual Placeholder Area con Icono de Categoría -->
        <div class="relative aspect-[4/5] bg-gradient-to-b from-amber-50/60 to-slate-100 dark:from-slate-800/60 dark:to-slate-900 flex flex-col items-center justify-center p-6 overflow-hidden border-b border-slate-100 dark:border-slate-800">
          
          <!-- Badge Flotante Superior -->
          <div class="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
            <span class="text-[11px] font-bold tracking-wider px-2.5 py-1 rounded-full uppercase shadow-sm ${badgeColor}">
              ${badge}
            </span>
            ${discount ? `
            <span class="text-[11px] font-semibold bg-white/90 dark:bg-slate-800/90 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full backdrop-blur-sm shadow-xs border border-red-100 dark:border-red-900/30">
              ${discount}
            </span>
            ` : ''}
          </div>

          <!-- Botón de Favorito Flotante -->
          <button onclick="toggleWishlist('${item.id}')" class="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-md flex items-center justify-center shadow-md border border-slate-200/50 dark:border-slate-700/50 hover:scale-110 active:scale-95 transition-all text-slate-400 hover:text-red-500 dark:hover:text-red-400 ${isWishlisted ? 'text-red-500 dark:text-red-400 fill-red-500' : ''}">
            <i data-lucide="heart" class="w-4 h-4 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}"></i>
          </button>

          <!-- Foto Comercial Real del Producto -->
          <div class="w-full h-full flex items-center justify-center p-3 relative group-hover:scale-105 transition-transform duration-500">
            ${image ? `
              <img 
                src="${image}" 
                alt="${item.name}" 
                loading="lazy"
                class="w-full h-44 object-contain drop-shadow-sm transition-transform duration-300 rounded-xl"
                onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';"
              />
            ` : ''}
            <div class="${image ? 'hidden' : 'flex'} flex-col items-center justify-center text-center">
              <div class="w-28 h-28 rounded-3xl bg-gradient-to-tr from-amber-100 to-amber-200 dark:from-slate-700 dark:to-slate-800 p-1 shadow-inner flex items-center justify-center border border-amber-300/40">
                <div class="w-full h-full rounded-[22px] bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex flex-col items-center justify-center p-3">
                  <i data-lucide="${icon}" class="w-8 h-8 text-red-600 dark:text-red-400 mb-1"></i>
                  <span class="text-[9px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 line-clamp-1">${categoryName}</span>
                  <span class="text-[8px] text-amber-600 dark:text-amber-400 font-semibold">ECONOMAX Pasto</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Botón Rápido Overlay (Aparece en hover) -->
          <div class="absolute inset-x-3 bottom-3 z-10 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            <button onclick="openQuickView('${item.id}')" class="w-full py-2.5 bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 rounded-xl font-medium text-xs backdrop-blur-md shadow-lg flex items-center justify-center gap-2 hover:bg-red-600 dark:hover:bg-red-500 dark:hover:text-white transition-colors">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i>
              <span>Ver Detalles</span>
            </button>
          </div>
        </div>

        <!-- Información del Producto -->
        <div class="p-5">
          <div class="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 mb-1.5 font-medium">
            <span class="text-red-600 dark:text-red-400 font-semibold">${categoryName}</span>
            <div class="flex items-center gap-1 text-amber-500">
              <i data-lucide="star" class="w-3.5 h-3.5 fill-amber-400 text-amber-400"></i>
              <span class="font-bold text-slate-700 dark:text-slate-300">${rating}</span>
              <span class="text-slate-400 dark:text-slate-500">(${reviews})</span>
            </div>
          </div>

          <h3 class="font-display font-semibold text-base text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors line-clamp-1 cursor-pointer" onclick="openQuickView('${item.id}')">
            ${item.name}
          </h3>

          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
            ${description}
          </p>

          <!-- Swatches de variantes de color interactivos -->
          <div class="flex items-center justify-between mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-1.5">
              ${colors.map((c, i) => `
                <span class="w-3.5 h-3.5 rounded-full border border-white dark:border-slate-800 ring-1 ring-slate-300 dark:ring-slate-700 transition-transform hover:scale-125 cursor-pointer" style="background-color: ${c};" title="Variante ${i+1}"></span>
              `).join('')}
            </div>
            <span class="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              ${stock} en stock
            </span>
          </div>
        </div>
      </div>

      <!-- Footer de la Tarjeta con Precios y Botón de Carrito -->
      <div class="px-5 pb-5 pt-1 flex items-center justify-between gap-3">
        <div>
          <div class="text-xs line-through text-slate-400 dark:text-slate-500">
            ${formatPrice(item.originalPrice || item.price)}
          </div>
          <div class="text-lg font-bold font-display text-slate-900 dark:text-white text-red-600 dark:text-red-400">
            ${formatPrice(item.price)}
          </div>
        </div>

        <button onclick="addToCart('${item.id}')" class="px-3.5 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-red-600/20 transition-all">
          <i data-lucide="shopping-cart" class="w-3.5 h-3.5"></i>
          <span>Agregar</span>
        </button>
      </div>
    `;

    grid.appendChild(card);
  });

  lucide.createIcons();
}

// Gestión de Favoritos
function toggleWishlist(productId) {
  if (state.wishlist.has(productId)) {
    state.wishlist.delete(productId);
    showToast('Eliminado de favoritos');
  } else {
    state.wishlist.add(productId);
    showToast('❤️ Guardado en tu lista de deseos');
  }
  updateWishlistUI();
  renderProducts();
}

function updateWishlistUI() {
  const countEl = document.getElementById('wishlist-count');
  if (countEl) {
    countEl.textContent = state.wishlist.size;
    countEl.classList.toggle('hidden', state.wishlist.size === 0);
  }
}

// Gestión del Carrito
function addToCart(productId) {
  const product = designMockups.find(p => p.id === productId);
  if (!product) return;

  const existing = state.cart.find(item => item.id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({
      id: product.id,
      name: product.name,
      category: product.categoryName,
      price: product.price,
      originalPrice: product.originalPrice,
      quantity: 1,
      variant: 'Variante Estándar',
      color: product.colors ? product.colors[0] : '#dc2626',
      badge: product.badge,
      image: product.image
    });
  }

  updateCartUI();
  showToast(`🛒 "${product.name}" añadido al carrito`);
  openCartDrawer();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(item => item.id !== productId);
  updateCartUI();
  showToast('Producto retirado del carrito');
}

function changeQuantity(productId, delta) {
  const item = state.cart.find(i => i.id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    removeFromCart(productId);
  } else {
    updateCartUI();
  }
}

function updateCartUI() {
  const countBadge = document.getElementById('cart-count');
  const itemsContainer = document.getElementById('cart-items-container');
  const emptyState = document.getElementById('cart-empty-state');
  const subtotalEl = document.getElementById('cart-subtotal');
  const shippingEl = document.getElementById('cart-shipping');
  const discountEl = document.getElementById('cart-discount');
  const totalEl = document.getElementById('cart-total');
  const progressText = document.getElementById('shipping-progress-text');
  const progressBar = document.getElementById('shipping-progress-bar');

  const totalItems = state.cart.reduce((sum, i) => sum + i.quantity, 0);

  if (countBadge) {
    countBadge.textContent = totalItems;
    countBadge.classList.toggle('hidden', totalItems === 0);
  }

  const subtotal = state.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const minOrder = state.minOrderAmount || 5000;
  
  let discountAmount = 0;
  if (state.discountCoupon === 'DISENO2026') {
    discountAmount = Math.round(subtotal * 0.15); // 15% OFF
  }

  const grandTotal = Math.max(0, subtotal - discountAmount);

  // Barra de progreso de compra mínima ($5.000 COP)
  if (progressText && progressBar) {
    if (subtotal >= minOrder) {
      progressText.innerHTML = '✅ <strong>¡Superaste el mínimo de $5.000 COP!</strong> Listo para pedir a domicilio en Pasto.';
      progressBar.style.width = '100%';
      progressBar.classList.add('bg-emerald-500');
      progressBar.classList.remove('bg-amber-500', 'bg-red-600');
    } else {
      const remaining = minOrder - subtotal;
      const pct = Math.min(100, Math.round((subtotal / minOrder) * 100));
      progressText.innerHTML = `⚠️ Compra mínima: <strong>$5.000 COP</strong> (Te faltan <strong>${formatPrice(remaining)}</strong>)`;
      progressBar.style.width = `${pct}%`;
      progressBar.classList.add('bg-amber-500');
      progressBar.classList.remove('bg-emerald-500', 'bg-red-600');
    }
  }

  if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
  if (shippingEl) {
    shippingEl.innerHTML = '<span class="text-red-600 dark:text-red-400 font-bold">🛵 Pagado al repartidor ($3.000 - $5.000)</span>';
  }
  if (discountEl) {
    discountEl.textContent = `-${formatPrice(discountAmount)}`;
    discountEl.parentElement.classList.toggle('hidden', discountAmount === 0);
  }
  if (totalEl) {
    totalEl.innerHTML = `${formatPrice(grandTotal)} <span class="text-[11px] font-normal text-slate-400 block sm:inline">(+ domicilio contra entrega)</span>`;
  }

  // Renderizado de lista de ítems en el drawer
  if (itemsContainer && emptyState) {
    if (state.cart.length === 0) {
      itemsContainer.innerHTML = '';
      emptyState.classList.remove('hidden');
      itemsContainer.classList.add('hidden');
    } else {
      emptyState.classList.add('hidden');
      itemsContainer.classList.remove('hidden');
      itemsContainer.innerHTML = state.cart.map(item => `
        <div class="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 transition-all">
          <div class="w-14 h-14 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden p-1 shadow-xs">
            ${item.image ? `<img src="${item.image}" alt="${item.name}" class="w-full h-full object-contain" onerror="this.style.display='none';" />` : `<span class="w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-slate-900" style="background-color: ${item.color || '#dc2626'}"></span>`}
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="text-sm font-semibold text-slate-900 dark:text-white truncate">${item.name}</h4>
            <p class="text-xs text-slate-400 dark:text-slate-500">${item.variant}</p>
            <div class="text-sm font-bold font-display text-slate-900 dark:text-white mt-1">
              ${formatPrice(item.price)}
            </div>
          </div>
          <div class="flex flex-col items-end gap-2">
            <button onclick="removeFromCart('${item.id}')" class="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors p-1" title="Eliminar">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
            <div class="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900">
              <button onclick="changeQuantity('${item.id}', -1)" class="w-6 h-6 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-l-lg font-bold text-xs">-</button>
              <span class="w-7 text-center text-xs font-semibold text-slate-800 dark:text-slate-200">${item.quantity}</span>
              <button onclick="changeQuantity('${item.id}', 1)" class="w-6 h-6 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-r-lg font-bold text-xs">+</button>
            </div>
          </div>
        </div>
      `).join('');
      lucide.createIcons();
    }
  }
}

// Cupón de descuento
function applyCoupon() {
  const input = document.getElementById('coupon-input');
  if (!input) return;
  const code = input.value.trim().toUpperCase();

  if (code === 'DISENO2026') {
    state.discountCoupon = code;
    updateCartUI();
    showToast('🎉 ¡Cupón DISENO2026 aplicado! 15% de descuento activado');
    input.disabled = true;
    const btn = document.getElementById('apply-coupon-btn');
    if (btn) btn.textContent = 'Aplicado';
  } else if (code === '') {
    showToast('Ingresa un código de cupón');
  } else {
    showToast('❌ Cupón inválido. Prueba con DISENO2026');
  }
}

// Abrir y Cerrar Carrito
function openCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  if (drawer) {
    drawer.classList.remove('pointer-events-none');
    drawer.querySelector('.drawer-backdrop').classList.remove('opacity-0');
    drawer.querySelector('.drawer-panel').classList.remove('translate-x-full');
    document.body.style.overflow = 'hidden';
  }
}

function closeCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  if (drawer) {
    drawer.classList.add('pointer-events-none');
    drawer.querySelector('.drawer-backdrop').classList.add('opacity-0');
    drawer.querySelector('.drawer-panel').classList.add('translate-x-full');
    document.body.style.overflow = '';
  }
}

// Modal de Vista Rápida
function openQuickView(productId) {
  const item = designMockups.find(p => p.id === productId);
  if (!item) return;

  state.activeQuickViewProduct = item;
  const modal = document.getElementById('quick-view-modal');
  if (!modal) return;

  document.getElementById('qv-title').textContent = item.name;
  document.getElementById('qv-category').textContent = item.categoryName;
  document.getElementById('qv-price').textContent = formatPrice(item.price);
  document.getElementById('qv-original-price').textContent = formatPrice(item.originalPrice);
  document.getElementById('qv-discount').textContent = item.discount;
  document.getElementById('qv-rating').textContent = `${item.rating} (${item.reviews} valoraciones)`;
  document.getElementById('qv-description').textContent = item.description;

  // Foto Comercial Real
  const imgBox = document.getElementById('qv-image-box');
  if (imgBox) {
    if (item.image) {
      imgBox.innerHTML = `
        <img 
          src="${item.image}" 
          alt="${item.name}" 
          class="max-h-64 max-w-full object-contain drop-shadow-md rounded-2xl" 
          onerror="this.src='logo.jpg'" 
        />
      `;
    } else {
      imgBox.innerHTML = `
        <div class="w-44 h-44 rounded-3xl bg-white/80 dark:bg-slate-800/80 shadow-inner flex flex-col items-center justify-center text-center p-4 border border-white/60 dark:border-slate-700">
          <i data-lucide="${item.icon || 'shopping-bag'}" class="w-10 h-10 text-red-500 mb-2"></i>
          <span class="text-xs font-bold text-slate-700 dark:text-slate-300">${item.categoryName}</span>
        </div>
      `;
    }
  }

  // Variantes de tamaño
  const sizesContainer = document.getElementById('qv-sizes');
  if (sizesContainer) {
    const sizes = Array.isArray(item.sizes) && item.sizes.length > 0 ? item.sizes : ['Estándar'];
    sizesContainer.innerHTML = sizes.map((s, idx) => `
      <button class="px-3 py-1.5 rounded-lg border ${idx === 0 ? 'border-red-600 bg-red-50 text-red-700 dark:bg-red-950/40 dark:border-red-500 dark:text-red-300' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'} text-xs font-semibold transition-all">
        ${s}
      </button>
    `).join('');
  }

  // Colores
  const colorsContainer = document.getElementById('qv-colors');
  if (colorsContainer) {
    const colors = Array.isArray(item.colors) && item.colors.length > 0 ? item.colors : ['#dc2626'];
    colorsContainer.innerHTML = colors.map((c, idx) => `
      <button class="w-6 h-6 rounded-full border-2 ${idx === 0 ? 'ring-2 ring-red-600 ring-offset-2 dark:ring-offset-slate-900' : 'border-white dark:border-slate-800'} transition-all" style="background-color: ${c};"></button>
    `).join('');
  }

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  lucide.createIcons();
}

function closeQuickView() {
  const modal = document.getElementById('quick-view-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

function addQuickViewToCart() {
  if (state.activeQuickViewProduct) {
    addToCart(state.activeQuickViewProduct.id);
    closeQuickView();
  }
}

// Simulador de Proceso de Checkout y Pasarela Interactiva (Estilo Temu & Tipti)
function openCheckoutModal() {
  if (state.cart.length === 0) {
    showToast('Tu carrito está vacío. Agrega productos para continuar.');
    return;
  }
  const subtotal = state.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  if (subtotal < (state.minOrderAmount || 5000)) {
    showToast(`⚠️ El pedido mínimo en Pasto es de ${formatPrice(state.minOrderAmount || 5000)}. Agrega más productos.`);
    return;
  }
  closeCartDrawer();
  const modal = document.getElementById('checkout-modal');
  if (modal) {
    const payTotalEl = document.getElementById('checkout-pay-total');
    if (payTotalEl) payTotalEl.textContent = formatPrice(subtotal);

    setCheckoutStep(1);
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

function setCheckoutStep(step) {
  if (step === 2) {
    const name = document.getElementById('checkout-name')?.value.trim();
    const phone = document.getElementById('checkout-phone')?.value.trim();
    const address = document.getElementById('checkout-address')?.value.trim();
    const barrio = document.getElementById('checkout-barrio')?.value.trim();
    if (!name || !phone || !address || !barrio) {
      showToast('⚠️ Por favor completa tu nombre, celular, dirección y barrio');
      return;
    }

    const subtotal = state.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const payTotalEl = document.getElementById('checkout-pay-total');
    if (payTotalEl) payTotalEl.textContent = formatPrice(subtotal);

    const activeRadio = document.querySelector('input[name="payment-method-type"]:checked');
    togglePaymentMethodUI(activeRadio ? activeRadio.value : 'card');
  }

  const step1 = document.getElementById('checkout-step-1');
  const step2 = document.getElementById('checkout-step-2');
  const step3 = document.getElementById('checkout-step-3');
  const dots = document.querySelectorAll('.checkout-step-dot');

  if (step1) step1.classList.toggle('hidden', step !== 1);
  if (step2) step2.classList.toggle('hidden', step !== 2);
  if (step3) step3.classList.toggle('hidden', step !== 3);

  dots.forEach((dot, idx) => {
    if (idx + 1 <= step) {
      dot.classList.add('bg-red-600', 'text-white');
      dot.classList.remove('bg-slate-200', 'text-slate-600', 'dark:bg-slate-700', 'dark:text-slate-400');
    } else {
      dot.classList.remove('bg-red-600', 'text-white');
      dot.classList.add('bg-slate-200', 'text-slate-600', 'dark:bg-slate-700', 'dark:text-slate-400');
    }
  });

  lucide.createIcons();
}

// Selector y conmutador visual de métodos de pago (Tarjeta, Nequi, Contra Entrega)
function togglePaymentMethodUI(method) {
  const cardBox = document.getElementById('card-option-box');
  const nequiBox = document.getElementById('nequi-option-box');
  const cashBox = document.getElementById('cash-option-box');

  const formCard = document.getElementById('payment-form-card');
  const formNequi = document.getElementById('payment-form-nequi');
  const formCash = document.getElementById('payment-form-cash');

  const payBtn = document.getElementById('pay-now-btn');
  const payBtnText = document.getElementById('pay-now-btn-text');
  const subtotal = state.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const totalFormatted = formatPrice(subtotal);

  const radio = document.querySelector(`input[name="payment-method-type"][value="${method}"]`);
  if (radio) radio.checked = true;

  [cardBox, nequiBox, cashBox].forEach(b => {
    if (b) {
      b.classList.remove('border-red-600', 'border-purple-600', 'border-amber-600', 'dark:border-red-500', 'dark:border-purple-500', 'dark:border-amber-500');
      b.classList.add('border-slate-200', 'dark:border-slate-800');
    }
  });

  if (formCard) formCard.classList.add('hidden');
  if (formNequi) formNequi.classList.add('hidden');
  if (formCash) formCash.classList.add('hidden');

  if (method === 'card') {
    if (cardBox) {
      cardBox.classList.remove('border-slate-200', 'dark:border-slate-800');
      cardBox.classList.add('border-red-600', 'dark:border-red-500');
    }
    if (formCard) formCard.classList.remove('hidden');
    if (payBtn) {
      payBtn.className = 'px-8 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-lg shadow-red-600/30 cursor-pointer';
    }
    if (payBtnText) payBtnText.textContent = `🔒 Pagar Ahora ${totalFormatted}`;
  } else if (method === 'nequi') {
    if (nequiBox) {
      nequiBox.classList.remove('border-slate-200', 'dark:border-slate-800');
      nequiBox.classList.add('border-purple-600', 'dark:border-purple-500');
    }
    if (formNequi) formNequi.classList.remove('hidden');
    if (payBtn) {
      payBtn.className = 'px-8 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-lg shadow-purple-600/30 cursor-pointer';
    }
    if (payBtnText) payBtnText.textContent = `🟣 Solicitar Débito Nequi (${totalFormatted})`;
  } else if (method === 'cash') {
    if (cashBox) {
      cashBox.classList.remove('border-slate-200', 'dark:border-slate-800');
      cashBox.classList.add('border-amber-600', 'dark:border-amber-500');
    }
    if (formCash) formCash.classList.remove('hidden');
    if (payBtn) {
      payBtn.className = 'px-8 py-3.5 bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-lg shadow-amber-600/30 cursor-pointer';
    }
    if (payBtnText) payBtnText.textContent = `🛵 Confirmar Pedido Contra Entrega`;
  }
  lucide.createIcons();
}

// Formateo de número de tarjeta con detección automática Visa / Mastercard
function formatCardNumber(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 16);
  let parts = v.match(/.{1,4}/g) || [];
  input.value = parts.join(' ');
  const brandIcon = document.getElementById('card-brand-icon');
  if (brandIcon) {
    if (v.startsWith('4')) {
      brandIcon.textContent = 'VISA';
      brandIcon.className = 'absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-blue-600 font-mono tracking-wider';
    } else if (/^5[1-5]/.test(v) || /^2[2-7]/.test(v)) {
      brandIcon.textContent = 'MC';
      brandIcon.className = 'absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-amber-600 font-mono tracking-wider';
    } else {
      brandIcon.textContent = '💳';
      brandIcon.className = 'absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono';
    }
  }
}

// Formateo de fecha de expiración MM/AA
function formatExpiry(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 4);
  if (v.length >= 2) {
    input.value = v.slice(0, 2) + '/' + v.slice(2);
  } else {
    input.value = v;
  }
}

// Procesamiento interactivo del pago seguro (Animación estilo Temu & Tipti)
async function processPaymentAndConfirm() {
  const methodRadio = document.querySelector('input[name="payment-method-type"]:checked');
  const method = methodRadio ? methodRadio.value : 'card';

  // Validaciones del cliente según método seleccionado
  if (method === 'card') {
    const cardNum = document.getElementById('card-number')?.value.replace(/\s+/g, '') || '';
    const cardHolder = document.getElementById('card-holder')?.value.trim() || '';
    const cardExpiry = document.getElementById('card-expiry')?.value.trim() || '';
    const cardCvv = document.getElementById('card-cvv')?.value.trim() || '';

    if (cardNum.length < 13) {
      showToast('⚠️ Ingresa un número de tarjeta válido (16 dígitos)');
      document.getElementById('card-number')?.focus();
      return;
    }
    if (!cardHolder) {
      showToast('⚠️ Ingresa el nombre del titular como figura en la tarjeta');
      document.getElementById('card-holder')?.focus();
      return;
    }
    if (!cardExpiry || cardExpiry.length < 4) {
      showToast('⚠️ Ingresa una fecha de expiración válida (MM/AA)');
      document.getElementById('card-expiry')?.focus();
      return;
    }
    if (cardCvv.length < 3) {
      showToast('⚠️ Ingresa el código CVV de seguridad (3 o 4 dígitos)');
      document.getElementById('card-cvv')?.focus();
      return;
    }
  } else if (method === 'nequi') {
    const nequiPhone = document.getElementById('nequi-phone-input')?.value.replace(/\D/g, '') || '';
    if (nequiPhone.length < 10) {
      showToast('⚠️ Ingresa un número de celular Nequi válido (10 dígitos)');
      document.getElementById('nequi-phone-input')?.focus();
      return;
    }
  }

  // Activar pantalla de procesamiento segura con animación estilo Temu / Tipti
  const overlay = document.getElementById('payment-processing-overlay');
  const statusText = document.getElementById('processing-status-text');
  if (overlay) overlay.classList.remove('hidden');

  if (statusText) {
    statusText.textContent = 'Validando pasarela segura y encriptación SSL 256-bit...';
  }

  await new Promise(r => setTimeout(r, 600));
  if (statusText) {
    if (method === 'card') {
      statusText.textContent = 'Verificando con la red bancaria y autorizando fondos...';
    } else if (method === 'nequi') {
      statusText.textContent = 'Enviando solicitud de débito instantáneo a tu App Nequi...';
    } else {
      statusText.textContent = 'Programando despacho contra entrega y asignando repartidor...';
    }
  }

  await new Promise(r => setTimeout(r, 700));
  if (statusText) {
    statusText.textContent = '¡Pago procesado con éxito! Generando comprobante fiscal...';
  }
  await new Promise(r => setTimeout(r, 500));

  if (overlay) overlay.classList.add('hidden');

  // Generación de códigos únicos de orden y autorización
  const orderNumber = 'ORD-ECONOMAX-' + Math.floor(1000 + Math.random() * 9000);
  const authCode = 'AUTH-' + Math.floor(100000 + Math.random() * 900000);
  const subtotal = state.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const totalFormatted = formatPrice(subtotal);

  const name = document.getElementById('checkout-name')?.value || 'Cliente';
  const phone = document.getElementById('checkout-phone')?.value || 'No indicado';
  const address = document.getElementById('checkout-address')?.value || 'Pasto';
  const barrio = document.getElementById('checkout-barrio')?.value || 'Juanoy Bajo';
  const notes = document.getElementById('checkout-notes')?.value || '';

  // Actualizar UI del paso 3 (Confirmación y Live Tracking)
  const orderNumEl = document.getElementById('confirmed-order-number');
  const authCodeEl = document.getElementById('confirmed-auth-code');
  const badgeTextEl = document.getElementById('confirmed-badge-text');
  const trackingLabelEl = document.getElementById('tracking-payment-label');

  if (orderNumEl) orderNumEl.textContent = orderNumber;
  if (authCodeEl) authCodeEl.textContent = authCode;

  let paymentMethodLabel = 'Tarjeta Crédito/Débito';
  let paymentStatus = 'Pagado / En Preparación';

  if (method === 'card') {
    paymentMethodLabel = 'Tarjeta Bancaria';
    if (badgeTextEl) badgeTextEl.textContent = '¡PAGO APROBADO CON ÉXITO!';
    if (trackingLabelEl) trackingLabelEl.textContent = `Aprobado por franquicia (${authCode})`;
  } else if (method === 'nequi') {
    paymentMethodLabel = 'Nequi en Línea';
    if (badgeTextEl) badgeTextEl.textContent = '¡DÉBITO NEQUI CONFIRMADO!';
    if (trackingLabelEl) trackingLabelEl.textContent = `Transferencia Nequi exitosa (${authCode})`;
  } else if (method === 'cash') {
    const changeVal = document.getElementById('cash-change-amount')?.value || 'exacto';
    const changeText = changeVal === 'exacto' ? 'Pago exacto' : `Paga con $${Number(changeVal).toLocaleString('es-CO')} COP`;
    paymentMethodLabel = `Contra Entrega Efectivo (${changeText})`;
    paymentStatus = 'Pendiente (Contra Entrega)';
    if (badgeTextEl) badgeTextEl.textContent = '¡PEDIDO REGISTRADO (CONTRA ENTREGA)!';
    if (trackingLabelEl) trackingLabelEl.textContent = `Se pagará al repartidor en tu puerta (${changeText})`;
  }

  // Registrar pedido en el backend y en localStorage para admin.html
  const orderData = {
    id: orderNumber,
    authCode: authCode,
    date: 'Hoy, ' + new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    customer: name,
    email: phone,
    phone: phone,
    address: `${address} - B. ${barrio}` + (notes ? ` (${notes})` : ''),
    items: state.cart.map(i => `${i.quantity}x ${i.name}`).join(', '),
    total: subtotal,
    payment: paymentMethodLabel,
    status: paymentStatus
  };

  try {
    const adminOrders = JSON.parse(localStorage.getItem('economax_admin_orders')) || [];
    adminOrders.unshift(orderData);
    localStorage.setItem('economax_admin_orders', JSON.stringify(adminOrders));

    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    }).catch(e => console.log('Sincronizando orden:', e));
  } catch (e) {}

  // Pasar visualmente a Step 3
  const step1 = document.getElementById('checkout-step-1');
  const step2 = document.getElementById('checkout-step-2');
  const step3 = document.getElementById('checkout-step-3');
  const dots = document.querySelectorAll('.checkout-step-dot');

  if (step1) step1.classList.add('hidden');
  if (step2) step2.classList.add('hidden');
  if (step3) step3.classList.remove('hidden');

  dots.forEach((dot) => {
    dot.classList.add('bg-red-600', 'text-white');
    dot.classList.remove('bg-slate-200', 'text-slate-600', 'dark:bg-slate-700', 'dark:text-slate-400');
  });

  // Vaciar carrito
  state.cart = [];
  updateCartUI();

  showToast(`🎉 ¡Pedido ${orderNumber} confirmado con éxito!`);
  lucide.createIcons();
}

// Asignaciones globales seguras
window.openCheckoutModal = openCheckoutModal;
window.closeCheckoutModal = closeCheckoutModal;
window.setCheckoutStep = setCheckoutStep;
window.togglePaymentMethodUI = togglePaymentMethodUI;
window.formatCardNumber = formatCardNumber;
window.formatExpiry = formatExpiry;
window.processPaymentAndConfirm = processPaymentAndConfirm;

// Toast Notifications
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'glass px-4 py-3 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 text-sm font-medium flex items-center gap-3 animate-fade-in pointer-events-auto';
  toast.innerHTML = `
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// Temporizador interactivo de Oferta Flash
function initCountdownTimer() {
  let timeLeft = (5 * 3600) + (42 * 60) + 18; // 05h 42m 18s

  setInterval(() => {
    if (timeLeft <= 0) timeLeft = 24 * 3600;
    timeLeft--;

    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;

    const elH = document.getElementById('timer-hours');
    const elM = document.getElementById('timer-minutes');
    const elS = document.getElementById('timer-seconds');

    if (elH) elH.textContent = String(hours).padStart(2, '0');
    if (elM) elM.textContent = String(minutes).padStart(2, '0');
    if (elS) elS.textContent = String(seconds).padStart(2, '0');
  }, 1000);
}

// Escuchadores de eventos
function setupEventListeners() {
  // Toggle de tema
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Selector de moneda
  const currencySelector = document.getElementById('currency-selector');
  if (currencySelector) {
    currencySelector.addEventListener('change', (e) => {
      state.currency = e.target.value;
      renderProducts();
      updateCartUI();
      showToast(`Moneda cambiada a ${state.currency}`);
    });
  }

  // Filtros de categoría
  const categoryTabs = document.querySelectorAll('[data-category]');
  categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const cat = tab.getAttribute('data-category');
      selectCategoryFilter(cat, false);
    });
  });

  // Selector de orden
  const sortSelect = document.getElementById('sort-selector');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.activeSort = e.target.value;
      renderProducts();
    });
  }

  // Búsqueda en vivo con renderProducts reactivo
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase().trim();
      renderProducts();
    });
  }

  // Newsletter
  const newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('newsletter-email');
      if (emailInput && emailInput.value) {
        showToast('✉️ ¡Gracias por suscribirte! Te notificaremos de nuevos lanzamientos.');
        emailInput.value = '';
      }
    });
  }

  // Copiar código promocional
  const promoCopyBtn = document.getElementById('copy-promo-btn');
  if (promoCopyBtn) {
    promoCopyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText('DISENO2026');
      showToast('📋 Código DISENO2026 copiado al portapapeles');
    });
  }

  // Menú móvil
  const mobileBtn = document.getElementById('mobile-menu-btn');
  if (mobileBtn) {
    mobileBtn.addEventListener('click', toggleMobileMenu);
  }
}

// Alternar visibilidad del menú móvil
function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  if (menu) {
    menu.classList.toggle('hidden');
  }
}

// Filtro interactivo por categoría (llamado desde tarjetas y pestañas)
function selectCategoryFilter(category, scroll = false) {
  const normCat = normalizeCategorySlug(category);
  state.activeCategory = normCat;

  const categoryTabs = document.querySelectorAll('[data-category]');
  categoryTabs.forEach(t => {
    const catAttr = t.getAttribute('data-category');
    const tabNorm = normalizeCategorySlug(catAttr);
    if (tabNorm === normCat) {
      t.classList.remove('bg-slate-100', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300');
      t.classList.add('bg-red-600', 'text-white', 'shadow-md');
    } else {
      t.classList.remove('bg-red-600', 'text-white', 'shadow-md');
      t.classList.add('bg-slate-100', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300');
    }
  });

  renderProducts();

  if (scroll) {
    const catalogoEl = document.getElementById('catalogo');
    if (catalogoEl) {
      catalogoEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const catLabels = {
    all: 'Todo el catálogo',
    canasta: '🥫 Canasta Familiar',
    snacks: '🍿 Snacks & Dulces',
    bebidas: '🥤 Bebidas',
    aseo: '🧼 Aseo & Limpieza',
    cocina: '🍳 Utensilios de Cocina',
    ropa: '👕 Prendas de Vestir',
    ferreteria: '🔧 Ferretería & Variedades'
  };
  const count = document.querySelectorAll('#products-grid > div').length;
  if (catLabels[normCat]) {
    showToast(`${catLabels[normCat]} (${count} productos)`);
  }
}


