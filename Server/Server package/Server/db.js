const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbFile = path.join(__dirname, 'billing.db');
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    number TEXT,
    customer_name TEXT,
    customer_address TEXT,
    customer_gst TEXT,
    date TEXT,
    items TEXT,          -- JSON string
    subtotal REAL,
    gst_percent REAL,
    gst_amount REAL,
    total REAL,
    pdf_path TEXT
  )`);
});

module.exports = db;
