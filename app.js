/**
 * BẾP NHÀ LÀM - GIÒ CHẢ & THỰC PHẨM SẠCH GIA TRUYỀN
 * Vanilla JS Application Logic & Interactive Features
 */

// ==========================================
// 1. CẤU HÌNH CỬA HÀNG & SẢN PHẨM (CLOUD FIRESTORE)
// ==========================================
// Toàn bộ thông tin cửa hàng và sản phẩm được đồng bộ thời gian thực từ Cloud Firestore
let SHOP_CONFIG = {};
let activeProducts = [];

// Format số sang VND
function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Format số thường không có ký hiệu đ
function formatNumber(num) {
  return new Intl.NumberFormat('vi-VN').format(num) + 'đ';
}

// ==========================================
// 3. KHỞI TẠO DOM & EVENTS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  renderLoadingState();
  setupCategoryFilters();
  setupSearchFilter();
  setupViewToggle();
  setupFaqAccordion();
  setupMobileMenu();
  setupBackToTop();
  initFirebaseClientSync();
});

// Hiển thị trạng thái đang tải dữ liệu
function renderLoadingState() {
  const gridContainer = document.getElementById('products-grid-container');
  if (gridContainer) {
    gridContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 2.2rem; color: var(--primary); margin-bottom: 14px; display: block;"></i>
        <p style="font-size: 1.05rem; font-weight: 600; color: var(--text-main);">Đang tải thực đơn tươi mới...</p>
        <span style="font-size: 0.85rem; color: var(--text-muted);">Vui lòng chờ trong giây lát.</span>
      </div>
    `;
  }

  const tableBody = document.getElementById('price-table-body');
  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
          <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--primary); margin-bottom: 8px;"></i>
          <div>Đang tải bảng giá...</div>
        </td>
      </tr>
    `;
  }
}

