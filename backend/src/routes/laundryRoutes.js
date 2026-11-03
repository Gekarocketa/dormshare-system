const express = require('express');
const {
  getLaundrySlots,
  createLaundryBooking,
  cancelLaundryBooking,
} = require('../controllers/laundryController');

const router = express.Router();

router.get('/slots', getLaundrySlots);
router.post('/bookings', createLaundryBooking);
router.delete('/bookings/:id', cancelLaundryBooking);

module.exports = router;

