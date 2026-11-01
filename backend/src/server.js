import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
  🪙 ========================================================
     Swarn Sathi Gold Loan Branch Console API
     Server running on port: http://localhost:${PORT}
     Environment: ${process.env.NODE_ENV || 'development'}
  ========================================================
  `);
});