// Đồng bộ sản phẩm và Cài đặt cửa hàng từ Firebase Firestore theo thời gian thực (Realtime)
function initFirebaseClientSync() {
  const services = initFirebaseServices();
  if (!services || !services.db) {
    console.warn("[Firebase Sync] Chưa kết nối được Firestore. Vui lòng kiểm tra lại cấu hình.");
    showConnectionError("Không thể kết nối dịch vụ Firebase. Vui lòng thử tải lại trang.");
    return;
  }

  // 1. Đồng bộ Danh sách món ăn
  services.db.collection('products').onSnapshot(snapshot => {
    if (!snapshot.empty) {
      const items = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() });
      });
      // Chỉ hiển thị các món đang mở bán / không bị tạm ẩn (isActive !== false)
      activeProducts = items.filter(p => p.isActive !== false);
      applyFilters();
      console.log(`[Firebase Sync] Đã đồng bộ thành công ${activeProducts.length} món ăn đang mở bán từ Cloud Firestore!`);
    } else {
      activeProducts = [];
      applyFilters();
    }
  }, error => {
    console.error("[Firebase Sync] Lỗi tải dữ liệu từ Firestore:", error);
    const gridContainer = document.getElementById('products-grid-container');
    if (gridContainer) {
      gridContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: var(--text-muted);">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; color: var(--accent); margin-bottom: 10px; display: block;"></i>
          <p style="font-size: 1rem; font-weight: 600;">Không thể kết nối đến cơ sở dữ liệu.</p>
          <span style="font-size: 0.85rem;">Vui lòng kiểm tra kết nối mạng hoặc thử tải lại trang.</span>
        </div>
      `;
    }
  });

  // 2. Đồng bộ Cấu hình Cửa hàng (Hotline, Zalo, Địa chỉ...)
  services.db.collection('settings').doc('shop').onSnapshot(doc => {
    if (doc.exists) {
      const data = doc.data();
      SHOP_CONFIG = { ...SHOP_CONFIG, ...data };
      applyShopConfigUI(SHOP_CONFIG);
      console.log("[Firebase Sync] Đã cập nhật Cấu hình Cửa Hàng từ Cloud Firestore!");
    }
  }, error => {
    console.warn("[Firebase Sync] Không tải được cấu hình shop, dùng mặc định:", error);
  });
}

// Cập nhật thông tin cửa hàng ra giao diện
function applyShopConfigUI(config) {
  if (!config) return;

  // 1. Tên thương hiệu & Cửa hàng
  if (config.shopName) {
    document.querySelectorAll('.shop-name-text').forEach(el => {
      el.textContent = config.shopName;
    });
    document.title = `${config.shopName} - Bảng Báo Giá Giò Chả, Xúc Xích & Thực Phẩm Sạch Gia Truyền`;
    document.querySelectorAll('.shop-copyright-text').forEach(el => {
      el.textContent = `© 2026 ${config.shopName} - Giò Chả & Thịt Lợn Tươi Sạch Gia Truyền. Toàn bộ hình ảnh & công thức thuộc bản quyền nhà làm.`;
    });
  }

  // 2. Khẩu hiệu / Slogan phụ đề
  if (config.slogan) {
    document.querySelectorAll('.shop-slogan-text').forEach(el => {
      el.textContent = config.slogan;
    });
  }

  // 3. Thông báo đầu trang (Announcement Bar)
  if (config.announcement) {
    document.querySelectorAll('.shop-announcement-text').forEach(el => {
      el.textContent = config.announcement;
    });
  }

  // 4. Huy hiệu ưu đãi ngắn
  if (config.announcementBadge) {
    document.querySelectorAll('.shop-badge-text').forEach(el => {
      el.textContent = config.announcementBadge;
    });
  }

  // 5. Số điện thoại Hotline
  if (config.hotline) {
    document.querySelectorAll('.shop-hotline-text').forEach(el => {
      el.textContent = config.hotline;
    });
  }
  if (config.hotlineRaw || config.hotline) {
    const raw = config.hotlineRaw || config.hotline.replace(/\D/g, '');
    document.querySelectorAll('.shop-hotline-link').forEach(el => {
      el.href = `tel:${raw}`;
    });
  }

  // 6. Số điện thoại Zalo
  if (config.zaloPhone || config.hotline) {
    const zalo = config.zaloPhone || config.hotline.replace(/\D/g, '');
    document.querySelectorAll('.shop-zalo-text').forEach(el => {
      el.textContent = config.zaloPhone || config.hotline;
    });
    document.querySelectorAll('.shop-zalo-link').forEach(el => {
      el.href = `https://zalo.me/${zalo}`;
    });
  }

  // 7. Link Fanpage Facebook
  if (config.facebookUrl) {
    document.querySelectorAll('.shop-facebook-link').forEach(el => {
      el.href = config.facebookUrl;
    });
  }

  // 8. Địa chỉ lò làm / cửa hàng
  if (config.address) {
    document.querySelectorAll('.shop-address-text').forEach(el => {
      el.textContent = config.address;
    });
  }

  // 9. Bản đồ Google Maps & Chỉ đường
  const mapIframe = document.getElementById('shop-map-iframe');
  const { embedUrl, directUrl } = parseGoogleMapUrl(config.mapUrl, config.address);

  if (mapIframe && embedUrl) {
    mapIframe.src = embedUrl;
  }
  document.querySelectorAll('.shop-map-link').forEach(el => {
    el.href = directUrl;
  });

  // 10. Giờ phục vụ / Mở cửa
  if (config.openHours) {
    document.querySelectorAll('.shop-hours-text').forEach(el => {
      el.textContent = config.openHours;
    });
  }

  // 11. Ghi chú giao hàng
  if (config.shipNote) {
    document.querySelectorAll('.shop-ship-text').forEach(el => {
      el.textContent = config.shipNote;
    });
  }

  // 12. Chế độ Bảo Trì / Tạm ngưng phục vụ (Maintenance Mode)
  const maintenanceOverlay = document.getElementById('maintenance-overlay');
  if (maintenanceOverlay) {
    if (config.isMaintenance === true) {
      document.body.classList.add('in-maintenance');
      maintenanceOverlay.style.display = 'flex';

      const titleEl = document.getElementById('maintenance-title');
      const msgEl = document.getElementById('maintenance-message');
      const expWrap = document.getElementById('maintenance-expected-wrap');
      const expText = document.getElementById('maintenance-expected-text');

      if (titleEl) {
        titleEl.textContent = config.maintenanceTitle || 'Bếp Đang Tạm Nghỉ Nâng Cấp';
      }
      if (msgEl) {
        msgEl.textContent = config.maintenanceMessage || 'Bếp nhà em xin phép tạm ngưng nhận đơn online ít ngày để nâng cấp máy móc và nhập đợt nguyên liệu tươi mới. Kính mong Quý khách thông cảm và quay lại sau!';
      }
      if (expWrap && expText) {
        if (config.maintenanceExpectedTime && config.maintenanceExpectedTime.trim()) {
          expText.textContent = config.maintenanceExpectedTime;
          expWrap.style.display = 'inline-flex';
        } else {
          expWrap.style.display = 'none';
        }
      }
    } else {
      document.body.classList.remove('in-maintenance');
      maintenanceOverlay.style.display = 'none';
    }
  }
}

