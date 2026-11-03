const express = require('express');
const {
  getPorterDashboard,
  borrowEquipment,
  returnEquipment,
  updateResourceStatus,
} = require('../controllers/porterController');

const router = express.Router();

router.get('/dashboard', getPorterDashboard);
router.post('/loans/borrow', borrowEquipment);
router.post('/loans/:id/return', returnEquipment);
router.patch('/resources/:id/status', updateResourceStatus);

module.exports = router;

