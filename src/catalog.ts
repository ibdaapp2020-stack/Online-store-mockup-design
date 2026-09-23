import type { CategoryId, Product } from './types'

export const photos = {
  iphone18: 'https://www.apple.com/v/iphone-18-pro/b/images/meta/iphone-18-pro_overview__bl9no3txkonm_og.png?202609172010',
  iphone17: 'https://www.apple.com/v/iphone-17/i/images/meta/iphone-17_overview__cg0rlzmbhl7m_og.png?202609231324',
  iphoneAir: 'https://www.apple.com/v/iphone-air/i/images/meta/iphone-air_overview__dwhg6l117yqa_og.png?202609231324',
  iphone16: 'https://www.apple.com/v/iphone-16-pro/a/images/overview/welcome/hero_endframe__b3cjfkquc2s2_large.jpg',
  airpods: 'https://www.apple.com/v/airpods-pro/t/images/meta/og__c0ceegchesom_overview.png?202609132104',
  macbookPro: 'https://www.apple.com/v/macbook-pro/ax/images/meta/macbook-pro__difvbgz1plsi_og.png?202608191258',
  macbookAir: 'https://www.apple.com/v/macbook-air/z/images/meta/macbook_air_mx__ez5y0k5yy7au_og.png',
  ipad: 'https://www.apple.com/v/ipad-pro/aw/images/meta/ipad-pro_overview__bu4cql27diaa_og.png?202609021131',
  watch: 'https://www.apple.com/assets-www/en_WW/watch/01_og/watch_og_9cde5b638.png',
  ps5: 'https://gmedia.playstation.com/is/image/SIEPDC/ps5-product-thumbnail-01-en-14sep21?$facebook$',
  ps5pro: 'https://gmedia.playstation.com/is/image/SIEPDC/ps5-pro-dualsense-image-block-01-en-16aug24?$facebook$',
}

const proColors = [
  { id: 'black', name: 'שחור', hex: '#1a1a1a' },
  { id: 'silver', name: 'כסוף', hex: '#d7d7dc' },
  { id: 'blue', name: 'תכלת', hex: '#9ec3d8' },
  { id: 'burg', name: 'בורגונדי', hex: '#6d2a38' },
]
const classicColors = [
  { id: 'black', name: 'שחור', hex: '#161616' },
  { id: 'white', name: 'לבן', hex: '#f3f3f5' },
  { id: 'pink', name: 'ורוד', hex: '#f0c2cb' },
  { id: 'blue', name: 'כחול', hex: '#8eb4d6' },
]
const storages = (steps: [string, number][]) => steps.map(([label, add]) => ({ id: label, label, add }))
const proStore = storages([
  ['256GB', 0],
  ['512GB', 900],
  ['1TB', 2600],
  ['2TB', 5300],
])
const phoneStore = storages([
  ['128GB', 0],
  ['256GB', 500],
  ['512GB', 1200],
])

type Seed = {
  id: string
  name: string
  brand: string
  category: CategoryId
  sub: string
  price: number
  blurb: string
  story: string
  image?: string
  images?: string[]
  official?: string
  colors?: Product['colors']
  storages?: Product['storages']
  specs?: string[]
  setupId?: string
  role?: string
  pairWith?: string[]
  badge?: string
  fit?: Product['fit']
  stock?: number
  rating?: number
  reviews?: number
}

function item(seed: Seed): Product {
  const images = seed.images ?? (seed.image ? [seed.image] : [])
  return {
    id: seed.id,
    name: seed.name,
    brand: seed.brand,
    category: seed.category,
    sub: seed.sub,
    price: seed.price,
    blurb: seed.blurb,
    story: seed.story,
    specs: seed.specs ?? ['אחריות יבואן', 'משלוח עד הבית או איסוף עצמי', 'חשבונית אוטומטית'],
    colors: seed.colors ?? [],
    storages: seed.storages ?? [],
    images,
    official: seed.official,
    setupId: seed.setupId,
    role: seed.role,
    pairWith: seed.pairWith,
    badge: seed.badge,
    fit: seed.fit ?? 'all',
    stock: seed.stock ?? 14,
    active: true,
    rating: seed.rating ?? 4.7,
    reviews: seed.reviews ?? 120,
  }
}

const close = 'בוחרים צבע ואחסון, משלוח עד הבית או איסוף עצמי, וחשבונית נפתחת בסוף ההזמנה.'

