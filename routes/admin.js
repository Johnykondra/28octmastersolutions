const express = require("express");
const ticketService = require("../services/ticketService");

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  if (req.session.user.role !== "admin") {
    return res.status(403).send("Administrator access is required.");
  }
  next();
}

router.get("/admin", requireAdmin, (req, res) => {
  res.render("admin", {
    title: "Admin Dashboard | Master Solutions",
    tickets: ticketService.listAllTickets(),
    counts: ticketService.getTicketCounts(),
    statuses: ticketService.statuses
  });
});

router.post("/admin/tickets/:ticketNumber/status", requireAdmin, (req, res) => {
  const ticketNumber = req.params.ticketNumber;
  const status = typeof req.body.status === "string" ? req.body.status : "";
  if (!ticketService.statuses.includes(status)) {
    req.session.notice = {
      type: "danger",
      message: "Choose a valid repair status."
    };
    return res.redirect("/admin");
  }

  if (!ticketService.setTicketStatus(ticketNumber, status)) {
    return res.status(404).send("Repair ticket not found.");
  }

  req.session.notice = {
    type: "success",
    message: `Ticket ${ticketNumber} updated to ${status}.`
  };
  res.redirect("/admin");
});

module.exports = router;
