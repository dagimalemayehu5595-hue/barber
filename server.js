const http = require("http");
const fs = require("fs");
const path = require("path");

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

  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });

  const ext = match[1].includes("png") ? ".png" : match[1].includes("webp") ? ".webp" : ".jpg";
  const id = `${Date.now()}-${safeName(booking.name)}`;
  const proofPath = path.join(UPLOADS_DIR, `${id}${ext}`);
  await fs.promises.writeFile(proofPath, Buffer.from(match[2], "base64"));

  let bookings = [];
  try {
    bookings = JSON.parse(await fs.promises.readFile(BOOKINGS_FILE, "utf8"));
  } catch (error) {
    bookings = [];
  }

  const saved = {
    id,
    name: booking.name,
    phone: booking.phone,
    email: booking.email || "Not provided",
    date: booking.date,
    time: booking.time,
    service: "Haircut",
    price: "500 ETB",
    paymentMethod: "Telebirr",
    telebirrNumber: "0993534777",
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
      send(res, 201, JSON.stringify({ ok: true, booking: saved }));
    } catch (error) {
      send(res, 400, JSON.stringify({ ok: false, error: error.message }));
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
