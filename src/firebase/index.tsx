export function initializeFirebase() {
  // 1. Если приложение уже есть, просто возвращаем SDK
  if (getApps().length > 0) {
    return getSdks(getApp());
  }

  let firebaseApp;
  
  // 2. Сначала пробуем конфиг (для разработки в IDX это надежнее)
  try {
    if (firebaseConfig && Object.keys(firebaseConfig).length > 0) {
      firebaseApp = initializeApp(firebaseConfig);
    } else {
      // Если конфиг пустой, пробуем авто-инициализацию
      firebaseApp = initializeApp();
    }
  } catch (e) {
    console.error("Firebase initialization failed:", e);
    // Последний шанс — достать уже созданное, если упало на повторе
    firebaseApp = getApp();
  }

  return getSdks(firebaseApp);
}