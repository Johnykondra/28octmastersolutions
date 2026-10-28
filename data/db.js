const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const configuredPath = process.env.DB_PATH || path.join(__dirname, "mastersolutions.db");
const databasePath = path.resolve(configuredPath);

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new DatabaseSync(databasePath);

db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Laptops', 'Desktops', 'Servers', 'Accessories')),
    brand TEXT NOT NULL,
    specs TEXT NOT NULL,
    priceFils INTEGER NOT NULL CHECK (priceFils >= 0),
    stock INTEGER NOT NULL CHECK (stock >= 0),
    imageUrl TEXT NOT NULL,
    isActive INTEGER NOT NULL DEFAULT 1 CHECK (isActive IN (0, 1))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS repair_prices (
    id INTEGER PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('Laptop', 'Desktop', 'Server')),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    minPriceFils INTEGER NOT NULL CHECK (minPriceFils >= 0),
    maxPriceFils INTEGER NOT NULL CHECK (maxPriceFils >= minPriceFils),
    averagePriceFils INTEGER NOT NULL CHECK (
      averagePriceFils >= minPriceFils AND averagePriceFils <= maxPriceFils
    ),
    pricingBasis TEXT NOT NULL,
    UNIQUE (category, name)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer'
  );

  CREATE TABLE IF NOT EXISTS service_tickets (
    id INTEGER PRIMARY KEY,
    ticketNumber TEXT NOT NULL UNIQUE,
    customerEmail TEXT NOT NULL COLLATE NOCASE,
    customerName TEXT NOT NULL,
    device TEXT NOT NULL,
    service TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Received'
      CHECK (status IN ('Received', 'In Progress', 'Waiting for Parts', 'Ready for Pickup', 'Completed', 'Cancelled')),
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS service_tickets_customer_email_created_at
    ON service_tickets (customerEmail, createdAt DESC);

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY,
    orderNumber TEXT NOT NULL UNIQUE,
    customerName TEXT NOT NULL,
    customerPhone TEXT NOT NULL,
    customerEmail TEXT NOT NULL COLLATE NOCASE,
    deliveryMethod TEXT NOT NULL CHECK (deliveryMethod IN ('pickup', 'delivery')),
    deliveryAddress TEXT,
    totalFils INTEGER NOT NULL CHECK (totalFils >= 0),
    status TEXT NOT NULL DEFAULT 'Pending',
    stripeSessionId TEXT UNIQUE,
    paidAt TEXT,
    confirmationEmailSentAt TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY,
    orderId INTEGER NOT NULL REFERENCES orders(id),
    productId INTEGER NOT NULL REFERENCES products(id),
    productName TEXT NOT NULL,
    unitPriceFils INTEGER NOT NULL CHECK (unitPriceFils >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0)
  );

  CREATE INDEX IF NOT EXISTS orders_customer_email_created_at
    ON orders (customerEmail, createdAt DESC);
  CREATE INDEX IF NOT EXISTS order_items_order_id
    ON order_items (orderId);
`);

const orderColumns = db.prepare("PRAGMA table_info(orders)").all();
if (!orderColumns.some((column) => column.name === "confirmationEmailSentAt")) {
  db.exec("ALTER TABLE orders ADD COLUMN confirmationEmailSentAt TEXT");
}

module.exports = db;
