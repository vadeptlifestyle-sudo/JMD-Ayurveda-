const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const invoicesRoute = require('./routes/invoices');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));

// serve saved pdfs
const invoicesDir = path.join(__dirname, 'invoices');
if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir);
app.use('/invoices', express.static(invoicesDir));

// API
app.use('/api/invoices', invoicesRoute);

app.get('/', (req, res) => {
  res.send({ msg: 'JMD Ayurveda Billing Server running' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
