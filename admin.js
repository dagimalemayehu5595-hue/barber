const pinInput = document.querySelector("#adminPin");
const loadButton = document.querySelector("#loadBookings");
const bookingList = document.querySelector("#bookingList");
const adminMessage = document.querySelector("#adminMessage");

const setMessage = (message) => {
  adminMessage.textContent = message;
};

const bookingMarkup = (booking) => `
  <article class="booking-card">
    <div>
      <h2>${booking.name} - ${booking.barber}</h2>
      <p>
        ${booking.date} at ${booking.time}<br />
        Client phone: ${booking.phone}<br />
        Total: ${booking.price || "500 ETB"} / Deposit: ${booking.deposit || "250 ETB"} / Remaining: ${booking.remainingBalance || "250 ETB"}<br />
        Payment: ${booking.paymentMethod} ${booking.paymentAccountNumber}<br />
        Proof file: ${booking.proofFile || "Saved with booking"}
      </p>
    </div>
    <button class="button danger" type="button" data-delete="${booking.id}">Cancel booking</button>
  </article>
`;

const loadBookings = async () => {
  const pin = pinInput.value.trim();
  if (!pin) {
    setMessage("Enter the admin PIN first.");
    return;
  }

  setMessage("Loading bookings...");
  bookingList.innerHTML = "";

  try {
    const response = await fetch("/api/bookings", {
      headers: { "X-Admin-Pin": pin },
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not load bookings.");
    }

    bookingList.innerHTML = result.bookings.length
      ? result.bookings.map(bookingMarkup).join("")
      : '<article class="booking-card"><p>No bookings yet.</p></article>';
    setMessage(`${result.bookings.length} booking${result.bookings.length === 1 ? "" : "s"} loaded.`);
  } catch (error) {
    setMessage(error.message);
  }
};

loadButton.addEventListener("click", loadBookings);

bookingList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;

  const pin = pinInput.value.trim();
  const id = button.dataset.delete;
  button.disabled = true;
  button.textContent = "Cancelling...";

  try {
    const response = await fetch(`/api/bookings/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "X-Admin-Pin": pin },
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Could not cancel booking.");
    }
    setMessage("Booking cancelled and the slot is open again.");
    await loadBookings();
  } catch (error) {
    setMessage(error.message);
    button.disabled = false;
    button.textContent = "Cancel booking";
  }
});
