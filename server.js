const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const loadEnvFile = () => {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").trim();
    }
  }
};

loadEnvFile();

const PORT = process.env.PORT || 4173;
const ROOT = __dirname;
const BOOKINGS_FILE = path.join(ROOT, "bookings.json");
const UPLOADS_DIR = path.join(ROOT, "uploads");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const send = (res, status, body, type = "application/json; charset=utf-8") => {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
};

const sendTelegramPhoto = async (saved) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn("Telegram is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.");
    return;
  }

  const proofPath = path.join(ROOT, saved.proofFile);
  const proof = await fs.promises.readFile(proofPath);
  const boundary = `----submit72-${Date.now()}`;
  const caption = [
    "New Submit 72 Barber Booking",
    "",
    `Client: ${saved.name}`,
    `Client phone: ${saved.phone}`,
    `Client email: ${saved.email}`,
    `Barber: ${saved.barber}`,
    `Barber phone: ${saved.barberPhone}`,
    `Date: ${saved.date}`,
    `Time: ${saved.time}`,
    `Service: ${saved.service}`,
    `Price: ${saved.price}`,
    `Payment: ${saved.paymentMethod}`,
    `Payment account: ${saved.paymentAccountNumber}`,
    `Account holder: ${saved.paymentAccountHolder}`,
    `Booking ID: ${saved.id}`,
  ].join("\n");

  const fileName = path.basename(saved.proofFile);
  const chunks = [
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${fileName}"\r\nContent-Type: image/jpeg\r\n\r\n`,
    ),
    proof,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ];

  const body = Buffer.concat(chunks);

  await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.telegram.org",
        path: `/bot${token}/sendPhoto`,
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": body.length,
        },
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`Telegram returned ${response.statusCode}: ${data}`));
          }
        });
      },
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
};

const safeName = (value) =>
  String(value || "client")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "client";

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8_000_000) {
        req.destroy();
        reject(new Error("Request too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });

const readBookings = async () => {
  try {
    return JSON.parse(await fs.promises.readFile(BOOKINGS_FILE, "utf8"));
  } catch (error) {
    return [];
  }
};

const isSameSlot = (booking, candidate) =>
  String(booking.barber || "").toLowerCase() === String(candidate.barber || "").toLowerCase() &&
  booking.date === candidate.date &&
  booking.time === candidate.time;

const saveBooking = async (booking) => {
  const required = ["name", "phone", "date", "time", "proofDataUrl"];
  for (const field of required) {
    if (!booking[field]) {
      throw new Error(`Missing ${field}`);
    }
  }

  const match = /^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i.exec(booking.proofDataUrl);
  if (!match) {
    throw new Error("Payment proof must be a PNG, JPG, or WebP image");
  }

  const bookings = await readBookings();
  if (bookings.some((existing) => isSameSlot(existing, booking))) {
    const error = new Error("This date and time is already picked for that barber.");
    error.statusCode = 409;
    throw error;
  }

  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });

  const ext = match[1].includes("png") ? ".png" : match[1].includes("webp") ? ".webp" : ".jpg";
  const id = `${Date.now()}-${safeName(booking.name)}`;
  const proofPath = path.join(UPLOADS_DIR, `${id}${ext}`);
  await fs.promises.writeFile(proofPath, Buffer.from(match[2], "base64"));

  const saved = {
    id,
    name: booking.name,
    phone: booking.phone,
    email: booking.email || "Not provided",
    date: booking.date,
    time: booking.time,
    barber: booking.barber || "Dagibladez",
    barberPhone: booking.barberPhone || "0993534777",
    barberEmail: booking.barberEmail || "Dagimhailu01@icloud.com",
    service: "Haircut",
    price: "500 ETB",
    paymentMethod: booking.paymentMethod || "Telebirr",
    paymentAccountNumber: booking.paymentAccountNumber || "0993534777",
    paymentAccountHolder: booking.paymentAccountHolder || "Dagibladez",
    proofFile: path.relative(ROOT, proofPath),
    createdAt: new Date().toISOString(),
  };

  bookings.unshift(saved);
  await fs.promises.writeFile(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
  return saved;
};

const serveFile = async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(ROOT, requested));

  if (!filePath.startsWith(ROOT)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  try {
    const data = await fs.promises.readFile(filePath);
    const type = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    send(res, 200, data, type);
  } catch (error) {
    send(res, 404, "Not found", "text/plain; charset=utf-8");
  }
};

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/bookings") {
    try {
      const booking = JSON.parse(await readBody(req));
      const saved = await saveBooking(booking);
      try {
        await sendTelegramPhoto(saved);
      } catch (telegramError) {
        console.error(telegramError.message);
      }
      send(res, 201, JSON.stringify({ ok: true, booking: saved }));
    } catch (error) {
      send(res, error.statusCode || 400, JSON.stringify({ ok: false, error: error.message }));
    }
    return;
  }

  if (req.method === "GET") {
    await serveFile(req, res);
    return;
  }

  send(res, 405, "Method not allowed", "text/plain; charset=utf-8");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Submit 72 Barber site running at http://127.0.0.1:${PORT}`);
});
