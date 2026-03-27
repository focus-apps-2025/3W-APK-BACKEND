// backend/routes/exportRoutes.js
router.post('/rack-view', protect, async (req, res) => {
  // req.body.rows: Array of racks
  // req.user: The current user object, if using authentication middleware
  const { rows } = req.body;
  if (!rows || !Array.isArray(rows)) {
    return res.status(400).json({ success: false, message: "No row data sent" });
  }
  const exportEntry = await ExportedRackView.create({
    exportedAt: new Date(),
    user: req.user ? req.user._id : null,
    racks: rows,
  });
  res.status(201).json({ success: true, id: exportEntry._id });
});

// In models/ExportedRackView.js
const ExportedRackViewSchema = new mongoose.Schema({
  exportedAt: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  racks: [mongoose.Schema.Types.Mixed], // Store the exported rows as array of objects
});
module.exports = mongoose.model("ExportedRackView", ExportedRackViewSchema);
