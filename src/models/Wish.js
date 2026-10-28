import mongoose from 'mongoose';

const wishSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    publicId: {
      type: String,
      required: true,
      select: false,
    },
    videoUrl: {
      type: String,
      required: true,
    },
    durationSeconds: {
      type: Number,
      required: true,
      min: 0,
      max: 20,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      required: true,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

wishSchema.index({ status: 1, createdAt: -1 });

export const Wish = mongoose.model('Wish', wishSchema);
