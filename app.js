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
    const nequiAmountEl = document.getElementById('nequi-amount-display');
    if (nequiAmountEl) nequiAmountEl.textContent = formatPrice(subtotal);

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

  // Controlar visibilidad del footer fijo según el paso activo
  const footerEl = document.getElementById('checkout-modal-footer');
  const footerStep1 = document.getElementById('footer-actions-step-1');
  const footerStep2 = document.getElementById('footer-actions-step-2');
  
  if (footerEl) {
    if (step === 3) {
      footerEl.classList.add('hidden'); // En el paso 3 de confirmación se oculta el footer
    } else {
      footerEl.classList.remove('hidden');
    }
  }
  if (footerStep1) footerStep1.classList.toggle('hidden', step !== 1);
  if (footerStep2) footerStep2.classList.toggle('hidden', step !== 2);
  
  // Regresar el scroll al inicio en cada paso
  const scrollArea = document.getElementById('checkout-steps-scroll-area');
  if (scrollArea) scrollArea.scrollTop = 0;

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


// ==================== CAMINO 2: NEQUI DIRECTO CON COMPROBANTE ====================
let currentReceiptBase64 = null;
let currentReceiptFileName = '';

function copyNequiNumber() {
  const number = '3004720904';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(number).then(() => {
      showToast('📋 ¡Número Nequi copiado: 300 472 0904!');
    }).catch(() => {
      prompt('Copia el número Nequi:', '3004720904');
    });
  } else {
    prompt('Copia el número Nequi:', '3004720904');
  }
}

function compressReceiptImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        const maxDim = 1200;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleReceiptFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  showToast('📸 Procesando comprobante...');
  try {
    const compressed = await compressReceiptImage(file);
    currentReceiptBase64 = compressed;
    currentReceiptFileName = file.name || 'comprobante.jpg';

    const emptyBox = document.getElementById('receipt-empty-state');
    const previewBox = document.getElementById('receipt-preview-state');
    const previewImg = document.getElementById('receipt-preview-img');
    const filenameEl = document.getElementById('receipt-filename');

    if (previewImg) previewImg.src = compressed;
    if (filenameEl) filenameEl.textContent = currentReceiptFileName;
    if (emptyBox) emptyBox.classList.add('hidden');
    if (previewBox) previewBox.classList.remove('hidden');

    showToast('✅ Comprobante adjuntado');
    lucide.createIcons();
  } catch (e) {
    console.error('Error con comprobante:', e);
    showToast('⚠️ No se pudo procesar la imagen');
  }
}

function clearReceiptFile() {
  currentReceiptBase64 = null;
  currentReceiptFileName = '';
  const input = document.getElementById('nequi-receipt-input');
  if (input) input.value = '';
  const emptyBox = document.getElementById('receipt-empty-state');
  const previewBox = document.getElementById('receipt-preview-state');
  if (emptyBox) emptyBox.classList.remove('hidden');
  if (previewBox) previewBox.classList.add('hidden');
  lucide.createIcons();
}

