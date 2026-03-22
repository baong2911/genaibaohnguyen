import mongoose from 'mongoose';

const ConversationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  provider: {
    type: String,
    enum: ['openai', 'gemini', 'perplexity'],
    required: true,
    default: 'openai'
  },
  model: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for better query performance
ConversationSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Conversation', ConversationSchema);
