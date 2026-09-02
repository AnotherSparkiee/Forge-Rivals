/**
 * @fileOverview Конфигурация Firebase.
 * API-ключ вынесен в окружение для гибкости.
 */

export const firebaseConfig = {
  "projectId": "studio-2788872209-f7092",
  "appId": "1:680539014052:web:3fafccf090ba18376d7731",
  "apiKey": process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDk-5jCdodI_Any76Jq2jiS3F_0DJBMnuo",
  "authDomain": "studio-2788872209-f7092.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "680539014052"
};
