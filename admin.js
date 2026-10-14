/**
 * BẾP NHÀ LÀM - ADMIN DASHBOARD LOGIC
 * Tích hợp Google Authentication, Whitelist Email & Cloud Firestore/Storage
 */



// Trạng thái ứng dụng Admin
let currentProducts = [];
let isDemoMode = false;
let currentAdminUser = null;
let currentDeletingId = null;

// Cấu hình cửa hàng (Tải động từ Firestore settings/shop)
let currentShopConfig = {};

// Tên danh mục chuẩn
const CATEGORY_NAMES = {
  gio: "Giò Truyền Thống",
  cha: "Chả Chiên / Hấp",
  xucxich: "Xúc Xích & Lạp Xưởng",
  thit: "Thịt Lợn Tươi Sạch"
};

// ==========================================
// KHỞI ĐỘNG VÀ XÁC THỰC
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initAdminApp();
});

function initAdminApp() {
  const firebaseServices = initFirebaseServices();

  if (firebaseServices && firebaseServices.auth) {
    // Đã cấu hình Firebase: hiển thị banner đã kết nối
    updateStatusBanner(true);

    // Lắng nghe trạng thái đăng nhập Firebase
    firebaseServices.auth.onAuthStateChanged(user => {
      if (user) {
        verifyAdminAccess(user);
      } else {
        showLoginScreen();
      }
    });

    // Sự kiện nút đăng nhập Google
    document.getElementById("btn-google-login").addEventListener("click", () => {
      loginWithGoogle(firebaseServices.auth);
    });
  } else {
    // Chưa cấu hình Firebase: hiển thị banner cảnh báo
    updateStatusBanner(false);

    // Nút đăng nhập Google khi chưa có Firebase -> gợi ý xem demo
    document.getElementById("btn-google-login").addEventListener("click", () => {
      showToast("Bạn chưa cấu hình Firebase trong firebase-config.js. Bấm 'Xem thử giao diện Demo' để trải nghiệm trước nhé!", "warning");
    });
  }

  // Nút vào chế độ Demo
  document.getElementById("btn-enter-demo").addEventListener("click", () => {
    enterDemoMode();
  });

  // Nút đăng xuất
  document.getElementById("btn-logout").addEventListener("click", () => {
    logoutAdmin();
  });

  // Sự kiện bộ lọc và tìm kiếm
  setupFiltersAndSearch();

  // Sự kiện modal và CRUD
  setupCrudEvents();
}

// Cập nhật banner thông báo kết nối
function updateStatusBanner(isConnected) {
  const banner = document.getElementById("firebase-status-banner");
  const text = document.getElementById("status-text");

  if (isConnected) {
    banner.classList.add("connected");
    text.innerHTML = `🟢 <strong>Đã kết nối Firebase Cloud!</strong> Dữ liệu món ăn và hình ảnh sẽ được đồng bộ thời gian thực (Realtime) với khách hàng.`;
  } else {
    banner.classList.remove("connected");
    text.innerHTML = `⚠️ Đang ở <strong>Chế độ Cục bộ (Local/Demo)</strong>. Bạn chưa cấu hình Firebase. Khi tạo xong project, hãy dán config vào file <code>firebase-config.js</code> để đồng bộ thời gian thực!`;
  }
}

// Xử lý đăng nhập bằng Google Popup
function loginWithGoogle(auth) {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider)
    .then(result => {
      verifyAdminAccess(result.user);
    })
    .catch(error => {
      console.error("Lỗi Google Sign-In:", error);
      showToast(`Đăng nhập thất bại: ${error.message}`, "error");
    });
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

// KIỂM TRA BẢO MẬT: XÁC THỰC QUA FIRESTORE COLLECTION 'admins'
async function verifyAdminAccess(user) {
  const userEmail = (user.email || "").toLowerCase().trim();
  const db = firebase.firestore();

  try {
    // Truy vấn document mang ID là email của user trong collection 'admins'
    const adminDoc = await db.collection("admins").doc(userEmail).get();

    if (adminDoc.exists) {
      // HỢP LỆ: Email có trong collection 'admins'
      currentAdminUser = user;
      isDemoMode = false;
      showToast(`Xin chào Quản trị viên ${user.displayName || userEmail}!`, "success");
      showDashboardScreen(user.displayName || "Admin", user.email, user.photoURL);
      loadProductsFromFirestore();
      loadShopConfigFromFirestore();
    } else {
      // KHÔNG CÓ TRONG BẢNG ADMINS
      handleUnauthorizedUser(userEmail);
    }
  } catch (error) {
    console.error("Lỗi xác thực quyền admin từ Firestore:", error);
    // Nếu bị lỗi Permission Denied từ Firebase Rules (do chưa được cấp quyền)
    handleUnauthorizedUser(userEmail, error.message);
  }
}

