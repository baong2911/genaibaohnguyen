import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import models
import User from './models/User.js';
import Conversation from './models/Conversation.js';
import ChatMessage from './models/ChatMessage.js';
import File from './models/File.js';

// Import middleware and utilities
import { authenticateToken, generateToken } from './middleware/auth.js';
import { upload, readFileContent } from './utils/fileUpload.js';
import { createProvider } from './services/aiProviders.js';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-hub';
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Routes
app.get('/api', (req, res) => {
  res.json({ message: 'Chat Hub API with MongoDB is running' });
});

// Authentication Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }

    // Create new user
    const user = new User({ username, email, password });
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id.toString());

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = generateToken(user._id.toString());

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Chat Routes (Protected)
app.post('/api/chat', authenticateToken, async (req, res) => {
  try {
    const { message, provider = 'openai', model, conversationId, apiKey, fileUrl, fileName } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get API key for the specified provider
    let key = apiKey;
    if (!key) {
      switch (provider) {
        case 'openai':
          key = process.env.OPENAI_API_KEY;
          break;
        case 'gemini':
          key = process.env.GEMINI_API_KEY;
          break;
        case 'perplexity':
          key = process.env.PERPLEXITY_API_KEY;
          break;
        default:
          return res.status(400).json({ error: 'Invalid provider' });
      }
    }

    if (!key) {
      return res.status(400).json({ error: `API key for ${provider} is required` });
    }

    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await Conversation.findOne({ 
        _id: conversationId, 
        userId: req.user._id 
      });
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
    } else {
      conversation = new Conversation({
        title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
        userId: req.user._id,
        provider,
        model
      });
      await conversation.save();
    }

    // Record start time for AI response measurement
    const aiRequestStartTime = Date.now();

    // Save user message
    const userMessage = new ChatMessage({
      conversationId: conversation._id,
      role: 'user',
      content: message,
      provider
    });
    await userMessage.save();

    // Get conversation history
    const messages = await ChatMessage.find({ 
      conversationId: conversation._id 
    }).sort({ createdAt: 1 });

    // Prepare messages for AI provider
    const aiMessages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      ...messages.map(msg => ({ 
        role: msg.role, 
        content: msg.content 
      }))
    ];

    // If there's a file URL, modify the last user message to include the image
    if (fileUrl) {
      // Check if the file is an image
      const isImage = fileUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);
      
      if (isImage) {
        if (provider === 'openai') {
          // For OpenAI with vision capability, use vision model if not specified
          const visionModel = model || 'gpt-4o';
          
          // Find the last user message and enhance it with image
          const lastMessageIndex = aiMessages.length - 1;
          if (aiMessages[lastMessageIndex] && aiMessages[lastMessageIndex].role === 'user') {
            aiMessages[lastMessageIndex] = {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: message
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: fileUrl
                  }
                }
              ]
            };
          }
          
          // Use vision model for image processing
          const aiProvider = createProvider(provider, key);
          const response = await aiProvider.chat(aiMessages, visionModel);
          
          // Save assistant response
          const assistantMessage = new ChatMessage({
            conversationId: conversation._id,
            role: 'assistant',
            content: response.content || 'Generated response (content not provided)',
            provider,
            model: response.model,
            tokenCount: response.tokenCount
          });
          await assistantMessage.save();

          return res.json({
            conversationId: conversation._id,
            message: response.content || 'Generated response (content not provided)',
            provider,
            model: response.model,
            tokenCount: response.tokenCount
          });
        } else {
          // For providers without vision capability (Gemini, Perplexity)
          // Inform user that image analysis is not supported
          const errorMessage = `Sorry, ${provider} doesn't support image analysis. Please use OpenAI provider for image processing, or provide a text description of the image instead.`;
          
          // Save user message
          const userMessage = new ChatMessage({
            conversationId: conversation._id,
            role: 'user',
            content: `${message} (Image URL: ${fileUrl})`,
            provider
          });
          await userMessage.save();
          
          // Save assistant error response
          const assistantMessage = new ChatMessage({
            conversationId: conversation._id,
            role: 'assistant',
            content: errorMessage,
            provider,
            model: model || 'system'
          });
          await assistantMessage.save();

          return res.json({
            conversationId: conversation._id,
            message: errorMessage,
            provider,
            model: model || 'system',
            error: 'VISION_NOT_SUPPORTED'
          });
        }
      } else {
        // For non-image files, add file info to message for all providers
        const fileInfo = fileName ? ` (File: ${fileName})` : '';
        aiMessages[aiMessages.length - 1].content += `\n\nFile URL: ${fileUrl}${fileInfo}`;
      }
    }

    // Call AI provider
    const aiProvider = createProvider(provider, key);
    const response = await aiProvider.chat(aiMessages, model);

    // Calculate AI response time
    const aiRequestEndTime = Date.now();
    const responseTimeMs = aiRequestEndTime - aiRequestStartTime;

    // Save assistant response
    const assistantMessage = new ChatMessage({
      conversationId: conversation._id,
      role: 'assistant',
      content: response.content || 'Generated response (content not provided)',
      provider,
      model: response.model,
      tokenCount: response.tokenCount,
      responseTime: responseTimeMs // Add response time in milliseconds
    });
    await assistantMessage.save();

    res.json({
      conversationId: conversation._id,
      message: response.content || 'Generated response (content not provided)',
      provider,
      model: response.model,
      tokenCount: response.tokenCount,
      responseTime: responseTimeMs,
      responseTimeFormatted: `${(responseTimeMs / 1000).toFixed(2)}s`
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Image generation endpoint
app.post('/api/generate-image', authenticateToken, async (req, res) => {
  try {
    const { prompt, provider = 'openai', options = {}, conversationId } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required for image generation' });
    }

    // Only OpenAI supports image generation in current implementation
    if (provider !== 'openai') {
      return res.status(400).json({ error: 'Currently only OpenAI provider supports image generation' });
    }

    // Get API key
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return res.status(400).json({ error: 'OpenAI API key is required for image generation' });
    }

    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await Conversation.findOne({ 
        _id: conversationId, 
        userId: req.user._id 
      });
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
    } else {
      conversation = new Conversation({
        title: `Image: ${prompt.slice(0, 30)}...`,
        userId: req.user._id,
        provider,
        model: options.model || 'dall-e-3'
      });
      await conversation.save();
    }

    // Save user message
    const userMessage = new ChatMessage({
      conversationId: conversation._id,
      role: 'user',
      content: `Generate image: ${prompt}`,
      provider
    });
    await userMessage.save();

    // Generate image
    const aiProvider = createProvider(provider, key);
    const imageResult = await aiProvider.generateImage(prompt, options);

    // Save assistant response with image URLs
    const assistantMessage = new ChatMessage({
      conversationId: conversation._id,
      role: 'assistant',
      content: `Generated image with prompt: "${imageResult.images[0]?.revised_prompt || prompt}"`,
      provider,
      model: imageResult.model,
      // Store image URLs in a custom field - you might want to modify your schema
      attachments: imageResult.images.map((img, index) => ({
        filename: `generated_image_${Date.now()}_${index}`,
        originalName: `generated_image_${index}.jpg`,
        mimetype: 'image/jpeg',
        size: 0, // Unknown size for generated images
        path: img.url // Store the image URL
      }))
    });
    await assistantMessage.save();

    res.json({
      conversationId: conversation._id,
      message: `Generated ${imageResult.images.length} image(s)`,
      images: imageResult.images,
      provider,
      model: imageResult.model
    });

  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Chat with file upload or file ID(s)
app.post('/api/chat/file', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { message, provider = 'openai', model, conversationId, apiKey, fileId } = req.body;
    const uploadedFile = req.file; // File from multipart upload

    // Resolve fileIds: support both `fileIds` (array or comma-separated) and legacy `fileId`
    let fileIds = [];
    if (req.body.fileIds) {
      if (Array.isArray(req.body.fileIds)) {
        fileIds = req.body.fileIds;
      } else {
        // Could be a JSON array string or comma-separated string
        try {
          const parsed = JSON.parse(req.body.fileIds);
          fileIds = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          fileIds = req.body.fileIds.split(',').map(id => id.trim()).filter(Boolean);
        }
      }
    } else if (fileId) {
      fileIds = [fileId];
    }

    // Enforce max 10 files
    if (fileIds.length > 10) {
      return res.status(400).json({ error: 'A maximum of 10 files can be processed at once' });
    }

    if (!message && !uploadedFile && fileIds.length === 0) {
      return res.status(400).json({ error: 'Message, file upload, or fileIds is required' });
    }

    // Get API key for the specified provider
    let key = apiKey;
    if (!key) {
      switch (provider) {
        case 'openai':
          key = process.env.OPENAI_API_KEY;
          break;
        case 'gemini':
          key = process.env.GEMINI_API_KEY;
          break;
        case 'perplexity':
          key = process.env.PERPLEXITY_API_KEY;
          break;
        default:
          return res.status(400).json({ error: 'Invalid provider' });
      }
    }

    if (!key) {
      return res.status(400).json({ error: `API key for ${provider} is required` });
    }

    // Resolve files from DB using fileIds
    let fileDocs = [];
    let files = [];

    if (fileIds.length > 0) {
      fileDocs = await File.find({
        _id: { $in: fileIds },
        userId: req.user._id,
        isDeleted: false
      });

      if (fileDocs.length !== fileIds.length) {
        return res.status(404).json({ error: 'One or more files not found or access denied' });
      }

      files = fileDocs.map(doc => ({
        originalname: doc.originalName,
        filename: doc.filename,
        mimetype: doc.mimetype,
        size: doc.size,
        path: path.join(__dirname, doc.path),
        _id: doc._id
      }));
    }

    // Handle single uploaded file (multipart)
    let uploadedFileDoc = null;
    if (uploadedFile) {
      const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
      const fileUrl = `${baseUrl}/uploads/${uploadedFile.filename}`;

      uploadedFileDoc = new File({
        originalName: uploadedFile.originalname,
        filename: uploadedFile.filename,
        mimetype: uploadedFile.mimetype,
        size: uploadedFile.size,
        path: `/uploads/${uploadedFile.filename}`,
        url: fileUrl,
        userId: req.user._id
      });
      await uploadedFileDoc.save();

      files.push({
        originalname: uploadedFile.originalname,
        filename: uploadedFile.filename,
        mimetype: uploadedFile.mimetype,
        size: uploadedFile.size,
        path: uploadedFile.path,
        _id: uploadedFileDoc._id
      });
      fileDocs.push(uploadedFileDoc);
    }

    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await Conversation.findOne({ 
        _id: conversationId, 
        userId: req.user._id 
      });
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
    } else {
      const titleBase = files.length > 0
        ? files.length === 1
          ? `File: ${files[0].originalname}`
          : `Files: ${files.map(f => f.originalname).join(', ')}`
        : (message || '').slice(0, 50);
      const title = titleBase.length > 50 ? titleBase.slice(0, 50) + '...' : titleBase;
      conversation = new Conversation({
        title,
        userId: req.user._id,
        provider,
        model
      });
      await conversation.save();
    }

    // Build full message with all file contents appended
    let fullMessage = message || '';
    let attachments = [];

    for (const file of files) {
      const fileContent = await readFileContent(file.path, file.mimetype);
      fullMessage += `\n\nFile content (${file.originalname}):\n${fileContent}`;
      attachments.push({
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path
      });
    }

    // Save user message with file attachments
    const userMessage = new ChatMessage({
      conversationId: conversation._id,
      role: 'user',
      content: fullMessage,
      attachments: attachments.length > 0 ? attachments : undefined,
      provider
    });
    await userMessage.save();

    // Get conversation history
    const messages = await ChatMessage.find({ 
      conversationId: conversation._id 
    }).sort({ createdAt: 1 });

    // Prepare messages for AI provider
    const aiMessages = [
      { role: 'system', content: 'You are a helpful assistant that can analyze and discuss file contents.' },
      ...messages.map(msg => ({ 
        role: msg.role, 
        content: msg.content 
      }))
    ];

    // Call AI provider
    const aiProvider = createProvider(provider, key);
    const response = await aiProvider.chat(aiMessages, model);

    // Save assistant response
    const assistantMessage = new ChatMessage({
      conversationId: conversation._id,
      role: 'assistant',
      content: response.content || 'Generated response (content not provided)',
      provider,
      model: response.model,
      tokenCount: response.tokenCount
    });
    await assistantMessage.save();

    res.json({
      conversationId: conversation._id,
      message: response.content || 'Generated response (content not provided)',
      provider,
      model: response.model,
      tokenCount: response.tokenCount,
      filesProcessed: files.map(f => f.originalname),
      fileIds: fileDocs.map(f => f._id)
    });
  } catch (error) {
    console.error('Chat with file error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// File upload endpoint - returns accessible URL
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Construct the accessible URL
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const fileUrl = `${baseUrl}/uploads/${file.filename}`;

    // Save file metadata to database
    const fileDoc = new File({
      originalName: file.originalname,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      path: `/uploads/${file.filename}`,
      url: fileUrl,
      userId: req.user._id,
      description: req.body.description || null,
      tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : []
    });

    await fileDoc.save();

    res.json({
      message: 'File uploaded successfully',
      file: {
        id: fileDoc._id,
        originalName: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        url: fileUrl,
        path: `/uploads/${file.filename}`,
        uploadedAt: fileDoc.uploadedAt,
        description: fileDoc.description,
        tags: fileDoc.tags
      }
    });

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get conversations
app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const conversations = await Conversation.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .limit(50);
    
    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get conversation messages
app.get('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify conversation belongs to user
    const conversation = await Conversation.findOne({ 
      _id: id, 
      userId: req.user._id 
    });
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await ChatMessage.find({ conversationId: id })
      .sort({ createdAt: 1 });
    
    res.json({
      conversation,
      messages
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get all chat history for user with pagination and filtering
app.get('/api/chat-history', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      provider,
      conversationId,
      search,
      startDate,
      endDate,
      role
    } = req.query;

    // Build filter query
    const matchStage = {
      $lookup: {
        from: 'conversations',
        localField: 'conversationId',
        foreignField: '_id',
        as: 'conversation'
      }
    };

    const filterStage = {
      $match: {
        'conversation.userId': req.user._id,
        ...(provider && { provider }),
        ...(conversationId && { conversationId: mongoose.Types.ObjectId(conversationId) }),
        ...(role && { role }),
        ...(search && { 
          content: { $regex: search, $options: 'i' } 
        }),
        ...(startDate || endDate) && {
          createdAt: {
            ...(startDate && { $gte: new Date(startDate) }),
            ...(endDate && { $lte: new Date(endDate) })
          }
        }
      }
    };

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Aggregate pipeline
    const pipeline = [
      matchStage,
      filterStage,
      {
        $addFields: {
          conversation: { $arrayElemAt: ['$conversation', 0] }
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $facet: {
          messages: [
            { $skip: skip },
            { $limit: parseInt(limit) },
            {
              $project: {
                _id: 1,
                conversationId: 1,
                role: 1,
                content: 1,
                attachments: 1,
                provider: 1,
                model: 1,
                tokenCount: 1,
                createdAt: 1,
                updatedAt: 1,
                'conversation._id': 1,
                'conversation.title': 1,
                'conversation.provider': 1,
                'conversation.model': 1
              }
            }
          ],
          totalCount: [
            { $count: 'count' }
          ]
        }
      }
    ];

    const result = await ChatMessage.aggregate(pipeline);
    const messages = result[0].messages;
    const totalCount = result[0].totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    // Get conversation statistics
    const conversationStats = await ChatMessage.aggregate([
      {
        $lookup: {
          from: 'conversations',
          localField: 'conversationId',
          foreignField: '_id',
          as: 'conversation'
        }
      },
      {
        $match: {
          'conversation.userId': req.user._id
        }
      },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          totalTokens: { $sum: '$tokenCount' },
          conversationCount: { $addToSet: '$conversationId' },
          providers: { $addToSet: '$provider' },
          models: { $addToSet: '$model' }
        }
      },
      {
        $project: {
          totalMessages: 1,
          totalTokens: 1,
          conversationCount: { $size: '$conversationCount' },
          providers: 1,
          models: { $filter: { input: '$models', cond: { $ne: ['$$this', null] } } }
        }
      }
    ]);

    const stats = conversationStats[0] || {
      totalMessages: 0,
      totalTokens: 0,
      conversationCount: 0,
      providers: [],
      models: []
    };

    res.json({
      messages,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalMessages: totalCount,
        limit: parseInt(limit),
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      },
      statistics: stats,
      filters: {
        provider: provider || null,
        conversationId: conversationId || null,
        search: search || null,
        startDate: startDate || null,
        endDate: endDate || null,
        role: role || null
      }
    });

  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get user prompts/messages only
app.get('/api/user-prompts', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      conversationId
    } = req.query;

    // Build query to get user messages only
    const query = {
      role: 'user'
    };

    // Add search filter if provided
    if (search) {
      query.content = { $regex: search, $options: 'i' };
    }

    // Add conversation filter if provided
    if (conversationId) {
      query.conversationId = mongoose.Types.ObjectId(conversationId);
    }

    // Get user messages with conversation lookup
    const pipeline = [
      {
        $lookup: {
          from: 'conversations',
          localField: 'conversationId',
          foreignField: '_id',
          as: 'conversation'
        }
      },
      {
        $match: {
          'conversation.userId': req.user._id,
          role: 'user',
          ...(search && { content: { $regex: search, $options: 'i' } }),
          ...(conversationId && { conversationId: mongoose.Types.ObjectId(conversationId) })
        }
      },
      {
        $addFields: {
          conversation: { $arrayElemAt: ['$conversation', 0] }
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $skip: (parseInt(page) - 1) * parseInt(limit)
      },
      {
        $limit: parseInt(limit)
      },
      {
        $project: {
          _id: 1,
          conversationId: 1,
          content: 1,
          attachments: 1,
          provider: 1,
          createdAt: 1,
          'conversation._id': 1,
          'conversation.title': 1
        }
      }
    ];

    const userPrompts = await ChatMessage.aggregate(pipeline);

    // Get total count for pagination
    const totalCount = await ChatMessage.aggregate([
      {
        $lookup: {
          from: 'conversations',
          localField: 'conversationId',
          foreignField: '_id',
          as: 'conversation'
        }
      },
      {
        $match: {
          'conversation.userId': req.user._id,
          role: 'user',
          ...(search && { content: { $regex: search, $options: 'i' } }),
          ...(conversationId && { conversationId: mongoose.Types.ObjectId(conversationId) })
        }
      },
      {
        $count: 'total'
      }
    ]);

    const total = totalCount[0]?.total || 0;
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      prompts: userPrompts,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalPrompts: total,
        limit: parseInt(limit),
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Get user prompts error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Start server
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log('POST /auth/register - Register new user');
    console.log('POST /auth/login - Login user');
    console.log('POST /chat - Chat with AI (protected)');
    console.log('POST /chat/file - Chat with file upload (protected)');
    console.log('POST /generate-image - Generate image (protected)');
    console.log('POST /upload - Upload file and get URL (protected)');
    console.log('GET /conversations - Get user conversations (protected)');
    console.log('GET /conversations/:id/messages - Get conversation messages (protected)');
    console.log('GET /chat-history - Get chat history with filters and pagination (protected)');
    console.log('GET /user-prompts - Get user prompts/messages only (protected)');
  });
};

startServer().catch(console.error);
