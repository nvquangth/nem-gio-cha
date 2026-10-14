/**
 * CẤU HÌNH FIREBASE - BẾP NHÀ LÀM
 * Quản trị viên được phân quyền bảo mật qua Cloud Firestore (Collection 'admins')
 */

// Cấu hình Firebase Project: nem-gio-cha
const firebaseConfig = {
  apiKey: "AIzaSyAs8geLKwq3zURmNxEFvthAGbX6k_DUsio",
  authDomain: "nem-gio-cha.firebaseapp.com",
  projectId: "nem-gio-cha",
  storageBucket: "nem-gio-cha.firebasestorage.app",
  messagingSenderId: "1068860645327",
  appId: "1:1068860645327:web:e8b7cd3860e82e0a5fbcba",
  measurementId: "G-6MHLX140ZH"
};

// Kiểm tra xem config đã được cấu hình thật chưa
function isFirebaseConfigured() {
  return (
    firebaseConfig &&
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== "YOUR_API_KEY" &&
    firebaseConfig.projectId !== "YOUR_PROJECT_ID"
  );
}

// Khởi tạo Firebase an toàn (chỉ khởi tạo khi đã có config thật và thư viện Firebase đã load)
let firebaseApp = null;
let firebaseAuth = null;
let firestoreDb = null;
let firebaseStorage = null;

function initFirebaseServices() {
  if (!isFirebaseConfigured()) {
    console.warn("⚠️ Firebase chưa được cấu hình. Đang chạy ở chế độ Dữ liệu mẫu cục bộ (Offline/Local mode). Vui lòng cập nhật firebase-config.js khi bạn tạo project.");
    return null;
  }

  if (typeof firebase === "undefined") {
    console.error("❌ Thư viện Firebase SDK chưa được nhúng vào HTML.");
    return null;
  }

  try {
    if (!firebase.apps.length) {
      firebaseApp = firebase.initializeApp(firebaseConfig);
    } else {
      firebaseApp = firebase.app();
    }
    
    if (typeof firebase.auth === "function") {
      firebaseAuth = firebase.auth();
    }
    if (typeof firebase.firestore === "function") {
      firestoreDb = firebase.firestore();
    }
    if (typeof firebase.storage === "function") {
      try {
        firebaseStorage = firebase.storage();
      } catch (e) {
        console.warn("Firebase Storage chưa được kích hoạt hoặc không khả dụng.");
      }
    }

    return { app: firebaseApp, auth: firebaseAuth, db: firestoreDb, storage: firebaseStorage };
  } catch (error) {
    console.error("Lỗi khởi tạo Firebase:", error);
    return null;
  }
}
