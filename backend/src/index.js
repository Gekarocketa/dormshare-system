require('dotenv').config();
const express = require('express');
const cors = require('cors');

const laundryRoutes = require('./routes/laundryRoutes');
const porterRoutes = require('./routes/porterRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Główny punkt kontrolny (healthcheck)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'DormShare API', timestamp: new Date().toISOString() });
});

// Trasy modułów
app.use('/api/laundry', laundryRoutes);
app.use('/api/porter', porterRoutes);

app.listen(PORT, () => {
  console.log(`[DormShare Backend] Serwer REST API nasłuchuje na http://localhost:${PORT}`);
});

