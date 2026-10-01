import { emailConfig } from './config.mjs'

const COPY = {
  he: {
    dir: 'rtl',
    lang: 'he',
    locale: 'he-IL',
    store: 'כניסה ל-PRO PHARM',
    viewOrder: 'צפייה בהזמנה',
    openOrder: 'פתח הזמנה',
    qty: 'כמות',
    price: 'מחיר',
    total: 'סה״כ',
    pickup: 'איסוף עצמי',
    payment: 'סטטוס תשלום',
    unpaid: 'ממתין לסליקה',
    paid: 'שולם',
    phone: 'טלפון',
    email: 'אימייל',
    address: 'כתובת',
    date: 'תאריך',
    order: 'הזמנה',
    customer: 'לקוח',
    method: 'שיטת תשלום',
    reference: 'אסמכתא',
    stock: 'מלאי',
    footerNote: 'האתר אינו בית מרקחת ואינו מחליף ייעוץ רפואי.',
    testTitle: 'מערכת ההתראות מחוברת בהצלחה',
    testBody: 'זהו מייל בדיקה ממערכת PRO PHARM.',
    testChecks: ['Brevo connected', 'PRO PHARM sender', 'Email template', 'Notification service'],
    adminNewOrder: 'התקבלה הזמנה חדשה',
    customerConfirm: 'ההזמנה התקבלה',
    customerConfirmBody: 'תודה. ההזמנה נשמרה ב-PRO PHARM.',
    adminPayment: 'התקבל תשלום',
    customerPayment: 'התשלום התקבל בהצלחה',
    customerPaymentBody: 'קיבלנו את התשלום עבור ההזמנה.',
    customerFail: 'התשלום לא הושלם',
    customerFailBody: 'לא הצלחנו לאשר את התשלום. אפשר לנסות שוב או ליצור קשר עם החנות.',
    adminFail: 'בעיית תשלום',
    packing: 'ההזמנה בהכנה',
    packingBody: 'ההזמנה נארזת עכשיו.',
    shipped: 'ההזמנה יצאה',
    shippedBody: 'ההזמנה יצאה למשלוח או מוכנה למסירה.',
    delivered: 'ההזמנה הושלמה',
    deliveredBody: 'ההזמנה נמסרה.',
    cancelled: 'ההזמנה בוטלה',
    cancelledBody: 'ההזמנה בוטלה. אם יש שאלה אפשר לפנות לחנות.',
    lowStock: 'מלאי נמוך',
    outOfStock: 'אזל מהמלאי',
  },
  ar: {
    dir: 'rtl',
    lang: 'ar',
    locale: 'ar',
    store: 'الدخول إلى PRO PHARM',
    viewOrder: 'عرض الطلب',
    openOrder: 'فتح الطلب',
    qty: 'الكمية',
    price: 'السعر',
    total: 'المجموع',
    pickup: 'استلام ذاتي',
    payment: 'حالة الدفع',
    unpaid: 'بانتظار التحصيل',
    paid: 'مدفوع',
    phone: 'الهاتف',
    email: 'البريد',
    address: 'العنوان',
    date: 'التاريخ',
    order: 'طلب',
    customer: 'الزبون',
    method: 'طريقة الدفع',
    reference: 'المرجع',
    stock: 'المخزون',
    footerNote: 'الموقع ليس صيدلية ولا يغني عن الاستشارة الطبية.',
    testTitle: 'تم ربط نظام الإشعارات بنجاح',
    testBody: 'هذه رسالة تجريبية من نظام PRO PHARM.',
    testChecks: ['Brevo connected', 'PRO PHARM sender', 'Email template', 'Notification service'],
    adminNewOrder: 'طلب جديد',
    customerConfirm: 'تم استلام طلبك',
    customerConfirmBody: 'شكراً لك. تم حفظ الطلب في PRO PHARM.',
    adminPayment: 'تم استلام دفعة',
    customerPayment: 'تم استلام الدفع بنجاح',
    customerPaymentBody: 'استلمنا دفعة طلبك.',
    customerFail: 'لم يكتمل الدفع',
    customerFailBody: 'تعذر تأكيد الدفع. يمكن المحاولة مرة أخرى أو التواصل مع المتجر.',
    adminFail: 'مشكلة في الدفع',
    packing: 'الطلب قيد التجهيز',
    packingBody: 'يتم تجهيز الطلب الآن.',
    shipped: 'خرج الطلب',
    shippedBody: 'خرج الطلب للشحن أو أصبح جاهزاً للتسليم.',
    delivered: 'اكتمل الطلب',
    deliveredBody: 'تم تسليم الطلب.',
    cancelled: 'تم إلغاء الطلب',
    cancelledBody: 'تم إلغاء الطلب. يمكن التواصل مع المتجر لأي استفسار.',
    lowStock: 'مخزون منخفض',
    outOfStock: 'نفد المخزون',
  },
  en: {
    dir: 'ltr',
    lang: 'en',
    locale: 'en-IL',
    store: 'Open PRO PHARM',
    viewOrder: 'View order',
    openOrder: 'Open order',
    qty: 'Qty',
    price: 'Price',
    total: 'Total',
    pickup: 'Store pickup',
    payment: 'Payment status',
    unpaid: 'Awaiting collection',
    paid: 'Paid',
    phone: 'Phone',
    email: 'Email',
    address: 'Address',
    date: 'Date',
    order: 'Order',
    customer: 'Customer',
    method: 'Payment method',
    reference: 'Reference',
    stock: 'Stock',
    footerNote: 'This site is not a pharmacy and does not replace medical advice.',
    testTitle: 'Notification system connected',
    testBody: 'This is a test email from the PRO PHARM system.',
    testChecks: ['Brevo connected', 'PRO PHARM sender', 'Email template', 'Notification service'],
    adminNewOrder: 'New order received',
    customerConfirm: 'Order received',
    customerConfirmBody: 'Thank you. Your order was saved at PRO PHARM.',
    adminPayment: 'Payment received',
    customerPayment: 'Payment received successfully',
    customerPaymentBody: 'We received payment for your order.',
    customerFail: 'Payment was not completed',
    customerFailBody: 'We could not confirm the payment. Try again or contact the store.',
    adminFail: 'Payment problem',
    packing: 'Order is being prepared',
    packingBody: 'Your order is now being packed.',
    shipped: 'Order is on the way',
    shippedBody: 'Your order was shipped or is ready for handover.',
    delivered: 'Order completed',
    deliveredBody: 'Your order was delivered.',
    cancelled: 'Order cancelled',
    cancelledBody: 'This order was cancelled. Contact the store if you have a question.',
    lowStock: 'Low stock',
    outOfStock: 'Out of stock',
  },
}