// Hàm chuẩn hóa và phân tích URL Google Maps để hiển thị Marker đỏ chính xác
function parseGoogleMapUrl(mapUrl, fallbackAddress) {
  const address = (fallbackAddress || "Hà Nội").trim();
  let directUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  let embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&hl=vi&z=16&output=embed`;

  if (!mapUrl || !mapUrl.trim()) {
    return { embedUrl, directUrl };
  }

  const raw = mapUrl.trim();

  // 1. Thẻ <iframe>: <iframe src="https://www.google.com/maps/embed?..."></iframe>
  const iframeMatch = raw.match(/src=["'](.*?)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    return { embedUrl: iframeMatch[1], directUrl };
  }

  // 2. Link embed chuẩn: https://www.google.com/maps/embed?pb=... hoặc có output=embed
  if (raw.includes('/maps/embed') || raw.includes('output=embed')) {
    return { embedUrl: raw, directUrl };
  }

  // 3. Link Google Maps Place (VD: https://www.google.com/maps/place/Tên+Quán/@21.028511,105.854167,17z/...)
  if (raw.includes('/maps/place/')) {
    const coordMatch = raw.match(/@([0-9.-]+),([0-9.-]+)/);
    const placeMatch = raw.match(/\/maps\/place\/([^/@?]+)/i);
    const placeName = placeMatch ? decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')) : address;

    if (coordMatch) {
      return {
        embedUrl: `https://maps.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}+(${encodeURIComponent(placeName)})&hl=vi&z=16&output=embed`,
        directUrl: raw
      };
    } else {
      return {
        embedUrl: `https://maps.google.com/maps?q=${encodeURIComponent(placeName)}&hl=vi&z=16&output=embed`,
        directUrl: raw
      };
    }
  }

  // 4. Link có toạ độ @lat,lng bất kỳ
  const anyCoordMatch = raw.match(/@([0-9.-]+),([0-9.-]+)/);
  if (anyCoordMatch) {
    return {
      embedUrl: `https://maps.google.com/maps?q=${anyCoordMatch[1]},${anyCoordMatch[2]}&hl=vi&z=16&output=embed`,
      directUrl: raw
    };
  }

  // 5. Link chứa tham số q= (VD: https://maps.google.com/?q=21.028511,105.854167 hoặc ?q=Địa+chỉ)
  const qMatch = raw.match(/[?&]q=([^&]+)/i);
  if (qMatch && qMatch[1]) {
    return {
      embedUrl: `https://maps.google.com/maps?q=${qMatch[1]}&hl=vi&z=16&output=embed`,
      directUrl: raw
    };
  }

  // 6. Nhập toạ độ thuần: 21.028511, 105.854167
  const pureCoords = raw.match(/^([0-9.-]+)\s*,\s*([0-9.-]+)$/);
  if (pureCoords) {
    const lat = pureCoords[1];
    const lng = pureCoords[2];
    return {
      embedUrl: `https://maps.google.com/maps?q=${lat},${lng}&hl=vi&z=16&output=embed`,
      directUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    };
  }

  // 7. Link rút gọn (maps.app.goo.gl hoặc goo.gl/maps)
  if (raw.includes('maps.app.goo.gl') || raw.includes('goo.gl/maps')) {
    return {
      embedUrl: `https://maps.google.com/maps?q=${encodeURIComponent(address)}&hl=vi&z=16&output=embed`,
      directUrl: raw
    };
  }

  // 8. Trường hợp còn lại (link web khác hoặc chuỗi địa chỉ)
  if (raw.startsWith('http')) {
    return {
      embedUrl: `https://maps.google.com/maps?q=${encodeURIComponent(address)}&hl=vi&z=16&output=embed`,
      directUrl: raw
    };
  } else {
    return {
      embedUrl: `https://maps.google.com/maps?q=${encodeURIComponent(raw)}&hl=vi&z=16&output=embed`,
      directUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw)}`
    };
  }
}

function showConnectionError(msg) {
  const gridContainer = document.getElementById('products-grid-container');
  if (gridContainer) {
    gridContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: var(--text-muted);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; color: var(--accent); margin-bottom: 10px; display: block;"></i>
        <p style="font-size: 1rem; font-weight: 600;">${escapeHtml(msg)}</p>
        <span style="font-size: 0.85rem;">Vui lòng kiểm tra lại cấu hình hoặc tải lại trang.</span>
      </div>
    `;
  }
}