// Xử lý khi tài khoản không có quyền Admin
function handleUnauthorizedUser(email, errorMsg = "") {
  firebase.auth().signOut().then(() => {
    alert(
      `⛔ TỪ CHỐI TRUY CẬP!\n\n` +
      `Email [${email}] chưa được cấp quyền Quản trị viên trên hệ thống.\n\n` +
      `👉 HƯỚNG DẪN CẤP QUYỀN:\n` +
      `1. Vào Firebase Console -> Firestore Database.\n` +
      `2. Vào collection 'admins' -> Bấm 'Add document'.\n` +
      `3. Đặt Document ID là: ${email}\n` +
      `4. Bấm Save rồi đăng nhập lại là xong!`
    );
    showLoginScreen();
  });
}

// Vào chế độ Demo giả lập
function enterDemoMode() {
  isDemoMode = true;
  currentAdminUser = {
    displayName: "Admin Thử Nghiệm",
    email: "demo@bepnhalam.vn",
    photoURL: null
  };
  showToast("Đã vào chế độ Demo! Dữ liệu được lưu trong LocalStorage máy bạn.", "warning");
  showDashboardScreen("Admin Thử Nghiệm", "demo@bepnhalam.vn", null);
  loadProductsFromLocalStorage();
}

// Đăng xuất
function logoutAdmin() {
  if (!isDemoMode && firebase.auth) {
    firebase.auth().signOut();
  }
  currentAdminUser = null;
  isDemoMode = false;
  showLoginScreen();
  showToast("Đã đăng xuất khỏi trang quản trị.", "success");
}

function showLoginScreen() {
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("dashboard-screen").style.display = "none";
}

function showDashboardScreen(name, email, photo) {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("dashboard-screen").style.display = "flex";

  document.getElementById("user-name").textContent = name;
  document.getElementById("user-email").textContent = email;
  if (photo) {
    document.getElementById("user-avatar").src = photo;
  }
}

// ==========================================
// QUẢN LÝ DỮ LIỆU SẢN PHẨM (CRUD)
// ==========================================

// 1. Tải dữ liệu từ Firestore (Realtime)
function loadProductsFromFirestore() {
  const db = firebase.firestore();
  db.collection("products").onSnapshot(snapshot => {
    if (snapshot.empty) {
      currentProducts = [];
      renderProductsTable([]);
      updateStats([]);
      showToast("Chưa có món ăn nào trên Firestore. Bấm '+ Thêm Món Mới' để bắt đầu thêm món!", "warning");
    } else {
      const items = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() });
      });
      currentProducts = items;
      applyFilters();
      updateStats(items);
    }
  }, error => {
    console.error("Lỗi Firestore onSnapshot:", error);
    showToast("Không thể tải dữ liệu từ Firestore. Kiểm tra lại Rules hoặc kết nối mạng.", "error");
    // Fallback sang local
    loadProductsFromLocalStorage();
  });
}

// 2. Tải dữ liệu từ LocalStorage (Demo Mode)
function loadProductsFromLocalStorage() {
  const saved = localStorage.getItem("giocha_demo_products");
  if (saved) {
    try {
      currentProducts = JSON.parse(saved);
    } catch (e) {
      currentProducts = [];
    }
  } else {
    currentProducts = [];
  }
  applyFilters();
  updateStats(currentProducts);
}

