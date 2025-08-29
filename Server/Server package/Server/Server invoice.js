const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const db = require('../db');

function formatINR(n) {
  return '₹ ' + Number(n).toFixed(2);
}

router.post('/', (req, res) => {
  // create invoice
  const data = req.body;
  /*
    Expected body:
    {
      number, customer_name, customer_address, customer_gst,
      date (YYYY-MM-DD),
      items: [{desc, qty, rate}],
      gst_percent (0 or e.g. 18)
    }
  */
  const id = uuidv4();
  const items = data.items || [];
  const subtotal = items.reduce((s,i)=> s + (i.qty * i.rate),0);
  const gst_percent = Number(data.gst_percent || 0);
  const gst_amount = +(subtotal * gst_percent / 100);
  const total = +(subtotal + gst_amount);
  const invoicesDir = path.join(__dirname, '..', 'invoices');
  if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir);

  const pdfPath = path.join(invoicesDir, `${id}.pdf`);

  // Generate PDF with PDFKit
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);

  // Header
  doc.fontSize(20).text('JMD Ayurveda', { align: 'left' });
  doc.fontSize(10).text('Ayurvedic Remedies & Wellness', { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(9).text('Address: Your Shop Address, Kota, Rajasthan', { align: 'left' });
  doc.text('Phone: +91-XXXXXXXXXX | Email: contact@jmdayurveda.in', { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Invoice #: ${data.number}`, { align: 'right' });
  doc.text(`Date: ${data.date}`, { align: 'right' });
  doc.moveDown(0.5);

  // Customer
  doc.fontSize(10).text(`Bill To: ${data.customer_name}`);
  if (data.customer_address) doc.text(data.customer_address);
  if (data.customer_gst) doc.text(`GSTIN: ${data.customer_gst}`);
  doc.moveDown();

  // Table header
  doc.fontSize(10).text('Description', 40, doc.y, { continued: true });
  doc.text('Qty', 320, doc.y, { continued: true });
  doc.text('Rate', 370, doc.y, { continued: true });
  doc.text('Amount', 450, doc.y);
  doc.moveTo(40, doc.y + 2).lineTo(550, doc.y + 2).stroke();

  // Items
  items.forEach(it => {
    const amount = it.qty * it.rate;
    doc.text(it.desc, 40, doc.y + 8, { width: 260 });
    doc.text(it.qty.toString(), 320, doc.y, { continued: true });
    doc.text(formatINR(it.rate), 370, doc.y, { continued: true });
    doc.text(formatINR(amount), 450, doc.y);
    doc.moveDown(0.2);
  });

  doc.moveDown();
  doc.text(`Subtotal: ${formatINR(subtotal)}`, { align: 'right' });
  doc.text(`GST (${gst_percent}%): ${formatINR(gst_amount)}`, { align: 'right' });
  doc.text(`Total: ${formatINR(total)}`, { align: 'right' });

  doc.moveDown(2);
  doc.fontSize(9).text('Notes: This is a computer generated invoice.', { align: 'left' });

  doc.end();

  stream.on('finish', () => {
    // save to db
    const stmt = db.prepare(`INSERT INTO invoices
      (id, number, customer_name, customer_address, customer_gst, date, items, subtotal, gst_percent, gst_amount, total, pdf_path)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    stmt.run(
      id,
      data.number,
      data.customer_name,
      data.customer_address,
      data.customer_gst,
      data.date,
      JSON.stringify(items),
      subtotal,
      gst_percent,
      gst_amount,
      total,
      pdfPath,
      function(err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'DB error' });
        }
        res.json({ id, number: data.number, pdf: `/invoices/${id}.pdf` });
      }
    );
    stmt.finalize();
  });

  stream.on('error', (err) => {
    console.error(err);
    res.status(500).json({ error: 'PDF gen error' });
  });
});

router.get('/', (req, res) => {
  db.all(`SELECT id, number, customer_name, date, subtotal, gst_percent, total FROM invoices ORDER BY date DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

router.get('/:id/pdf', (req, res) => {
  const id = req.params.id;
  db.get(`SELECT pdf_path FROM invoices WHERE id = ?`, [id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Not found' });
    res.sendFile(row.pdf_path);
  });
});

module.exports = router;
