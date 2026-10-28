const express = require("express");
const orderService = require("../services/orderService");
const productService = require("../services/productService");
const stripeService = require("../services/stripeService");
const emailService = require("../services/emailService");

const router = express.Router();
const deliveryArea = "Fujairah";
const deliveryFeeFils = 2500;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+0-9()\-\s]{7,20}$/;

function getCheckoutItems(cart) {
  const items = [];
  for (const [id, quantity] of Object.entries(cart)) {
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(quantity) || quantity <= 0) {
      return { error: "Your cart has an invalid item. Please update it and try again." };
    }

    const product = productService.getProduct(id);
    if (!product) {
      return { error: "A product in your cart is no longer available. Please review your cart." };
    }
    if (product.stock < quantity) {
      return {
        error: product.stock === 0
          ? `${product.name} is out of stock. Please update your cart.`
          : `Only ${product.stock} ${product.stock === 1 ? "unit is" : "units are"} available for ${product.name}. Please update your cart.`
      };
    }
    items.push({
      productId: product.id,
      productName: product.name,
      unitPriceFils: product.priceFils,
      quantity
    });
  }
  return items.length
    ? { items }
    : { error: "Your cart is empty." };
}

function getBaseUrl() {
  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    throw new Error("Set BASE_URL to the public site URL before starting checkout.");
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error("BASE_URL must be a valid absolute URL.");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw new Error("BASE_URL must use HTTP or HTTPS and must not include credentials.");
  }
  return baseUrl;
}

function initialForm(req) {
  return {
    name: req.session.user?.name || "",
    phone: "",
    email: req.session.user?.email || "",
    deliveryMethod: "pickup",
    deliveryAddress: ""
  };
}

function renderCheckout(res, { form, items, error = "", status = 200 }) {
  const subtotalFils = items.reduce((total, item) => {
    return total + item.unitPriceFils * item.quantity;
  }, 0);
  const selectedFee = form.deliveryMethod === "delivery" ? deliveryFeeFils : 0;
  res.status(status).render("checkout", {
    title: "Checkout | Master Solutions",
    error,
    status,
    form,
    items,
    subtotalFils,
    deliveryArea,
    deliveryFeeFils,
    totalFils: subtotalFils + selectedFee,
    stripeConfigured: stripeService.hasTestSecretKey()
  });
}

router.get("/checkout", (req, res) => {
  const snapshot = getCheckoutItems(req.session.cart || {});
  if (snapshot.error) {
    req.session.notice = { type: "warning", message: snapshot.error };
    return res.redirect("/cart");
  }
  renderCheckout(res, {
    form: initialForm(req),
    items: snapshot.items
  });
});

router.post("/checkout", async (req, res, next) => {
  const form = {
    name: typeof req.body.name === "string" ? req.body.name.trim() : "",
    phone: typeof req.body.phone === "string" ? req.body.phone.trim() : "",
    email: typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "",
    deliveryMethod: typeof req.body.deliveryMethod === "string" ? req.body.deliveryMethod : "",
    deliveryAddress: typeof req.body.deliveryAddress === "string" ? req.body.deliveryAddress.trim() : ""
  };

  const snapshot = getCheckoutItems(req.session.cart || {});
  if (snapshot.error) {
    req.session.notice = { type: "warning", message: snapshot.error };
    return res.redirect("/cart");
  }

  let error;
  if (!form.name || form.name.length > 100) {
    error = "Enter your name (up to 100 characters).";
  } else if (!phonePattern.test(form.phone) || form.phone.replace(/\D/g, "").length < 7) {
    error = "Enter a valid phone number.";
  } else if (form.email.length > 254 || !emailPattern.test(form.email)) {
    error = "Enter a valid email address.";
  } else if (!["pickup", "delivery"].includes(form.deliveryMethod)) {
    error = "Choose store pickup or delivery.";
  } else if (
    form.deliveryMethod === "delivery" &&
    (!form.deliveryAddress || form.deliveryAddress.length > 300)
  ) {
    error = "Enter your delivery address (up to 300 characters).";
  }

  if (error) {
    return renderCheckout(res, { form, items: snapshot.items, error, status: 400 });
  }

  let baseUrl;
  try {
    stripeService.getStripe();
    baseUrl = getBaseUrl();
  } catch (configurationError) {
    return renderCheckout(res, {
      form,
      items: snapshot.items,
      error: configurationError.message,
      status: 503
    });
  }

  const selectedDeliveryFee = form.deliveryMethod === "delivery" ? deliveryFeeFils : 0;
  const order = orderService.createPendingOrder({
    customerName: form.name,
    customerPhone: form.phone,
    customerEmail: form.email,
    deliveryMethod: form.deliveryMethod,
    deliveryAddress: form.deliveryAddress,
    deliveryFeeFils: selectedDeliveryFee,
    items: snapshot.items
  });
  const items = orderService.getOrderItems(order.id);

  let checkoutSession;
  try {
    checkoutSession = await stripeService.createCheckoutSession({
      order,
      items,
      baseUrl,
      deliveryLabel: `Delivery within ${deliveryArea}`
    });
  } catch (stripeError) {
    console.error("Stripe Checkout session creation failed:", stripeError.message);
    try {
      orderService.discardPendingOrder(order.id);
    } catch (cleanupError) {
      console.error("Could not remove the unpaid order after Stripe failure:", cleanupError.message);
    }
    return renderCheckout(res, {
      form,
      items: snapshot.items,
      error: "We could not start secure payment. Please try again.",
      status: 502
    });
  }

  if (!checkoutSession.url || !orderService.saveStripeSessionId(order.id, checkoutSession.id)) {
    console.error(`Stripe Checkout session could not be linked to order ${order.orderNumber}.`);
    return renderCheckout(res, {
      form,
      items: snapshot.items,
      error: "We could not link the secure payment session to your order. Please contact the shop before retrying.",
      status: 502
    });
  }
  res.redirect(303, checkoutSession.url);
});

