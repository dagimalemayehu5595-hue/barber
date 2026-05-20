const form = document.querySelector("#bookingForm");
const proofInput = document.querySelector("#paymentProof");
const proofPreview = document.querySelector("#proofPreview");
const previewName = document.querySelector("#previewName");
const previewMeta = document.querySelector("#previewMeta");
const toast = document.querySelector("#toast");
const dateInput = form.elements.date;

const today = new Date();
const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 10);
dateInput.min = localToday;

const showToast = (message) => {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 6200);
};

const resetBookingUi = () => {
  form.reset();
  proofPreview.innerHTML = "<span>Payment proof preview</span>";
  previewName.textContent = "Waiting for details";
  previewMeta.textContent = "500 ETB haircut - Telebirr 0993534777";
  dateInput.min = localToday;
};

const updatePreview = () => {
  const name = form.elements.clientName.value.trim();
  const phone = form.elements.phone.value.trim();
  const date = form.elements.date.value;
  const time = form.elements.time.value;

  previewName.textContent = name || "Waiting for details";

  const details = ["500 ETB haircut", "Telebirr 0993534777"];
  if (phone) details.push(phone);
  if (date && time) details.push(`${date} at ${time}`);
  previewMeta.textContent = details.join(" - ");
};

form.addEventListener("input", updatePreview);

proofInput.addEventListener("change", () => {
  const file = proofInput.files?.[0];

  if (!file) {
    proofPreview.innerHTML = "<span>Payment proof preview</span>";
    return;
  }

  if (!file.type.startsWith("image/")) {
    proofInput.value = "";
    proofPreview.innerHTML = "<span>Payment proof preview</span>";
    showToast("Please upload an image file for the payment proof.");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    proofPreview.innerHTML = `<img src="${reader.result}" alt="Uploaded payment proof preview" />`;
  };
  reader.readAsDataURL(file);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = form.elements.clientName.value.trim();
  const phone = form.elements.phone.value.trim();
  const email = form.elements.email.value.trim();
  const date = form.elements.date.value;
  const time = form.elements.time.value;
  const proof = proofInput.files?.[0];

  if (!proof) {
    showToast("Please upload your Telebirr payment proof before reserving.");
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    const booking = {
      name,
      phone,
      email: email || "Not provided",
      date,
      time,
      service: "Haircut",
      price: "500 ETB",
      paymentMethod: "Telebirr",
      telebirrNumber: "0993534777",
      proofFileName: proof.name,
      proofDataUrl: reader.result,
      createdAt: new Date().toISOString(),
    };

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(booking),
      });

      if (!response.ok) {
        throw new Error("Booking server unavailable");
      }

      showToast(`Booking received for ${name}. We will confirm by phone at ${phone}.`);
    } catch (error) {
      const savedBooking = {
        ...booking,
        proofDataUrl: "Saved in this browser only",
      };
      const bookings = JSON.parse(localStorage.getItem("submit72Bookings") || "[]");
      bookings.unshift(savedBooking);
      localStorage.setItem("submit72Bookings", JSON.stringify(bookings.slice(0, 20)));
      showToast(`Booking saved on this device for ${name}. Run the server to receive bookings at the shop.`);
    }

    resetBookingUi();
  };

  reader.readAsDataURL(proof);
});
