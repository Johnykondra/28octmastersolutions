const { randomUUID } = require("node:crypto");
const db = require("../data/db");

const insertOrder = db.prepare(`
  INSERT INTO orders (
    orderNumber,
    customerName,
    customerPhone,
    customerEmail,
    deliveryMethod,
    deliveryAddress,
    totalFils
  )
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const setOrderNumber = db.prepare("UPDATE orders SET orderNumber = ? WHERE id = ?");
const insertOrderItem = db.prepare(`
  INSERT INTO order_items (orderId, productId, productName, unitPriceFils, quantity)
  VALUES (?, ?, ?, ?, ?)
`);
const setStripeSessionId = db.prepare(`
  UPDATE orders
  SET stripeSessionId = ?
  WHERE id = ? AND status = 'Pending' AND stripeSessionId IS NULL
`);
const deletePendingOrderItems = db.prepare(`
  DELETE FROM order_items
  WHERE orderId = ? AND EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.orderId
      AND orders.status = 'Pending'
      AND orders.stripeSessionId IS NULL
  )
`);
const deletePendingOrder = db.prepare(`
  DELETE FROM orders
  WHERE id = ? AND status = 'Pending' AND stripeSessionId IS NULL
`);
const orderByStripeSession = db.prepare("SELECT * FROM orders WHERE stripeSessionId = ?");
const orderById = db.prepare("SELECT * FROM orders WHERE id = ?");
const itemsByOrderId = db.prepare(`
  SELECT productId, productName, unitPriceFils, quantity
  FROM order_items
  WHERE orderId = ?
  ORDER BY id
`);
const markOrderPaid = db.prepare(`
  UPDATE orders
  SET status = 'Paid', paidAt = ?
  WHERE id = ? AND paidAt IS NULL
`);
const paidOrderForEmail = db.prepare(`
  SELECT * FROM orders
  WHERE id = ? AND status = 'Paid' AND paidAt IS NOT NULL AND confirmationEmailSentAt IS NULL
`);
const markConfirmationEmailSent = db.prepare(`
  UPDATE orders
  SET confirmationEmailSentAt = ?
  WHERE id = ? AND status = 'Paid' AND confirmationEmailSentAt IS NULL
`);
const ordersByCustomerEmail = db.prepare(`
  SELECT id, orderNumber, deliveryMethod, totalFils, status, paidAt, createdAt
  FROM orders
  WHERE customerEmail = ? COLLATE NOCASE
  ORDER BY createdAt DESC, id DESC
`);
const orderItemsByIds = db.prepare(`
  SELECT orderId, productId, productName, unitPriceFils, quantity
  FROM order_items
  WHERE orderId IN (SELECT id FROM orders WHERE customerEmail = ? COLLATE NOCASE)
  ORDER BY orderId, id