router.get("/order-success", async (req, res) => {
  const sessionId = typeof req.query.session_id === "string" ? req.query.session_id : "";
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return res.status(400).render("order-result", {
      title: "Payment status | Master Solutions",
      order: null,
      paymentConfirmed: false,
      unavailable: false
    });
  }

  const order = orderService.getOrderByStripeSessionId(sessionId);
  if (!order) {
    return res.status(404).render("order-result", {
      title: "Payment status | Master Solutions",
      order: null,
      paymentConfirmed: false,
      unavailable: false
    });
  }

  let checkoutSession;
  try {
    checkoutSession = await stripeService.retrieveCheckoutSession(sessionId);
  } catch (stripeError) {
    console.error("Could not verify Stripe Checkout payment:", stripeError.message);
    return res.status(503).render("order-result", {
      title: "Payment status | Master Solutions",
      order,
      paymentConfirmed: false,
      unavailable: true
    });
  }

  if (
    checkoutSession.id !== sessionId ||
    checkoutSession.client_reference_id !== order.orderNumber ||
    checkoutSession.metadata?.orderId !== String(order.id) ||
    checkoutSession.currency !== "aed" ||
    checkoutSession.amount_total !== order.totalFils
  ) {
    return res.status(400).render("order-result", {
      title: "Payment status | Master Solutions",
      order: null,
      paymentConfirmed: false,
      unavailable: false
    });
  }

  if (checkoutSession.payment_status !== "paid") {
    return res.render("order-result", {
      title: "Payment not completed | Master Solutions",
      order,
      paymentConfirmed: false,
      unavailable: false
    });
  }

  try {
    const result = orderService.finalizePaidOrder(sessionId, productService);
    if (!result) {
      return res.status(404).render("order-result", {
        title: "Payment status | Master Solutions",
        order: null,
        paymentConfirmed: false,
        unavailable: false
      });
    }
    if (result.newlyPaid) {
      delete req.session.cart;
      try {
        const confirmation = orderService.claimConfirmationEmail(result.order.id);
        if (confirmation) {
          await emailService.sendOrderConfirmation(confirmation.order, confirmation.items);
        }
      } catch (emailError) {
        console.error(
          `Could not process order confirmation email for ${result.order.orderNumber}:`,
          emailError.message
        );
      }
    }
    return res.render("order-result", {
      title: "Order confirmed | Master Solutions",
      order: result.order,
      paymentConfirmed: true,
      unavailable: false
    });
  } catch (processingError) {
    if (!(processingError instanceof orderService.PaidOrderOutOfStockError)) {
      return next(processingError);
    }
    console.error(`Paid order ${order.orderNumber} requires stock review:`, processingError.message);
    return res.status(409).render("order-result", {
      title: "Order needs attention | Master Solutions",
      order,
      paymentConfirmed: false,
      unavailable: true
    });
  }
});

module.exports = router;
