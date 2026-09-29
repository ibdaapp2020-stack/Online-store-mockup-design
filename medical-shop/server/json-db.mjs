import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function createJsonDb(file, fallback) {
  mkdirSync(dirname(file), { recursive: true })
  let state = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : clone(fallback)
  state.sessions ||= []
  state.categories ||= []
  state.products ||= []
  state.orders ||= []
  state.customers ||= []
  state.customer_sessions ||= []
  state.services ||= []
  state.appointments ||= []
  state.employees ||= []
  state.staff_sessions ||= []
  state.attendance ||= []
  state.mail_log ||= []
  let snapshot = null

  function persist() {
    if (snapshot) return
    writeFileSync(file, JSON.stringify(state))
  }

  return {
    exec(sql) {
      const text = String(sql).trim()
      if (text.startsWith('BEGIN')) snapshot = clone(state)
      else if (text.startsWith('COMMIT')) {
        snapshot = null
        persist()
      } else if (text.startsWith('ROLLBACK') && snapshot) {
        state = snapshot
        snapshot = null
      }
    },
    prepare(sql) {
      const text = String(sql).replace(/\s+/g, ' ').trim()
      return {
        get: (...args) => readOne(text, args, state),
        all: (...args) => readMany(text, args, state),
        run: (...args) => {
          writeOne(text, args, state)
          persist()
          return {}
        },
      }
    },
  }
}

function byId(rows, id) {
  return rows.find((row) => String(row.id).toLowerCase() === String(id).toLowerCase())
}

function readOne(sql, args, state) {
  if (sql.startsWith('SELECT token, customer_id FROM customer_sessions')) return state.customer_sessions.find((row) => row.token === args[0])
  if (sql.startsWith('SELECT token, employee_id FROM staff_sessions')) return state.staff_sessions.find((row) => row.token === args[0])
  if (sql.startsWith('SELECT * FROM customers WHERE email')) return state.customers.find((row) => row.email === args[0])
  if (sql.startsWith('SELECT * FROM customers WHERE id')) return byId(state.customers, args[0])
  if (sql.startsWith('SELECT * FROM employees WHERE username')) return state.employees.find((row) => row.username === args[0])
  if (sql.startsWith('SELECT * FROM employees WHERE id')) return byId(state.employees, args[0])
  if (sql.startsWith('SELECT * FROM services WHERE id')) return byId(state.services, args[0])
  if (sql.startsWith('SELECT * FROM appointments WHERE id')) return byId(state.appointments, args[0])
  if (sql.startsWith('SELECT data FROM settings')) return state.settings ? { data: JSON.stringify(state.settings) } : undefined
  if (sql.startsWith('SELECT id FROM settings')) return state.settings ? { id: 1 } : undefined
  if (sql.startsWith('SELECT password_hash FROM admin')) return state.admin ? { password_hash: state.admin.password_hash } : undefined
  if (sql.startsWith('SELECT id FROM admin')) return state.admin ? { id: 1 } : undefined
  if (sql.startsWith('SELECT COUNT(*) AS count, COALESCE(SUM(total)')) {
    return {
      count: state.orders.length,
      revenue: state.orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    }
  }
  if (sql.includes("status != 'delivered'")) {
    return { count: state.orders.filter((order) => order.status !== 'delivered').length }
  }
  if (sql.startsWith('SELECT COUNT(*) AS count FROM products')) return { count: state.products.length }
  if (sql.startsWith('SELECT token FROM sessions')) return state.sessions.find((session) => session.token === args[0])
  if (sql.startsWith('SELECT id FROM orders WHERE id')) return byId(state.orders, args[0]) ? { id: byId(state.orders, args[0]).id } : undefined
  if (sql.startsWith('SELECT * FROM orders WHERE id')) return byId(state.orders, args[0])
  if (sql.includes('AND active = 1')) {
    const product = byId(state.products, args[0])
    return product && product.active === 1 ? product : undefined
  }
  if (sql.startsWith('SELECT id FROM products')) {
    const product = byId(state.products, args[0])
    return product ? { id: product.id } : undefined
  }
  if (sql.startsWith('SELECT * FROM products WHERE id')) return byId(state.products, args[0])
  return undefined
}

