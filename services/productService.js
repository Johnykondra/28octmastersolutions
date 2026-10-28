const db = require("../data/db");

const categories = Object.freeze(["Laptops", "Desktops", "Servers", "Accessories"]);
const products = [
  {
    name: "Dell Latitude 5450",
    category: "Laptops",
    brand: "Dell",
    specs: "14-inch FHD+ · Intel Core Ultra 5 · 16GB RAM · 512GB SSD",
    priceFils: 349900,
    stock: 8
  },
  {
    name: "Lenovo ThinkPad E14 Gen 6",
    category: "Laptops",
    brand: "Lenovo",
    specs: "14-inch WUXGA · Intel Core Ultra 5 · 16GB RAM · 512GB SSD",
    priceFils: 329900,
    stock: 6
  },
  {
    name: "ASUS Vivobook S 14",
    category: "Laptops",
    brand: "ASUS",
    specs: "14-inch OLED · Intel Core Ultra 7 · 16GB RAM · 1TB SSD",
    priceFils: 429900,
    stock: 5
  },
  {
    name: "Dell Pro Tower",
    category: "Desktops",
    brand: "Dell",
    specs: "Intel Core i5 · 16GB RAM · 512GB SSD · Windows 11 Pro",
    priceFils: 289900,
    stock: 4
  },
  {
    name: "HP ProDesk 400 G9",
    category: "Desktops",
    brand: "HP",
    specs: "Intel Core i5 · 16GB RAM · 512GB SSD · Windows 11 Pro",
    priceFils: 269900,
    stock: 3
  },
  {
    name: "Lenovo ThinkCentre neo 50t",
    category: "Desktops",
    brand: "Lenovo",
    specs: "Intel Core i5 · 16GB RAM · 512GB SSD · Windows 11 Pro",
    priceFils: 259900,
    stock: 5
  },
  {
    name: "Dell PowerEdge R770",
    category: "Servers",
    brand: "Dell",
    specs: "2U rack server · Dual-socket ready · DDR5 · Hot-swap storage",
    priceFils: 3299900,
    stock: 2
  },
  {
    name: "HPE ProLiant DL380 Gen12",
    category: "Servers",
    brand: "HP",
    specs: "2U rack server · Intel Xeon 6 · DDR5 · Hot-swap storage",
    priceFils: 3899900,
    stock: 2
  },
  {
    name: "Lenovo ThinkSystem SR650 V3",
    category: "Servers",
    brand: "Lenovo",
    specs: "2U rack server · Dual-socket ready · DDR5 · Enterprise storage",
    priceFils: 3499900,
    stock: 1
  },
  {
    name: "Dell Pro Plus Keyboard and Mouse",
    category: "Accessories",
    brand: "Dell",
    specs: "Wireless keyboard and mouse · Bluetooth · Multi-device pairing",
    priceFils: 34900,
    stock: 12
  },
  {
    name: "Lenovo ThinkPad USB-C Dock Gen 2",
    category: "Accessories",
    brand: "Lenovo",
    specs: "USB-C docking station · Dual display · 90W power delivery",
    priceFils: 79900,
    stock: 7
  },
  {
    name: "ASUS ROG Cetra True Wireless",
    category: "Accessories",
    brand: "ASUS",
    specs: "Wireless gaming earbuds · Active noise cancellation · USB-C",
    priceFils: 39900,
    stock: 9
  }
].map((product) => ({
  ...product,
  imageUrl: `https://placehold.co/640x420/0b1f3a/5eead4?text=${encodeURIComponent(product.name)}`
}));

const countProducts = db.prepare("SELECT COUNT(*) AS count FROM products");
const insertProduct = db.prepare(`
  INSERT INTO products (name, category, brand, specs, priceFils, stock, imageUrl)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const allProducts = db.prepare("SELECT * FROM products WHERE isActive = 1 ORDER BY category, name");
const productsByCategory = db.prepare(
  "SELECT * FROM products WHERE isActive = 1 AND category = ? ORDER BY name"
);
const productsBySearch = db.prepare(`
  SELECT * FROM products
  WHERE isActive = 1
    AND instr(lower(name || ' ' || brand || ' ' || specs), lower(?)) > 0
  ORDER BY category, name
`);
const productsByCategoryAndSearch = db.prepare(`
  SELECT * FROM products
  WHERE isActive = 1
    AND category = ?
    AND instr(lower(name || ' ' || brand || ' ' || specs), lower(?)) > 0
  ORDER BY name
`);
const productById = db.prepare("SELECT * FROM products WHERE id = ? AND isActive = 1");
const setStock = db.prepare("UPDATE products SET stock = ? WHERE id = ?");
const decrementStockIfAvailable = db.prepare(`
  UPDATE products
  SET stock = stock - ?
  WHERE id = ? AND isActive = 1 AND stock >= ?
`);

function seedProductsIfEmpty() {
  if (countProducts.get().count > 0) {
    return;
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const product of products) {
      insertProduct.run(
        product.name,
        product.category,
        product.brand,
        product.specs,
        product.priceFils,
        product.stock,
        product.imageUrl
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

seedProductsIfEmpty();

function listProducts({ category, search = "" } = {}) {
  if (category && !categories.includes(category)) {
    throw new RangeError(`Unknown product category: ${category}`);
  }
  if (typeof search !== "string") {
    throw new TypeError("Product search must be a string.");
  }

  const term = search.trim().slice(0, 100);
  if (category && term) {
    return productsByCategoryAndSearch.all(category, term);
  }
  if (category) {
    return productsByCategory.all(category);
  }
  if (term) {
    return productsBySearch.all(term);
  }
  return allProducts.all();
}

function getProduct(id) {
  const productId = Number(id);
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    return undefined;
  }
  return productById.get(productId);
}

function updateStock(id, stock) {
  const productId = Number(id);
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    throw new TypeError("Product ID must be a positive whole number.");
  }
  if (!Number.isSafeInteger(stock) || stock < 0) {
    throw new TypeError("Stock must be a non-negative whole number.");
  }

  const result = setStock.run(stock, productId);
  return result.changes > 0 ? getProduct(productId) : null;
}

function decrementStock(id, quantity) {
  const productId = Number(id);
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    throw new TypeError("Product ID must be a positive whole number.");
  }
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new TypeError("Stock decrement must be a positive whole number.");
  }

  return decrementStockIfAvailable.run(quantity, productId, quantity).changes === 1;
}

module.exports = {
  categories,
  listProducts,
  getProduct,
  updateStock,
  decrementStock
};
