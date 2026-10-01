import { FirebaseError } from 'firebase/app'

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'האימייל או הסיסמה שגויים',
  'auth/invalid-email': 'כתובת האימייל לא תקינה',
  'auth/user-disabled': 'החשבון חסום',
  'auth/user-not-found': 'החשבון לא נמצא',
  'auth/wrong-password': 'האימייל או הסיסמה שגויים',
  'auth/too-many-requests': 'יותר מדי ניסיונות. נסו שוב בעוד רגע',
  'auth/email-already-in-use': 'האימייל כבר רשום',
  'auth/weak-password': 'הסיסמה קצרה מדי',
  'permission-denied': 'אין הרשאה לפעולה הזו',
  'unavailable': 'שירות Firebase לא זמין כרגע',
}

export function firebaseMessage(error: unknown, fallback = 'הפעולה נכשלה') {
  if (error instanceof FirebaseError) return MESSAGES[error.code] || fallback
  if (error instanceof Error && error.message) return error.message
  return fallback
}
