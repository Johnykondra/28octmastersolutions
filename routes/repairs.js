const express = require("express");
const ticketService = require("../services/ticketService");
const emailService = require("../services/emailService");

const router = express.Router();
const validDevices = new Set(["Laptop", "Desktop", "Server", "Other"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireCustomer(req, res, next) {
  if (!req.session.user) {
    return res.redirect(`/login?next=${encodeURIComponent("/repairs/new")}`);
  }
  next();
}

router.get("/new", requireCustomer, (req, res) => {
  res.render("repair-request", {
    title: "Book a Repair | Master Solutions",
    error: "",
    submitted: false,
    form: {
      name: req.session.user?.name || "",
      email: req.session.user?.email || "",
      device: "",
      service: ""
    }
  });
});

router.post("/", requireCustomer, async (req, res) => {
  const customerName = req.session.user.name;
  const customerEmail = req.session.user.email;
  const device = typeof req.body.device === "string" ? req.body.device : "";
  const service = typeof req.body.service === "string" ? req.body.service.trim() : "";

  const form = {
    name: customerName,
    email: customerEmail,
    device,
    service
  };
  const renderError = (error, status = 400) => res.status(status).render("repair-request", {
    title: "Book a Repair | Master Solutions",
    error,
    submitted: false,
    form
  });

  if (!customerName || customerName.length > 100) {
    return renderError("Enter your name (up to 100 characters).");
  }
  if (customerEmail.length > 254 || !emailPattern.test(customerEmail)) {
    return renderError("Enter a valid email address.");
  }
  if (!validDevices.has(device)) {
    return renderError("Choose a device type.");
  }
  if (!service || service.length > 200) {
    return renderError("Describe the service you need (up to 200 characters).");
  }

  const ticketNumber = ticketService.createTicket({
    customerName,
    customerEmail,
    device,
    service
  });
  try {
    const ticket = ticketService.getTicketByNumber(ticketNumber);
    if (!ticket) {
      throw new Error(`Created repair ticket ${ticketNumber} could not be reloaded for email.`);
    }
    await emailService.sendRepairTicketConfirmation(ticket);
  } catch (emailError) {
    console.error(`Could not process repair ticket email for ${ticketNumber}:`, emailError.message);
  }
  req.session.notice = {
    type: "success",
    message: `Repair request received. Your ticket number is ${ticketNumber}.`
  };
  res.redirect("/account?tab=repairs");
});

module.exports = router;