// Hàm lọc ký tự đặc biệt chống tấn công XSS (Cross-Site Scripting)
function escapeHtml(text) {
  if (typeof text !== 'string') return text ?? '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Render danh sách sản phẩm dạng Thẻ Grid
function renderProductGrid(items) {
  const container = document.getElementById('products-grid-container');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: var(--text-muted);">
        <i class="fa-solid fa-bowl-food" style="font-size: 2.5rem; color: var(--border-subtle); margin-bottom: 12px; display: block;"></i>
        <p style="font-size: 1.1rem; font-weight: 600;">Không tìm thấy sản phẩm phù hợp.</p>
        <span style="font-size: 0.9rem;">Vui lòng thử tìm với từ khóa khác hoặc bấm xem 'Tất Cả'.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(item => {
    const isOutOfStock = item.inStock === false;
    const safeName = escapeHtml(item.name);
    const safeDesc = escapeHtml(item.desc || '');
    const safeCategory = escapeHtml(item.categoryName || 'Món Gia Truyền');
    const safeTag = item.tag ? escapeHtml(item.tag) : '';
    const safeUnit = escapeHtml(item.unit || 'kg');
    const safeImage = escapeHtml(item.image || 'assets/images/gio_lua.jpg');
    const hasPrice = item.price && item.price > 0;
    const hasWholesale = item.wholesalePrice && item.wholesalePrice > 0;

    return `
    <article class="product-card ${isOutOfStock ? 'is-out-of-stock' : ''}" data-id="${item.id}" style="${isOutOfStock ? 'opacity: 0.85;' : ''}">
      <div class="card-img-wrap">
        <img src="${safeImage}" alt="${safeName}" loading="lazy" onerror="this.src='assets/images/gio_lua.jpg'">
        <div class="card-badge-top">
          ${isOutOfStock ? `
            <span class="badge-tag" style="background: #475569; color: #fff;">
              <i class="fa-solid fa-ban"></i> Tạm Hết Hàng
            </span>
          ` : (safeTag ? `
            <span class="badge-tag badge-${item.badgeType || 'accent'}">
              ${safeTag}
            </span>
          ` : '')}
        </div>
      </div>
      <div class="card-body">
        <span class="product-category-label">${safeCategory}</span>
        <h3 class="product-name">${safeName}</h3>
        <p class="product-desc">${safeDesc}</p>
        
        <div class="product-specs">
          ${(item.specs || []).map(spec => `
            <span class="spec-pill"><i class="fa-solid fa-circle-check text-accent"></i> ${escapeHtml(spec)}</span>
          `).join('')}
        </div>

        <div class="card-footer-price">
          <div class="price-block">
            <span class="price-label">${hasPrice ? 'Giá niêm yết' : 'Báo giá'}</span>
            <div class="price-value" style="${!hasPrice ? 'color: var(--primary); font-size: 1.25rem;' : ''}">
              ${hasPrice ? `${formatNumber(item.price)} <span class="price-unit">/${safeUnit}</span>` : 'Liên hệ'}
            </div>
            <span class="wholesale-hint">
              ${hasWholesale ? `<i class="fa-solid fa-tags"></i> Sỉ từ: ${formatNumber(item.wholesalePrice)}/${safeUnit}` : (hasPrice ? '<i class="fa-solid fa-tags"></i> Sỉ: Liên hệ' : '<i class="fa-solid fa-phone"></i> Giá theo thời giá')}
            </span>
          </div>

          <div class="card-action-btns">
            ${isOutOfStock ? `
              <button class="btn-quick-inquire" style="background: #e2e8f0; color: #64748b; cursor: not-allowed; box-shadow: none;" disabled>
                <i class="fa-solid fa-clock"></i> Tạm Hết Hàng
              </button>
            ` : hasPrice ? `
              <button class="btn-quick-inquire" onclick="openDirectZaloModal('${item.id}')" title="Nhắn Zalo tư vấn đặt món">
                <i class="fa-solid fa-comment-dots"></i> Nhắn Zalo Đặt Món
              </button>
            ` : `
              <button class="btn-quick-inquire" onclick="openDirectZaloModal('${item.id}')" title="Nhắn Zalo hỏi báo giá món này">
                <i class="fa-solid fa-phone-volume"></i> Liên Hệ Báo Giá
              </button>
            `}
          </div>
        </div>
      </div>
    </article>
  `;
  }).join('');
}

// Render dạng Bảng báo giá chi tiết (Price Table)
function renderProductTable(items) {
  const tbody = document.getElementById('price-table-body');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">Không có sản phẩm nào.</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map((item, index) => {
    const isOutOfStock = item.inStock === false;
    const safeName = escapeHtml(item.name);
    const safeDesc = escapeHtml(item.desc || '');
    const safeCategory = escapeHtml(item.categoryName || 'Khác');
    const safeUnit = escapeHtml(item.unit || 'kg');
    const safeImage = escapeHtml(item.image || 'assets/images/gio_lua.jpg');
    const hasPrice = item.price && item.price > 0;
    const hasWholesale = item.wholesalePrice && item.wholesalePrice > 0;

    return `
    <tr style="${isOutOfStock ? 'opacity: 0.75; background: #f8fafc;' : ''}">
      <td style="font-weight: 700; color: var(--text-light); text-align: center; width: 40px;">${index + 1}</td>
      <td>
        <div class="table-product-cell">
          <img src="${safeImage}" alt="${safeName}" class="table-thumb" loading="lazy" onerror="this.src='assets/images/gio_lua.jpg'">
          <div>
            <div class="table-prod-name">
              ${safeName}
              ${isOutOfStock ? '<span style="font-size: 0.7rem; background: #64748b; color: #fff; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Tạm Hết</span>' : ''}
            </div>
            <div class="table-prod-desc">${safeDesc.substring(0, 60)}...</div>
          </div>
        </div>
      </td>
      <td>
        <span class="badge-tag badge-green" style="font-size: 0.75rem;">${safeCategory}</span>
      </td>
      <td style="font-weight: 600; color: var(--text-muted);">${safeUnit}</td>
      <td>
        <div class="table-price-retail" style="${!hasPrice ? 'color: var(--primary); font-weight: 700;' : ''}">
          ${hasPrice ? formatNumber(item.price) : 'Liên hệ'}
        </div>
        <div class="table-price-wholesale">
          ${hasWholesale ? `Sỉ: ${formatNumber(item.wholesalePrice)}` : (hasPrice ? 'Sỉ: Liên hệ' : 'Báo giá theo mẻ')}
        </div>
      </td>
      <td style="text-align: right;">
        ${isOutOfStock ? `
          <button class="btn-quick-inquire" style="background: #e2e8f0; color: #64748b; cursor: not-allowed; padding: 8px 12px; font-size: 0.8rem;" disabled>
            Tạm Hết
          </button>
        ` : hasPrice ? `
          <button class="btn-quick-inquire" onclick="openDirectZaloModal('${item.id}')" title="Nhắn Zalo tư vấn món này">
            <i class="fa-solid fa-comment-dots"></i> Tư Vấn Zalo
          </button>
        ` : `
          <button class="btn-quick-inquire" onclick="openDirectZaloModal('${item.id}')" title="Nhắn Zalo hỏi báo giá">
            <i class="fa-solid fa-phone-volume"></i> Báo Giá
          </button>
        `}
      </td>
    </tr>
  `;
  }).join('');
}

