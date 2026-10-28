const express = require("express");
const productService = require("../services/productService");

const router = express.Router();

router.get("/", (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category : "";
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";

  if (category && !productService.categories.includes(category)) {
    return res.status(400).send("Choose a valid product category.");
  }

  const products = productService.listProducts({ category: category || undefined, search });
  res.render("shop", {
    title: "Shop Computers & Accessories | Master Solutions",
    categories: productService.categories,
    selectedCategory: category,
    search,
    products
  });
});

router.get("/:id", (req, res) => {
  const product = productService.getProduct(req.params.id);
  if (!product) {
    return res.status(404).send("Product not found.");
  }

  res.render("product", {
    title: `${product.name} | Master Solutions`,
    product
  });
});

module.exports = router;
