const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["User", "Accountant", "Admin", "BranchManager"], // 👈 أضفنا BranchManager
    default: "User",
  },
  assignedBranches: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
