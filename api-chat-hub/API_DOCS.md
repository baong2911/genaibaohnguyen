# Chat Hub API Documentation

**Version:** 1.0.0  
**Base URL:** `http://localhost:3000`  
**Authentication:** JWT Bearer Token

## Overview

Chat Hub API is a comprehensive multi-provider AI chat server that supports OpenAI, Google Gemini, and Perplexity. It provides user authentication, conversation management, and file upload capabilities with MongoDB persistence.

## Authentication

All chat endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Obtaining a Token

1. Register a new user with `POST /auth/register`
2. Login with `POST /auth/login` 
3. Use the returned `token` in subsequent requests

---

## Endpoints

### Authentication

#### Register User
```http
POST /auth/register
```

**Request Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com", 
  "password": "securePassword123"
}
```

**Success Response (201):**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "65f1234567890abcdef12345",
    "username": "john_doe",
    "email": "john@example.com"
  }
}
```

**Error Responses:**
- `400` - Missing required fields or user already exists

---

#### Login User
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Success Response (200):**
```json
{
  "message": "Login successful", 
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "65f1234567890abcdef12345",
    "username": "john_doe", 
    "email": "john@example.com"
  }
}
```

**Error Responses:**
- `400` - Missing email or password
- `401` - Invalid credentials

---

### Chat

#### Send Chat Message
```http
POST /chat
Authorization: Bearer TOKEN
```

**Request Body:**
```json
{
  "message": "Explain quantum computing in simple terms",
  "provider": "openai",          // Optional: "openai" | "gemini" | "perplexity" 
  "model": "gpt-4",              // Optional: provider-specific model
  "conversationId": "65f123...", // Optional: continue existing conversation
  "apiKey": "sk-..."             // Optional: override environment API key
}
```

**Success Response (200):**
```json
{
  "conversationId": "65f1234567890abcdef12345",
  "message": "Quantum computing is a revolutionary computing paradigm...",
  "provider": "openai",
  "model": "gpt-4", 
  "tokenCount": 256
}
```

**Supported Providers:**
| Provider | Default Model | Other Models |
|----------|---------------|--------------|
| openai | gpt-4 | gpt-3.5-turbo, gpt-4-turbo |
| gemini | gemini-pro | gemini-pro-vision |
| perplexity | llama-3.1-sonar-small-128k-online | Various Llama models |

**Error Responses:**
- `400` - Missing message or invalid provider
- `401` - Missing or invalid token
- `404` - Conversation not found (if conversationId provided)
- `500` - AI provider error or server error

---

#### Chat with File Upload
```http
POST /chat/file
Authorization: Bearer TOKEN
Content-Type: multipart/form-data
```

**Form Fields:**
- `file` (file): Document to analyze (required if no message)
- `message` (string): Optional message about the file
- `provider` (string): AI provider (openai/gemini/perplexity)
- `model` (string): Optional model specification
- `conversationId` (string): Optional existing conversation ID
- `apiKey` (string): Optional API key override

**Success Response (200):**
```json
{
  "conversationId": "65f1234567890abcdef12345",
  "message": "This document discusses the implementation of...",
  "provider": "openai",
  "model": "gpt-4",
  "tokenCount": 512,
  "fileProcessed": "document.pdf"
}
```

**Supported File Types:**
- Text: `.txt`, `.md` (text/plain, text/markdown)
- Documents: `.pdf` (application/pdf)
- Data: `.json` (application/json), `.csv` (text/csv)
- Spreadsheets: `.xls`, `.xlsx` (Excel formats)
- **Size Limit:** 10MB per file

**Error Responses:**
- `400` - No message or file provided, invalid file type
- `413` - File too large

---

### Conversation Management

#### Get User Conversations
```http
GET /conversations
Authorization: Bearer TOKEN
```

**Success Response (200):**
```json
[
  {
    "_id": "65f1234567890abcdef12345",
    "title": "Quantum computing discussion", 
    "userId": "65f1234567890abcdef67890",
    "provider": "openai",
    "model": "gpt-4",
    "createdAt": "2024-03-15T10:30:00.000Z",
    "updatedAt": "2024-03-15T11:45:00.000Z"
  }
]
```

**Notes:**
- Returns up to 50 most recent conversations
- Sorted by most recently updated

---

#### Get Conversation Messages
```http
GET /conversations/{conversationId}/messages
Authorization: Bearer TOKEN
```

**Path Parameters:**
- `conversationId` (string): MongoDB ObjectId of the conversation

**Success Response (200):**
```json
{
  "conversation": {
    "_id": "65f1234567890abcdef12345",
    "title": "Quantum computing discussion",
    "userId": "65f1234567890abcdef67890", 
    "provider": "openai",
    "model": "gpt-4",
    "createdAt": "2024-03-15T10:30:00.000Z",
    "updatedAt": "2024-03-15T11:45:00.000Z"
  },
  "messages": [
    {
      "_id": "65f1234567890abcdef11111",
      "conversationId": "65f1234567890abcdef12345",
      "role": "user",
      "content": "Explain quantum computing",
      "provider": "openai",
      "createdAt": "2024-03-15T10:30:00.000Z"
    },
    {
      "_id": "65f1234567890abcdef22222", 
      "conversationId": "65f1234567890abcdef12345",
      "role": "assistant",
      "content": "Quantum computing is a revolutionary...",
      "provider": "openai",
      "model": "gpt-4",
      "tokenCount": 256,
      "createdAt": "2024-03-15T10:30:15.000Z"
    }
  ]
}
```

**Error Responses:**
- `404` - Conversation not found or doesn't belong to user

---

### Health Check

#### Server Status
```http
GET /
```