function money(value, lang) {
  return `${Number(value || 0).toLocaleString(COPY[lang].locale)} ₪`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDate(value, lang) {
  const date = value ? new Date(value) : new Date()
  return date.toLocaleString(COPY[lang].locale, { dateStyle: 'medium', timeStyle: 'short' })
}

export function layout({ lang, title, intro, bodyHtml, ctaLabel, ctaHref }) {
  const copy = COPY[lang] || COPY.he
  const config = emailConfig()
  const logo = `${config.storeUrl}/logo.jpg`
  return `<!DOCTYPE html>
<html lang="${copy.lang}" dir="${copy.dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;background:#eef4f2;padding:16px;font-family:Arial,Helvetica,sans-serif;color:#163a66;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #d7e4e0;border-radius:18px;">
    <tr>
      <td style="padding:24px 24px 16px;text-align:center;border-bottom:1px solid #e6eeeb;">
        <img src="${logo}" alt="PRO PHARM" width="64" height="64" style="display:block;margin:0 auto 10px;border-radius:12px;max-width:64px;height:auto;" />
        <h1 style="margin:0;font-size:22px;line-height:1.3;color:#163a66;">PRO PHARM</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <h2 style="margin:0 0 10px;font-size:20px;line-height:1.4;color:#0f766e;">${escapeHtml(title)}</h2>
        ${intro ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${escapeHtml(intro)}</p>` : ''}
        ${bodyHtml}
      </td>
    </tr>
    ${
      ctaHref
        ? `<tr><td style="padding:0 24px 24px;text-align:center;">
      <a href="${escapeHtml(ctaHref)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:700;font-size:16px;">${escapeHtml(ctaLabel)}</a>
    </td></tr>`
        : ''
    }
    <tr>
      <td style="padding:16px 24px 24px;text-align:center;color:#5b6b73;font-size:13px;line-height:1.6;border-top:1px solid #e6eeeb;">
        <strong style="color:#163a66;">PRO PHARM</strong><br />
        <a href="${config.storeUrl}" style="color:#0f766e;">propharm.dev</a><br />
        ${escapeHtml(copy.footerNote)}
      </td>
    </tr>
  </table>
</body>
</html>`
}

function itemBlocks(items, lang) {
  const copy = COPY[lang]
  return (items || [])
    .map((item) => {
      const extra = [item.size, item.color, item.other].filter(Boolean).join(' · ')
      return `<div style="padding:12px 0;border-bottom:1px solid #e6eeeb;">
        <p style="margin:0 0 4px;font-size:16px;font-weight:700;">${escapeHtml(item.name)}${extra ? ` · ${escapeHtml(extra)}` : ''}</p>
        <p style="margin:0;font-size:14px;color:#5b6b73;">${copy.qty}: ${item.qty} · ${copy.price}: ${money(item.price, lang)} · ${copy.total}: ${money(item.price * item.qty, lang)}</p>
      </div>`
    })
    .join('')
}

function kv(label, value) {
  if (value == null || value === '') return ''
  return `<p style="margin:0 0 8px;font-size:15px;line-height:1.5;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`
}

