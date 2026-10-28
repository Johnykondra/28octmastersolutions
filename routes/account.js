const express = require("express");
const ticketService = require("../services/ticketService");
const orderService = require("../services/orderService");

const router = express.Router();

router.get("/account", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const activeTab = req.query.tab === "orders" ? "orders" : "repairs";
  const tickets = activeTab === "repairs"
    ? ticketService.listTicketsByCustomerEmail(req.session.user.email)
    : [];
  const orders = activeTab === "orders"
    ? orderService.listOrdersByCustomerEmail(req.session.user.email)
    : [];
  res.render("account", {
    title: "My Account | Master Solutions",
    activeTab,
    tickets,
    orders
  });
});

module.exports = router;