`);

class PaidOrderOutOfStockError extends Error {
  constructor(productName) {
    super(`${productName} is no longer available in the ordered quantity.`);
    this.name = "PaidOrderOutOfStockError";
    this.productName = productName;
  }
}

function rollbackTransaction(error) {
  db.exec("ROLLBACK");
  throw error;
}

function createPendingOrder({
  customerName,
  customerPhone,
  customerEmail,
  deliveryMethod,
  deliveryAddress,
  deliveryFeeFils,
  items
}) {
  if (!["pickup", "delivery"].includes(deliveryMethod)) {
    throw new TypeError("Choose a valid delivery method.");
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new TypeError("An order must contain at least one product.");
  }
  if (!Number.isSafeInteger(deliveryFeeFils) || deliveryFeeFils < 0) {
    throw new TypeError("The delivery fee must be a non-negative whole number of fils.");
  }

  const normalizedEmail = customerEmail.trim().toLowerCase();
  const address = deliveryMethod === "delivery" ? deliveryAddress.trim() : null;
  if (deliveryMethod === "delivery" && !address) {
    throw new TypeError("A delivery address is required for delivery orders.");
  }
  if (deliveryMethod === "pickup" && deliveryFeeFils !== 0) {
    throw new TypeError("Store pickup must be free.");
  }

  const itemsTotalFils = items.reduce((total, item) => {
    if (
      !Number.isSafeInteger(item.productId) ||
      item.productId <= 0 ||
      typeof item.productName !== "string" ||
      !Number.isSafeInteger(item.unitPriceFils) ||
      item.unitPriceFils < 0 ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      throw new TypeError("Order items must have valid product, price, and quantity values.");
    }
    const lineTotal = item.unitPriceFils * item.quantity;
    if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(total + lineTotal)) {
      throw new RangeError("The order total is too large.");
    }
    return total + lineTotal;
  }, 0);
  const totalFils = itemsTotalFils + deliveryFeeFils;
  if (!Number.isSafeInteger(totalFils)) {
    throw new RangeError("The order total is too large.");
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const result = insertOrder.run(
      `CREATING-${randomUUID()}`,
      customerName.trim(),
      customerPhone.trim(),
      normalizedEmail,
      deliveryMethod,
      address,
      totalFils
    );
    const id = Number(result.lastInsertRowid);
    const orderNumber = `ORD-${5000 + id}`;
    setOrderNumber.run(orderNumber, id);
    for (const item of items) {
      insertOrderItem.run(
        id,
        item.productId,
        item.productName,
        item.unitPriceFils,
        item.quantity
      );
    }
    db.exec("COMMIT");
    return {
      id,
      orderNumber,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: normalizedEmail,
      deliveryMethod,
      deliveryAddress: address,
      deliveryFeeFils,
      totalFils,
      status: "Pending"
    };
  } catch (error) {
    return rollbackTransaction(error);
  }
}

function saveStripeSessionId(orderId, stripeSessionId) {
  const result = setStripeSessionId.run(stripeSessionId, orderId);
  return result.changes === 1;
}

function discardPendingOrder(orderId) {
  db.exec("BEGIN IMMEDIATE");
  try {
    deletePendingOrderItems.run(orderId);
    const result = deletePendingOrder.run(orderId);
    db.exec("COMMIT");
    return result.changes === 1;
  } catch (error) {
    return rollbackTransaction(error);
  }
}

function getOrderByStripeSessionId(stripeSessionId) {
  return orderByStripeSession.get(stripeSessionId);
}

function getOrderItems(orderId) {
  return itemsByOrderId.all(orderId);
}

function claimConfirmationEmail(orderId) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const order = paidOrderForEmail.get(orderId);
    if (!order) {
      db.exec("COMMIT");
      return null;
    }

    const sentAt = new Date().toISOString();
    const result = markConfirmationEmailSent.run(sentAt, orderId);
    if (result.changes !== 1) {
      db.exec("COMMIT");
      return null;
    }
    const items = itemsByOrderId.all(orderId);
    db.exec("COMMIT");
    return { order: { ...order, confirmationEmailSentAt: sentAt }, items };
  } catch (error) {
    return rollbackTransaction(error);
  }
}

function finalizePaidOrder(stripeSessionId, productService) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const order = orderByStripeSession.get(stripeSessionId);
    if (!order) {
      db.exec("COMMIT");
      return null;
    }
    if (order.paidAt) {
      db.exec("COMMIT");
      return { order, newlyPaid: false };
    }

    for (const item of itemsByOrderId.all(order.id)) {
      if (!productService.decrementStock(item.productId, item.quantity)) {
        throw new PaidOrderOutOfStockError(item.productName);
      }
    }

    const paidAt = new Date().toISOString();
    const result = markOrderPaid.run(paidAt, order.id);
    if (result.changes !== 1) {
      throw new Error(`Could not mark order ${order.orderNumber} as paid.`);
    }
    db.exec("COMMIT");
    return {
      order: { ...order, status: "Paid", paidAt },
      newlyPaid: true
    };
  } catch (error) {
    return rollbackTransaction(error);
  }
}

function listOrdersByCustomerEmail(email) {
  const orders = ordersByCustomerEmail.all(email.trim().toLowerCase());
  const items = orderItemsByIds.all(email.trim().toLowerCase());
  const itemsByOrder = new Map();
  for (const item of items) {
    const orderItems = itemsByOrder.get(item.orderId) || [];
    orderItems.push(item);
    itemsByOrder.set(item.orderId, orderItems);
  }
  return orders.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) || []
  }));
}

function getOrderById(id) {
  return orderById.get(id);
}

module.exports = {
  PaidOrderOutOfStockError,
  createPendingOrder,
  saveStripeSessionId,
  discardPendingOrder,
  getOrderByStripeSessionId,
  getOrderById,
  getOrderItems,
  claimConfirmationEmail,
  finalizePaidOrder,
  listOrdersByCustomerEmail
};
