import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "@/components/Router";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sparkles,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Layers,
  Shuffle,
  Eye,
  EyeOff,
} from "lucide-react";
import { UserMenu } from "@/components/UserMenu";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = "openai" | "gemini" | "perplexity";

const PROVIDER_OPTIONS: { value: Provider; label: string; color: string; icon: string }[] = [
  { value: "openai", label: "OpenAI", color: "bg-green-500", icon: "O" },
  { value: "gemini", label: "Gemini", color: "bg-blue-500", icon: "G" },
  { value: "perplexity", label: "Perplexity", color: "bg-purple-500", icon: "P" },
];

interface FlashCard {
  id: string;
  question: string;
  answer: string;
}

type CardCount = 5 | 10 | 15 | 20;



// ─── Prompt ───────────────────────────────────────────────────────────────────

const buildPrompt = (count: CardCount, input: string) => `
You are a flash card generator. Given the user's notes or topic, produce exactly ${count} flash cards in strict JSON format.

Rules:
- Each card has "id" (unique string like "c1","c2"...), "question" (clear and concise), and "answer" (informative but brief, 1–3 sentences).
- Cover the most important concepts from the input.
- Do NOT include any citation markers, footnotes, or reference numbers such as [1], [2], [3] anywhere in the question or answer text.
- Do NOT include any superscripts, brackets, or annotation symbols of any kind.
- No markdown fences, no extra text — return ONLY a raw JSON array.

Example output:
[{"id":"c1","question":"What is photosynthesis?","answer":"Photosynthesis is the process by which plants use sunlight, water, and CO₂ to produce glucose and oxygen."}]

Now generate ${count} flash cards for the following input:
${input}
`.trim();

// ─── Flip Card component ──────────────────────────────────────────────────────

