const express = require("express");
const productService = require("../services/productService");

const router = express.Router();

function redirectWithNotice(req, res, type, message, destination = "/cart") {
  req.session.notice = { type, message };
  res.redirect(destination);
}

function getProductId(value) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return null;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

router.get("/", (req, res) => {
  const cart = req.session.cart || {};
  const items = [];
  let stockChanged = false;

  for (const [id, quantity] of Object.entries(cart)) {
    const product = productService.getProduct(id);
    if (!product || product.stock === 0 || !Number.isSafeInteger(quantity) || quantity <= 0) {
      delete cart[id];
      stockChanged = true;
      continue;
    }

    const availableQuantity = Math.min(quantity, product.stock);
    if (availableQuantity !== quantity) {
      cart[id] = availableQuantity;
      stockChanged = true;
    }
    items.push({
      product,
      quantity: availableQuantity,
      lineTotal: product.priceFils * availableQuantity
    });
  }

  if (Object.keys(cart).length > 0) {
    req.session.cart = cart;
  } else {
    delete req.session.cart;
  }
  if (stockChanged && !res.locals.notice) {
    res.locals.notice = {
      type: "warning",
      message: "Your cart was updated because product availability changed."
    };
  }

  res.render("cart", {
    title: "Your Cart | Master Solutions",
    items,
    cartTotal: items.reduce((total, item) => total + item.lineTotal, 0)
  });
});

router.post("/add/:id", (req, res) => {
  const id = getProductId(req.params.id);
  const product = id ? productService.getProduct(id) : undefined;
  if (!product) {
    return res.status(404).send("Product not found.");
  }
  if (product.stock < 1) {
    return redirectWithNotice(req, res, "warning", `${product.name} is out of stock.`, `/shop/${id}`);
  }

  const cart = req.session.cart || {};
  const quantity = cart[id] || 0;
  if (quantity >= product.stock) {
    return redirectWithNotice(
      req,
      res,
      "warning",
      `Only ${product.stock} ${product.stock === 1 ? "unit is" : "units are"} available.`,
      `/shop/${id}`
    );
  }

  cart[id] = quantity + 1;
  req.session.cart = cart;
  redirectWithNotice(req, res, "success", `${product.name} added to your cart.`);
});

router.post("/update/:id", (req, res) => {
  const id = getProductId(req.params.id);
  const product = id ? productService.getProduct(id) : undefined;
  if (!product) {
    return res.status(404).send("Product not found.");
  }

  const cart = req.session.cart || {};
  const currentQuantity = cart[id] || 0;
  const delta = Number(req.body.delta);
  if (req.body.delta !== "-1" && req.body.delta !== "1") {
    return redirectWithNotice(req, res, "warning", "Choose a valid quantity adjustment.");
  }

  const nextQuantity = currentQuantity + delta;
  if (nextQuantity <= 0) {
    delete cart[id];
  } else if (nextQuantity > product.stock) {
    return redirectWithNotice(
      req,
      res,
      "warning",
      `Only ${product.stock} ${product.stock === 1 ? "unit is" : "units are"} available.`
    );
  } else {
    cart[id] = nextQuantity;
  }

  req.session.cart = cart;
  res.redirect("/cart");
});

router.post("/remove/:id", (req, res) => {
  const id = getProductId(req.params.id);
  if (!id) {
    return res.status(404).send("Product not found.");
  }

  const cart = req.session.cart || {};
  delete cart[id];
  req.session.cart = cart;
  redirectWithNotice(req, res, "success", "Item removed from your cart.");
});

module.exports = router;