export function renderTestEmail(lang) {
  const copy = COPY[lang] || COPY.he
  const config = emailConfig()
  const checks = copy.testChecks.map((line) => `<p style="margin:0 0 6px;font-size:15px;">✓ ${escapeHtml(line)}</p>`).join('')
  return {
    subject: 'PRO PHARM — בדיקת מערכת ההתראות',
    html: layout({
      lang,
      title: copy.testTitle,
      intro: copy.testBody,
      bodyHtml: checks,
      ctaLabel: copy.store,
      ctaHref: config.storeUrl,
    }),
    text: ['PRO PHARM', copy.testTitle, copy.testBody, ...copy.testChecks.map((line) => `✓ ${line}`), config.storeUrl].join('\n'),
  }
}

export function renderAdminNewOrder(order, lang) {
  const copy = COPY[lang] || COPY.he
  const config = emailConfig()
  const customer = order.customer || {}
  const html = layout({
    lang,
    title: copy.adminNewOrder,
    intro: `${copy.order} ${order.id}`,
    bodyHtml: [
      kv(copy.date, formatDate(order.createdAt, lang)),
      kv(copy.customer, customer.name),
      kv(copy.phone, customer.phone),
      kv(copy.email, customer.email),
      kv(copy.address, [customer.city, customer.address].filter(Boolean).join(' · ')),
      kv(copy.pickup, 'רחוב ח׳אלד בן אל-וליד, שגב שלום'),
      kv(copy.payment, copy.unpaid),
      itemBlocks(order.items, lang),
      `<p style="margin:16px 0 0;font-size:18px;font-weight:700;">${copy.total}: ${money(order.total, lang)}</p>`,
    ].join(''),
    ctaLabel: copy.openOrder,
    ctaHref: `${config.portalUrl}/orders`,
  })
  const text = [
    `PRO PHARM — ${copy.adminNewOrder} ${order.id}`,
    `${copy.date}: ${formatDate(order.createdAt, lang)}`,
    `${copy.customer}: ${customer.name || ''}`,
    `${copy.phone}: ${customer.phone || ''}`,
    `${copy.email}: ${customer.email || ''}`,
    `${copy.address}: ${customer.city || ''} ${customer.address || ''}`,
    ...(order.items || []).map((item) => `${item.name} x${item.qty} = ${item.price * item.qty}`),
    `${copy.total}: ${order.total}`,
    `${config.portalUrl}/orders`,
  ].join('\n')
  return { subject: `PRO PHARM — הזמנה חדשה #${order.id}`, html, text }
}

export function renderCustomerOrder(order, lang) {
  const copy = COPY[lang] || COPY.he
  const config = emailConfig()
  const html = layout({
    lang,
    title: copy.customerConfirm,
    intro: copy.customerConfirmBody,
    bodyHtml: [
      kv(copy.order, order.id),
      kv(copy.date, formatDate(order.createdAt, lang)),
      kv(copy.pickup, 'רחוב ח׳אלד בן אל-וליד, שגב שלום'),
      kv(copy.payment, copy.unpaid),
      itemBlocks(order.items, lang),
      `<p style="margin:16px 0 0;font-size:18px;font-weight:700;">${copy.total}: ${money(order.total, lang)}</p>`,
    ].join(''),
    ctaLabel: copy.viewOrder,
    ctaHref: `${config.storeUrl}/order/${encodeURIComponent(order.id)}`,
  })
  const text = [
    `PRO PHARM — ${copy.customerConfirm} ${order.id}`,
    copy.customerConfirmBody,
    ...(order.items || []).map((item) => `${item.name} x${item.qty}`),
    `${copy.total}: ${order.total}`,
    `${config.storeUrl}/order/${order.id}`,
  ].join('\n')
  return { subject: `PRO PHARM — ${copy.customerConfirm} #${order.id}`, html, text }
}