// Selector y conmutador visual de métodos de pago (Nequi Directo y Contra Entrega)
function togglePaymentMethodUI(method) {
  const nequiBox = document.getElementById('nequi-option-box');
  const cashBox = document.getElementById('cash-option-box');

  const formNequi = document.getElementById('payment-form-nequi');
  const formCash = document.getElementById('payment-form-cash');

  const payBtn = document.getElementById('pay-now-btn');
  const payBtnText = document.getElementById('pay-now-btn-text');
  const subtotal = state.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const totalFormatted = formatPrice(subtotal);

  const radio = document.querySelector(`input[name="payment-method-type"][value="${method}"]`);
  if (radio) radio.checked = true;

  [nequiBox, cashBox].forEach(b => {
    if (b) {
      b.classList.remove('border-purple-600', 'border-amber-600', 'dark:border-purple-500', 'dark:border-amber-500', 'shadow-sm');
      b.classList.add('border-slate-200', 'dark:border-slate-800');
    }
  });

  if (formNequi) formNequi.classList.add('hidden');
  if (formCash) formCash.classList.add('hidden');

  if (method === 'nequi') {
    if (nequiBox) {
      nequiBox.classList.remove('border-slate-200', 'dark:border-slate-800');
      nequiBox.classList.add('border-purple-600', 'dark:border-purple-500', 'shadow-sm');
    }
    if (formNequi) formNequi.classList.remove('hidden');
    if (payBtn) {
      payBtn.className = 'flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold text-xs sm:text-sm text-white flex items-center justify-center gap-2 shadow-lg cursor-pointer transition active:scale-95';
      payBtn.setAttribute('style', 'background-color: #4a005f !important; background: linear-gradient(135deg, #2b0038 0%, #6a0080 100%) !important; color: #ffffff !important; box-shadow: 0 4px 14px 0 rgba(74, 0, 95, 0.4) !important;');
    }
    const iconEl = document.getElementById('pay-now-btn-icon');
    if (iconEl) iconEl.textContent = '📱';
    if (payBtnText) payBtnText.textContent = `Confirmar Pedido con Nequi (${totalFormatted})`;
    
    // Actualizar valor exacto a transferir en la tarjeta de Nequi
    const amountEl = document.getElementById('nequi-amount-display');
    if (amountEl) amountEl.textContent = totalFormatted;
  } else if (method === 'cash') {
    if (cashBox) {
      cashBox.classList.remove('border-slate-200', 'dark:border-slate-800');
      cashBox.classList.add('border-amber-600', 'dark:border-amber-500', 'shadow-sm');
    }
    if (formCash) formCash.classList.remove('hidden');
    if (payBtn) {
      payBtn.className = 'flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold text-xs sm:text-sm text-white flex items-center justify-center gap-2 shadow-lg cursor-pointer transition active:scale-95';
      payBtn.setAttribute('style', 'background-color: #059669 !important; background: linear-gradient(135deg, #10b981 0%, #047857 100%) !important; color: #ffffff !important; box-shadow: 0 4px 14px 0 rgba(5, 150, 105, 0.4) !important;');
    }
    const iconEl = document.getElementById('pay-now-btn-icon');
    if (iconEl) iconEl.textContent = '🛵';
    if (payBtnText) payBtnText.textContent = 'Confirmar Pedido Contra Entrega';
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

// Procesamiento de pedidos Camino 2: Nequi Directo con Comprobante y Contra Entrega
async function processPaymentAndConfirm() {
  const methodRadio = document.querySelector('input[name="payment-method-type"]:checked');
  const method = methodRadio ? methodRadio.value : 'nequi';

  const nequiRef = document.getElementById('nequi-ref-input')?.value.trim() || '';

  // Validación: Si es Nequi, exigir comprobante o referencia para que Doña Angela pueda verificar
  if (method === 'nequi' && !currentReceiptBase64 && !nequiRef) {
    showToast('⚠️ Por favor adjunta la foto de tu comprobante o escribe la referencia de tu transferencia');
    const box = document.getElementById('receipt-upload-box');
    if (box) {
      box.classList.add('ring-2', 'ring-purple-500', 'animate-pulse');
      setTimeout(() => box.classList.remove('ring-2', 'ring-purple-500', 'animate-pulse'), 2000);
    }
    return;
  }

  // Activar pantalla de procesamiento rápida
  const overlay = document.getElementById('payment-processing-overlay');
  const statusText = document.getElementById('processing-status-text');
  if (overlay) overlay.classList.remove('hidden');

  if (statusText) {
    statusText.textContent = method === 'nequi' 
      ? 'Registrando comprobante y enviando datos a Tienda ECONOMAX...' 
      : 'Programando despacho contra entrega con el repartidor...';
  }

  // Si hay foto de comprobante, intentar subirla a la nube permanente (/api/upload)
  let uploadedReceiptUrl = null;
  if (currentReceiptBase64) {
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: currentReceiptBase64 })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.url) {
          uploadedReceiptUrl = data.url;
        }
      }
    } catch (e) {
      console.warn('Subiendo comprobante localmente:', e);
    }
  }

  await new Promise(r => setTimeout(r, 600));
  if (overlay) overlay.classList.add('hidden');

  // Generación de códigos únicos de orden
  const orderNumber = 'ORD-ECONOMAX-' + Math.floor(1000 + Math.random() * 9000);
  const authCode = nequiRef || ('NEQUI-' + Math.floor(100000 + Math.random() * 900000));
  const subtotal = state.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const totalFormatted = formatPrice(subtotal);

  const name = document.getElementById('checkout-name')?.value || 'Cliente';
  const phone = document.getElementById('checkout-phone')?.value || 'No indicado';
  const address = document.getElementById('checkout-address')?.value || 'Pasto';
  const barrio = document.getElementById('checkout-barrio')?.value || 'Juanoy Bajo';
  const notes = document.getElementById('checkout-notes')?.value || '';

  // Actualizar UI del paso 3 (Confirmación)
  const orderNumEl = document.getElementById('confirmed-order-number');
  const authCodeEl = document.getElementById('confirmed-auth-code');
  const badgeTextEl = document.getElementById('confirmed-badge-text');
  const trackingLabelEl = document.getElementById('tracking-payment-label');

  if (orderNumEl) orderNumEl.textContent = orderNumber;
  if (authCodeEl) authCodeEl.textContent = authCode;

  let paymentMethodLabel = 'Transferencia Nequi Directa';
  let paymentStatus = 'Pendiente por verificar comprobante';

  if (method === 'nequi') {
    paymentMethodLabel = 'Nequi Directo (300 472 0904)';
    paymentStatus = 'Pendiente por verificar comprobante';
    if (badgeTextEl) badgeTextEl.textContent = '🟡 COMPROBANTE ENVIADO - POR VERIFICAR';
    if (trackingLabelEl) trackingLabelEl.textContent = 'Doña Angela verificará tu comprobante en su app Nequi y despachará';
  } else if (method === 'cash') {
    const changeVal = document.getElementById('cash-change-amount')?.value || 'exacto';
    const changeText = changeVal === 'exacto' ? 'Pago exacto' : `Paga con ${Number(changeVal).toLocaleString('es-CO')} COP`;
    paymentMethodLabel = `Contra Entrega Efectivo (${changeText})`;
    paymentStatus = 'Pendiente (Contra Entrega)';
    if (badgeTextEl) badgeTextEl.textContent = '🟢 PEDIDO REGISTRADO (CONTRA ENTREGA)';
    if (trackingLabelEl) trackingLabelEl.textContent = `Se pagará al repartidor en tu puerta (${changeText})`;
  }

  // Registrar pedido en el backend y en localStorage para admin.html con foto del comprobante
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
    status: paymentStatus,
    receiptUrl: uploadedReceiptUrl || currentReceiptBase64 || null,
    receiptRef: nequiRef || null
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

  // Limpiar carrito y comprobante temporal
  state.cart = [];
  currentReceiptBase64 = null;
  currentReceiptFileName = '';
  updateCartUI();

  showToast(`🎉 ¡Pedido ${orderNumber} registrado con éxito!`);
  lucide.createIcons();
}

// Asignaciones globales seguras
window.openCheckoutModal = openCheckoutModal;
window.closeCheckoutModal = closeCheckoutModal;
window.setCheckoutStep = setCheckoutStep;
window.togglePaymentMethodUI = togglePaymentMethodUI;
window.formatCardNumber = formatCardNumber;
window.formatExpiry = formatExpiry;
window.copyNequiNumber = copyNequiNumber;
window.handleReceiptFileSelect = handleReceiptFileSelect;
window.clearReceiptFile = clearReceiptFile;
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


