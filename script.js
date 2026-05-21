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
        detail: "Send 250 ETB deposit to 0993534777",
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
        detail: "Send 250 ETB deposit to 0939025328 - Account holder Yabtsega",
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
const paymentInstructions = document.querySelector("#paymentInstructions");
const proofHelp = document.querySelector("#proofHelp");
const timeSlots = document.querySelector("#timeSlots");
const slotHelp = document.querySelector("#slotHelp");
const toast = document.querySelector("#toast");
const dateInput = form.elements.date;
const timeInput = form.elements.time;
const HAIRCUT_PRICE = 500;
const BOOKING_DEPOSIT = 250;
const REMAINING_BALANCE = HAIRCUT_PRICE - BOOKING_DEPOSIT;
const SLOT_DURATION_MINUTES = 60;
const TIME_SLOTS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

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

const isPickedLocally = (booking, bookings) =>
  bookings.some(
    (existing) =>
      String(existing.barber || "").toLowerCase() === String(booking.barber || "").toLowerCase() &&
      existing.date === booking.date &&
      existing.time === booking.time,
  );

const getLocalPickedTimes = (barber, date) => {
  const bookings = JSON.parse(localStorage.getItem("submit72Bookings") || "[]");
  return bookings
    .filter(
      (booking) =>
        String(booking.barber || "").toLowerCase() === String(barber || "").toLowerCase() && booking.date === date,
    )
    .map((booking) => booking.time);
};

const getPickedTimes = async (barber, date) => {
  if (!date) {
    return [];
  }

  const localPickedTimes = getLocalPickedTimes(barber, date);

  try {
    const response = await fetch(
      `/api/availability?barber=${encodeURIComponent(barber)}&date=${encodeURIComponent(date)}`,
    );

    if (!response.ok) {
      throw new Error("Availability server unavailable");
    }

    const result = await response.json();
    return [...new Set([...(result.bookedTimes || []), ...localPickedTimes])];
  } catch (error) {
    return localPickedTimes;
  }
};

const renderTimeSlots = async () => {
  const barber = getSelectedBarber();
  const date = dateInput.value;

  timeInput.value = "";

  if (!date) {
    timeSlots.innerHTML = "";
    slotHelp.textContent = `Choose a date to see open ${SLOT_DURATION_MINUTES}-minute haircut slots.`;
    return;
  }

  slotHelp.textContent = "Loading open haircut slots...";
  const pickedTimes = await getPickedTimes(barber.name, date);

  timeSlots.innerHTML = TIME_SLOTS.map((time) => {
    const isPicked = pickedTimes.includes(time);
    return `
      <button class="time-slot${isPicked ? " picked" : ""}" type="button" data-time="${time}" ${isPicked ? "disabled" : ""}>
        <strong>${time}</strong>
        <span>${isPicked ? "Picked" : `${SLOT_DURATION_MINUTES} min`}</span>
      </button>
    `;
  }).join("");

  const openCount = TIME_SLOTS.length - pickedTimes.length;
  slotHelp.textContent =
    openCount > 0
      ? `${openCount} open time${openCount === 1 ? "" : "s"} for ${barber.name}.`
      : `All times are picked for ${barber.name} on this date.`;

  updatePreview();
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

const renderPaymentInstructions = () => {
  const barber = getSelectedBarber();
  const payment = getSelectedPayment();
  paymentInstructions.innerHTML = `
    <strong>Send ${BOOKING_DEPOSIT} ETB deposit before reserving</strong>
    <p>Total haircut: ${HAIRCUT_PRICE} ETB<br />Remaining at shop: ${REMAINING_BALANCE} ETB<br />${payment.label}: ${payment.accountNumber}<br />Account holder: ${payment.accountHolder}<br />Barber: ${barber.name}</p>
  `;
};

const resetBookingUi = () => {
  form.reset();
  renderPaymentMethods();
  proofPreview.innerHTML = "<span>Payment proof preview</span>";
  previewName.textContent = "Waiting for details";
  dateInput.min = localToday;
  renderTimeSlots();
  updatePreview();
};

const updatePreview = () => {
  const name = form.elements.clientName.value.trim();
  const phone = form.elements.phone.value.trim();
  const date = form.elements.date.value;
  const time = form.elements.time.value;
  const barber = getSelectedBarber();
  const payment = getSelectedPayment();
  renderPaymentInstructions();

  previewName.textContent = name || "Waiting for details";
  previewBarber.textContent = barber.name;
  previewPhone.textContent = barber.phone;
  previewEmail.textContent = barber.email;
  proofHelp.textContent = `Screenshot or photo of your ${payment.label} receipt`;

  const details = [`${HAIRCUT_PRICE} ETB haircut`, `${BOOKING_DEPOSIT} ETB deposit`, barber.name, `${payment.label} ${payment.accountNumber}`];
  if (phone) details.push(phone);
  if (date && time) details.push(`${date} at ${time}`);
  previewMeta.textContent = details.join(" - ");
};

form.addEventListener("change", (event) => {
  if (event.target.name === "barber") {
    renderPaymentMethods();
    renderTimeSlots();
  }

  if (event.target.name === "date") {
    renderTimeSlots();
  }

  updatePreview();
});

form.addEventListener("input", updatePreview);

timeSlots.addEventListener("click", (event) => {
  const slot = event.target.closest(".time-slot");

  if (!slot || slot.disabled) {
    return;
  }

  timeInput.value = slot.dataset.time;
  timeSlots.querySelectorAll(".time-slot").forEach((button) => button.classList.remove("selected"));
  slot.classList.add("selected");
  updatePreview();
});

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

  if (!time) {
    showToast("Please choose an open time slot before reserving.");
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
      price: `${HAIRCUT_PRICE} ETB`,
      deposit: `${BOOKING_DEPOSIT} ETB`,
      remainingBalance: `${REMAINING_BALANCE} ETB`,
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

      if (response.status === 409) {
        const result = await response.json().catch(() => ({}));
        showToast(result.error || "That date and time is already picked. Please choose another slot.");
        return;
      }

      if (!response.ok) {
        throw new Error("Booking server unavailable");
      }

      showToast(`Booking sent to the shop for ${name}. Please wait for confirmation from ${barber.name}.`);
    } catch (error) {
      const savedBooking = {
        ...booking,
        proofDataUrl: "Saved in this browser only",
      };
      const bookings = JSON.parse(localStorage.getItem("submit72Bookings") || "[]");
      if (isPickedLocally(savedBooking, bookings)) {
        showToast("That date and time is already picked for this barber. Please choose another slot.");
        return;
      }

      bookings.unshift(savedBooking);
      localStorage.setItem("submit72Bookings", JSON.stringify(bookings.slice(0, 20)));
      showToast(`Booking saved for ${name}. When the backend is running, it will be sent to the shop for confirmation.`);
    }

    resetBookingUi();
  };

  reader.readAsDataURL(proof);
});

renderPaymentMethods();
renderPaymentInstructions();
renderTimeSlots();
updatePreview();
