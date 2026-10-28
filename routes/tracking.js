const express = require("express");
const ticketService = require("../services/ticketService");

const router = express.Router();

router.get("/track", (req, res) => {
  res.render("track", {
    title: "Track a Repair | Master Solutions",
    error: "",
    ticket: null,
    ticketNumber: "",
    email: ""
  });
});

router.post("/track", (req, res) => {
  const ticketNumber = typeof req.body.ticketNumber === "string"
    ? req.body.ticketNumber.trim().slice(0, 100)
    : "";
  const email = typeof req.body.email === "string"
    ? req.body.email.trim().toLowerCase().slice(0, 254)
    : "";
  const ticket = ticketNumber && email
    ? ticketService.getTicketForTracking(ticketNumber, email)
    : undefined;

  res.status(ticket ? 200 : 404).render("track", {
    title: "Track a Repair | Master Solutions",
    error: ticket ? "" : "We couldn’t find a ticket matching those details.",
    ticket: ticket || null,
    ticketNumber,
    email
  });
});

module.exports = router;