export function renderAdminPayment(order, payment, lang) {
  const copy = COPY[lang] || COPY.he
  const config = emailConfig()
  const customer = order.customer || {}
  const html = layout({
    lang,
    title: copy.adminPayment,
    bodyHtml: [
      kv(copy.order, order.id),
      kv(copy.customer, customer.name),
      kv(copy.total, money(payment?.amount ?? order.total, lang)),
      kv(copy.method, payment?.method || ''),
      kv(copy.reference, payment?.reference || ''),
      kv(copy.date, formatDate(payment?.paidAt || order.createdAt, lang)),
    ].join(''),
    ctaLabel: copy.openOrder,
    ctaHref: `${config.portalUrl}/orders`,
  })
  return {
    subject: `PRO PHARM — התקבל תשלום עבור הזמנה #${order.id}`,
    html,
    text: `PRO PHARM — ${copy.adminPayment} ${order.id}\n${copy.total}: ${payment?.amount ?? order.total}\n${copy.method}: ${payment?.method || ''}`,
  }
}

export function renderCustomerPayment(order, payment, lang) {
  const copy = COPY[lang] || COPY.he
  const config = emailConfig()
  return {
    subject: `PRO PHARM — ${copy.customerPayment} #${order.id}`,
    html: layout({
      lang,
      title: copy.customerPayment,
      intro: copy.customerPaymentBody,
      bodyHtml: [kv(copy.order, order.id), kv(copy.total, money(payment?.amount ?? order.total, lang)), kv(copy.payment, copy.paid)].join(''),
      ctaLabel: copy.viewOrder,
      ctaHref: `${config.storeUrl}/order/${encodeURIComponent(order.id)}`,
    }),
    text: `PRO PHARM — ${copy.customerPayment}\n${order.id}\n${copy.total}: ${payment?.amount ?? order.total}`,
  }
}

export function renderCustomerPaymentFailed(order, lang) {
  const copy = COPY[lang] || COPY.he
  const config = emailConfig()
  return {
    subject: `PRO PHARM — ${copy.customerFail} #${order.id}`,
    html: layout({
      lang,
      title: copy.customerFail,
      intro: copy.customerFailBody,
      bodyHtml: kv(copy.order, order.id),
      ctaLabel: copy.viewOrder,
      ctaHref: `${config.storeUrl}/order/${encodeURIComponent(order.id)}`,
    }),
    text: `PRO PHARM — ${copy.customerFail}\n${order.id}\n${copy.customerFailBody}`,
  }
}

export function renderAdminPaymentFailed(order, detail, lang) {
  const copy = COPY[lang] || COPY.he
  const config = emailConfig()
  return {
    subject: `PRO PHARM — ${copy.adminFail} #${order.id}`,
    html: layout({
      lang,
      title: copy.adminFail,
      bodyHtml: [kv(copy.order, order.id), kv(copy.customer, order.customer?.name), `<p style="margin:0;font-size:15px;">${escapeHtml(detail || '')}</p>`].join(''),
      ctaLabel: copy.openOrder,
      ctaHref: `${config.portalUrl}/orders`,
    }),
    text: `PRO PHARM — ${copy.adminFail} ${order.id}\n${detail || ''}`,
  }
}

export function renderOrderStatus(order, lang) {
  const copy = COPY[lang] || COPY.he
  const config = emailConfig()
  const map = {
    packing: { title: copy.packing, intro: copy.packingBody },
    shipped: { title: copy.shipped, intro: copy.shippedBody },
    delivered: { title: copy.delivered, intro: copy.deliveredBody },
    cancelled: { title: copy.cancelled, intro: copy.cancelledBody },
  }
  const selected = map[order.status]
  if (!selected) return null
  return {
    subject: `PRO PHARM — ${selected.title} #${order.id}`,
    html: layout({
      lang,
      title: selected.title,
      intro: selected.intro,
      bodyHtml: [kv(copy.order, order.id), kv(copy.pickup, 'רחוב ח׳אלד בן אל-וליד, שגב שלום'), `<p style="margin:16px 0 0;font-size:18px;font-weight:700;">${copy.total}: ${money(order.total, lang)}</p>`].join(''),
      ctaLabel: copy.viewOrder,
      ctaHref: `${config.storeUrl}/order/${encodeURIComponent(order.id)}`,
    }),
    text: `PRO PHARM — ${selected.title}\n${order.id}\n${selected.intro}`,
  }
}

export function renderStockAlert({ title, product, stock, lang }) {
  const copy = COPY[lang] || COPY.he
  const config = emailConfig()
  return {
    subject: `PRO PHARM — ${title}: ${product.name}`,
    html: layout({
      lang,
      title,
      bodyHtml: [`<p style="margin:0 0 8px;font-size:16px;font-weight:700;">${product.name}</p>`, kv('SKU', product.id), kv(copy.stock, String(stock))].join(''),
      ctaLabel: copy.openOrder,
      ctaHref: `${config.portalUrl}/products/${encodeURIComponent(product.id)}`,
    }),
    text: `PRO PHARM — ${title}\n${product.name}\n${copy.stock}: ${stock}`,
  }
}

export const STATUS_COPY = COPY