function FlipCard({ card, index, total }: { card: FlashCard; index: number; total: number }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      {/* Counter */}
      <p className="text-sm text-muted-foreground font-medium">
        Card {index + 1} of {total}
      </p>

      {/* Card */}
      <div
        className="w-full max-w-xl cursor-pointer"
        style={{ perspective: "1000px", height: "260px", width: "400px" }}
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
            transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1)",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front — Question */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
            className="rounded-2xl border border-border/50 bg-card shadow-xl flex flex-col items-center justify-center p-8 gap-3"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-primary/70">Question</span>
            <p className="text-lg font-semibold text-center leading-snug text-foreground">
              {card.question}
            </p>
            <span className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> Click to reveal answer
            </span>
          </div>

          {/* Back — Answer */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
            className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card to-accent/10 shadow-xl flex flex-col items-center justify-center p-8 gap-3"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-primary/70">Answer</span>
            <p className="text-base text-center leading-relaxed text-foreground">
              {card.answer}
            </p>
            <span className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <EyeOff className="w-3.5 h-3.5" /> Click to flip back
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const FlashCardPage = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { navigateTo } = useRouter();

  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<Provider>("openai");
  const [cardCount, setCardCount] = useState<CardCount>(10);
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const handleGenerate = async () => {
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
    setCards([]);
    setCurrentIndex(0);
    setShowAll(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: buildPrompt(cardCount, input.trim()),
          provider,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error || "Failed to generate flash cards.");
      }

      const data = await response.json();
      const raw: string = data.message || data.content || "";
      const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
      const parsed: FlashCard[] = JSON.parse(cleaned);

      // Strip any citation markers like [1], [2], [3] that the AI may have included
      const sanitized = parsed.map((card) => ({
        ...card,
        question: card.question.replace(/\[\d+\]/g, "").trim(),
        answer: card.answer.replace(/\[\d+\]/g, "").trim(),
      }));

      if (!Array.isArray(sanitized) || sanitized.length === 0) throw new Error("No cards returned.");

      setCards(sanitized);
      toast.success(`${parsed.length} flash cards generated!`);
    } catch (error: any) {
      console.error(error);
      toast.error(
        error.message?.includes("JSON")
          ? "AI returned invalid format. Try again."
          : error.message || "Failed to generate flash cards."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleShuffle = () => {
    setCards((prev) => [...prev].sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
    toast.success("Cards shuffled!");
  };

  const handleClear = () => {
    setInput("");
    setCards([]);
    setCurrentIndex(0);
    setShowAll(false);
  };

  const prev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const next = () => setCurrentIndex((i) => Math.min(cards.length - 1, i + 1));

  const COUNT_OPTIONS: CardCount[] = [5, 10, 15, 20];

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
                  <Layers className="w-6 h-6 text-primary" />
                  Flash Card Generator
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Turn your notes or topic into interactive flash cards powered by AI
                </p>
              </div>
            </div>

            {/* User Menu */}
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">

          {/* ── Input panel ─────────────────────────────────────────────── */}
          <div className="bg-card/30 backdrop-blur-xl rounded-2xl border border-border/50 shadow-xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 bg-card/50 flex items-center justify-between">
              <h2 className="font-semibold text-base">Your Topic / Notes</h2>
              <span className="text-xs text-muted-foreground">
                {input.length > 0 ? `${input.length} chars` : "Paste or type below"}
              </span>
            </div>

            <div className="flex-1 p-5 flex flex-col gap-4">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`e.g. "World War II key events"\n\nor paste a paragraph of notes and the AI will create cards from them.`}
                className="flex-1 min-h-[240px] resize-none text-sm border-border/40 focus:border-primary/50 bg-background/50 rounded-xl"
              />

              {/* Provider selector */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">AI Provider:</p>
                <div className="flex gap-2">
                  {PROVIDER_OPTIONS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setProvider(p.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-semibold border transition-all duration-150 ${
                        provider === p.value
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card/60 border-border/40 hover:border-primary/40 text-foreground"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full ${p.color} flex items-center justify-center`}>
                        <span className="text-[9px] font-bold text-white">{p.icon}</span>
                      </div>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card count selector */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Number of cards:</p>
                <div className="flex gap-2">
                  {COUNT_OPTIONS.map((n) => (
                    <button
                      key={n}
                      onClick={() => setCardCount(n)}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-all duration-150 ${
                        cardCount === n
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card/60 border-border/40 hover:border-primary/40 text-foreground"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tips */}
              <div className="rounded-xl bg-muted/40 border border-border/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">💡 Tips</p>
                <p>• Short topic: <span className="italic">"React hooks"</span></p>
                <p>• Paste study notes for targeted cards</p>
                <p>• Shuffle to randomise the order</p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleGenerate}
                  disabled={!input.trim() || isLoading || !isAuthenticated}
                  className="flex-1 bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Cards
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleClear}
                  variant="outline"
                  disabled={!input && cards.length === 0}
                  className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* ── Output panel ─────────────────────────────────────────────── */}
          <div className="bg-card/30 backdrop-blur-xl rounded-2xl border border-border/50 shadow-xl flex flex-col overflow-hidden min-h-[520px]">
            <div className="px-5 py-4 border-b border-border/50 bg-card/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-base">Flash Cards</h2>
                {cards.length > 0 && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    — {cards.length} cards
                  </span>
                )}
              </div>

              {cards.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleShuffle}
                    className="h-7 px-2 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    Shuffle
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setShowAll((s) => !s); setCurrentIndex(0); }}
                    className="h-7 px-2 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary"
                  >
                    {showAll ? (
                      <><RotateCcw className="w-3.5 h-3.5" />One by one</>
                    ) : (
                      <><Layers className="w-3.5 h-3.5" />Show all</>
                    )}
                  </Button>
                </div>
              )}
            </div>

            <div className="flex-1 p-6">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm">Creating your flash cards…</p>
                </div>
              ) : cards.length > 0 ? (
                showAll ? (
                  /* ── Grid view ── */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {cards.map((card, i) => (
                      <div
                        key={card.id}
                        className="rounded-xl border border-border/50 bg-card/60 p-4 flex flex-col gap-2 shadow-sm hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5">
                            #{i + 1}
                          </span>
                          <span className="text-xs text-muted-foreground">Q &amp; A</span>
                        </div>
                        <p className="text-sm font-semibold text-foreground leading-snug">
                          {card.question}
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/30 pt-2 mt-1">
                          {card.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* ── Single flip-card view ── */
                  <div className="flex flex-col items-center gap-6">
                    <FlipCard
                      key={cards[currentIndex].id}
                      card={cards[currentIndex]}
                      index={currentIndex}
                      total={cards.length}
                    />

                    {/* Navigation */}
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={prev}
                        disabled={currentIndex === 0}
                        className="gap-1.5"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Prev
                      </Button>

                      {/* Dot indicators (max 20) */}
                      <div className="flex gap-1.5 flex-wrap justify-center max-w-xs">
                        {cards.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentIndex(i)}
                            className={`w-2 h-2 rounded-full transition-all duration-200 ${
                              i === currentIndex
                                ? "bg-primary scale-125"
                                : "bg-muted-foreground/30 hover:bg-muted-foreground/60"
                            }`}
                          />
                        ))}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={next}
                        disabled={currentIndex === cards.length - 1}
                        className="gap-1.5"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full max-w-xl">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>{Math.round(((currentIndex + 1) / cards.length) * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-300"
                          style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              ) : (
                /* ── Empty state ── */
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center text-muted-foreground select-none">
                  <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center">
                    <Layers className="w-8 h-8 opacity-40" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">No flash cards yet</p>
                    <p className="text-xs mt-1">
                      Enter a topic or paste notes on the left and click{" "}
                      <strong>Generate Cards</strong>
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
            to use the Flash Card feature.
          </p>
        )}
      </div>
    </div>
  );
};

export default FlashCardPage;
