import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "@/components/Router";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Copy, Trash2, ClipboardList, Loader2 } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

type Provider = "openai" | "gemini" | "perplexity";
type SummaryStyle = "concise" | "detailed" | "bullet";

const PROVIDER_OPTIONS: { value: Provider; label: string; color: string; icon: string }[] = [
  { value: "openai", label: "OpenAI", color: "bg-green-500", icon: "O" },
  { value: "gemini", label: "Gemini", color: "bg-blue-500", icon: "G" },
  { value: "perplexity", label: "Perplexity", color: "bg-purple-500", icon: "P" },
];

const STYLE_PROMPTS: Record<SummaryStyle, string> = {
  concise: "Summarize the following notes into a short, clear paragraph. Keep it brief and to the point.",
  detailed: "Summarize the following notes in detail, preserving all key ideas and important points. Use clear paragraphs.",
  bullet: "Summarize the following notes as a structured bullet-point list. Group related points together with clear headings."
};

const STYLE_LABELS: Record<SummaryStyle, { label: string; emoji: string; description: string }> = {
  concise: { label: "Concise", emoji: "✂️", description: "Short and to the point" },
  detailed: { label: "Detailed", emoji: "📝", description: "Full coverage of all ideas" },
  bullet: { label: "Bullet Points", emoji: "📋", description: "Structured list format" },
};

const SummarizeNote = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { navigateTo } = useRouter();

  const [input, setInput] = useState("");
  const [summary, setSummary] = useState("");
  const [style, setStyle] = useState<SummaryStyle>("concise");
  const [provider, setProvider] = useState<Provider>("openai");
  const [isLoading, setIsLoading] = useState(false);

  const handleSummarize = async () => {
    if (!input.trim()) return;

    if (!isAuthenticated) {
      toast.error("Please sign in to use this feature.");
      return;
    }

    const token = localStorage.getItem("chatHubToken");
    if (!token) {
      toast.error("Please sign in to continue.");
      return;
    }

    setIsLoading(true);
    setSummary("");

    const prompt = `${STYLE_PROMPTS[style]}\n\n---\n\n${input.trim()}`;

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: prompt, provider }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error || "Failed to summarize.");
      }

      const data = await response.json();
      setSummary(data.message || data.content || "No summary returned.");
      toast.success("Summary generated!");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to generate summary.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    toast.success("Summary copied to clipboard!");
  };

  const handleClear = () => {
    setInput("");
    setSummary("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-xl shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateTo("home")}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent flex items-center gap-2">
                  <ClipboardList className="w-6 h-6 text-primary" />
                  Summarize Note
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Paste your notes and get an AI-powered summary
                </p>
              </div>
            </div>

            {/* User Menu */}
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Provider selector */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">AI Provider:</span>
          {PROVIDER_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => setProvider(p.value)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-all duration-150 ${
                provider === p.value
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card/60 border-border/40 hover:border-primary/40 text-foreground"
              }`}
            >
              <div className={`w-5 h-5 rounded-full ${p.color} flex items-center justify-center`}>
                <span className="text-[10px] font-bold text-white">{p.icon}</span>
              </div>
              <span className="font-medium">{p.label}</span>
            </button>
          ))}
        </div>

        {/* Style selector */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Summary style:</span>
          {(Object.keys(STYLE_LABELS) as SummaryStyle[]).map((s) => (
            <button
              key={s}
              onClick={() => setStyle(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all duration-150 ${
                style === s
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card/60 border-border/40 hover:border-primary/40 text-foreground"
              }`}
            >
              <span>{STYLE_LABELS[s].emoji}</span>
              <span className="font-medium">{STYLE_LABELS[s].label}</span>
              <span className={`text-xs hidden sm:inline ${style === s ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                — {STYLE_LABELS[s].description}
              </span>
            </button>
          ))}
        </div>

        {/* Two-column layout on lg+ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input panel */}
          <div className="bg-card/30 backdrop-blur-xl rounded-2xl border border-border/50 shadow-xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 bg-card/50 flex items-center justify-between">
              <h2 className="font-semibold text-base">Your Notes</h2>
              <span className="text-xs text-muted-foreground">
                {input.length > 0 ? `${input.length} characters` : "Paste or type your notes below"}
              </span>
            </div>
            <div className="flex-1 p-5 flex flex-col gap-4">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste your notes, meeting minutes, article, or any text you want summarized…"
                className="flex-1 min-h-[320px] resize-none text-sm border-border/40 focus:border-primary/50 bg-background/50 rounded-xl"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleSummarize}
                  disabled={!input.trim() || isLoading || !isAuthenticated}
                  className="flex-1 bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Summarizing…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Summarize
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleClear}
                  variant="outline"
                  disabled={!input && !summary}
                  className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Output panel */}
          <div className="bg-card/30 backdrop-blur-xl rounded-2xl border border-border/50 shadow-xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 bg-card/50 flex items-center justify-between">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Summary
                {summary && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({STYLE_LABELS[style].emoji} {STYLE_LABELS[style].label})
                  </span>
                )}
              </h2>
              {summary && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopy}
                  className="h-7 px-2 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </Button>
              )}
            </div>
            <div className="flex-1 p-5">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm">Generating your summary…</p>
                </div>
              ) : summary ? (
                <div className="text-sm leading-relaxed text-foreground prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center text-muted-foreground select-none">
                  <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center">
                    <ClipboardList className="w-7 h-7 opacity-40" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">No summary yet</p>
                    <p className="text-xs mt-1">
                      Paste your notes on the left and click <strong>Summarize</strong>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {!isAuthenticated && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Please{" "}
            <button
              onClick={() => navigateTo("home")}
              className="text-primary underline underline-offset-2 hover:opacity-80"
            >
              sign in
            </button>{" "}
            to use the summarize feature.
          </p>
        )}
      </div>
    </div>
  );
};

export default SummarizeNote;