function readMany(sql, _args, state) {
  if (sql.startsWith('SELECT id FROM products')) return state.products.map((product) => ({ id: product.id }))
  if (sql.startsWith('SELECT * FROM services')) return [...state.services]
  if (sql.startsWith('SELECT * FROM appointments')) return [...state.appointments]
  if (sql.startsWith('SELECT * FROM customers')) return [...state.customers]
  if (sql.startsWith('SELECT * FROM employees')) return [...state.employees]
  if (sql.startsWith('SELECT * FROM attendance')) return [...state.attendance]
  if (sql.startsWith('SELECT * FROM mail_log')) return [...state.mail_log]
  if (sql.startsWith('SELECT id, name, blurb FROM categories')) {
    return [...state.categories].sort((a, b) => a.sort - b.sort).map(({ id, name, blurb }) => ({ id, name, blurb }))
  }
  if (sql.includes('stock <= 5')) {
    return state.products.filter((product) => product.active === 1 && product.stock <= 5).sort((a, b) => a.stock - b.stock)
  }
  if (sql.startsWith('SELECT * FROM products WHERE active = 1')) {
    return state.products.filter((product) => product.active === 1)
  }
  if (sql.startsWith('SELECT * FROM products')) return [...state.products]
  if (sql.includes('LIMIT 6')) return [...state.orders].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 6)
  if (sql.startsWith('SELECT * FROM orders')) return [...state.orders].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  if (sql.startsWith('SELECT id FROM orders')) return state.orders.map((order) => ({ id: order.id }))
  return []
}

function productFrom(args, active) {
  return {
    id: args[0],
    name: args[1],
    category: args[2],
    price: args[3],
    compare_at: args[4],
    description: args[5],
    specs: args[6],
    stock: args[7],
    badge: args[8],
    rating: args[9],
    reviews: args[10],
    tone: args[11],
    image: args[12],
    active,
    rowid: Date.now(),
  }
}

