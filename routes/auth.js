const express = require("express");
const bcrypt = require("bcryptjs");
const userService = require("../services/userService");

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const bcryptRounds = 12;

function renderForm(res, page, options = {}) {
  const isRegister = page === "register";
  res.status(options.status || 200).render(page, {
    title: isRegister ? "Register | Master Solutions" : "Login | Master Solutions",
    error: options.error || "",
    name: options.name || "",
    email: options.email || "",
    nextPath: options.nextPath || ""
  });
}

function getSafeNextPath(value) {
  return value === "/repairs/new" ? value : "/account";
}

function regenerateSession(req, user, next) {
  const cart = req.session.cart;
  req.session.regenerate((error) => {
    if (error) {
      return next(error);
    }
    if (cart) {
      req.session.cart = cart;
    }
    if (user) {
      req.session.user = user;
    }
    next();
  });
}

router.get("/register", (req, res) => {
  if (req.session.user) {
    return res.redirect("/account");
  }
  renderForm(res, "register", { nextPath: getSafeNextPath(req.query.next) });
});

router.post("/register", async (req, res, next) => {
  if (req.session.user) {
    return res.redirect("/account");
  }
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body.email === "string" ? userService.normalizeEmail(req.body.email) : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const confirmPassword = typeof req.body.confirmPassword === "string" ? req.body.confirmPassword : "";
  const nextPath = getSafeNextPath(req.body.next);

  if (!name || name.length > 100) {
    return renderForm(res, "register", {
      status: 400,
      error: "Enter your name (up to 100 characters).",
      name,
      email,
      nextPath
    });
  }
  if (email.length > 254 || !emailPattern.test(email)) {
    return renderForm(res, "register", {
      status: 400,
      error: "Enter a valid email address.",
      name,
      email,
      nextPath
    });
  }
  if (Buffer.byteLength(password, "utf8") < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return renderForm(res, "register", {
      status: 400,
      error: "Use a password between 8 and 72 bytes.",
      name,
      email,
      nextPath
    });
  }
  if (password !== confirmPassword) {
    return renderForm(res, "register", {
      status: 400,
      error: "The passwords do not match.",
      name,
      email,
      nextPath
    });
  }

  if (userService.getUserByEmail(email)) {
    return renderForm(res, "register", {
      status: 409,
      error: "An account with that email already exists. Please log in instead.",
      name,
      email,
      nextPath
    });
  }

  const passwordHash = await bcrypt.hash(password, bcryptRounds);
  const user = userService.createCustomer({ name, email, passwordHash });
  if (!user) {
    return renderForm(res, "register", {
      status: 409,
      error: "An account with that email already exists. Please log in instead.",
      name,
      email,
      nextPath
    });
  }

  regenerateSession(req, user, (error) => {
    if (error) {
      return next(error);
    }
    res.redirect(nextPath);
  });
});

router.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/account");
  }
  renderForm(res, "login", { nextPath: getSafeNextPath(req.query.next) });
});

router.post("/login", async (req, res, next) => {
  if (req.session.user) {
    return res.redirect("/account");
  }
  const email = typeof req.body.email === "string" ? userService.normalizeEmail(req.body.email) : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const nextPath = getSafeNextPath(req.body.next);
  const user = email.length <= 254 ? userService.getUserByEmail(email) : undefined;
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return renderForm(res, "login", {
      status: 401,
      error: "Email or password is incorrect.",
      email,
      nextPath
    });
  }

  const { passwordHash, ...sessionUser } = user;
  regenerateSession(req, sessionUser, (error) => {
    if (error) {
      return next(error);
    }
    res.redirect(nextPath);
  });
});

router.post("/logout", (req, res, next) => {
  regenerateSession(req, null, (error) => {
    if (error) {
      return next(error);
    }
    res.redirect("/");
  });
});

module.exports = router;
