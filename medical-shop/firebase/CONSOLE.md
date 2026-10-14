# מה להעתיק מ-Firebase Console

אחרי יצירת הפרויקט, מלאו את הקבצים הבאים מחוץ לגיט (`.env` מקומי + משתני Vercel).

## Project settings → General

1. `FIREBASE_PROJECT_ID` — מזהה הפרויקט.
2. `FIREBASE_WEB_API_KEY` — Web API Key.
3. `FIREBASE_AUTH_DOMAIN` — `PROJECT_ID.firebaseapp.com`.
4. `FIREBASE_STORAGE_BUCKET` — `PROJECT_ID.appspot.com` או `PROJECT_ID.firebasestorage.app`.

## Project settings → Service accounts

1. Generate new private key.
2. שמרו את קובץ ה-JSON מחוץ לריפו.
3. `GOOGLE_APPLICATION_CREDENTIALS` = הנתיב המלא לקובץ.

אל תדביקו את תוכן מפתח השירות לקוד לקוח או ל-GitHub.

## Authentication

1. Enable Email/Password.
2. צרו משתמש מנהל.
3. ב-Firestore צרו ידנית: `admins/{UID}` עם `{ "role": "admin" }`.

## Firestore / Storage

1. Create database (production או test).
2. Create storage bucket.
3. פרסמו את `firebase/firestore.rules` ו-`firebase/storage.rules`.
