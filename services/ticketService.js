const { randomBytes } = require("node:crypto");
const db = require("../data/db");

const statuses = Object.freeze([
  "Received",
  "In Progress",
  "Waiting for Parts",
  "Ready for Pickup",
  "Completed",
  "Cancelled"
]);
const insertTicket = db.prepare(`
  INSERT INTO service_tickets (ticketNumber, customerEmail, customerName, device, service)
  VALUES (?, ?, ?, ?, ?)
`);
const ticketsByCustomerEmail = db.prepare(`
  SELECT ticketNumber, device, service, status, createdAt
  FROM service_tickets
  WHERE customerEmail = ? COLLATE NOCASE
  ORDER BY createdAt DESC, id DESC
`);
const ticketByNumberAndEmail = db.prepare(`
  SELECT ticketNumber, customerName, customerEmail, device, service, status, createdAt
  FROM service_tickets
  WHERE ticketNumber = ? AND customerEmail = ? COLLATE NOCASE
`);
const ticketByNumber = db.prepare(`
  SELECT ticketNumber, customerName, customerEmail, device, service, status, createdAt
  FROM service_tickets
  WHERE ticketNumber = ?
`);
const allTickets = db.prepare(`
  SELECT ticketNumber, customerName, customerEmail, device, service, status, createdAt
  FROM service_tickets
  ORDER BY createdAt DESC, id DESC
`);
const ticketCounts = db.prepare(`
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN status = 'Received' THEN 1 ELSE 0 END) AS received,
    SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS inProgress,
    SUM(CASE WHEN status = 'Waiting for Parts' THEN 1 ELSE 0 END) AS waitingForParts,
    SUM(CASE WHEN status = 'Ready for Pickup' THEN 1 ELSE 0 END) AS readyForPickup,
    SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed,
    SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled
  FROM service_tickets
`);
const updateTicketStatus = db.prepare(
  "UPDATE service_tickets SET status = ? WHERE ticketNumber = ?"
);

function createTicket({ customerName, customerEmail, device, service }) {
  const ticketNumber = `MS-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  insertTicket.run(
    ticketNumber,
    customerEmail.trim().toLowerCase(),
    customerName.trim(),
    device.trim(),
    service.trim()
  );
  return ticketNumber;
}

function listTicketsByCustomerEmail(email) {
  return ticketsByCustomerEmail.all(email.trim().toLowerCase());
}

function getTicketForTracking(ticketNumber, email) {
  return ticketByNumberAndEmail.get(ticketNumber.trim(), email.trim().toLowerCase());
}

function getTicketByNumber(ticketNumber) {
  return ticketByNumber.get(ticketNumber);
}

function listAllTickets() {
  return allTickets.all();
}

function getTicketCounts() {
  const counts = ticketCounts.get();
  return Object.fromEntries(
    Object.entries(counts).map(([status, count]) => [status, count || 0])
  );
}

function setTicketStatus(ticketNumber, status) {
  if (!statuses.includes(status)) {
    throw new RangeError(`Unknown service ticket status: ${status}`);
  }
  const result = updateTicketStatus.run(status, ticketNumber);
  return result.changes > 0;
}

module.exports = {
  statuses,
  createTicket,
  listTicketsByCustomerEmail,
  getTicketForTracking,
  getTicketByNumber,
  listAllTickets,
  getTicketCounts,
  setTicketStatus
};
