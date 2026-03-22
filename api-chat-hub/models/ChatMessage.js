import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: function() {
      // Content is required unless there are attachments or generated content
      return !this.attachments || this.attachments.length === 0;
    }
  },
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    path: {
      type: String,
      required: true
    }
  }],
  provider: {
    type: String,
    enum: ['openai', 'gemini', 'perplexity'],
    required: true,
    default: 'openai'
  },
  model: {
    type: String,
    trim: true
  },
  tokenCount: {
    type: Number,
    min: 0
  },
  responseTime: {
    type: Number,
    min: 0,
    description: 'AI response time in milliseconds'
  }
}, {
  timestamps: true
});

// Index for better query performance
ChatMessageSchema.index({ conversationId: 1, createdAt: 1 });

export default mongoose.model('ChatMessage', ChatMessageSchema);