// Render danh sách ra bảng HTML
function renderProductsTable(items) {
  const tbody = document.getElementById("admin-products-tbody");
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-table">
          <i class="fa-solid fa-box-open"></i>
          <p style="font-weight: 700; font-size: 15px; margin-bottom: 4px;">Không tìm thấy món ăn nào</p>
          <span>Hãy thử đổi bộ lọc hoặc thêm món ăn mới vào hệ thống.</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map(item => {
    const safeName = escapeHtml(item.name);
    const safeTag = item.tag ? escapeHtml(item.tag) : "";
    const safeCategory = escapeHtml(item.categoryName || CATEGORY_NAMES[item.category] || "Khác");
    const safeUnit = escapeHtml(item.unit || "kg");
    const safeImage = escapeHtml(item.image || "assets/images/gio_lua.jpg");
    const isHidden = item.isActive === false;

    const hasPrice = item.price && item.price > 0;
    const hasWholesale = item.wholesalePrice && item.wholesalePrice > 0;

    return `
    <tr class="${isHidden ? 'row-hidden' : ''}">
      <td>
        <div class="item-thumb-cell">
          <img class="item-thumb" src="${safeImage}" alt="${safeName}" onerror="this.src='assets/images/gio_lua.jpg'">
          <div class="item-info">
            <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
              <span class="item-name">${safeName}</span>
              ${isHidden ? `<span class="badge-hidden-item" title="Món này đang tạm ẩn khỏi trang khách"><i class="fa-solid fa-eye-slash"></i> Đang Ẩn</span>` : ""}
            </div>
            ${safeTag ? `<span class="item-tag">${safeTag}</span>` : ""}
          </div>
        </div>
      </td>
      <td>
        <span class="badge-category">${safeCategory}</span>
      </td>
      <td>
        <div class="price-main">${hasPrice ? formatCurrency(item.price) : '<span style="color: var(--primary); font-weight: 700;">Liên hệ</span>'}</div>
        <div class="price-sub">${hasPrice ? `/${safeUnit}` : 'Theo thời giá'}</div>
      </td>
      <td>
        <div class="price-main" style="color: var(--gray-700);">${hasWholesale ? formatCurrency(item.wholesalePrice) : "Liên hệ"}</div>
        <div class="price-sub">${hasWholesale ? 'Từ 10kg' : 'Báo giá sỉ'}</div>
      </td>
      <td style="text-align: center;">
        <div class="status-badge-toggle ${item.inStock !== false ? 'in-stock' : 'out-of-stock'}" 
             onclick="toggleProductStock('${item.id}')"
             title="Bấm để đổi trạng thái Còn hàng / Tạm hết">
          <span class="status-indicator"></span>
          <span class="status-text">${item.inStock !== false ? 'Còn Hàng' : 'Tạm Hết'}</span>
        </div>
      </td>
      <td style="text-align: right;">
        <div class="row-actions" style="justify-content: flex-end;">
          <button class="btn-icon ${isHidden ? 'warning' : 'active-toggle'}" 
                  onclick="toggleProductVisibility('${item.id}')" 
                  title="${isHidden ? 'Món đang ẩn - Bấm để HIỆN LẠI trên website' : 'Món đang hiện - Bấm để TẠM ẨN khỏi website'}">
            <i class="fa-solid ${isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i>
          </button>
          <button class="btn-icon" onclick="openEditModal('${item.id}')" title="Chỉnh sửa món">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-icon danger" onclick="openDeleteModal('${item.id}', '${safeName.replace(/'/g, "\\'")}')" title="Xóa món">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
  }).join("");
}

// Cập nhật số liệu thống kê
function updateStats(items) {
  document.getElementById("stat-total-items").textContent = items.length;
  document.getElementById("stat-instock-items").textContent = items.filter(p => p.isActive !== false && p.inStock !== false).length;
  document.getElementById("stat-outstock-items").textContent = items.filter(p => p.inStock === false).length;

  const uniqueCats = new Set(items.map(p => p.category));
  document.getElementById("stat-categories").textContent = uniqueCats.size || 4;
}

// Format tiền VND
function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
}

// ==========================================
// BỘ LỌC VÀ TÌM KIẾM
// ==========================================
function setupFiltersAndSearch() {
  const searchInput = document.getElementById("admin-search-input");
  const categoryFilter = document.getElementById("admin-category-filter");
  const stockFilter = document.getElementById("admin-stock-filter");

  searchInput.addEventListener("input", applyFilters);
  categoryFilter.addEventListener("change", applyFilters);
  stockFilter.addEventListener("change", applyFilters);
}

function applyFilters() {
  const query = document.getElementById("admin-search-input").value.toLowerCase().trim();
  const category = document.getElementById("admin-category-filter").value;
  const stock = document.getElementById("admin-stock-filter").value;

  let filtered = currentProducts.filter(item => {
    // Lọc tìm kiếm
    const matchQuery = !query || 
      item.name.toLowerCase().includes(query) || 
      (item.id && item.id.toLowerCase().includes(query));

    // Lọc danh mục
    const matchCategory = category === "all" || item.category === category;

    // Lọc trạng thái
    const isInstock = item.inStock !== false;
    const isActive = item.isActive !== false;
    let matchStock = true;
    if (stock === "instock") matchStock = isInstock;
    if (stock === "outstock") matchStock = !isInstock;
    if (stock === "active") matchStock = isActive;
    if (stock === "hidden") matchStock = !isActive;

    return matchQuery && matchCategory && matchStock;
  });

  renderProductsTable(filtered);
}

// ==========================================
// CÁC HÀNH ĐỘNG THÊM / SỬA / XÓA / ĐỔI TRẠNG THÁI
// ==========================================

// 1. Toggle Ẩn / Hiện món trên website khách
window.toggleProductVisibility = async function(id) {
  const item = currentProducts.find(p => p.id === id);
  if (!item) return;

  const newActiveStatus = item.isActive === false ? true : false;

  if (!isDemoMode && firestoreDb) {
    try {
      await firestoreDb.collection("products").doc(id).update({
        isActive: newActiveStatus,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast(
        newActiveStatus 
          ? `Đã hiển thị lại món '${item.name}' trên website!` 
          : `Đã tạm ẩn món '${item.name}' khỏi website!`, 
        "success"
      );
    } catch (e) {
      showToast(`Lỗi cập nhật: ${e.message}`, "error");
    }
  } else {
    // Local / Demo
    item.isActive = newActiveStatus;
    localStorage.setItem("giocha_demo_products", JSON.stringify(currentProducts));
    applyFilters();
    updateStats(currentProducts);
    showToast(
      newActiveStatus 
        ? `[Demo] Đã hiển thị lại '${item.name}'` 
        : `[Demo] Đã tạm ẩn '${item.name}'`, 
      "success"
    );
  }
};

// 2. Toggle nhanh Còn hàng / Tạm hết
window.toggleProductStock = async function(id) {
  const item = currentProducts.find(p => p.id === id);
  if (!item) return;

  const newStockStatus = item.inStock === false ? true : false;

  if (!isDemoMode && firestoreDb) {
    try {
      await firestoreDb.collection("products").doc(id).update({
        inStock: newStockStatus,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast(`Đã chuyển '${item.name}' sang: ${newStockStatus ? 'Còn Hàng' : 'Tạm Hết'}`, "success");
    } catch (e) {
      showToast(`Lỗi cập nhật: ${e.message}`, "error");
    }
  } else {
    // Local / Demo
    item.inStock = newStockStatus;
    localStorage.setItem("giocha_demo_products", JSON.stringify(currentProducts));
    applyFilters();
    updateStats(currentProducts);
    showToast(`[Demo] Đã đổi trạng thái '${item.name}'`, "success");
  }
};

// 2. Mở Modal Thêm mới
function openAddModal() {
  document.getElementById("modal-title").textContent = "Thêm Món Ăn Mới";
  document.getElementById("form-item-id").value = "";
  document.getElementById("product-form").reset();
  document.getElementById("form-unit").value = "kg";
  document.getElementById("form-stock").value = "true";
  const activeSelect = document.getElementById("form-is-active");
  if (activeSelect) activeSelect.value = "true";
  document.getElementById("image-preview-container").style.display = "none";
  document.getElementById("product-modal").classList.add("active");
}

// 3. Mở Modal Sửa
window.openEditModal = function(id) {
  const item = currentProducts.find(p => p.id === id);
  if (!item) return;

  document.getElementById("modal-title").textContent = "Chỉnh Sửa Món Ăn";
  document.getElementById("form-item-id").value = item.id;
  document.getElementById("form-name").value = item.name || "";
  document.getElementById("form-category").value = item.category || "gio";
  document.getElementById("form-price").value = item.price > 0 ? item.price : "";
  document.getElementById("form-wholesale-price").value = item.wholesalePrice > 0 ? item.wholesalePrice : "";
  document.getElementById("form-unit").value = item.unit || "kg";
  document.getElementById("form-tag").value = item.tag || "";
  document.getElementById("form-image-url").value = item.image || "";
  document.getElementById("form-desc").value = item.desc || "";
  document.getElementById("form-specs").value = item.specs ? item.specs.join(", ") : "";
  document.getElementById("form-stock").value = item.inStock !== false ? "true" : "false";
  const activeSelect = document.getElementById("form-is-active");
  if (activeSelect) activeSelect.value = item.isActive !== false ? "true" : "false";

  if (item.image) {
    document.getElementById("image-preview-container").style.display = "flex";
    document.getElementById("form-image-preview").src = item.image;
    document.getElementById("form-image-status").textContent = "Ảnh hiện tại của món";
  } else {
    document.getElementById("image-preview-container").style.display = "none";
  }

  document.getElementById("product-modal").classList.add("active");
};

// 4. Mở Modal Xóa
window.openDeleteModal = function(id, name) {
  currentDeletingId = id;
  document.getElementById("delete-item-name").textContent = name;
  document.getElementById("delete-confirm-modal").classList.add("active");
};

// 5. Cài đặt các Event cho Form và Modal
function setupCrudEvents() {
  // Nút mở modal thêm
  document.getElementById("btn-add-product").addEventListener("click", openAddModal);

  // Đóng modal
  const closeModal = () => document.getElementById("product-modal").classList.remove("active");
  document.getElementById("btn-close-product-modal").addEventListener("click", closeModal);
  document.getElementById("btn-cancel-product-modal").addEventListener("click", closeModal);

  // Đóng modal xóa
  const closeDeleteModal = () => {
    currentDeletingId = null;
    document.getElementById("delete-confirm-modal").classList.remove("active");
  };
  document.getElementById("btn-cancel-delete").addEventListener("click", closeDeleteModal);

  // Xác nhận xóa
  document.getElementById("btn-confirm-delete").addEventListener("click", async () => {
    if (!currentDeletingId) return;

    if (!isDemoMode && firestoreDb) {
      try {
        await firestoreDb.collection("products").doc(currentDeletingId).delete();
        showToast("Đã xóa món ăn thành công khỏi Firestore!", "success");
      } catch (e) {
        showToast(`Lỗi khi xóa: ${e.message}`, "error");
      }
    } else {
      currentProducts = currentProducts.filter(p => p.id !== currentDeletingId);
      localStorage.setItem("giocha_demo_products", JSON.stringify(currentProducts));
      applyFilters();
      updateStats(currentProducts);
      showToast("[Demo] Đã xóa món ăn khỏi bộ nhớ tạm!", "success");
    }

    closeDeleteModal();
  });

  // Chọn ảnh từ máy tính (Trigger upload box)
  const fileInput = document.getElementById("form-image-file");
  document.getElementById("upload-box-trigger").addEventListener("click", () => {
    fileInput.click();
  });

  // Nén ảnh tự động trước khi lưu hoặc upload (Chuẩn WebP/JPEG, kích thước gọn nhẹ < 60KB)
  function compressImageFile(file, maxWidth = 800, maxHeight = 800, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          let dataUrl = canvas.toDataURL("image/webp", quality);
          if (!dataUrl.startsWith("data:image/webp")) {
            dataUrl = canvas.toDataURL("image/jpeg", quality);
          }
          resolve(dataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1. Hiển thị trạng thái đang xử lý
    document.getElementById("image-preview-container").style.display = "flex";
    document.getElementById("form-image-status").innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tối ưu hoá ảnh...`;

    let optimizedDataUrl = "";
    try {
      // Tự động nén ảnh sang WebP độ phân giải tối đa 800px
      optimizedDataUrl = await compressImageFile(file, 800, 800, 0.82);
      document.getElementById("form-image-preview").src = optimizedDataUrl;
      // Gán trước ảnh đã nén vào ô URL để nếu Storage lỗi (404/chưa nâng cấp Blaze) thì món vẫn có ảnh chuẩn 100%!
      document.getElementById("form-image-url").value = optimizedDataUrl;
      const approxKb = Math.round(optimizedDataUrl.length * 0.75 / 1024);
      document.getElementById("form-image-status").innerHTML = `✅ Đã tối ưu ảnh sẵn sàng (${approxKb} KB)`;
    } catch (err) {
      console.warn("Không thể nén ảnh client-side:", err);
    }

    // 2. Nếu có Firebase Storage, thử upload lên Cloud Storage
    if (!isDemoMode && firebaseStorage) {
      document.getElementById("form-image-status").innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang thử tải lên Cloud Storage...`;
      try {
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storageRef = firebaseStorage.ref(`products/${Date.now()}_${safeFileName}`);
        const snapshot = await storageRef.put(file);
        const downloadUrl = await snapshot.ref.getDownloadURL();
        document.getElementById("form-image-url").value = downloadUrl;
        document.getElementById("form-image-status").innerHTML = `☁️ Đã lưu trên Cloud Storage thành công!`;
        showToast("Ảnh đã được tải lên Firebase Storage!", "success");
      } catch (err) {
        console.warn("Firebase Storage chưa kích hoạt (404) hoặc lỗi quyền. Tự động lưu ảnh đã nén trực tiếp vào Firestore:", err);
        // Tự động fallback: Giữ nguyên optimizedDataUrl để lưu trực tiếp vào Firestore!
        if (optimizedDataUrl) {
          document.getElementById("form-image-url").value = optimizedDataUrl;
          document.getElementById("form-image-status").innerHTML = `✅ Đã tối ưu ảnh & sẵn sàng lưu trực tiếp vào CSDL!`;
          showToast("Đã tối ưu hoá và lưu ảnh trực tiếp vào CSDL!", "success");
        } else {
          document.getElementById("form-image-status").textContent = `⚠️ Lỗi upload Storage (${err.message}). Bạn có thể dán link ảnh bên dưới.`;
          showToast("Chưa thể tải ảnh lên Storage.", "error");
        }
      }
    }
  });

  // Preview khi dán link URL ảnh
  document.getElementById("form-image-url").addEventListener("input", (e) => {
    const url = e.target.value.trim();
    if (url) {
      document.getElementById("image-preview-container").style.display = "flex";
      document.getElementById("form-image-preview").src = url;
      document.getElementById("form-image-status").textContent = "Ảnh từ đường dẫn URL";
    }
  });

  // Submit Form Lưu Món (Thêm hoặc Sửa)
  document.getElementById("product-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const saveBtn = document.getElementById("btn-save-product");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...`;

    const id = document.getElementById("form-item-id").value || generateSlug(document.getElementById("form-name").value);
    const category = document.getElementById("form-category").value;
    const rawSpecs = document.getElementById("form-specs").value;

    const activeSelect = document.getElementById("form-is-active");
    const isActive = activeSelect ? activeSelect.value === "true" : true;

    const productData = {
      id: id,
      name: document.getElementById("form-name").value.trim(),
      category: category,
      categoryName: CATEGORY_NAMES[category] || "Khác",
      price: parseInt(document.getElementById("form-price").value) || 0,
      wholesalePrice: parseInt(document.getElementById("form-wholesale-price").value) || 0,
      unit: document.getElementById("form-unit").value.trim() || "kg",
      tag: document.getElementById("form-tag").value.trim(),
      image: document.getElementById("form-image-url").value.trim() || "assets/images/gio_lua.jpg",
      desc: document.getElementById("form-desc").value.trim(),
      specs: rawSpecs ? rawSpecs.split(",").map(s => s.trim()).filter(Boolean) : [],
      inStock: document.getElementById("form-stock").value === "true",
      isActive: isActive,
      updatedAt: new Date().toISOString()
    };

    if (!isDemoMode && firestoreDb) {
      try {
        await firestoreDb.collection("products").doc(id).set(productData, { merge: true });
        showToast("Đã lưu sản phẩm lên Firebase Firestore thành công!", "success");
        closeModal();
      } catch (err) {
        showToast(`Lỗi khi lưu: ${err.message}`, "error");
      }
    } else {
      // Local / Demo
      const existingIdx = currentProducts.findIndex(p => p.id === id);
      if (existingIdx >= 0) {
        currentProducts[existingIdx] = productData;
      } else {
        currentProducts.unshift(productData);
      }
      localStorage.setItem("giocha_demo_products", JSON.stringify(currentProducts));
      applyFilters();
      updateStats(currentProducts);
      showToast("[Demo] Đã lưu sản phẩm vào bộ nhớ tạm!", "success");
      closeModal();
    }

    saveBtn.disabled = false;
    saveBtn.innerHTML = `<i class="fa-solid fa-check"></i> Lưu Sản Phẩm`;
  });



  // ==========================================
  // QUẢN LÝ CÀI ĐẶT CỬA HÀNG (SHOP SETTINGS)
  // ==========================================
  const shopModal = document.getElementById("shop-settings-modal");
  const openShopModalBtn = document.getElementById("btn-open-shop-settings");
  const closeShopModalBtn = document.getElementById("btn-close-shop-settings");
  const cancelShopModalBtn = document.getElementById("btn-cancel-shop-settings");

  if (openShopModalBtn) {
    openShopModalBtn.addEventListener("click", () => {
      // Điền thông tin hiện tại vào form
      document.getElementById("shop-name-input").value = currentShopConfig.shopName || "";
      document.getElementById("shop-slogan-input").value = currentShopConfig.slogan || "";
      document.getElementById("shop-announcement-input").value = currentShopConfig.announcement || "";
      document.getElementById("shop-badge-input").value = currentShopConfig.announcementBadge || "";
      document.getElementById("shop-hotline-input").value = currentShopConfig.hotline || "";
      document.getElementById("shop-hotline-raw-input").value = currentShopConfig.hotlineRaw || "";
      document.getElementById("shop-zalo-input").value = currentShopConfig.zaloPhone || "";
      document.getElementById("shop-facebook-input").value = currentShopConfig.facebookUrl || "";
      document.getElementById("shop-address-input").value = currentShopConfig.address || "";
      document.getElementById("shop-hours-input").value = currentShopConfig.openHours || "";
      document.getElementById("shop-map-input").value = currentShopConfig.mapUrl || "";
      document.getElementById("shop-ship-input").value = currentShopConfig.shipNote || "";

      // Cài đặt Chế độ bảo trì
      const maintToggle = document.getElementById("shop-maintenance-toggle");
      const maintWrap = document.getElementById("maintenance-fields-wrap");
      if (maintToggle) {
        maintToggle.checked = currentShopConfig.isMaintenance === true;
        if (maintWrap) maintWrap.style.display = maintToggle.checked ? "block" : "none";
      }
      document.getElementById("shop-maintenance-title").value = currentShopConfig.maintenanceTitle || "";
      document.getElementById("shop-maintenance-expected").value = currentShopConfig.maintenanceExpectedTime || "";
      document.getElementById("shop-maintenance-message").value = currentShopConfig.maintenanceMessage || "";

      updateAdminMapPreview();
      shopModal.classList.add("active");
    });
  }

  // Tự động xem trước bản đồ khi gõ / dán link map hoặc địa chỉ
  const mapInputEl = document.getElementById("shop-map-input");
  const addressInputEl = document.getElementById("shop-address-input");
  if (mapInputEl) mapInputEl.addEventListener("input", updateAdminMapPreview);
  if (addressInputEl) addressInputEl.addEventListener("input", updateAdminMapPreview);

  // Toggle ẩn/hiện trường thông tin bảo trì khi gạt công tắc
  const maintToggleEl = document.getElementById("shop-maintenance-toggle");
  if (maintToggleEl) {
    maintToggleEl.addEventListener("change", (e) => {
      const wrap = document.getElementById("maintenance-fields-wrap");
      if (wrap) wrap.style.display = e.target.checked ? "block" : "none";
    });
  }

  // Bấm vào badge Bảo trì trên thanh navbar để mở modal Cài đặt
  const adminMaintBadge = document.getElementById("admin-maintenance-badge");
  if (adminMaintBadge && openShopModalBtn) {
    adminMaintBadge.addEventListener("click", () => openShopModalBtn.click());
  }

  const closeShopSettings = () => shopModal.classList.remove("active");
  if (closeShopModalBtn) closeShopModalBtn.addEventListener("click", closeShopSettings);
  if (cancelShopModalBtn) cancelShopModalBtn.addEventListener("click", closeShopSettings);

  const shopForm = document.getElementById("shop-settings-form");
  if (shopForm) {
    shopForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById("btn-save-shop-settings");
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...`;

      const maintToggleChecked = document.getElementById("shop-maintenance-toggle") ? document.getElementById("shop-maintenance-toggle").checked : false;

      const newSettings = {
        shopName: document.getElementById("shop-name-input").value.trim(),
        slogan: document.getElementById("shop-slogan-input").value.trim(),
        announcement: document.getElementById("shop-announcement-input").value.trim(),
        announcementBadge: document.getElementById("shop-badge-input").value.trim(),
        hotline: document.getElementById("shop-hotline-input").value.trim(),
        hotlineRaw: document.getElementById("shop-hotline-raw-input").value.trim(),
        zaloPhone: document.getElementById("shop-zalo-input").value.trim(),
        facebookUrl: document.getElementById("shop-facebook-input").value.trim(),
        address: document.getElementById("shop-address-input").value.trim(),
        openHours: document.getElementById("shop-hours-input").value.trim(),
        mapUrl: document.getElementById("shop-map-input").value.trim(),
        shipNote: document.getElementById("shop-ship-input").value.trim(),
        isMaintenance: maintToggleChecked,
        maintenanceTitle: document.getElementById("shop-maintenance-title").value.trim(),
        maintenanceExpectedTime: document.getElementById("shop-maintenance-expected").value.trim(),
        maintenanceMessage: document.getElementById("shop-maintenance-message").value.trim(),
        updatedAt: new Date().toISOString()
      };

      if (!isDemoMode && firestoreDb) {
        try {
          await firestoreDb.collection("settings").doc("shop").set(newSettings, { merge: true });
          currentShopConfig = { ...currentShopConfig, ...newSettings };
          updateAdminMaintenanceStatus(currentShopConfig.isMaintenance === true);
          showToast(newSettings.isMaintenance ? "Đã BẬT Chế độ bảo trì cho website!" : "Đã cập nhật thông tin cửa hàng thành công!", "success");
          closeShopSettings();
        } catch (err) {
          showToast(`Lỗi khi lưu cài đặt: ${err.message}`, "error");
        }
      } else {
        currentShopConfig = { ...currentShopConfig, ...newSettings };
        localStorage.setItem("giocha_demo_shop_config", JSON.stringify(currentShopConfig));
        updateAdminMaintenanceStatus(currentShopConfig.isMaintenance === true);
        showToast(newSettings.isMaintenance ? "[Demo] Đã BẬT Chế độ bảo trì!" : "[Demo] Đã lưu thông tin cửa hàng!", "success");
        closeShopSettings();
      }

      saveBtn.disabled = false;
      saveBtn.innerHTML = `<i class="fa-solid fa-check"></i> Lưu Cài Đặt Shop`;
    });
  }
}

// Cập nhật trạng thái badge cảnh báo Bảo trì trên topbar Admin
function updateAdminMaintenanceStatus(isMaintenance) {
  const badge = document.getElementById("admin-maintenance-badge");
  if (badge) {
    badge.style.display = isMaintenance ? "inline-flex" : "none";
  }
}

// Tải thông tin cửa hàng từ Firestore
function loadShopConfigFromFirestore() {
  if (!firestoreDb) return;
  firestoreDb.collection("settings").doc("shop").onSnapshot(doc => {
    if (doc.exists) {
      currentShopConfig = doc.data() || {};
      updateAdminMaintenanceStatus(currentShopConfig.isMaintenance === true);
    }
  }, err => {
    console.warn("Không tải được settings/shop:", err);
  });
}

// Tạo slug ID từ tên tiếng Việt
function generateSlug(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Hiển thị Toast thông báo
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  const icon = type === "success" ? "fa-circle-check" : (type === "error" ? "fa-circle-xmark" : "fa-triangle-exclamation");
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Cập nhật khung xem trước Google Maps trong modal Cài đặt Shop
function updateAdminMapPreview() {
  const mapInput = document.getElementById("shop-map-input");
  const addressInput = document.getElementById("shop-address-input");
  const previewWrap = document.getElementById("admin-map-preview-wrap");
  const previewIframe = document.getElementById("admin-map-preview-iframe");

  if (!mapInput || !previewWrap || !previewIframe) return;

  const raw = mapInput.value.trim();
  const address = addressInput ? addressInput.value.trim() : "";

  if (raw || address) {
    const { embedUrl } = parseGoogleMapUrl(raw, address);
    if (embedUrl) {
      previewIframe.src = embedUrl;
      previewWrap.style.display = "block";
      return;
    }
  }
  previewWrap.style.display = "none";
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

