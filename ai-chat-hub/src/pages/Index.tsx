import { useState, useRef, useEffect } from "react";
import { Send, Trash2, Sparkles, Paperclip, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChatMessage } from "@/components/ChatMessage";
import { AuthDialog } from "@/components/AuthDialog";
import { UserMenu } from "@/components/UserMenu";
import { useChat } from "@/hooks/useChat";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "@/components/Router";
import { toast } from "sonner";

type Provider = "openai" | "gemini" | "perplexity";
type GeminiMode = "ask" | "generate-image";

const Index = () => {
  const [activeProvider, setActiveProvider] = useState<Provider>("openai");
  const [geminiMode, setGeminiMode] = useState<GeminiMode>("ask");
  const [input, setInput] = useState("");
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user, isAuthenticated, logout, isLoading: authLoading } = useAuth();
  const { navigateTo } = useRouter();

  const openaiChat = useChat("openai");
  const geminiChat = useChat("gemini", geminiMode);
  const perplexityChat = useChat("perplexity");

  const currentChat =
    activeProvider === "openai"
      ? openaiChat
      : activeProvider === "gemini"
      ? geminiChat
      : perplexityChat;

  // When switching tabs, mark any streaming message as complete
  useEffect(() => {
    const chats = [openaiChat, geminiChat, perplexityChat];
    chats.forEach((chat) => {
      if (chat.streamingMessageId !== null) {
        chat.markMessageAsStreamed(chat.streamingMessageId);
      }
    });
  }, [activeProvider]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentChat.messages]);

  const handleSend = async () => {
    if (!input.trim() || currentChat.isLoading) return;
    
    if (!isAuthenticated) {
      setAuthDialogOpen(true);
      return;
    }
    
    const message = input;
    setInput("");
    await currentChat.sendMessage(message);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      currentChat.addFiles(files);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const providerLabels = {
    openai: "OpenAI GPT-5.1",
    gemini: "Gemini 3 Pro",
    perplexity: "Perplexity Sonar Pro",
  };

  const samplePrompts: Record<Provider, string[]> = {
    openai: [
      "Analyze whether my business idea is logically viable and list the risks.",
      "Given these market conditions, what scenario is most likely for next quarter sales?",
      "Predict how customer behavior will change if we increase pricing by 10%.",
      "Explain the reasoning steps behind choosing Strategy A vs Strategy B for my startup.",
      "Evaluate my business workflow and identify where bottlenecks are most likely to happen.",
      "Create a clear narrative explaining how my company can scale from 10 clients to 100.",
    ],
    gemini: [
      "Analyze this business requirement document and identify missing details.",
      "Read this business plan and highlight the strengths and weaknesses.",
      "Review this product specification and summarize the key technical needs.",
      "Interpret this onboarding document and recommend process improvements.",
      "Compare these two business policy documents and list their differences.",
      "From this pitch deck text, identify what investors will question the most.",
    ],
    perplexity: [
      "Find the latest market statistics for the U.S. e-commerce industry and cite sources.",
      "Retrieve recent competitor information and show evidence from trusted sources.",
      "Search for current regulations affecting cross-border shipping businesses.",
      "Provide verified data on consumer trends in the tech retail market.",
      "Find real-time updates on AI industry funding and list reliable references.",
      "Retrieve facts about startup failure rates and show where each statistic comes from.",
    ],
  };

  const useCases: Record<Provider, Array<{ emoji: string; title: string; description: string }>> = {
    openai: [
      { emoji: "🧠", title: "Logic & Reasoning", description: "Complex problem solving and analysis" },
      { emoji: "🎯", title: "Scenario Assessment", description: "Evaluate situations and outcomes" },
      { emoji: "🔮", title: "Prediction", description: "Forecast trends and possibilities" },
      { emoji: "📖", title: "Narrative Understanding", description: "Organize and explain concepts" },
    ],
    gemini: [
      { emoji: "📊", title: "Chart Interpretation", description: "Analyze visual data representations" },
      { emoji: "📋", title: "Table Analysis", description: "Extract insights from structured data" },
      { emoji: "🖼️", title: "Image Understanding", description: "Process and interpret images" },
      { emoji: "🔄", title: "Cross-Modal Analytics", description: "Connect multimodal information" },
    ],
    perplexity: [
      { emoji: "🔍", title: "Fact Retrieval", description: "Access verified information" },
      { emoji: "📌", title: "Evidence Pointing", description: "Source-backed answers" },
      { emoji: "⚡", title: "Real-Time Search", description: "Current contextual information" },
      { emoji: "✅", title: "Grounded Insights", description: "Verifiable and cited data" },
    ],
  };

  const handleSamplePrompt = (prompt: string) => {
    if (!isAuthenticated) {
      setAuthDialogOpen(true);
      return;
    }
    setInput(prompt);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Professional Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-xl shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              CS 298 - Bao H. Nguyen - Gen AI
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Powered by OpenAI, Google Gemini & Perplexity
              </p>
            </div>
            {/* User Menu */}
            <UserMenu onSignInClick={() => setAuthDialogOpen(true)} />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Tab Navigation */}
        <Tabs
          value={activeProvider}
          onValueChange={(v) => setActiveProvider(v as Provider)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          {/* Professional Tab Navigation */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <TabsList className="bg-muted/50 backdrop-blur-sm p-1 h-12 w-full sm:w-auto grid grid-cols-3 sm:flex">
                <TabsTrigger
                  value="openai"
                  className="text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">O</span>
                  </div>
                  OpenAI
                </TabsTrigger>
                <TabsTrigger
                  value="gemini"
                  className="text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                  Gemini
                </TabsTrigger>
                <TabsTrigger
                  value="perplexity"
                  className="text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">P</span>
                  </div>
                  Perplexity
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-3">
                {activeProvider === "gemini" && (
                  <Select
                    value={geminiMode}
                    onValueChange={(value) => setGeminiMode(value as GeminiMode)}
                  >
                    <SelectTrigger className="w-auto min-w-[140px] bg-card/50 backdrop-blur-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ask">💬 Ask</SelectItem>
                      <SelectItem value="generate-image">🎨 Generate Image</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {currentChat.messages.length > 0 && (
                  <Button
                    onClick={currentChat.clearMessages}
                    variant="outline"
                    size="sm"
                    className="bg-card/50 backdrop-blur-sm hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all duration-200"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Tab Content */}
          {(["openai", "gemini", "perplexity"] as Provider[]).map((provider) => (
            <TabsContent
              key={provider}
              value={provider}
              className="flex-1 flex flex-col min-h-0 mt-0"
            >
              <div className="bg-card/30 backdrop-blur-xl rounded-2xl border border-border/50 shadow-xl flex flex-col min-h-[600px] overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          provider === "openai"
                            ? "bg-green-500"
                            : provider === "gemini"
                            ? "bg-blue-500"
                            : "bg-purple-500"
                        }`}
                      >
                        {provider === "gemini" ? (
                          <Sparkles className="w-4 h-4 text-white" />
                        ) : (
                          <span className="text-sm font-bold text-white">
                            {provider === "openai" ? "O" : "P"}
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{providerLabels[provider]}</h3>
                        <p className="text-xs text-muted-foreground">
                          {provider === "openai" && "Logical reasoning and complex analysis"}
                          {provider === "gemini" && 
                            (geminiMode === "generate-image" 
                              ? "Image generation powered by Imagen 4" 
                              : "Multimodal AI with document analysis"
                            )
                          }
                          {provider === "perplexity" && "Real-time web search with citations"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  {currentChat.messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
                      <div className="space-y-3">
                        <h2 className="text-2xl font-bold text-foreground">
                          Welcome to {providerLabels[provider]}
                        </h2>
                        <p className="text-lg text-muted-foreground">
                          {!isAuthenticated
                            ? "Please sign in to start chatting with AI"
                            : currentChat.hasApiKey
                            ? "Ask me anything, and I'll provide helpful and detailed responses."
                            : "Configure your API key in the .env file to get started"}
                        </p>
                      </div>

                      {isAuthenticated && currentChat.hasApiKey && (
                        <>
                          {/* Use Cases */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-4xl">
                            {useCases[provider].map((useCase, index) => (
                              <div
                                key={index}
                                className="bg-card/60 backdrop-blur-sm rounded-xl p-4 border border-border/30 hover:border-primary/30 transition-colors"
                              >
                                <div className="text-2xl mb-2">{useCase.emoji}</div>
                                <h4 className="font-medium text-sm mb-1">{useCase.title}</h4>
                                <p className="text-xs text-muted-foreground">{useCase.description}</p>
                              </div>
                            ))}
                          </div>

                          {/* Sample Prompts */}
                          <div className="w-full max-w-4xl">
                            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Try these example prompts:</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {samplePrompts[provider].slice(0, 4).map((prompt, index) => (
                                <button
                                  key={index}
                                  onClick={() => handleSamplePrompt(prompt)}
                                  className="text-left p-3 text-sm bg-muted/50 hover:bg-muted/70 rounded-lg transition-colors border border-border/30 hover:border-primary/30"
                                >
                                  "{prompt}"
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      {currentChat.messages.map((message, index) => (
                        <ChatMessage
                          key={index}
                          role={message.role}
                          content={message.content}
                          isStreaming={currentChat.streamingMessageId === index}
                          hasStreamed={message.hasStreamed}
                          onStreamComplete={() => currentChat.markMessageAsStreamed(index)}
                          imageUrl={message.imageUrl}
                          imagePrompt={message.imagePrompt}
                          fileUrls={message.fileUrls}
                          fileNames={message.fileNames}
                          fileTypes={message.fileTypes}
                          fileUrl={message.fileUrl}
                          fileName={message.fileName}
                          fileType={message.fileType}
                          responseTime={message.responseTime}
                          responseTimeFormatted={message.responseTimeFormatted}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Input Area */}
                <div className="px-6 py-6 border-t border-border/50 bg-card/50 backdrop-blur-sm">
                  {currentChat.pendingFiles.length > 0 && (
                    <div className="mb-4 flex flex-col gap-2">
                      {currentChat.pendingFiles.map((pf, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors duration-300 ${
                            pf.status === "uploading"
                              ? "bg-muted/40 border-border/30"
                              : pf.status === "success"
                              ? "bg-green-500/10 border-green-500/30"
                              : "bg-destructive/10 border-destructive/30"
                          }`}
                        >
                          {/* Status icon */}
                          {pf.status === "uploading" && (
                            <Loader2 className="w-4 h-4 text-muted-foreground shrink-0 animate-spin" />
                          )}
                          {pf.status === "success" && (
                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                          )}
                          {pf.status === "error" && (
                            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                          )}

                          {/* File name + status label */}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm truncate block">{pf.file.name}</span>
                            {pf.status === "uploading" && (
                              <span className="text-xs text-muted-foreground">Uploading…</span>
                            )}
                            {pf.status === "success" && (
                              <span className="text-xs text-green-500">Upload complete</span>
                            )}
                            {pf.status === "error" && (
                              <span className="text-xs text-destructive">{pf.error ?? "Upload failed"}</span>
                            )}
                          </div>

                          {/* Progress bar for uploading */}
                          {pf.status === "uploading" && (
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                              <div className="h-full bg-primary rounded-full animate-pulse w-2/3" />
                            </div>
                          )}

                          {/* Remove button (only when not uploading) */}
                          {pf.status !== "uploading" && (
                            <Button
                              onClick={() => currentChat.removePendingFile(i)}
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-3 items-end">
                    <div className="flex-1 relative">
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                          !isAuthenticated
                            ? "Please sign in to start chatting..."
                            : !currentChat.hasApiKey 
                            ? "Please configure your API key first" 
                            : activeProvider === "gemini" && geminiMode === "generate-image"
                            ? "Describe the image you want to generate..."
                            : activeProvider === "gemini"
                            ? "Type your message or attach a file... (Shift + Enter for new line)"
                            : "Type your message... (Shift + Enter for new line)"
                        }
                        className="min-h-[56px] max-h-[200px] resize-none pr-4 pl-4 py-4 text-base rounded-2xl border-border/50 focus:border-primary/50 bg-background/50 backdrop-blur-sm shadow-sm"
                        disabled={!isAuthenticated || !currentChat.hasApiKey || currentChat.isLoading}
                      />
                    </div>

                    <div className="flex gap-2">
                      {/* File upload button with pending-file badge */}
                      <div className="relative">
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={!isAuthenticated || !currentChat.hasApiKey || currentChat.isLoading || currentChat.pendingFiles.length >= 10}
                          size="lg"
                          variant="outline"
                          className="h-[56px] px-5 rounded-2xl hover:bg-primary/5 hover:border-primary/50 transition-all duration-200 disabled:opacity-50"
                          title={
                            currentChat.pendingFiles.length >= 10
                              ? "Maximum 10 files reached"
                              : `Upload files (${10 - currentChat.pendingFiles.length} remaining)`
                          }
                        >
                          <Paperclip className="w-5 h-5" />
                        </Button>
                        {currentChat.pendingFiles.length > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center pointer-events-none">
                            {currentChat.pendingFiles.length}
                          </span>
                        )}
                      </div>

                      <Button
                        onClick={handleSend}
                        disabled={
                          !input.trim() ||
                          !isAuthenticated ||
                          !currentChat.hasApiKey ||
                          currentChat.isLoading ||
                          currentChat.pendingFiles.some((pf) => pf.status === "uploading")
                        }
                        size="lg"
                        className="h-[56px] px-6 rounded-2xl bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100"
                        title={currentChat.pendingFiles.some((pf) => pf.status === "uploading") ? "Waiting for uploads to finish…" : undefined}
                      >
                        <Send className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>

                  {currentChat.messages.length > 0 && isAuthenticated && (
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                      {activeProvider === "gemini" && geminiMode === "ask" 
                        ? "Press Enter to send • Shift + Enter for new line • Click 📎 to attach files"
                        : "Press Enter to send • Shift + Enter for new line"}
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.md,.pdf,.json,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Authentication Dialog */}
      <AuthDialog 
        open={authDialogOpen} 
        onOpenChange={setAuthDialogOpen} 
      />
    </div>
  );
};

export default Index;