const SEEDS: Seed[] = [
  {
    id: 'iphone-18-pro-max',
    name: 'iPhone 18 Pro Max',
    brand: 'Apple',
    category: 'mobile',
    sub: 'iphone',
    price: 5899,
    blurb: 'המסך הגדול בסדרת 18. טיטניום, מצלמת פרו, וסוללה ליום ארוך.',
    story:
      'iPhone 18 Pro Max הוא הדגם הגדול בסדרת 18 של אפל. המסך ממלא כמעט את כל החזית, גוף הטיטניום נשאר יציב ביד למרות המידה, והמצלמה האחורית בנויה ליום, ללילה ולזום בלי לעבור בין מצבים. הצבעים שמגיעים לישראל הם שחור, כסוף, תכלת ובורגונדי. הנפח מתחיל ב־256GB ומטפס עד 2TB, למי שמצלם וידאו ולא מוחק. USB-C טוען את המכשיר ומחבר אותו למסך ולמחשב. ' +
      close,
    image: photos.iphone18,
    images: [photos.iphone18, photos.iphone16],
    official: 'https://www.apple.com/iphone-18-pro/',
    colors: proColors,
    storages: proStore,
    specs: ['מסך גדול OLED', 'גוף טיטניום', 'USB-C', 'מצלמת פרו', 'שנתיים אחריות יבואן'],
    pairWith: ['magsafe-case', 'glass', 'charger-35', 'airpods-pro'],
    badge: 'הנמכר',
    stock: 8,
    rating: 4.9,
    reviews: 640,
  },
  {
    id: 'iphone-18-pro',
    name: 'iPhone 18 Pro',
    brand: 'Apple',
    category: 'mobile',
    sub: 'iphone',
    price: 5399,
    blurb: 'הדגל הקומפקטי של סדרת 18. אותה מצלמה, מידה שנכנסת לכיס.',
    story:
      'iPhone 18 Pro הוא אותו דור של הפרו מקס, במידה שנוחה יותר ביד אחת. מסך בהיר, גוף טיטניום, ומערכת צילום שמחזיקה תמונה יציבה גם כשזזים. מתאים למי שרוצה את הסדרה החדשה בלי המסך הענק. הצבעים והנפחים זהים למשפחת הפרו, כולל 2TB למי שמחזיק ספריית וידאו על המכשיר. ' +
      close,
    image: photos.iphone18,
    official: 'https://www.apple.com/iphone-18-pro/',
    colors: proColors,
    storages: proStore,
    specs: ['OLED', 'טיטניום', 'USB-C', 'מצלמת פרו'],
    pairWith: ['magsafe-case', 'charger-35', 'airpods-pro'],
    badge: 'חדש',
    stock: 11,
    rating: 4.8,
    reviews: 510,
  },
  {
    id: 'iphone-17',
    name: 'iPhone 17',
    brand: 'Apple',
    category: 'mobile',
    sub: 'iphone',
    price: 3990,
    blurb: 'האייפון העגול של 2025. הבחירה הנפוצה לקו פרטי.',
    story:
      'iPhone 17 הוא המסלול המוכר לשדרוג שנתי: מסך OLED, USB-C, ומצלמה שמצלמת טוב בלי להיכנס להגדרות. הוא קל יותר מדגמי הפרו, מגיע בצבעים רגועים, והנפח מתחיל ב־128GB. בישראל הוא עדיין מהמכשירים שנגמרים ראשונים כי המחיר שלו יושב באמצע, והוא משלים כיסוי, מטען ואוזניות בלי לקפוץ לתקציב של דגל. ' +
      close,
    image: photos.iphone17,
    official: 'https://www.apple.com/iphone-17/',
    colors: classicColors,
    storages: phoneStore,
    specs: ['OLED', 'USB-C', '128GB ומעלה'],
    setupId: 'pocket',
    role: 'device',
    pairWith: ['magsafe-case', 'charger-35', 'airpods-pro'],
    rating: 4.7,
    reviews: 880,
  },
  {
    id: 'iphone-16-pro',
    name: 'iPhone 16 Pro',
    brand: 'Apple',
    category: 'mobile',
    sub: 'iphone',
    price: 4290,
    blurb: 'טיטניום וכפתור שליטה במצלמה. עדיין נמכר חזק אחרי ירידת מחיר.',
    story:
      'iPhone 16 Pro נשאר על המדף כי הוא כבר הוכיח את עצמו: גוף טיטניום, כפתור המצלמה, וזום שמספיק לטיולים ולאירועים. המחיר ירד אחרי שנכנסה סדרת 18, והמכשיר עדיין מקבל עדכונים לאורך שנים. בחירת הצבע והאחסון נשארת, והוא מתחבר לאותם אביזרים של מגסייף. ' +
      close,
    image: photos.iphone16,
    official: 'https://www.apple.com/iphone-16-pro/',
    colors: proColors,
    storages: proStore,
    specs: ['טיטניום', 'כפתור מצלמה', 'USB-C'],
    pairWith: ['magsafe-case', 'airpods-pro'],
  },
  {
    id: 'iphone-15',
    name: 'iPhone 15',
    brand: 'Apple',
    category: 'mobile',
    sub: 'iphone',
    price: 2490,
    blurb: 'האייפון שנשאר כי המחיר שלו הגיוני, עם USB-C.',
    story:
      'iPhone 15 הוא נקודת הכניסה שעדיין מרגישה עדכנית: USB-C, מסך בהיר, ומצלמה כפולה שמספיקה ליום יום. מי שעובר מאנדרואיד ישן או ממכשיר עם שקע ישן מקבל כאן את השפה של אפל בלי לשלם על דגם פרו. הנפחים הקטנים יותר מתאימים למי ששומר תמונות בענן. ' +
      close,
    image: photos.iphone16,
    official: 'https://www.apple.com/iphone-15/',
    colors: classicColors,
    storages: phoneStore,
    specs: ['USB-C', 'מסך OLED', 'אחריות יבואן'],
    pairWith: ['magsafe-case', 'glass'],
  },
  {
    id: 's26-ultra',
    name: 'Galaxy S26 Ultra',
    brand: 'Samsung',
    category: 'mobile',
    sub: 'samsung',
    price: 5290,
    blurb: 'האולטרה החדש. עט, מסך גדול, וזום שעדיין מבדיל את סמסונג.',
    story:
      'Galaxy S26 Ultra הוא המכשיר שקונים בישראל כשרוצים את הקצה של סמסונג: מסך גדול חד, S Pen שנשלף מהגוף, ומצלמה עם זום שמחליף מצלמת כיס. הוא מתאים גם למי שחותם על מסמכים מהשטח וגם למי שמצלם הופעות. האחסון עולה עד נפחים גדולים, והצבעים הכהים פחות מראים טביעות. אחריות היבואן והמשלוח זהים לשאר המכשירים בחנות. ' +
      close,
    official: 'https://www.samsung.com/il/smartphones/',
    colors: proColors,
    storages: proStore,
    specs: ['S Pen', 'מסך גדול', 'זום ארוך', 'שנתיים אחריות'],
    badge: 'אולטרה',
  },
  {
    id: 's25',
    name: 'Galaxy S25',
    brand: 'Samsung',
    category: 'mobile',
    sub: 'samsung',
    price: 3190,
    blurb: 'דגל קומפקטי אחרי ירידת מחיר. נוח ביד אחת.',
    story:
      'Galaxy S25 הוא הדגל בלי המידה של האולטרה. המסך חד, הסוללה מחזיקה יום עבודה, והמכשיר נכנס לכיס בלי לבלוט. אחרי שסדרת 26 נכנסה, המחיר שלו ירד והוא נהיה הבחירה של מי שרוצה סמסונג עדכני בלי לשלם על העט והזום הארוך. ' +
      close,
    official: 'https://www.samsung.com/il/smartphones/',
    colors: classicColors,
    storages: phoneStore,
    specs: ['מסך חד', 'סוללה ליום', 'אחריות יבואן'],
  },
  {
    id: 'a56',
    name: 'Galaxy A56',
    brand: 'Samsung',
    category: 'mobile',
    sub: 'samsung',
    price: 1590,
    blurb: 'המדרגה שאנשים קונים כשרוצים סמסונג בלי מחיר דגל.',
    story:
      'Galaxy A56 ממלא את רוב קווי הסלולר בארץ: מסך גדול, סוללה רגועה, ומצלמה שמספיקה לילדים, לוואטסאפ ולחופשה. הוא לא מתיימר להיות אולטרה, ודווקא בגלל זה המחיר שלו נשאר הגיוני כשקונים שני מכשירים הביתה. הכיסוי והמגן זולים יחסית, והאחריות של היבואן מכסה את השנתיים הראשונות. ' +
      close,
    official: 'https://www.samsung.com/il/smartphones/',
    colors: classicColors,
    storages: phoneStore,
    specs: ['מסך גדול', 'סוללה ארוכה', 'מחיר כניסה'],
    badge: 'שווה',
  },
  {
    id: 'pixel-10-pro',
    name: 'Pixel 10 Pro',
    brand: 'Google',
    category: 'mobile',
    sub: 'pixel',
    price: 4490,
    blurb: 'המצלמה של גוגל, בלי שכבות מיותרות על האנדרואיד.',
    story:
      'Pixel 10 Pro נבנה סביב הצילום. העיבוד של גוגל מיישר אור, פנים ושמיים בלי שתצטרכו לערוך, והמערכת נשארת נקייה בלי מעטפת כבדה. בישראל הוא מגיע עם עברית מלאה, עדכוני אבטחה ישירים מגוגל, ונפח שמתחיל גבוה מספיק לווידאו. מתאים למי שעזב סמסונג בגלל התפריטים, ועדיין רוצה אנדרואיד. ' +
      close,
    official: 'https://store.google.com/category/phones',
    colors: classicColors,
    storages: proStore,
    specs: ['מצלמת פיקסל', 'עדכונים ישירים', 'אנדרואיד נקי'],
    badge: 'צילום',
  },
  {
    id: 'pixel-10',
    name: 'Pixel 10',
    brand: 'Google',
    category: 'mobile',
    sub: 'pixel',
    price: 3490,
    blurb: 'הפיקסל הרגיל. אותה שפת צילום, מידה נוחה יותר.',
    story:
      'Pixel 10 לוקח את הצילום של סדרת הפרו ומוריד את המחיר ואת המידה. המסך נוח ביד, הסוללה מספיקה ליום, והעדכונים מגיעים בלי לחכות ליבואן. מי שרוצה את הפיקסל בלי לשלם על העדשה הנוספת של הפרו נעצר כאן. ' +
      close,
    official: 'https://store.google.com/category/phones',
    colors: classicColors,
    storages: phoneStore,
    specs: ['צילום חישובי', 'עדכונים ישירים'],
  },
  {
    id: 'xiaomi-15-ultra',
    name: 'Xiaomi 15 Ultra',
    brand: 'Xiaomi',
    category: 'mobile',
    sub: 'xiaomi',
    price: 4490,
    blurb: 'מצלמה גדולה וזום, למי שרוצה דגל בלי לעבור לאפל.',
    story:
      'Xiaomi 15 Ultra מגיע לישראל בשביל המצלמה: חיישן גדול, זום ששומר פרטים, ומסך בהיר בחוץ. הטעינה מהירה מהדגלים של אפל, והמחיר יושב מתחת לסדרת הפרו. המכשיר עבה יותר בגלל העדשות, ומי שמצלם טיולים מרגיש את זה בתמונה ולא במשקל בתיק. ' +
      close,
    official: 'https://www.mi.com/il',
    colors: proColors,
    storages: proStore,
    specs: ['מצלמת אולטרה', 'טעינה מהירה', 'מסך בהיר'],
  },
  {
    id: 'redmi-note-14',
    name: 'Redmi Note 14 Pro',
    brand: 'Xiaomi',
    category: 'mobile',
    sub: 'xiaomi',
    price: 1290,
    blurb: 'הנוט שממלא את הרשתות. מסך גדול ומחיר רגוע.',
    story:
      'Redmi Note 14 Pro הוא המכשיר שקונים כשצריך טלפון חדש השבוע, לא דגל לשנתיים של צילום. המסך גדול, הסוללה מחזיקה מעבר ליום, והמחיר משאיר מקום לכיסוי ולמגן. הוא מיובא רשמית, עם אחריות, ומתאים כמכשיר שני או כשדרוג ממכשיר בן ארבע. ' +
      close,
    official: 'https://www.mi.com/il',
    colors: classicColors,
    storages: phoneStore,
    specs: ['מסך גדול', 'סוללה ארוכה', 'מחיר כניסה'],
    badge: 'נמכר',
  },
  {
    id: 'mba-13',
    name: 'MacBook Air 13',
    brand: 'Apple',
    category: 'computer',
    sub: 'mac',
    price: 4990,
    blurb: 'הנייד ללימודים ולבית. דק, שקט, ומספיק ליום בלי מטען.',
    story:
      'MacBook Air 13 הוא הנייד שאפל בנתה למי שסוחב מחשב כל היום. אין מאוורר שנשמע, הגוף דק, והסוללה מחזיקה הרצאות ופגישות בלי לחפש שקע. 16GB זיכרון ו־512GB אחסון מספיקים לדפדפן, למסמכים ולעריכה קלה. הוא חלק מעמדת העבודה: מקלדת, עכבר ומסך משלימים אותו כשחוזרים לשולחן. ' +
      close,
    image: photos.macbookAir,
    official: 'https://www.apple.com/macbook-air/',
    colors: classicColors,
    specs: ['13 אינץ׳', '16GB', '512GB', 'שקט'],
    setupId: 'desk',
    role: 'computer',
    pairWith: ['keyboard', 'mouse', 'monitor-27'],
  },
  {
    id: 'mbp-14',
    name: 'MacBook Pro 14',
    brand: 'Apple',
    category: 'computer',
    sub: 'mac',
    price: 8990,
    blurb: 'הפרו של הצוותים. מסך בהיר ושקע שמחזיק עריכה.',
    story:
      'MacBook Pro 14 הוא המחשב שמחלקות לוקחות כשאייר כבר לא מספיק. המסך בהיר בחדר מואר, היציאות מחברות מסך בלי מתאם לכל כבל, והמעבד מחזיק ייצוא וידאו וקומפילציה בלי להאט באמצע. 24GB ו־1TB הם נקודת הפתיחה לעבודה, ותחנת עגינה סוגרת את השולחן בכבל אחד. ' +
      close,
    image: photos.macbookPro,
    official: 'https://www.apple.com/macbook-pro/',
    colors: proColors,
    specs: ['14 אינץ׳', '24GB', '1TB', 'מסך בהיר'],
    fit: 'business',
    badge: 'לצוות',
    pairWith: ['dock', 'monitor-27'],
  },
  {
    id: 'imac',
    name: 'iMac 24',
    brand: 'Apple',
    category: 'computer',
    sub: 'mac',
    price: 6490,
    blurb: 'הכול במסך אחד. לשולחן הבית או לדלפק הקבלה.',
    story:
      'iMac 24 שם את המחשב בתוך המסך. אין מגדל מתחת לשולחן, המקלדת והעכבר מגיעים איתו, והצבע של הגוף נשאר חלק מהחדר. מתאים לקבלה, למטבח ולמי שעובד תמיד מאותו שולחן. החיבורים יושבים מאחור, והמסך חד מספיק למסמכים ולתמונות. ' +
      close,
    image: photos.macbookAir,
    official: 'https://www.apple.com/imac/',
    colors: classicColors,
    specs: ['24 אינץ׳', 'מקלדת ועכבר', 'הכול במסך'],
  },
  {
    id: 'thinkpad-x1',
    name: 'ThinkPad X1 Carbon',
    brand: 'Lenovo',
    category: 'computer',
    sub: 'windows',
    price: 6890,
    blurb: 'המקלדת שמחלקות IT קונות שוב. קל, שקט, וווינדוס.',
    story:
      'ThinkPad X1 Carbon הוא הנייד שווינדוס ארגוני עדיין מעדיף. המקלדת נמוכה ומדויקת, הגוף קל לטיסות, והאבטחה מתאימה למחשב שמחובר לרשת של חברה. 32GB זיכרון מחזיקים עשרות לשוניות ומסמכים פתוחים. הוא לא מחשב משחק, והוא בדיוק בשביל יום עבודה ארוך. ' +
      close,
    official: 'https://www.lenovo.com/il/he/',
    specs: ['14 אינץ׳', '32GB', 'מקלדת ThinkPad'],
    fit: 'business',
    badge: 'למחלקות',
  },
  {
    id: 'xps-14',
    name: 'XPS 14',
    brand: 'Dell',
    category: 'computer',
    sub: 'windows',
    price: 7490,
    blurb: 'ווינדוס דק, מסך צפוף, למי שלא עובר למק.',
    story:
      'XPS 14 הוא התשובה של דל למי שרוצה מחשב דק עם ווינדוס ומסך שנראה טוב בעריכה. המסגרת דקה, הגוף אלומיניום, ו־32GB עם 1TB מספיקים לפרויקט בלי דיסק חיצוני. מתאים למעצבים שנשארים על תוכנות ווינדוס ולמשרד שכבר חי ב־Microsoft 365. ' +
      close,
    official: 'https://www.dell.com/he-il',
    colors: proColors,
    specs: ['14 אינץ׳', '32GB', '1TB'],
    fit: 'business',
  },
  {
    id: 'ipad-pro',
    name: 'iPad Pro 13',
    brand: 'Apple',
    category: 'computer',
    sub: 'tablet',
    price: 5490,
    blurb: 'הטאבלט שמחליף לפטופ קל. מסך גדול ועפרון.',
    story:
      'iPad Pro 13 הוא המסך שלוקחים לפגישה במקום מחשב, כשהעבודה היא ציור, חתימה, או מצגת. עם Apple Pencil הוא מרגיש כמו נייר מהיר, והאחסון עולה אם שומרים פרויקטים על המכשיר. הוא לא מחליף מקבוק פרו לעריכת וידאו כבדה, והוא כן מחליף את הנייד הקל בתיק. ' +
      close,
    image: photos.ipad,
    official: 'https://www.apple.com/ipad-pro/',
    colors: classicColors,
    storages: phoneStore,
    specs: ['13 אינץ׳', 'תמיכה ב־Pencil', 'מסך בהיר'],
    pairWith: ['pencil', 'magsafe-case'],
  },
  {
    id: 'ipad-air',
    name: 'iPad Air',
    brand: 'Apple',
    category: 'computer',
    sub: 'tablet',
    price: 2990,
    blurb: 'האייר של האייפדים. הדגם שקונים ללימודים.',
    story:
      'iPad Air יושב באמצע: קל יותר מהפרו, חזק יותר מהאייפד הרגיל, ומספיק לשיעורים, לציור ולנטפליקס על הספה. הסטודנטים לוקחים אותו עם עפרון, וההורים לוקחים אותו בלי. הנפח הבסיסי מספיק אם הקבצים בענן. ' +
      close,
    image: photos.ipad,
    official: 'https://www.apple.com/ipad-air/',
    colors: classicColors,
    storages: phoneStore,
    specs: ['מסך נוח', 'תמיכה בעפרון', 'קל בתיק'],
  },
  {
    id: 'monitor-27',
    name: 'מסך 27 QHD',
    brand: 'LG',
    category: 'computer',
    sub: 'monitor',
    price: 1290,
    blurb: '27 אינץ׳ לעמדת עבודה. חד, ולא גדול מדי לשולחן.',
    story:
      'מסך 27 אינץ׳ ברזולוציית QHD הוא המידה שעמדת עבודה צריכה: מספיק רחב לשני חלונות, חד לטקסט, ולא תופס את כל השולחן. חיבור USB-C מביא תמונה וטעינה לנייד בכבל אחד. הוא החלק שסוגר את עמדת העבודה יחד עם המקלדת והעכבר. ' +
      close,
    official: 'https://www.lg.com/il',
    specs: ['27 אינץ׳', 'QHD', 'USB-C'],
    setupId: 'desk',
    role: 'screen',
  },
  {
    id: 'monitor-32',
    name: 'מסך 32 4K',
    brand: 'Samsung',
    category: 'computer',
    sub: 'monitor',
    price: 2190,
    blurb: 'מסך רחב לעריכה ולשולחן הבית. 4K על 32 אינץ׳.',
    story:
      'מסך 32 אינץ׳ ב־4K נותן מקום אמיתי לציר זמן, לגיליון ולחלון וידאו בלי להתפשר על חדות. הוא גדול לשולחן קטן, ומתאים למי שיושב מולו כל היום או מחבר קונסולה לסלון בלי טלוויזיה נפרדת. הכיוון והגובה נשמרים אחרי שמזיזים אותו פעם אחת. ' +
      close,
    official: 'https://www.samsung.com/il/monitors/',
    specs: ['32 אינץ׳', '4K', 'לעריכה ולסלון'],
  },
  {
    id: 'ps5',
    name: 'PlayStation 5',
    brand: 'Sony',
    category: 'gaming',
    sub: 'console',
    price: 2190,
    blurb: 'הקונסולה של הסלון. דיסק, בקר, ומשחקים שכולם מדברים עליהם.',
    story:
      'PlayStation 5 היא הקונסולה שנמצאת ברוב הסלונים שמשחקים בהם בערב. הכונן קורא דיסקים, הבקר מרגיש את המשחק בטריגרים, והתמונה על מסך גדול נשארת הסיבה שקונים אותה ולא משחקים רק בטלפון. אוזניות ובקר נוסף משלימים ערכה לשניים. ' +
      close,
    image: photos.ps5,
    official: 'https://www.playstation.com/en-us/ps5/',
    specs: ['כונן דיסקים', 'בקר DualSense', '4K'],
    badge: 'סלונים',
    pairWith: ['dualsense', 'pulse-headset'],
  },
  {
    id: 'ps5-pro',
    name: 'PlayStation 5 Pro',
    brand: 'Sony',
    category: 'gaming',
    sub: 'console',
    price: 3290,
    blurb: 'הפרו למי שכבר יש מסך גדול ורוצה תמונה חלקה יותר.',
    story:
      'PlayStation 5 Pro מיועדת למי שכבר יושב מול מסך גדול ורואה את ההבדל בקצב וברזולוציה. היא מריצה את אותם משחקים, עם יותר מרווח גרפי, בלי להחליף את הספרייה. הבקר נשאר DualSense, והאוזניות של סוני יושבות עליה בלי מתאם. ' +
      close,
    image: photos.ps5pro,
    official: 'https://www.playstation.com/en-us/ps5/ps5-pro/',
    specs: ['ביצועים גבוהים יותר', 'תואם למשחקי PS5'],
    badge: 'פרו',
  },
  {
    id: 'xbox-x',
    name: 'Xbox Series X',
    brand: 'Microsoft',
    category: 'gaming',
    sub: 'console',
    price: 2290,
    blurb: 'האקסבוקס החזק, עם Game Pass וכונן.',
    story:
      'Xbox Series X הוא הגוף הגדול של מיקרוסופט: שקט יחסית, כונן, וגישה ל־Game Pass שמחליפה מדף של דיסקים. מתאים למי שכבר בנה ספרייה באקסבוקס או משחק גם במחשב עם אותו חשבון. הבקר האלחוטי עובד גם על ווינדוס. ' +
      close,
    official: 'https://www.xbox.com/he-IL/consoles/xbox-series-x',
    specs: ['כונן', 'Game Pass', '4K'],
  },
  {
    id: 'dualsense',
    name: 'DualSense',
    brand: 'Sony',
    category: 'gaming',
    sub: 'gear',
    price: 299,
    blurb: 'הבקר של הפלייסטיישן. טריגרים שמרגישים את המשחק.',
    story:
      'DualSense הוא הבקר שמגיע עם הפלייסטיישן, וקונים אותו שוב כשצריך אחד לשחקן השני או כשהישן נשחק. הטריגרים משתנים לפי המשחק, המשטח המרכזי מגיב למגע, והסוללה מחזיקה ערב. יש כמה צבעים, והוא החלק שסוגר עמדת גיימינג. ' +
      close,
    official: 'https://www.playstation.com/',
    colors: classicColors,
    specs: ['הפטיקה', 'טריגרים אדפטיביים', 'אלחוטי'],
    setupId: 'play',
    role: 'pad',
  },
  {
    id: 'pulse-headset',
    name: 'Pulse Elite',
    brand: 'Sony',
    category: 'gaming',
    sub: 'gear',
    price: 549,
    blurb: 'אוזניות סגורות לפלייסטיישן, עם מיקרופון שנשמע בשיחה.',
    story:
      'Pulse Elite סוגרות את הרעש של הסלון ומחברות ישירות לפלייסטיישן בלי דונגל שנאבד. המיקרופון מספיק לשיחה עם החברים, והאוזניות נוחות למשחק ארוך יותר מאוזניות טלפון. הן חלק מעמדת הגיימינג יחד עם העכבר, המקלדת והבקר. ' +
      close,
    official: 'https://www.playstation.com/',
    specs: ['אלחוטי', 'מיקרופון', 'לפלייסטיישן'],
    setupId: 'play',
    role: 'audio',
  },
  {
    id: 'gpro-mouse',
    name: 'G Pro X',
    brand: 'Logitech',
    category: 'gaming',
    sub: 'gear',
    price: 499,
    blurb: 'עכבר קל למי שמשחק רציני על המחשב.',
    story:
      'G Pro X הוא עכבר קל לתנועות מהירות. החיישן לא מאבד את הסמן, המשקל לא מעייף אחרי שעה, והחיבור האלחוטי נשאר יציב על המחשב. הוא לא עכבר משרדי שקט, והוא כן העכבר שלוקחים לעמדת משחק. ' +
      close,
    official: 'https://www.logitechg.com/he-il',
    specs: ['קל', 'אלחוטי', 'חיישן משחק'],
    setupId: 'play',
    role: 'mouse',
  },
  {
    id: 'gpro-keys',
    name: 'מקלדת משחק אלחוטית',
    brand: 'Logitech',
    category: 'gaming',
    sub: 'gear',
    price: 699,
    blurb: 'מקלדת נמוכה עם תאורה, לשולחן המשחק.',
    story:
      'המקלדת הנמוכה משאירה את שורש כף היד ישר ואת התאורה רק איפה שצריך בלילה. היא אלחוטית, נטענת, ומספיק שקטה לשולחן בסלון. יחד עם העכבר, האוזניות והבקר היא סוגרת עמדת גיימינג מלאה. ' +
      close,
    official: 'https://www.logitechg.com/he-il',
    specs: ['פרופיל נמוך', 'אלחוטית', 'תאורה'],
    setupId: 'play',
    role: 'keys',
  },
  {
    id: 'airpods-pro',
    name: 'AirPods Pro',
    brand: 'Apple',
    category: 'accessories',
    sub: 'audio',
    price: 999,
    blurb: 'ביטול רעשים לדרך ולשיחות. הזוג שמשלימים לאייפון.',
    story:
      'AirPods Pro יושבות באוזן עם אטם, סוגרות רעש של אוטובוס ומשרד, ועוברות לשקיפות כשצריך לשמוע את הרחוב. הן מתחברות לאייפון בלי תפריט, הקופסה נטענת במגסייף, והשיחות נשמעות ברור יותר מאוזניות פתוחות. זה החלק של השמע בכיס המושלם. ' +
      close,
    image: photos.airpods,
    official: 'https://www.apple.com/airpods-pro/',
    specs: ['ביטול רעשים', 'קופסת MagSafe', 'לאייפון'],
    setupId: 'pocket',
    role: 'audio',
    badge: 'שמע',
  },
  {
    id: 'sony-xm5',
    name: 'WH-1000XM5',
    brand: 'Sony',
    category: 'accessories',
    sub: 'audio',
    price: 1290,
    blurb: 'אוזניות גדולות לטיסות ולמשרד. ביטול רעשים שקט.',
    story:
      'WH-1000XM5 הן האוזניות שלוקחים לטיסה וליום עבודה פתוח. ביטול הרעשים חזק יותר מאוזניות כיס, הרפידות רכות לאורך שעות, והסוללה מחזיקה את היום בלי טעינה בצהריים. הן מתחברות לבלוטות׳ לכל טלפון, לא רק לאייפון. ' +
      close,
    official: 'https://www.sony.co.il/',
    specs: ['ביטול רעשים', 'סוללה ארוכה', 'מעל האוזן'],
  },
  {
    id: 'charger-35',
    name: 'מטען 35W כפול',
    brand: 'Apple',
    category: 'accessories',
    sub: 'power',
    price: 249,
    blurb: 'שתי יציאות. טלפון ואוזניות מאותו שקע.',
    story:
      'מטען 35W של אפל שם שתי יציאות USB-C על שקע אחד. בלילה הוא טוען את האייפון ואת הקופסה של האוזניות יחד, ובתיק הוא קטן מספיק כדי לא להחליף מטען נפרד לכל מכשיר. הוא החלק של הטעינה בכיס המושלם. ' +
      close,
    official: 'https://www.apple.com/shop/accessories/all/power-cables',
    specs: ['35W', 'שתי יציאות', 'USB-C'],
    setupId: 'pocket',
    role: 'power',
  },
  {
    id: 'keyboard',
    name: 'מקלדת אלחוטית',
    brand: 'Logitech',
    category: 'accessories',
    sub: 'power',
    price: 349,
    blurb: 'מקלדת שקטה למשרד ולשולחן הבית.',
    story:
      'המקלדת האלחוטית של לוג׳יטק שקטה מספיק לשיחת וידאו באותו חדר, והמקשים נמוכים לכתיבה ארוכה. היא מתחברת למק ולווינדוס, והסוללה מחזיקה חודשים. בעמדת העבודה היא יושבת מול המסך, ליד העכבר. ' +
      close,
    official: 'https://www.logitech.com/he-il',
    specs: ['שקטה', 'אלחוטית', 'רב־מערכת'],
    setupId: 'desk',
    role: 'keys',
  },
  {
    id: 'mouse',
    name: 'עכבר אלחוטי',
    brand: 'Logitech',
    category: 'accessories',
    sub: 'power',
    price: 199,
    blurb: 'עכבר שקט ליום עבודה. לא עכבר משחק.',
    story:
      'העכבר השקט מיועד למסמכים ולדפדפן, לא למשחק תחרותי. הוא קל, האלחוט יציב, והגלילה מדויקת בגיליונות. יחד עם המקלדת והמסך הוא סוגר את עמדת העבודה בלי כבלים על השולחן. ' +
      close,
    official: 'https://www.logitech.com/he-il',
    specs: ['שקט', 'אלחוטי', 'למשרד'],
    setupId: 'desk',
    role: 'mouse',
  },
  {
    id: 'dock',
    name: 'תחנת עגינה',
    brand: 'CalDigit',
    category: 'accessories',
    sub: 'power',
    price: 899,
    blurb: 'כבל אחד למסך, לטעינה ולרשת.',
    story:
      'תחנת העגינה מחברת מסך, רשת, וכוננים לנייד בכבל אחד, וגם טוענת אותו. בעמדת עבודה עסקית היא מחליפה את המסך החיצוני כחלק הרביעי, כי הנייד נסגר בסוף היום ונשאר מחובר מחר באותו שקע. ' +
      close,
    official: 'https://www.caldigit.com/',
    specs: ['USB-C', 'מסך ורשת', 'טעינה'],
    fit: 'business',
    setupId: 'desk',
    role: 'screen',
  },
  {
    id: 'watch-s11',
    name: 'Apple Watch Series 11',
    brand: 'Apple',
    category: 'accessories',
    sub: 'wear',
    price: 1790,
    blurb: 'השעון לאימונים, לשינה ולהודעות על היד.',
    story:
      'Apple Watch Series 11 מודד אימון, דופק ושינה, ומראה הודעות בלי להוציא את הטלפון. הוא צריך אייפון לידו, הרצועה מתחלפת, והמסך נשאר קריא בשמש. זה לא מכשיר עצמאי למי שנמצא על אנדרואיד. ' +
      close,
    image: photos.watch,
    official: 'https://www.apple.com/apple-watch-series-11/',
    colors: classicColors,
    specs: ['מעקב אימון', 'הודעות', 'לאייפון'],
  },
  {
    id: 'pencil',
    name: 'Apple Pencil Pro',
    brand: 'Apple',
    category: 'accessories',
    sub: 'wear',
    price: 549,
    blurb: 'העפרון לאייפד. כתיבה, ציור ולחיצה.',
    story:
      'Apple Pencil Pro נצמד לאייפד מגנטית, נטען שם, ומגיב ללחיצה ולגלגול. כותבים איתו סיכום, חותמים, ומסמנים על תמונה בלי עיכוב שמורגש. הוא משלים את האייפד פרו ואת האייר, ולא עובד על כל דור ישן. ' +
      close,
    official: 'https://www.apple.com/apple-pencil/',
    specs: ['מגנטי', 'לחיצה', 'לאייפד'],
  },
  {
    id: 'magsafe-case',
    name: 'כיסוי MagSafe',
    brand: 'Apple',
    category: 'accessories',
    sub: 'protect',
    price: 199,
    blurb: 'כיסוי שקוף עם מגנט. נטען בלי להוריד אותו.',
    story:
      'כיסוי ה־MagSafe שומר על הגב והפינות ועדיין נצמד למטען המגנטי ולתושבת ברכב. הוא שקוף כדי שהצבע שבחרתם באייפון יישאר גלוי, והמגנט מיושר כך שהטעינה לא נקטעת. זה המיגון של הכיס המושלם. ' +
      close,
    official: 'https://www.apple.com/shop/accessories/all/cases-protection',
    colors: classicColors,
    specs: ['MagSafe', 'שקוף', 'לאייפון'],
    setupId: 'pocket',
    role: 'guard',
  },
  {
    id: 'glass',
    name: 'מגן זכוכית',
    brand: 'DESIGMA',
    category: 'accessories',
    sub: 'protect',
    price: 69,
    blurb: 'זכוכית מחוסמת למסך. נמרחת בדקה.',
    story:
      'מגן הזכוכית יושב על המסך וסופג את המפתח בכיס במקום הזכוכית של המכשיר. ההתקנה עם מסגרת, בלי בועות אם מנקים את המסך קודם. הוא זול מהחלפת מסך במעבדה, והוא החלק השני של המיגון ליד הכיסוי. ' +
      close,
    specs: ['זכוכית מחוסמת', 'כולל מסגרת הדבקה'],
    setupId: 'pocket',
    role: 'guard',
  },
  {
    id: 'repair-screen-home',
    name: 'החלפת מסך עד הבית',
    brand: 'DESIGMA Lab',
    category: 'repair',
    sub: 'visit',
    price: 349,
    blurb: 'טכנאי מגיע ומחליף מסך שבור, בתיאום.',
    story:
      'החלפת מסך עד הבית מיועדת למכשיר שנפל והתמונה נסדקה או נעלמה. טכנאי מגיע לכתובת שקבעתם, בודק שהמגע והתאורה חזרו, ומשאיר את המכשיר אצלכם. החלק תואם לדגם, והתיקון מקבל 90 יום אחריות. אם המסך דולף נוזל או שהמכשיר נרטב, עדיף קודם אבחון ולא החלפה עיוורת. אפשר גם להעלות תמונות של השבר ולקבל הצעת מחיר לפני שקובעים הגעה.',
    specs: ['הגעה עד הבית', 'חלק תואם', 'אחריות 90 יום'],
    badge: 'עד הבית',
    stock: 40,
  },
  {
    id: 'repair-battery-home',
    name: 'החלפת סוללה עד הבית',
    brand: 'DESIGMA Lab',
    category: 'repair',
    sub: 'visit',
    price: 249,
    blurb: 'סוללה שנגמרת בצהריים. מחליפים אצלכם.',
    story:
      'החלפת סוללה עד הבית מתאימה למכשיר שבריאות הסוללה שלו ירדה והוא נכבה באמצע היום. הטכנאי מחליף את התא אצלכם, מכייל טעינה, ובודק שהמכשיר עולה. לא משאירים את הטלפון במעבדה ללילה. האחריות על ההחלפה היא 90 יום. אם המכשיר גם תפוח, מעלים תמונה של הגב לפני ההגעה.',
    specs: ['הגעה עד הבית', 'בדיקת סוללה', 'אחריות 90 יום'],
    stock: 40,
  },
  {
    id: 'repair-diag-home',
    name: 'אבחון עד הבית',
    brand: 'DESIGMA Lab',
    category: 'repair',
    sub: 'visit',
    price: 79,
    blurb: 'לא בטוחים מה שבור. בודקים ונותנים מחיר לפני תיקון.',
    story:
      'אבחון עד הבית הוא הביקור כשלא ברור אם הבעיה במסך, בסוללה או בשקע. הטכנאי בודק את המכשיר אצלכם ומשאיר מחיר כתוב לפני שנוגעים בחלק. דמי האבחון יורדים ממחיר התיקון אם ממשיכים. אם יש תמונות של הנזק, שולחים אותן לפני הביקור כדי שהחלק הנכון יגיע עם הטכנאי.',
    specs: ['הגעה עד הבית', 'האבחון יורד מהתיקון'],
    badge: 'מתחילים כאן',
    stock: 50,
  },
  {
    id: 'repair-screen-lab',
    name: 'החלפת מסך במעבדה',
    brand: 'DESIGMA Lab',
    category: 'repair',
    sub: 'lab',
    price: 299,
    blurb: 'מביאים את המכשיר, אוספים כשהמסך חדש.',
    story:
      'החלפת מסך במעבדה זולה יותר מהגעה הביתה, כי המכשיר מגיע אלינו. בודקים את המגע, את הצבע ואת ה־Face ID או חיישן הטביעת אצבע לפני המסירה. זמן הטיפול בדרך כלל באותו יום אם החלק במלאי. איסוף עצמי מהמעבדה, עם 90 יום אחריות על התיקון.',
    specs: ['במעבדה', 'איסוף עצמי', 'אחריות 90 יום'],
    stock: 40,
  },
  {
    id: 'repair-water',
    name: 'טיפול אחרי מים',
    brand: 'DESIGMA Lab',
    category: 'repair',
    sub: 'lab',
    price: 189,
    blurb: 'כיבוי, ייבוש ובדיקה אחרי נפילה למים.',
    story:
      'טיפול אחרי מים מתחיל בכיבוי ובייבוש מבוקר, לא באורז ובשקע. במעבדה פותחים, מנקים מגעים, ובודקים מסך, שמע וטעינה. אין הבטחה שהמכשיר יחזור לחיים אם המים הגיעו ללוח. מעלים תמונה של מצב המכשיר וכותבים מתי הוא נרטב, כדי שנדע אם כדאי לפתוח או לעצור.',
    specs: ['במעבדה', 'בלי הבטחה להצלה מלאה'],
    stock: 20,
  },
  {
    id: 'fleet-iphone',
    name: 'ערכת אייפון למחלקה',
    brand: 'Apple',
    category: 'enterprise',
    sub: 'fleet',
    price: 4190,
    blurb: 'מכשיר אחיד לעובדים, עם כיסוי ומטען.',
    story:
      'ערכת האייפון למחלקה מיישרת את אותו דגם, אותו כיסוי ואותו מטען לכל עובד חדש. המחיר הוא ליחידה, והנחת הכמות נכנסת כשמזמינים כמה ערכות יחד. מתאים לקליטה של צוות בלי שכל אחד יבחר מכשיר אחר. הציוד הזה מופיע רק במחירון העסקי.',
    official: 'https://www.apple.com/business/',
    fit: 'business',
    pairWith: ['magsafe-case', 'charger-35'],
    badge: 'לעסקים',
    specs: ['מכשיר אחיד', 'כיסוי', 'מטען'],
  },
  {
    id: 'fleet-laptop',
    name: 'ערכת נייד לעובד',
    brand: 'Lenovo',
    category: 'enterprise',
    sub: 'fleet',
    price: 5690,
    blurb: 'נייד, עכבר ותחנת עגינה כחבילת קליטה.',
    story:
      'ערכת הנייד לעובד כוללת מחשב ווינדוס, עכבר ותחנת עגינה, כדי שביום הראשון יש שולחן עובד ולא רשימת קניות. הכמות קובעת את ההנחה, ואפשר לשכפל את אותה עמדה לכמה עובדים מהסל. החבילה מוצגת ללקוחות עסקיים בלבד.',
    official: 'https://www.lenovo.com/il/he/',
    fit: 'business',
    pairWith: ['dock', 'mouse'],
    specs: ['נייד', 'עכבר', 'עגינה'],
  },
  {
    id: 'meet-cam',
    name: 'מצלמת חדר ישיבות',
    brand: 'Logitech',
    category: 'enterprise',
    sub: 'meeting',
    price: 2490,
    blurb: 'מצלמה רחבה לשולחן הישיבות, עם מיקרופונים.',
    story:
      'מצלמת חדר הישיבות מכסה את השולחן בלי שמישהו יחזיק לפטופ מול כולם. המיקרופונים קולטים את החדר, והתמונה נשארת יציבה כשמישהו זז. מתאימה לחדר קבוע, לא לתיק. מוצגת בקטגוריית הציוד העסקי.',
    official: 'https://www.logitech.com/he-il',
    fit: 'business',
    specs: ['זווית רחבה', 'מיקרופונים', 'לחדר קבוע'],
  },
  {
    id: 'barcode',
    name: 'קורא ברקוד אלחוטי',
    brand: 'Zebra',
    category: 'enterprise',
    sub: 'meeting',
    price: 890,
    blurb: 'למחסן ולדלפק. סורק ומעביר למחשב.',
    story:
      'קורא הברקוד האלחוטי עובד בדלפק ובמעבר במחסן. הוא קורא מדבקות משלוח ומדפי מלאי ומעביר את המק״ט למחשב בלי כבל שנמתח. הסוללה מחזיקה משמרת, והבסיס טוען אותו בין סריקות. פריט לקטלוג העסקי.',
    official: 'https://www.zebra.com/',
    fit: 'business',
    specs: ['אלחוטי', 'למחסן ולדלפק', 'בסיס טעינה'],
  },
]

export const SEED: Product[] = SEEDS.map(item)

export const banners = [
  {
    image: photos.iphone18,
    kicker: 'סדרת 18',
    title: 'iPhone 18 Pro Max',
    text: 'המסך הגדול, צבע, אחסון, והעמוד הרשמי של אפל.',
    to: '/p/iphone-18-pro-max',
  },
  {
    image: photos.macbookPro,
    kicker: 'עמדת עבודה',
    title: 'MacBook Pro 14',
    text: 'מסך בהיר לצוות, ומסך חיצוני שסוגר את השולחן.',
    to: '/p/mbp-14',
  },
  {
    image: photos.ps5pro,
    kicker: 'סלון',
    title: 'PlayStation 5 Pro',
    text: 'תמונה חלקה יותר על המסך שכבר יש בבית.',
    to: '/p/ps5-pro',
  },
  {
    image: photos.airpods,
    kicker: 'שמע',
    title: 'AirPods Pro',
    text: 'ביטול רעשים שסוגר את הכיס יחד עם המכשיר.',
    to: '/p/airpods-pro',
  },
]