function writeOne(sql, args, state) {
  if (sql.startsWith('INSERT INTO settings')) {
    state.settings = JSON.parse(args[0])
    return
  }
  if (sql.startsWith('INSERT INTO admin')) {
    state.admin = { password_hash: args[0] }
    return
  }
  if (sql.startsWith('INSERT INTO categories')) {
    state.categories.push({ id: args[0], name: args[1], blurb: args[2], sort: args[3] })
    return
  }
  if (sql.startsWith('INSERT INTO sessions')) {
    state.sessions.push({ token: args[0], created_at: args[1] })
    return
  }
  if (sql.startsWith('DELETE FROM sessions')) {
    state.sessions = state.sessions.filter((session) => session.token !== args[0])
    return
  }
  if (sql.startsWith('INSERT INTO orders')) {
    state.orders.push({
      id: args[0],
      created_at: args[1],
      status: args[2],
      customer_json: args[3],
      items_json: args[4],
      subtotal: args[5],
      discount: args[6],
      shipping: args[7],
      total: args[8],
      coupon: args[9],
    })
    return
  }
  if (sql.startsWith('INSERT INTO customer_sessions')) {
    state.customer_sessions.push({ token: args[0], customer_id: args[1], created_at: args[2] })
    return
  }
  if (sql.startsWith('DELETE FROM customer_sessions')) {
    state.customer_sessions = state.customer_sessions.filter((row) => row.token !== args[0])
    return
  }
  if (sql.startsWith('INSERT INTO customers')) {
    state.customers.push({
      id: args[0],
      name: args[1],
      phone: args[2],
      email: args[3],
      password_hash: args[4],
      points: args[5],
      next_percent: args[6],
      created_at: args[7],
    })
    return
  }
  if (sql.startsWith('UPDATE customers SET points')) {
    const customer = byId(state.customers, args[2])
    if (!customer) return
    customer.points = args[0]
    customer.next_percent = args[1]
    return
  }
  if (sql.startsWith('INSERT INTO services')) {
    state.services.push({
      id: args[0],
      name: args[1],
      days: args[2],
      open_time: args[3],
      close_time: args[4],
      slot_minutes: args[5],
      active: args[6],
    })
    return
  }
  if (sql.startsWith('UPDATE services SET name')) {
    const service = byId(state.services, args[6])
    if (!service) return
    service.name = args[0]
    service.days = args[1]
    service.open_time = args[2]
    service.close_time = args[3]
    service.slot_minutes = args[4]
    service.active = args[5]
    return
  }
  if (sql.startsWith('DELETE FROM services')) {
    state.services = state.services.filter((row) => row.id !== args[0])
    return
  }
  if (sql.startsWith('INSERT INTO appointments')) {
    state.appointments.push({
      id: args[0],
      service_id: args[1],
      customer_id: args[2],
      customer_name: args[3],
      date: args[4],
      time: args[5],
      status: args[6],
      created_at: args[7],
    })
    return
  }
  if (sql.startsWith('UPDATE appointments SET status')) {
    const appointment = byId(state.appointments, args[1])
    if (appointment) appointment.status = args[0]
    return
  }
  if (sql.startsWith('INSERT INTO staff_sessions')) {
    state.staff_sessions.push({ token: args[0], employee_id: args[1], created_at: args[2] })
    return
  }
  if (sql.startsWith('DELETE FROM staff_sessions')) {
    state.staff_sessions = state.staff_sessions.filter((row) => row.token !== args[0])
    return
  }
  if (sql.startsWith('INSERT INTO employees')) {
    state.employees.push({ id: args[0], name: args[1], username: args[2], password_hash: args[3], active: args[4] })
    return
  }
  if (sql.startsWith('DELETE FROM employees')) {
    state.employees = state.employees.filter((row) => row.id !== args[0])
    return
  }
  if (sql.startsWith('INSERT INTO attendance')) {
    state.attendance.push({
      id: args[0],
      employee_id: args[1],
      employee_name: args[2],
      kind: args[3],
      at: args[4],
      lat: args[5],
      lng: args[6],
    })
    return
  }
  if (sql.startsWith('INSERT INTO mail_log')) {
    state.mail_log.push({
      id: args[0],
      order_id: args[1],
      to_email: args[2],
      status: args[3],
      detail: args[4],
      created_at: args[5],
    })
    return
  }
  if (sql.startsWith('UPDATE products SET sizes')) {
    const product = byId(state.products, args[2])
    if (!product) return
    product.sizes = args[0]
    product.colors = args[1]
    return
  }
  if (sql.startsWith('UPDATE products SET stock')) {
    const product = byId(state.products, args[1])
    if (product) product.stock -= Number(args[0])
    return
  }
  if (sql.startsWith('UPDATE products SET name')) {
    const product = byId(state.products, args[13])
    if (!product) return
    product.name = args[0]
    product.category = args[1]
    product.price = args[2]
    product.compare_at = args[3]
    product.description = args[4]
    product.specs = args[5]
    product.stock = args[6]
    product.badge = args[7]
    product.rating = args[8]
    product.reviews = args[9]
    product.tone = args[10]
    product.image = args[11]
    product.active = args[12]
    return
  }
  if (sql.startsWith('DELETE FROM products')) {
    state.products = state.products.filter((product) => product.id !== args[0])
    return
  }
  if (sql.startsWith('UPDATE orders SET status')) {
    const order = byId(state.orders, args[1])
    if (order) order.status = args[0]
    return
  }
  if (sql.startsWith('UPDATE settings SET data')) {
    state.settings = JSON.parse(args[0])
    return
  }
  if (sql.startsWith('INSERT INTO products')) {
    const active = sql.includes(', 1)') ? 1 : args[13]
    state.products.push(productFrom(args, active))
  }
}
