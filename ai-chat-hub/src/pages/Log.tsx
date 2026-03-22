import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { MessageSquare, Clock, FileText, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

// Get API base URL from environment variable with fallback
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

interface Attachment {
  id: string;
  originalName: string;
  mimetype: string;
  size: number;
}

interface Conversation {
  _id: string;
  title: string;
}

interface UserPrompt {
  _id: string;
  conversationId: string;
  content: string;
  attachments: Attachment[];
  provider: "openai" | "gemini" | "perplexity";
  createdAt: string;
  conversation: Conversation;
}

interface UserPromptsResponse {
  prompts: UserPrompt[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalPrompts: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const Log = () => {
  const { user, isAuthenticated } = useAuth();
  const [prompts, setPrompts] = useState<UserPrompt[]>([]);
  const [pagination, setPagination] = useState<UserPromptsResponse['pagination'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchUserPrompts = async (page: number = 1) => {
    if (!isAuthenticated) return;

    const token = localStorage.getItem('chatHubToken');
    if (!token) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/user-prompts?page=${page}&limit=10`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch prompts: ${response.statusText}`);
      }

      const data: UserPromptsResponse = await response.json();
      setPrompts(data.prompts);
      setPagination(data.pagination);
      setCurrentPage(page);
    } catch (error) {
      console.error("Error fetching user prompts:", error);
      toast.error("Failed to load prompt history");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchUserPrompts(1);
    }
  }, [isAuthenticated]);

  const handlePageChange = (newPage: number) => {
    if (pagination && newPage >= 1 && newPage <= pagination.totalPages) {
      fetchUserPrompts(newPage);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getProviderBadgeColor = (provider: string) => {
    switch (provider) {
      case 'openai': return 'bg-green-500';
      case 'gemini': return 'bg-blue-500';
      case 'perplexity': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const truncateContent = (content: string, maxLength: number = 150) => {
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
  };

  const goBack = () => {
    window.history.back();
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <MessageSquare className="w-16 h-16 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">Please sign in to view your prompt log.</p>
          <Button onClick={goBack} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-xl shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button onClick={goBack} variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <MessageSquare className="w-6 h-6" />
                  Prompt Log
                </h1>
                <p className="text-sm text-muted-foreground">
                  Your chat history with AI providers
                </p>
              </div>
            </div>
            {pagination && (
              <Badge variant="secondary" className="text-sm">
                {pagination.totalPrompts} total prompts
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-card/30 backdrop-blur-xl rounded-2xl border border-border/50 shadow-xl overflow-hidden">
          {/* Pagination Header */}
          {pagination && pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur-sm flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {pagination.currentPage} of {pagination.totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={!pagination.hasPrev || isLoading}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={!pagination.hasNext || isLoading}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Prompts List */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-muted-foreground">Loading prompts...</div>
                  </div>
                ) : prompts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare className="w-16 h-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No prompts found</h3>
                    <p className="text-muted-foreground mb-4">Your chat history will appear here</p>
                    <Button onClick={goBack} variant="outline">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Start Chatting
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {prompts.map((prompt) => (
                      <div
                        key={prompt._id}
                        className="border rounded-lg p-6 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-3">
                              <Badge
                                variant="secondary"
                                className={`${getProviderBadgeColor(prompt.provider)} text-white`}
                              >
                                {prompt.provider.toUpperCase()}
                              </Badge>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                {formatDate(prompt.createdAt)}
                              </div>
                            </div>
                            <p className="text-base mb-3 break-words leading-relaxed">
                              {truncateContent(prompt.content)}
                            </p>
                            {prompt.conversation && (
                              <p className="text-sm text-muted-foreground mb-2">
                                <strong>Conversation:</strong> {prompt.conversation.title}
                              </p>
                            )}
                            {prompt.attachments && prompt.attachments.length > 0 && (
                              <div className="flex items-center gap-2 mt-3">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                  {prompt.attachments.length} attachment{prompt.attachments.length > 1 ? 's' : ''}:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {prompt.attachments.slice(0, 3).map((attachment) => (
                                    <Badge key={attachment.id} variant="outline" className="text-xs">
                                      {attachment.originalName}
                                    </Badge>
                                  ))}
                                  {prompt.attachments.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{prompt.attachments.length - 3} more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Pagination Footer */}
          {pagination && pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-border/50 bg-card/50 backdrop-blur-sm flex items-center justify-center">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1 || isLoading}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={!pagination.hasPrev || isLoading}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  Page {pagination.currentPage} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={!pagination.hasNext || isLoading}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.totalPages)}
                  disabled={currentPage === pagination.totalPages || isLoading}
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Log;
