import { useState, useEffect } from "react";
import { toast } from "sonner";
import { API_KEYS } from "@/config/apiKeys";

// Get API base URL from environment variable with fallback
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export interface Message {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  hasStreamed?: boolean; // Track if message has already been streamed
  imageUrl?: string; // For image generation
  imagePrompt?: string; // For tracking what image was requested
  fileUrls?: string[]; // For uploaded files (multiple)
  fileNames?: string[]; // Names of uploaded files
  fileTypes?: string[]; // MIME types of uploaded files
  // Legacy single-file fields (kept for backward compat with stored messages)
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  responseTime?: number; // Response time in milliseconds
  responseTimeFormatted?: string; // Formatted response time (e.g., "2.34s")
}

type Provider = "openai" | "gemini" | "perplexity";
type GeminiMode = "ask" | "generate-image";

const STORAGE_PREFIX = "chat_";
const STREAMING_STATE_PREFIX = "streaming_state_";

export type FileUploadStatus = "uploading" | "success" | "error";

export interface PendingFile {
  file: File;
  status: FileUploadStatus;
  fileId?: string;
  fileUrl?: string;
  error?: string;
}

export const useChat = (provider: Provider, geminiMode?: GeminiMode) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  // Get API key from config
  const apiKey = API_KEYS[provider];

  // Load messages from localStorage
  useEffect(() => {
    const storedMessages = localStorage.getItem(`${STORAGE_PREFIX}${provider}`);
    const storedStreamingState = localStorage.getItem(`${STREAMING_STATE_PREFIX}${provider}`);
    
    if (storedMessages) {
      const parsedMessages = JSON.parse(storedMessages);
      setMessages(parsedMessages);
    }
    
    // Restore streaming state for this provider
    if (storedStreamingState) {
      setStreamingMessageId(JSON.parse(storedStreamingState));
    } else {
      setStreamingMessageId(null);
    }
  }, [provider]);

  // Listen for logout event and clear in-memory state
  useEffect(() => {
    const handleLogout = () => {
      setMessages([]);
      setStreamingMessageId(null);
    };
    window.addEventListener('chat-logout', handleLogout);
    return () => window.removeEventListener('chat-logout', handleLogout);
  }, []);

  // Save messages to localStorage (now with permanent URLs, safe to persist)
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`${STORAGE_PREFIX}${provider}`, JSON.stringify(messages));
    }
  }, [messages, provider]);

  // Save streaming state to localStorage
  useEffect(() => {
    if (streamingMessageId !== null) {
      localStorage.setItem(`${STREAMING_STATE_PREFIX}${provider}`, JSON.stringify(streamingMessageId));
    } else {
      localStorage.removeItem(`${STREAMING_STATE_PREFIX}${provider}`);
    }
  }, [streamingMessageId, provider]);

  // Upload files immediately when selected, tracking per-file status
  const addFiles = async (files: File[]) => {
    const token = localStorage.getItem('chatHubToken');
    if (!token) {
      toast.error("Please sign in to continue");
      return;
    }

    const MAX_FILES = 10;

    // Enforce 10-file limit
    setPendingFiles((prev) => {
      const remaining = MAX_FILES - prev.length;
      if (remaining <= 0) {
        toast.error("You can upload a maximum of 10 files per message.");
        files = [];
        return prev;
      }
      if (files.length > remaining) {
        toast.warning(`Only ${remaining} more file(s) allowed. The rest were ignored.`);
        files = files.slice(0, remaining);
      }
      return prev;
    });

    if (files.length === 0) return;

    // Add all files as "uploading" first
    const newPending: PendingFile[] = files.map((file) => ({ file, status: "uploading" }));
    setPendingFiles((prev) => [...prev, ...newPending]);

    // Upload each file and update its individual status
    await Promise.all(
      files.map(async (file) => {
        try {
          const result = await uploadFile(file, token);
          setPendingFiles((prev) =>
            prev.map((pf) =>
              pf.file === file
                ? { ...pf, status: "success", fileId: result.file.id, fileUrl: result.file.url }
                : pf
            )
          );
        } catch (error: any) {
          setPendingFiles((prev) =>
            prev.map((pf) =>
              pf.file === file
                ? { ...pf, status: "error", error: error.message || "Upload failed" }
                : pf
            )
          );
        }
      })
    );
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearPendingFiles = () => setPendingFiles([]);

  const sendMessage = async (content: string) => {
    // Get authentication token
    const token = localStorage.getItem('chatHubToken');
    if (!token) {
      toast.error("Please sign in to continue");
      return;
    }

    // Only use successfully uploaded files
    const successFiles = pendingFiles.filter((pf) => pf.status === "success");
    const uploadedFileIds = successFiles.map((pf) => pf.fileId!);

    let userMessage: Message = { role: "user", content };
    if (successFiles.length > 0) {
      userMessage.fileNames = successFiles.map((pf) => pf.file.name);
      userMessage.fileTypes = successFiles.map((pf) => pf.file.type);
      userMessage.fileUrls = successFiles.map((pf) => pf.fileUrl!);
    }

    // Clear pending files and add user message
    setPendingFiles([]);
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      let response: any;

      // Handle Gemini image generation mode with special endpoint
      if (provider === "gemini" && geminiMode === "generate-image") {
        response = await callGenerateImage(content, token);
      } else if (uploadedFileIds.length > 0) {
        // Use chat with file IDs
        response = await callChatWithFileIds(content, uploadedFileIds, provider, token, geminiMode);
      } else {
        // Use regular chat endpoint
        response = await callChat(content, provider, token, geminiMode);
      }

      // Check if response contains image data (for image generation)
      let assistantMessage: Message;
      if (response.imageUrl || response.image_url) {
        assistantMessage = { 
          role: "assistant", 
          content: "Here's the generated image:", 
          imageUrl: response.imageUrl || response.image_url,
          imagePrompt: content,
          isStreaming: true,
          hasStreamed: false,
          responseTime: response.responseTime,
          responseTimeFormatted: response.responseTimeFormatted
        };
      } else if (response.message && response.message.startsWith('IMAGE_DATA:')) {
        const imageData = response.message.replace('IMAGE_DATA:', '');
        assistantMessage = { 
          role: "assistant", 
          content: "Here's the generated image:", 
          imageUrl: `data:image/png;base64,${imageData}`,
          imagePrompt: content,
          isStreaming: true,
          hasStreamed: false,
          responseTime: response.responseTime,
          responseTimeFormatted: response.responseTimeFormatted
        };
      } else {
        const rawContent = response.message || response.content || "No response received";
        // Strip citation markers like [1], [2], [12], etc. from responses (preserve newlines)
        const cleanedContent = rawContent.replace(/\[\d+\]/g, "").replace(/[ \t]{2,}/g, " ").trim();
        assistantMessage = { 
          role: "assistant", 
          content: cleanedContent, 
          isStreaming: true,
          hasStreamed: false,
          responseTime: response.responseTime,
          responseTimeFormatted: response.responseTimeFormatted
        };
      }
      
      setMessages((prev) => {
        const newMessages = [...prev, assistantMessage];
        setStreamingMessageId(newMessages.length - 1);
        return newMessages;
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = () => {
    setMessages([]);
    setStreamingMessageId(null);
    localStorage.removeItem(`${STORAGE_PREFIX}${provider}`);
    localStorage.removeItem(`${STREAMING_STATE_PREFIX}${provider}`);
    toast.success("Chat cleared");
  };

  const markMessageAsStreamed = (index: number) => {
    setMessages((prev) => 
      prev.map((msg, i) => 
        i === index ? { ...msg, isStreaming: false, hasStreamed: true } : msg
      )
    );
    setStreamingMessageId(null);
    localStorage.removeItem(`${STREAMING_STATE_PREFIX}${provider}`);
  };

  return {
    messages,
    isLoading,
    hasApiKey: true,
    streamingMessageId,
    pendingFiles,
    addFiles,
    removePendingFile,
    clearPendingFiles,
    sendMessage,
    clearMessages,
    markMessageAsStreamed,
  };
};

// Upload file to get permanent URL
const uploadFile = async (file: File, token: string): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `File upload error: ${response.statusText}`);
  }

  return await response.json();
};

