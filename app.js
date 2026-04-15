const STORAGE_KEY = "barber_booking_v1";

const SERVICES = [
  { id: "haircut", name: "Haircut", duration: 30 },
  { id: "beard", name: "Beard Trim", duration: 20 },
  { id: "combo", name: "Haircut + Beard", duration: 45 },
  { id: "styling", name: "Hair Styling", duration: 40 },
];

const SLOT_TIMES = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00",
  "16:30", "17:00", "17:30", "18:00",
];

const STATUS_META = {
  available: { label: "Available", className: "status-available" },
  busy: { label: "Busy", className: "status-busy" },
  break: { label: "On Break", className: "status-break" },
  offline: { label: "Offline", className: "status-offline" },
};

const state = {
  role: "customer",
  selectedDate: todayISO(),
  currentMonth: monthStart(todayISO()),
  barberStatus: "available",
  bookings: [],
};

const els = {
  roleButtons: document.querySelectorAll(".role-btn"),
  statusDot: document.getElementById("statusDot"),
  liveStatusText: document.getElementById("liveStatusText"),
  statusHint: document.getElementById("statusHint"),
  barberControls: document.getElementById("barberControls"),
  statusSelect: document.getElementById("statusSelect"),
  customerBookingSection: document.getElementById("customerBookingSection"),
  bookingForm: document.getElementById("bookingForm"),
  customerName: document.getElementById("customerName"),
  serviceSelect: document.getElementById("serviceSelect"),
  dateInput: document.getElementById("dateInput"),
  slotSelect: document.getElementById("slotSelect"),
  monthLabel: document.getElementById("monthLabel"),
  prevMonth: document.getElementById("prevMonth"),
  nextMonth: document.getElementById("nextMonth"),
  calendarGrid: document.getElementById("calendarGrid"),
  customerWorkflow: document.getElementById("customerWorkflow"),
  barberWorkflow: document.getElementById("barberWorkflow"),
  customerRequests: document.getElementById("customerRequests"),
  pendingList: document.getElementById("pendingList"),
  todaySchedule: document.getElementById("todaySchedule"),
  historyList: document.getElementById("historyList"),
  bookingItemTemplate: document.getElementById("bookingItemTemplate"),
};

init();

function init() {
  hydrate();
  seedDefaults();
  setupServiceOptions();
  setupDateInput();
  bindEvents();
  render();
}

function hydrate() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    state.role = saved.role || state.role;
    state.selectedDate = saved.selectedDate || state.selectedDate;
    state.currentMonth = saved.currentMonth || state.currentMonth;
    state.barberStatus = saved.barberStatus || state.barberStatus;
    state.bookings = Array.isArray(saved.bookings) ? saved.bookings : [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function seedDefaults() {
  if (state.bookings.length) return;
  const tomorrow = addDaysISO(todayISO(), 1);
  state.bookings.push({
    id: crypto.randomUUID(),
    customerName: "Ravi",
    serviceId: "haircut",
    date: tomorrow,
    time: "10:30",
    status: "confirmed",
    createdAt: Date.now() - 1000 * 60 * 60 * 20,
    updatedAt: Date.now() - 1000 * 60 * 60 * 18,
  });
  persist();
}

function setupServiceOptions() {
  els.serviceSelect.innerHTML = SERVICES.map(
    (service) =>
      `<option value="${service.id}">${service.name} (${service.duration} min)</option>`
  ).join("");
}

function setupDateInput() {
  const today = todayISO();
  els.dateInput.min = today;
  if (state.selectedDate < today) state.selectedDate = today;
  els.dateInput.value = state.selectedDate;
}

function bindEvents() {
  els.roleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.role = button.dataset.role;
      persist();
      render();
    });
  });

  els.statusSelect.addEventListener("change", (event) => {
    state.barberStatus = event.target.value;
    persist();
    renderStatus();
    renderSlots();
  });

  els.dateInput.addEventListener("change", (event) => {
    state.selectedDate = event.target.value;
    persist();
    renderSlots();
  });

  els.bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    createBookingRequest();
  });

  els.prevMonth.addEventListener("click", () => {
    state.currentMonth = monthShift(state.currentMonth, -1);
    persist();
    renderCalendar();
  });

  els.nextMonth.addEventListener("click", () => {
    state.currentMonth = monthShift(state.currentMonth, 1);
    persist();
    renderCalendar();
  });

  els.pendingList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const id = target.dataset.id;
    if (!id) return;
    if (target.dataset.action === "approve") updateBookingStatus(id, "confirmed");
    if (target.dataset.action === "reject") updateBookingStatus(id, "rejected");
  });
}