**Success Response (200):**
```json
{
  "message": "Chat Hub API with MongoDB is running"
}
```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "error": "Error description"
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created (registration)
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (expired token)
- `404` - Not Found (resource doesn't exist)
- `413` - Payload Too Large (file size exceeded)
- `500` - Internal Server Error

---

## Code Examples

### JavaScript/Node.js

#### Complete Authentication Flow
```javascript
class ChatHubClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('chatHubToken');
  }

  async register(username, email, password) {
    const response = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    
    const data = await response.json();
    if (response.ok) {
      this.token = data.token;
      localStorage.setItem('chatHubToken', this.token);
    }
    return data;
  }

  async login(email, password) {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    if (response.ok) {
      this.token = data.token;
      localStorage.setItem('chatHubToken', this.token);
    }
    return data;
  }

  async chat(message, options = {}) {
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, ...options })
    });
    
    return await response.json();
  }

  async chatWithFile(file, message = '', options = {}) {
    const formData = new FormData();
    formData.append('file', file);
    if (message) formData.append('message', message);
    
    Object.entries(options).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const response = await fetch(`${this.baseUrl}/chat/file`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`
      },
      body: formData
    });
    
    return await response.json();
  }

  async getConversations() {
    const response = await fetch(`${this.baseUrl}/conversations`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    
    return await response.json();
  }
}

// Usage
const client = new ChatHubClient();

// Register and start chatting
await client.register('john_doe', 'john@example.com', 'password123');

// Chat with OpenAI
const response = await client.chat('Explain machine learning', {
  provider: 'openai',
  model: 'gpt-4'
});

console.log(response.message);
```

#### File Upload Example
```javascript
// Upload and analyze a PDF
const fileInput = document.getElementById('file-input');
const file = fileInput.files[0];

const result = await client.chatWithFile(file, 'Summarize this document', {
  provider: 'openai'
});

console.log('File analysis:', result.message);
```

### Python

#### Using requests library
```python
import requests
import json

class ChatHubClient:
    def __init__(self, base_url='http://localhost:3000'):
        self.base_url = base_url
        self.token = None
    
    def register(self, username, email, password):
        response = requests.post(f'{self.base_url}/auth/register', 
            json={'username': username, 'email': email, 'password': password})
        data = response.json()
        if response.ok:
            self.token = data['token']
        return data
    
    def login(self, email, password):
        response = requests.post(f'{self.base_url}/auth/login',
            json={'email': email, 'password': password})
        data = response.json()
        if response.ok:
            self.token = data['token']
        return data
    
    def chat(self, message, **options):
        headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
        payload = {'message': message, **options}
        response = requests.post(f'{self.base_url}/chat', 
            headers=headers, json=payload)
        return response.json()
    
    def chat_with_file(self, file_path, message='', **options):
        headers = {'Authorization': f'Bearer {self.token}'}
        files = {'file': open(file_path, 'rb')}
        data = {'message': message, **options}
        
        response = requests.post(f'{self.base_url}/chat/file',
            headers=headers, files=files, data=data)
        return response.json()

# Usage
client = ChatHubClient()
client.login('john@example.com', 'password123')

# Chat with different providers
openai_response = client.chat('Explain AI', provider='openai')
gemini_response = client.chat('What is machine learning?', provider='gemini') 
perplexity_response = client.chat('Latest AI news', provider='perplexity')
```

### cURL Examples

#### Register and Login
```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"john_doe","email":"john@example.com","password":"password123"}'

# Login  
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'
```

#### Chat Examples
```bash
# Simple chat
curl -X POST http://localhost:3000/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello, world!","provider":"openai"}'

# Continue conversation
curl -X POST http://localhost:3000/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Tell me more","conversationId":"65f1234567890abcdef12345"}'

# File upload
curl -X POST http://localhost:3000/chat/file \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.pdf" \
  -F "message=Analyze this document" \
  -F "provider=openai"
```

---

## Environment Setup

Required environment variables:

```env
# Server
PORT=3000

# Database  
MONGODB_URI=mongodb://localhost:27017/chat-hub

# Authentication
JWT_SECRET=your-super-secret-jwt-key-here

# AI Providers (at least one required)
OPENAI_API_KEY=sk-your-openai-key
GEMINI_API_KEY=your-gemini-key  
PERPLEXITY_API_KEY=pplx-your-perplexity-key
```

---

## Rate Limits & Best Practices

### Recommendations
- **Token Storage**: Store JWT tokens securely (httpOnly cookies for web apps)
- **Error Handling**: Always check response status before parsing JSON
- **File Validation**: Validate file types and sizes on client-side before upload
- **Conversation Management**: Reuse conversation IDs for multi-turn chats
- **Provider Selection**: Choose providers based on use case:
  - **OpenAI**: General-purpose, coding, creative writing
  - **Gemini**: Multimodal capabilities, Google integration
  - **Perplexity**: Real-time information, research queries

### Limits
- **File Size**: 10MB maximum per upload
- **Token Expiry**: JWT tokens expire after 24 hours
- **Conversation History**: Limited to 50 recent conversations per user

---

## Troubleshooting

### Common Issues

**401 Unauthorized**
- Check if token is included in Authorization header
- Verify token format: `Bearer TOKEN_HERE`
- Token may have expired (24h lifetime)

**400 Bad Request** 
- Validate required fields in request body
- Check file type and size for uploads
- Ensure provider name is valid

**500 Internal Server Error**
- Check if AI provider API keys are set correctly
- Verify MongoDB connection
- Check server logs for specific error details

**File Upload Issues**
- Ensure Content-Type is `multipart/form-data` 
- Check file size (max 10MB)
- Verify file type is supported

---

*Last Updated: January 25, 2026*