// Call the centralized chat API
const callChat = async (message: string, provider: Provider, token: string, geminiMode?: GeminiMode): Promise<any> => {
  const requestBody: any = {
    message,
    provider,
    systemInstruction: "Do not include citation markers such as [1], [2], [3], or any bracketed numbers in your response.",
  };

  // Add Gemini-specific mode if applicable
  if (provider === "gemini" && geminiMode === "generate-image") {
    requestBody.mode = "generate-image";
  }

  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `API error: ${response.statusText}`);
  }

  return await response.json();
};

// Call the dedicated image generation API
const callGenerateImage = async (prompt: string, token: string): Promise<any> => {
  const requestBody = {
    prompt,
    options: {
      model: "dall-e-3",
      size: "1024x1024",
      quality: "standard"
    }
  };

  const response = await fetch(`${API_BASE_URL}/api/generate-image`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `Image generation error: ${response.statusText}`);
  }

  return await response.json();
};

// Call the chat API with multiple file IDs (files already uploaded)
const callChatWithFileIds = async (message: string, fileIds: string[], provider: Provider, token: string, geminiMode?: GeminiMode): Promise<any> => {
  const requestBody: any = {
    message,
    provider,
    fileIds,
    systemInstruction: "Do not include citation markers such as [1], [2], [3], or any bracketed numbers in your response.",
  };

  // Add Gemini-specific mode if applicable
  if (provider === "gemini" && geminiMode) {
    requestBody.mode = geminiMode;
  }

  const response = await fetch(`${API_BASE_URL}/api/chat/file`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `API error: ${response.statusText}`);
  }

  return await response.json();
};

// Call the chat API with file URL (file already uploaded)
const callChatWithFileUrl = async (message: string, fileUrl: string, fileName: string, provider: Provider, token: string, geminiMode?: GeminiMode): Promise<any> => {
  const requestBody: any = {
    message,
    provider,
    fileUrl,
    fileName
  };

  // Add Gemini-specific mode if applicable
  if (provider === "gemini" && geminiMode) {
    requestBody.mode = geminiMode;
  }

  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `API error: ${response.statusText}`);
  }

  return await response.json();
};

// Call the chat API with file upload
const callChatWithFile = async (message: string, file: File, provider: Provider, token: string, geminiMode?: GeminiMode): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);
  if (message) formData.append('message', message);
  formData.append('provider', provider);

  // Add Gemini-specific mode if applicable
  if (provider === "gemini" && geminiMode) {
    formData.append('mode', geminiMode);
  }

  const response = await fetch(`${API_BASE_URL}/api/chat/file`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `API error: ${response.statusText}`);
  }

  return await response.json();
};

// Helper function to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

const callPerplexity = async (message: string, apiKey: string): Promise<string> => {
  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        { role: "system", content: "You are a helpful assistant. Provide responses in plain text without using markdown formatting. Do not use asterisks (**) for bold text or hashtags (#) for headers. Write in clear, simple text format." },
        { role: "user", content: message }
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
};