// ==========================================
// 4. BỘ LỌC DANH MỤC & TÌM KIẾM
// ==========================================
let currentCategory = 'all';
let currentSearchQuery = '';

function setupCategoryFilters() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.getAttribute('data-category');
      applyFilters();
    });
  });
}

function setupSearchFilter() {
  const searchInput = document.getElementById('catalog-search-input');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value.trim().toLowerCase();
    applyFilters();
  });
}

function applyFilters() {
  let filtered = activeProducts.filter(p => {
    const matchCat = currentCategory === 'all' || p.category === currentCategory;
    const matchSearch = !currentSearchQuery || 
      (p.name && p.name.toLowerCase().includes(currentSearchQuery)) || 
      (p.desc && p.desc.toLowerCase().includes(currentSearchQuery)) ||
      (p.categoryName && p.categoryName.toLowerCase().includes(currentSearchQuery));
    return matchCat && matchSearch;
  });

  renderProductGrid(filtered);
  renderProductTable(filtered);
}

// Chuyển đổi giữa Dạng Lưới (Grid) và Dạng Bảng (Table)
function setupViewToggle() {
  const btnGrid = document.getElementById('btn-view-grid');
  const btnTable = document.getElementById('btn-view-table');
  const gridView = document.getElementById('products-grid-container');
  const tableView = document.getElementById('price-table-container');

  if (!btnGrid || !btnTable || !gridView || !tableView) return;

  btnGrid.addEventListener('click', () => {
    btnGrid.classList.add('active');
    btnTable.classList.remove('active');
    gridView.style.display = 'grid';
    tableView.style.display = 'none';
  });

  btnTable.addEventListener('click', () => {
    btnTable.classList.add('active');
    btnGrid.classList.remove('active');
    gridView.style.display = 'none';
    tableView.style.display = 'block';
  });
}

