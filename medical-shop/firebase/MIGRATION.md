# תוכנית מיגרציה ל-Firebase — ללא הרצה אוטומטית

הסקריפט `npm run migrate:firebase:dry` רק מייצא ובודק.
אין כתיבה ל-Firebase ואין מחיקת SQLite בלי אישור מפורש.

## Rollback

1. השאירו את `medical-shop/data/shop.db` במקומו.
2. אם משהו השתבש, שחזרו מתיקיית `medical-shop/backups/pro-pharm-*`.
3. אל תמחקו את SQLite גם אחרי מיגרציה מוצלחת, לפחות שבועיים.

## Apply בעתיד, רק אחרי אישור

```
FIREBASE_MIGRATE_CONFIRM=YES
FIREBASE_PROJECT_ID=...
GOOGLE_APPLICATION_CREDENTIALS=...
```

גם אז הסקריפט נעצר לפני כתיבה עד שתאשרו במפורש להסיר את עצירת הבטיחות.