function createBookingRequest() {
  const customerName = els.customerName.value.trim();
  const serviceId = els.serviceSelect.value;
  const date = els.dateInput.value;
  const time = els.slotSelect.value;

  if (!customerName || !serviceId || !date || !time) return;
  if (date < todayISO()) return;

  const reservedSlots = getReservedSlots(date);
  if (reservedSlots.includes(time)) {
    alert("This slot is no longer available.");
    renderSlots();
    return;
  }

  state.bookings.push({
    id: crypto.randomUUID(),
    customerName,
    serviceId,
    date,
    time,
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  els.bookingForm.reset();
  els.dateInput.value = date;
  state.selectedDate = date;

  persist();
  render();
}

function updateBookingStatus(id, status) {
  const booking = state.bookings.find((item) => item.id === id);
  if (!booking) return;

  if (status === "confirmed") {
    const confirmedSlots = state.bookings
      .filter((item) => item.status === "confirmed" && item.date === booking.date && item.id !== booking.id)
      .map((item) => item.time);

    if (confirmedSlots.includes(booking.time)) {
      alert("Cannot approve: this time slot is already confirmed.");
      return;
    }
  }

  booking.status = status;
  booking.updatedAt = Date.now();
  persist();
  render();
}

function render() {
  renderRole();
  renderStatus();
  renderSlots();
  renderCalendar();
  renderWorkflows();
}

function renderRole() {
  els.roleButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.role === state.role);
  });

  const isBarber = state.role === "barber";
  els.barberControls.classList.toggle("hidden", !isBarber);
  els.customerBookingSection.classList.toggle("hidden", isBarber);
  els.customerWorkflow.classList.toggle("hidden", isBarber);
  els.barberWorkflow.classList.toggle("hidden", !isBarber);
  els.statusSelect.value = state.barberStatus;
}

function renderStatus() {
  els.statusDot.className = `status-dot ${STATUS_META[state.barberStatus].className}`;
  els.liveStatusText.textContent = `Barber is ${STATUS_META[state.barberStatus].label}`;

  if (state.barberStatus === "available") {
    els.statusHint.textContent = "Customers can request future appointments now.";
  } else if (state.barberStatus === "busy") {
    els.statusHint.textContent = "Currently serving a client. Booking requests remain open.";
  } else if (state.barberStatus === "break") {
    els.statusHint.textContent = "On break. New requests can still be sent for later slots.";
  } else {
    els.statusHint.textContent = "Offline. Live confirmation may be delayed.";
  }
}

function renderSlots() {
  const date = state.selectedDate;
  const reservedSlots = getReservedSlots(date);

  let availableSlots = SLOT_TIMES.filter((slot) => !reservedSlots.includes(slot));

  // If barber is offline, only allow booking for tomorrow onwards.
  if (state.barberStatus === "offline" && date === todayISO()) {
    availableSlots = [];
  }

  els.slotSelect.innerHTML = availableSlots.length
    ? availableSlots.map((slot) => `<option value="${slot}">${slot}</option>`).join("")
    : '<option value="">No slots available</option>';

  els.slotSelect.disabled = availableSlots.length === 0;
}

function renderCalendar() {
  const [year, month] = state.currentMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const monthTitle = new Date(year, month - 1, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  els.monthLabel.textContent = monthTitle;

  const headers = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    .map((day) => `<div class="day-header">${day}</div>`)
    .join("");

  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push('<div class="day-cell"></div>');

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateISO = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const count = state.bookings.filter((booking) => booking.date === dateISO && booking.status === "confirmed").length;
    const hasBookings = count > 0;

    cells.push(`
      <div class="day-cell ${hasBookings ? "has-bookings" : ""}">
        ${day}
        ${hasBookings ? `<span class="booking-badge">${count} booked</span>` : ""}
      </div>
    `);
  }

  els.calendarGrid.innerHTML = headers + cells.join("");
}

function renderWorkflows() {
  renderCustomerRequests();
  renderBarberPending();
  renderDailyDashboard();
  renderHistory();
}