// ==========================================
// 5. TƯ VẤN & ĐẶT MÓN TRỰC TIẾP QUA ZALO
// ==========================================
// Mở Zalo hỏi trực tiếp 1 sản phẩm
function openDirectZaloModal(productId) {
  const product = activeProducts.find(p => p.id === productId);
  if (!product) return;

  const shopTitle = (SHOP_CONFIG && SHOP_CONFIG.shopName) || "Bếp Nhà Làm";
  const zaloNum = (SHOP_CONFIG && SHOP_CONFIG.zaloPhone) || (SHOP_CONFIG && SHOP_CONFIG.hotlineRaw) || "0988123456";
  let msg = '';
  if (product.price && product.price > 0) {
    const priceText = `${formatNumber(product.price)}/${product.unit || 'kg'}`;
    msg = `Chào ${shopTitle}, tôi muốn hỏi tư vấn và đặt món: ${product.name} (${priceText}). Bạn có sẵn hàng hôm nay không?`;
  } else {
    msg = `Chào ${shopTitle}, tôi muốn hỏi báo giá món: ${product.name} (${product.unit || 'kg'}). Shop tư vấn giá sỉ & lẻ giúp tôi với nhé!`;
  }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(msg);
  }
  const zaloUrl = `https://zalo.me/${zaloNum}`;
  window.open(zaloUrl, '_blank');
  showToast(`Đang mở Zalo để tư vấn món: ${product.name}`);
}

// ==========================================
// 6. ACCORDION FAQ
// ==========================================
function setupFaqAccordion() {
  const faqQuestions = document.querySelectorAll('.faq-question');
  faqQuestions.forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      const isActive = item.classList.contains('active');
      
      // Close all
      document.querySelectorAll('.faq-item').forEach(i => {
        i.classList.remove('active');
        const ans = i.querySelector('.faq-answer');
        if (ans) ans.style.maxHeight = null;
      });

      // Toggle current
      if (!isActive) {
        item.classList.add('active');
        const ans = item.querySelector('.faq-answer');
        if (ans) ans.style.maxHeight = ans.scrollHeight + "px";
      }
    });
  });

  // Mở sẵn câu hỏi đầu tiên
  const firstFaq = document.querySelector('.faq-item');
  if (firstFaq) {
    firstFaq.classList.add('active');
    const firstAns = firstFaq.querySelector('.faq-answer');
    if (firstAns) firstAns.style.maxHeight = firstAns.scrollHeight + "px";
  }
}

// ==========================================
// 7. TOAST NOTIFICATION & MOBILE MENU & SCROLL
// ==========================================
function showToast(message) {
  let toast = document.getElementById('toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = 'toast-notice';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #4ade80;"></i> <span>${message}</span>`;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

function setupMobileMenu() {
  const toggleBtn = document.getElementById('menu-toggle');
  const navMenu = document.getElementById('main-nav-menu');
  if (!toggleBtn || !navMenu) return;

  toggleBtn.addEventListener('click', () => {
    navMenu.classList.toggle('mobile-active');
    const icon = toggleBtn.querySelector('i');
    if (icon) {
      if (navMenu.classList.contains('mobile-active')) {
        icon.className = 'fa-solid fa-xmark';
      } else {
        icon.className = 'fa-solid fa-bars';
      }
    }
  });

  // Đóng khi click link
  navMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('mobile-active');
      const icon = toggleBtn.querySelector('i');
      if (icon) icon.className = 'fa-solid fa-bars';
    });
  });
}

function setupBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

