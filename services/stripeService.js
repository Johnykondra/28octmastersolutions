const Stripe = require("stripe");

let stripeClient;

function hasTestSecretKey() {
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  return /^sk_test_[A-Za-z0-9]{24,}$/.test(secretKey);
}

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!hasTestSecretKey()) {
    throw new Error("Set a valid Stripe test secret key in STRIPE_SECRET_KEY to enable checkout.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

async function createCheckoutSession({ order, items, baseUrl, deliveryLabel }) {
  const stripe = getStripe();
  const rootUrl = baseUrl.replace(/\/+$/, "");
  const lineItems = items.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency: "aed",
      unit_amount: item.unitPriceFils,
      product_data: {
        name: item.productName
      }
    }
  }));

  if (order.deliveryFeeFils > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "aed",
        unit_amount: order.deliveryFeeFils,
        product_data: {
          name: deliveryLabel
        }
      }
    });
  }

  return stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: lineItems,
      customer_email: order.customerEmail,
      client_reference_id: order.orderNumber,
      metadata: {
        orderId: String(order.id),
        orderNumber: order.orderNumber
      },
      success_url: `${rootUrl}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${rootUrl}/cart`
    },
    {
      idempotencyKey: `checkout-order-${order.id}`
    }
  );
}

async function retrieveCheckoutSession(sessionId) {
  return getStripe().checkout.sessions.retrieve(sessionId);
}

module.exports = {
  hasTestSecretKey,
  getStripe,
  createCheckoutSession,
  retrieveCheckoutSession
};
