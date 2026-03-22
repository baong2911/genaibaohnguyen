import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { User, MessageSquare, Clock, FileText, ChevronLeft, ChevronRight } from "lucide-react";
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

interface UserProfileProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UserProfile = ({ open, onOpenChange }: UserProfileProps) => {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
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
      const response = await fetch(`${API_BASE_URL}/api/user-prompts?page=${page}&limit=50`, {
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

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "log" && prompts.length === 0) {
      fetchUserPrompts(1);
    }
  };

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

  const truncateContent = (content: string, maxLength: number = 100) => {
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            User Profile
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="log" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Prompt Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="flex-1 space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Username</label>
                  <p className="text-lg font-medium">{user.username}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-lg">{user.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User ID</label>
                  <p className="text-sm font-mono bg-muted px-2 py-1 rounded">{user.id}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-card rounded-lg p-4 border">
                  <h3 className="font-medium mb-2">Account Status</h3>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Active
                  </Badge>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="log" className="flex-1 flex flex-col mt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                <h3 className="font-semibold">Prompt History</h3>
                {pagination && (
                  <Badge variant="secondary">
                    {pagination.totalPrompts} total prompts
                  </Badge>
                )}
              </div>
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={!pagination.hasPrev || isLoading}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
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
                </div>
              )}
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <div className="p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Loading prompts...</div>
                  </div>
                ) : prompts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <MessageSquare className="w-12 h-12 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No prompts found</p>
                    <p className="text-sm text-muted-foreground">Your chat history will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {prompts.map((prompt) => (
                      <div
                        key={prompt._id}
                        className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                variant="secondary"
                                className={`${getProviderBadgeColor(prompt.provider)} text-white`}
                              >
                                {prompt.provider}
                              </Badge>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {formatDate(prompt.createdAt)}
                              </div>
                            </div>
                            <p className="text-sm mb-2 break-words">
                              {truncateContent(prompt.content)}
                            </p>
                            {prompt.conversation && (
                              <p className="text-xs text-muted-foreground">
                                Conversation: {prompt.conversation.title}
                              </p>
                            )}
                            {prompt.attachments && prompt.attachments.length > 0 && (
                              <div className="flex items-center gap-1 mt-2">
                                <FileText className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {prompt.attachments.length} attachment{prompt.attachments.length > 1 ? 's' : ''}
                                </span>
                                <div className="flex gap-1">
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
