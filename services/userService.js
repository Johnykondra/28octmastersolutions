const db = require("../data/db");

const userByEmail = db.prepare(`
  SELECT id, name, email, passwordHash, role
  FROM users
  WHERE email = ? COLLATE NOCASE
`);
const insertUser = db.prepare(`
  INSERT INTO users (name, email, passwordHash)
  VALUES (?, ?, ?)
`);

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function getUserByEmail(email) {
  return userByEmail.get(normalizeEmail(email));
}

function createCustomer({ name, email, passwordHash }) {
  const normalizedEmail = normalizeEmail(email);
  try {
    const result = insertUser.run(name.trim(), normalizedEmail, passwordHash);
    return {
      id: Number(result.lastInsertRowid),
      name: name.trim(),
      email: normalizedEmail,
      role: "customer"
    };
  } catch (error) {
    if (getUserByEmail(normalizedEmail)) {
      return null;
    }
    throw error;
  }
}

module.exports = {
  normalizeEmail,
  getUserByEmail,
  createCustomer
};
