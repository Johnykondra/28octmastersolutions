const checkoutSummary = document.querySelector(".checkout-summary");

if (checkoutSummary) {
  const addressField = document.querySelector("#deliveryAddress");
  const deliveryAmount = checkoutSummary.querySelector(".checkout-delivery-amount");
  const totalAmount = checkoutSummary.querySelector(".checkout-total-amount");
  const subtotalFils = Number(checkoutSummary.dataset.subtotalFils);
  const deliveryFeeFils = Number(checkoutSummary.dataset.deliveryFeeFils);

  function formatPrice(fils) {
    return `AED ${(fils / 100).toLocaleString("en-AE", {
      minimumFractionDigits: Number.isInteger(fils / 100) ? 0 : 2,
      maximumFractionDigits: 2
    })}`;
  }

  function updateDeliverySummary() {
    const deliverySelected = document.querySelector(
      'input[name="deliveryMethod"]:checked'
    )?.value === "delivery";
    const deliveryFils = deliverySelected ? deliveryFeeFils : 0;
    deliveryAmount.textContent = deliveryFils ? formatPrice(deliveryFils) : "Free";
    totalAmount.textContent = formatPrice(subtotalFils + deliveryFils);
    addressField.required = deliverySelected;
  }

  document.querySelectorAll('input[name="deliveryMethod"]').forEach((input) => {
    input.addEventListener("change", updateDeliverySummary);
  });
  updateDeliverySummary();
}