function renderCustomerRequests() {
  const requests = [...state.bookings]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 12);

  if (!requests.length) {
    els.customerRequests.innerHTML = "<li class='muted'>No requests yet.</li>";
    return;
  }

  els.customerRequests.innerHTML = "";
  requests.forEach((booking) => {
    const node = cloneBookingTemplate();
    node.querySelector(".item-title").textContent = `${booking.customerName} - ${serviceName(booking.serviceId)}`;
    node.querySelector(".item-sub").textContent = `${friendlyDate(booking.date)} at ${booking.time}`;
    node.querySelector(".item-actions").innerHTML = `<span class="badge ${booking.status}">${booking.status}</span>`;
    els.customerRequests.appendChild(node);
  });
}

function renderBarberPending() {
  const pending = state.bookings
    .filter((booking) => booking.status === "pending")
    .sort((a, b) => toMillis(a.date, a.time) - toMillis(b.date, b.time));

  if (!pending.length) {
    els.pendingList.innerHTML = "<li class='muted'>No pending requests.</li>";
    return;
  }

  els.pendingList.innerHTML = "";
  pending.forEach((booking) => {
    const node = cloneBookingTemplate();
    node.querySelector(".item-title").textContent = `${booking.customerName} - ${serviceName(booking.serviceId)}`;
    node.querySelector(".item-sub").textContent = `${friendlyDate(booking.date)} at ${booking.time}`;
    node.querySelector(".item-actions").innerHTML = `
      <button class="approve-btn" data-action="approve" data-id="${booking.id}">Approve</button>
      <button class="reject-btn" data-action="reject" data-id="${booking.id}">Reject</button>
    `;
    els.pendingList.appendChild(node);
  });
}

function renderDailyDashboard() {
  const today = todayISO();
  const schedule = state.bookings
    .filter((booking) => booking.status === "confirmed" && booking.date === today)
    .sort((a, b) => a.time.localeCompare(b.time));

  if (!schedule.length) {
    els.todaySchedule.innerHTML = "<li class='muted'>No confirmed appointments today.</li>";
    return;
  }

  els.todaySchedule.innerHTML = "";
  schedule.forEach((booking) => {
    const node = cloneBookingTemplate();
    node.querySelector(".item-title").textContent = `${booking.time} - ${booking.customerName}`;
    node.querySelector(".item-sub").textContent = `${serviceName(booking.serviceId)} (Confirmed)`;
    node.querySelector(".item-actions").innerHTML = "<span class='badge confirmed'>confirmed</span>";
    els.todaySchedule.appendChild(node);
  });
}

function renderHistory() {
  const now = Date.now();
  const history = state.bookings
    .filter((booking) => toMillis(booking.date, booking.time) < now)
    .sort((a, b) => toMillis(b.date, b.time) - toMillis(a.date, a.time))
    .slice(0, 10);

  if (!history.length) {
    els.historyList.innerHTML = "<li class='muted'>No past appointments yet.</li>";
    return;
  }

  els.historyList.innerHTML = "";
  history.forEach((booking) => {
    const node = cloneBookingTemplate();
    node.querySelector(".item-title").textContent = `${booking.customerName} - ${serviceName(booking.serviceId)}`;
    node.querySelector(".item-sub").textContent = `${friendlyDate(booking.date)} at ${booking.time}`;
    node.querySelector(".item-actions").innerHTML = `<span class="badge ${booking.status}">${booking.status}</span>`;
    els.historyList.appendChild(node);
  });
}

function getReservedSlots(date) {
  return state.bookings
    .filter((booking) => booking.date === date && ["confirmed", "pending"].includes(booking.status))
    .map((booking) => booking.time);
}

function cloneBookingTemplate() {
  return els.bookingItemTemplate.content.firstElementChild.cloneNode(true);
}

function serviceName(serviceId) {
  return SERVICES.find((service) => service.id === serviceId)?.name ?? "Service";
}

function toMillis(date, time) {
  return new Date(`${date}T${time}:00`).getTime();
}

function friendlyDate(dateISO) {
  const date = new Date(`${dateISO}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(dateISO, days) {
  const date = new Date(`${dateISO}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthStart(dateISO) {
  const [year, month] = dateISO.split("-");
  return `${year}-${month}`;
}

function monthShift(monthISO, offset) {
  const [year, month] = monthISO.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
