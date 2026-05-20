const BARBERS = {
  dagibladez: {
    name: "Dagibladez",
    phone: "0993534777",
    email: "Dagimhailu01@icloud.com",
    payments: [
      {
        id: "dagibladez-telebirr",
        method: "Telebirr",
        label: "Telebirr",
        detail: "Send 500 ETB to 0993534777",
        accountNumber: "0993534777",
        accountHolder: "Dagibladez",
      },
    ],
  },
  "360yabu": {
    name: "360yabu",
    phone: "0939025328",
    email: "simonyabtsega@gmail.com",
    payments: [
      {
        id: "360yabu-abysiniya",
        method: "Abysiniya Bank",
        label: "Abysiniya Bank",
        detail: "Account 161664383 - Account holder Yabtsega",
        accountNumber: "161664383",
        accountHolder: "Yabtsega",
      },
      {
        id: "360yabu-telebirr",
        method: "Telebirr",
        label: "Telebirr",
        detail: "Send 500 ETB to 0939025328 - Account holder Yabtsega",
        accountNumber: "0939025328",
        accountHolder: "Yabtsega",
      },
    ],
  },
};

const form = document.querySelector("#bookingForm");
const proofInput = document.querySelector("#paymentProof");
const proofPreview = document.querySelector("#proofPreview");
const previewName = document.querySelector("#previewName");
const previewMeta = document.querySelector("#previewMeta");
const previewBarber = document.querySelector("#previewBarber");
const previewPhone = document.querySelector("#previewPhone");
const previewEmail = document.querySelector("#previewEmail");
const paymentMethods = document.querySelector("#paymentMethods");
const proofHelp = document.querySelector("#proofHelp");
const toast = document.querySelector("#toast");
const dateInput = form.elements.date;

const today = new Date();
const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 10);
dateInput.min = localToday;

const getSelectedBarber = () => BARBERS[form.elements.barber.value] || BARBERS.dagibladez;

const getSelectedPayment = () => {
  const barber = getSelectedBarber();
  return barber.payments.find((payment) => payment.id === form.elements.paymentMethod.value) || barber.payments[0];
};

const showToast = (message) => {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 6200);
};

const renderPaymentMethods = () => {
  const barber = getSelectedBarber();
  paymentMethods.innerHTML = barber.payments
    .map(
      (payment, index) => `
        <label class="payment-choice">
          <input name="paymentMethod" type="radio" value="${payment.id}" ${index === 0 ? "checked" : ""} />
          <span>
            <strong>${payment.label}</strong>
            <small>${payment.detail}</small>
          </span>
        </label>
      `,
    )
    .join("");
};

const resetBookingUi = () => {
  form.reset();
  renderPaymentMethods();
  proofPreview.innerHTML = "<span>Payment proof preview</span>";
  previewName.textContent = "Waiting for details";
  dateInput.min = localToday;
  updatePreview();
};

const updatePreview = () => {
  const name = form.elements.clientName.value.trim();
  const phone = form.elements.phone.value.trim();
  const date = form.elements.date.value;
  const time = form.elements.time.value;
  const barber = getSelectedBarber();
  const payment = getSelectedPayment();

  previewName.textContent = name || "Waiting for details";
  previewBarber.textContent = barber.name;
  previewPhone.textContent = barber.phone;
  previewEmail.textContent = barber.email;
  proofHelp.textContent = `Screenshot or photo of your ${payment.label} receipt`;

  const details = ["500 ETB haircut", barber.name, `${payment.label} ${payment.accountNumber}`];
  if (phone) details.push(phone);
  if (date && time) details.push(`${date} at ${time}`);
  previewMeta.textContent = details.join(" - ");
};

form.addEventListener("change", (event) => {
  if (event.target.name === "barber") {
    renderPaymentMethods();
  }

  updatePreview();
});

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
  const barber = getSelectedBarber();
  const payment = getSelectedPayment();

  if (!proof) {
    showToast("Please upload your payment proof before reserving.");
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
      barber: barber.name,
      barberPhone: barber.phone,
      barberEmail: barber.email,
      service: "Haircut",
      price: "500 ETB",
      paymentMethod: payment.method,
      paymentAccountNumber: payment.accountNumber,
      paymentAccountHolder: payment.accountHolder,
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

      showToast(`Booking received for ${name} with ${barber.name}. We will confirm by phone at ${phone}.`);
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

renderPaymentMethods();
updatePreview();
