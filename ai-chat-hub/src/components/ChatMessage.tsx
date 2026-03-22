import { Bot, User, FileText, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  hasStreamed?: boolean;
  onStreamComplete?: () => void;
  imageUrl?: string;
  imagePrompt?: string;
  // Multi-file fields
  fileUrls?: string[];
  fileNames?: string[];
  fileTypes?: string[];
  // Legacy single-file fields (backward compat)
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  responseTime?: number;
  responseTimeFormatted?: string;
}

export const ChatMessage = ({ 
  role, 
  content, 
  isStreaming = false, 
  hasStreamed = false,
  onStreamComplete,
  imageUrl,
  imagePrompt,
  fileUrls,
  fileNames,
  fileTypes,
  fileUrl,
  fileName,
  fileType,
  responseTime,
  responseTimeFormatted
}: ChatMessageProps) => {
  // Normalize to arrays, merging multi-file and legacy single-file fields
  const allFileUrls = fileUrls ?? (fileUrl ? [fileUrl] : []);
  const allFileNames = fileNames ?? (fileName ? [fileName] : []);
  const allFileTypes = fileTypes ?? (fileType ? [fileType] : []);
  const isUser = role === "user";
  const [displayedContent, setDisplayedContent] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // User messages appear instantly
    if (isUser) {
      setDisplayedContent(content);
      return;
    }

    // If message has already been streamed, show it immediately
    if (hasStreamed) {
      setDisplayedContent(content);
      setIsTyping(false);
      return;
    }

    // AI messages with typing effect (only if currently streaming and not yet streamed)
    if (isStreaming && !hasStreamed) {
      // If we already have partial content displayed (e.g., when returning from another tab),
      // continue from where we left off
      const startIndex = displayedContent.length;
      
      if (startIndex === 0) {
        setDisplayedContent("");
      }
      
      setIsTyping(true);
      let currentIndex = startIndex;

      const typingInterval = setInterval(() => {
        if (currentIndex < content.length) {
          setDisplayedContent(content.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          setIsTyping(false);
          clearInterval(typingInterval);
          // Notify parent that streaming is complete
          if (onStreamComplete) {
            onStreamComplete();
          }
        }
      }, 20); // Adjust speed: lower = faster, higher = slower

      return () => {
        clearInterval(typingInterval);
        // Keep the current displayed content when unmounting (tab switching)
      };
    } else {
      // For existing messages (on mount), show immediately
      setDisplayedContent(content);
    }
  }, [content, isUser, isStreaming, hasStreamed, onStreamComplete]);

  return (
    <div
      className={cn(
        "flex gap-4 px-4 py-4 animate-in fade-in slide-in-from-bottom-2 duration-300 hover:bg-muted/20 transition-colors rounded-lg group",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
          <Bot className="w-5 h-5 text-white" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-5 py-4 shadow-md group-hover:shadow-lg transition-all",
          isUser
            ? "bg-gradient-to-br from-primary to-accent text-white"
            : "bg-card border border-border/50 text-foreground backdrop-blur-sm"
        )}
      >
        {isUser ? (
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
            {displayedContent}
          </p>
        ) : (
          <div className="text-[15px] leading-relaxed prose prose-sm dark:prose-invert max-w-none break-words
            prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
            prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
            prose-p:my-1.5 prose-p:leading-relaxed
            prose-ul:my-1.5 prose-ul:pl-5 prose-li:my-0.5
            prose-ol:my-1.5 prose-ol:pl-5
            prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:text-foreground
            prose-pre:bg-muted prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto
            prose-blockquote:border-l-4 prose-blockquote:border-primary/40 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground
            prose-strong:font-semibold prose-strong:text-foreground
            prose-table:text-sm prose-th:font-semibold prose-th:text-left prose-th:p-2 prose-td:p-2
            prose-a:text-primary prose-a:underline hover:prose-a:opacity-80"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {displayedContent}
            </ReactMarkdown>
            {isTyping && (
              <span className="inline-block w-1 h-4 ml-0.5 bg-current animate-pulse" />
            )}
          </div>
        )}
        
        {/* Display response time for assistant messages */}
        {!isUser && responseTimeFormatted && (
          <div className="mt-2 flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-muted-foreground/40"></div>
            <span className="text-xs text-muted-foreground/60">
              Response time: {responseTimeFormatted}
            </span>
          </div>
        )}
        {/* Display uploaded files */}
        {allFileUrls.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {allFileUrls.map((url, i) => {
              const name = allFileNames[i] ?? `File ${i + 1}`;
              const type = allFileTypes[i] ?? "";
              return type.startsWith('image/') ? (
                <div key={i}>
                  <img
                    src={url}
                    alt={name}
                    className="rounded-lg max-w-full max-h-96 h-auto shadow-lg border border-border/30"
                    loading="lazy"
                  />
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    {name}
                  </p>
                </div>
              ) : (
                <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
                  <FileText className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">{name}</span>
                </div>
              );
            })}
          </div>
        )}
        {imageUrl && (
          <div className="mt-3">
            <img 
              src={imageUrl} 
              alt={imagePrompt || "Generated image"} 
              className="rounded-lg max-w-full h-auto shadow-lg border border-border/30"
              loading="lazy"
            />
            {imagePrompt && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                Prompt: {imagePrompt}
              </p>
            )}
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center group-hover:border-primary/30 transition-colors">
          <User className="w-5 h-5 text-foreground" />
        </div>
      )}
    </div>
  );
};
