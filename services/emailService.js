const nodemailer = require("nodemailer");

const shopName = "Master Solutions Computer Sales and Services";
const shopAddress = "Fujairah, Al Faseel Building 2";
const signOff = `${shopName} · built at London International · lisrc.ae · by Copilot`;
let transporter;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatPrice(priceFils) {
  const amount = priceFils / 100;
  return `AED ${amount.toLocaleString("en-AE", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

function formatDate(value) {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Email date must be a valid date.");
  }
  return date.toLocaleString("en-AE", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Dubai"
  });
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !pass || !from) {
    throw new Error("SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM must be configured.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
    throw new Error("SMTP_FROM must be a valid email address.");
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
  return transporter;
}

async function deliver({ to, subject, text, html, messageType, reference }) {
  try {
    await getTransporter().sendMail({
      from: { name: shopName, address: process.env.SMTP_FROM },
      to,
      subject,
      text,
      html
    });
    return true;
  } catch (error) {
    console.error(`Could not send ${messageType} email for ${reference}:`, error.message);
    return false;
  }
}

async function sendOrderConfirmation(order, items) {
  const deliveryMethod = order.deliveryMethod === "pickup"
    ? `Pick up in store at ${shopAddress}`
    : `Delivery within Fujairah${order.deliveryAddress ? ` — ${order.deliveryAddress}` : ""}`;
  const rows = items.map((item) => {
    const lineTotalFils = item.unitPriceFils * item.quantity;
    return {
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: formatPrice(item.unitPriceFils),
      lineTotal: formatPrice(lineTotalFils)
    };
  });
  const textItems = rows.map((item) => (
    `${item.productName} | ${item.quantity} | ${item.unitPrice} each | ${item.lineTotal}`
  ));
  const text = [
    `Thank you for your order, ${order.customerName}.`,
    `Order: ${order.orderNumber}`,
    "",
    "Items | Quantity | Unit price | Line total",
    ...textItems,
    "",
    `Total: ${formatPrice(order.totalFils)} (AED, including 5% VAT)`,
    `Delivery method: ${deliveryMethod}`,
    `Store address: ${shopAddress}`,
    "",
    signOff
  ].join("\n");
  const htmlRows = rows.map((item) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e3eaf2">${escapeHtml(item.productName)}</td>
      <td style="padding:8px;border-bottom:1px solid #e3eaf2;text-align:center">${item.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #e3eaf2;text-align:right">${escapeHtml(item.unitPrice)}</td>
      <td style="padding:8px;border-bottom:1px solid #e3eaf2;text-align:right">${escapeHtml(item.lineTotal)}</td>
    </tr>`).join("");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#132238;line-height:1.6">
      <h1 style="color:#0b1f3a">Your order is confirmed</h1>
      <p>Thank you for your order, ${escapeHtml(order.customerName)}.</p>
      <p><strong>Order number:</strong> ${escapeHtml(order.orderNumber)}</p>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="padding:8px;text-align:left">Item</th>
          <th style="padding:8px">Quantity</th>
          <th style="padding:8px;text-align:right">Unit price</th>
          <th style="padding:8px;text-align:right">Line total</th>
        </tr></thead>
        <tbody>${htmlRows}</tbody>
      </table>
      <p><strong>Total: ${escapeHtml(formatPrice(order.totalFils))}</strong> (AED, including 5% VAT)</p>
      <p><strong>Delivery method:</strong> ${escapeHtml(deliveryMethod)}</p>
      <p><strong>Store address:</strong> ${escapeHtml(shopAddress)}</p>
      <p style="margin-top:32px;color:#64748b;font-size:12px">${escapeHtml(signOff)}</p>
    </div>`;

  return deliver({
    to: order.customerEmail,
    subject: `Your order ${order.orderNumber} is confirmed`,
    text,
    html,
    messageType: "order confirmation",
    reference: order.orderNumber
  });
}

async function sendRepairTicketConfirmation(ticket) {
  const baseUrl = process.env.BASE_URL;
  let trackingUrl;
  try {
    const parsedUrl = new URL(baseUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("BASE_URL must use HTTP or HTTPS.");
    }
    trackingUrl = new URL("/track", parsedUrl).toString();
  } catch {
    console.error(`Could not send repair ticket email for ${ticket.ticketNumber}: BASE_URL is not a valid HTTP or HTTPS URL.`);
    return false;
  }

  let dropOffDate;
  try {
    dropOffDate = formatDate(ticket.createdAt);
  } catch (error) {
    console.error(`Could not send repair ticket email for ${ticket.ticketNumber}:`, error.message);
    return false;
  }

  const text = [
    `Hello ${ticket.customerName},`,
    "",
    `We received repair ticket ${ticket.ticketNumber}.`,
    `Device: ${ticket.device}`,
    `Issue: ${ticket.service}`,
    `Drop-off date: ${dropOffDate}`,
    "",
    "Before dropping off your device, please back up your data and remove any personal accounts if possible.",
    `Track your ticket: ${trackingUrl}`,
    "",
    signOff
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#132238;line-height:1.6">
      <h1 style="color:#0b1f3a">Repair ticket received</h1>
      <p>Hello ${escapeHtml(ticket.customerName)}, we received your repair request.</p>
      <p><strong>Ticket number:</strong> ${escapeHtml(ticket.ticketNumber)}</p>
      <p><strong>Device:</strong> ${escapeHtml(ticket.device)}</p>
      <p><strong>Issue:</strong> ${escapeHtml(ticket.service)}</p>
      <p><strong>Drop-off date:</strong> ${escapeHtml(dropOffDate)}</p>
      <p>Before dropping off your device, please back up your data and remove any personal accounts if possible.</p>
      <p><a href="${escapeHtml(trackingUrl)}">Track your repair ticket</a></p>
      <p style="margin-top:32px;color:#64748b;font-size:12px">${escapeHtml(signOff)}</p>
    </div>`;

  return deliver({
    to: ticket.customerEmail,
    subject: `Repair ticket ${ticket.ticketNumber} received`,
    text,
    html,
    messageType: "repair ticket confirmation",
    reference: ticket.ticketNumber
  });
}

module.exports = {
  sendOrderConfirmation,
  sendRepairTicketConfirmation
};
