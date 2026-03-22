import { useState, useEffect, useRef } from "react";
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
  GitBranch,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
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

interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const NODE_W = 160;
const NODE_H = 44;
const H_GAP = 60;   // horizontal gap between levels
const V_GAP = 18;   // vertical gap between sibling nodes

// ─── Layout engine ────────────────────────────────────────────────────────────

interface LayoutNode {
  node: MindMapNode;
  x: number;
  y: number;
  depth: number;
  children: LayoutNode[];
}

function layoutTree(node: MindMapNode, depth = 0): LayoutNode {
  const children = (node.children || []).map((c) => layoutTree(c, depth + 1));
  return { node, x: 0, y: 0, depth, children };
}

function assignY(ln: LayoutNode): number {
  if (ln.children.length === 0) {
    ln.y = 0;
    return NODE_H;
  }
  let cursor = 0;
  const childHeights: number[] = ln.children.map((c) => {
    const h = assignY(c);
    c.y = cursor + h / 2 - NODE_H / 2;
    cursor += h + V_GAP;
    return h;
  });
  cursor -= V_GAP;
  ln.y = cursor / 2 - NODE_H / 2;
  // shift children so that the group is centred around ln.y
  const groupCenter = ln.children.reduce((s, c) => s + c.y + NODE_H / 2, 0) / ln.children.length;
  const shift = (ln.y + NODE_H / 2) - groupCenter;
  const shiftAll = (n: LayoutNode, dy: number) => {
    n.y += dy;
    n.children.forEach((c) => shiftAll(c, dy));
  };
  ln.children.forEach((c) => shiftAll(c, shift));
  return cursor;
}

function assignX(ln: LayoutNode, x = 0) {
  ln.x = x;
  ln.children.forEach((c) => assignX(c, x + NODE_W + H_GAP));
}

function flattenLayout(ln: LayoutNode): LayoutNode[] {
  return [ln, ...ln.children.flatMap(flattenLayout)];
}

function buildLayout(root: MindMapNode) {
  const tree = layoutTree(root);
  assignY(tree);
  // normalise so min-y = 20
  const nodes = flattenLayout(tree);
  const minY = Math.min(...nodes.map((n) => n.y));
  nodes.forEach((n) => (n.y -= minY - 20));
  assignX(tree, 20);
  return { tree, nodes };
}

// ─── SVG edges ────────────────────────────────────────────────────────────────

function Edges({ tree }: { tree: LayoutNode }) {
  const paths: string[] = [];
  const visit = (ln: LayoutNode) => {
    ln.children.forEach((child) => {
      const x1 = ln.x + NODE_W;
      const y1 = ln.y + NODE_H / 2;
      const x2 = child.x;
      const y2 = child.y + NODE_H / 2;
      const mx = (x1 + x2) / 2;
      paths.push(`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
      visit(child);
    });
  };
  visit(tree);
  return (
    <>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="hsl(var(--border))" strokeWidth={1.5} />
      ))}
    </>
  );
}

// ─── Depth colours ────────────────────────────────────────────────────────────

const DEPTH_COLORS = [
  "hsl(var(--primary))",
  "hsl(221,83%,53%)",   // blue
  "hsl(142,71%,45%)",   // green
  "hsl(38,92%,50%)",    // amber
  "hsl(262,83%,58%)",   // violet
  "hsl(336,80%,57%)",   // pink
];

function depthColor(depth: number) {
  return DEPTH_COLORS[depth % DEPTH_COLORS.length];
}

// ─── SVG node ─────────────────────────────────────────────────────────────────

function NodeRect({ ln }: { ln: LayoutNode }) {
  const color = depthColor(ln.depth);
  const isRoot = ln.depth === 0;
  return (
    <g>
      <rect
        x={ln.x}
        y={ln.y}
        width={NODE_W}
        height={NODE_H}
        rx={isRoot ? 12 : 8}
        fill={isRoot ? color : "hsl(var(--card))"}
        stroke={color}
        strokeWidth={isRoot ? 0 : 1.5}
        filter={isRoot ? "url(#shadow)" : undefined}
      />
      <foreignObject x={ln.x + 6} y={ln.y} width={NODE_W - 12} height={NODE_H}>
        <div
          style={{
            height: NODE_H,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: isRoot ? 13 : 11,
            fontWeight: isRoot ? 700 : 500,
            color: isRoot ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
            textAlign: "center",
            lineHeight: 1.2,
            overflow: "hidden",
            padding: "2px 4px",
          }}
        >
          {ln.node.label}
        </div>
      </foreignObject>
    </g>
  );
}

// ─── Full SVG canvas ──────────────────────────────────────────────────────────

function MindMapCanvas({ root }: { root: MindMapNode }) {
  const { tree, nodes } = buildLayout(root);
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);

  const maxX = Math.max(...nodes.map((n) => n.x + NODE_W)) + 20;
  const maxY = Math.max(...nodes.map((n) => n.y + NODE_H)) + 20;
  const vw = maxX * zoom;
  const vh = maxY * zoom;

  const handleDownload = () => {
    // Resolve a CSS custom property to an actual RGB color string
    const resolveVar = (cssVar: string): string => {
      const tmp = document.createElement("div");
      tmp.style.cssText = `position:absolute;visibility:hidden;color:hsl(var(${cssVar}))`;
      document.body.appendChild(tmp);
      const color = getComputedStyle(tmp).color; // "rgb(r, g, b)"
      tmp.remove();
      return color;
    };

    const primaryColor   = resolveVar("--primary");
    const cardColor      = resolveVar("--card");
    const borderColor    = resolveVar("--border");
    const foregroundColor = resolveVar("--foreground");
    const primaryFgColor = resolveVar("--primary-foreground");

    const resolvedDepthColors = [
      primaryColor,
      "hsl(221,83%,53%)",
      "hsl(142,71%,45%)",
      "hsl(38,92%,50%)",
      "hsl(262,83%,58%)",
      "hsl(336,80%,57%)",
    ];

    const escXml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    // Build edge paths
    const edgeParts: string[] = [];
    const visitEdges = (ln: LayoutNode) => {
      ln.children.forEach((child) => {
        const x1 = ln.x + NODE_W, y1 = ln.y + NODE_H / 2;
        const x2 = child.x,       y2 = child.y + NODE_H / 2;
        const mx = (x1 + x2) / 2;
        edgeParts.push(
          `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" fill="none" stroke="${borderColor}" stroke-width="1.5"/>`
        );
        visitEdges(child);
      });
    };
    visitEdges(tree);

    // Build node elements using <text> instead of <foreignObject>
    const nodeParts = nodes.map((ln) => {
      const color     = resolvedDepthColors[ln.depth % resolvedDepthColors.length];
      const isRoot    = ln.depth === 0;
      const fill      = isRoot ? color : cardColor;
      const textColor = isRoot ? primaryFgColor : foregroundColor;
      const fontSize  = isRoot ? 13 : 11;
      const fontWeight = isRoot ? 700 : 500;
      const rx        = isRoot ? 12 : 8;

      const cx = ln.x + NODE_W / 2;
      const cy = ln.y + NODE_H / 2;

      // Simple word-wrap
      const words    = ln.node.label.split(" ");
      const maxChars = Math.floor((NODE_W - 16) / (fontSize * 0.6));
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const candidate = cur ? `${cur} ${w}` : w;
        if (candidate.length <= maxChars) {
          cur = candidate;
        } else {
          if (cur) lines.push(cur);
          cur = w;
        }
      }
      if (cur) lines.push(cur);

      const lh     = fontSize * 1.35;
      const startY = cy - (lines.length * lh) / 2 + lh * 0.8;

      const tspans = lines
        .map((line, i) => `<tspan x="${cx}" y="${(startY + i * lh).toFixed(1)}">${escXml(line)}</tspan>`)
        .join("");

      return (
        `<g>` +
        `<rect x="${ln.x}" y="${ln.y}" width="${NODE_W}" height="${NODE_H}" rx="${rx}" ` +
        `fill="${fill}" stroke="${color}" stroke-width="${isRoot ? 0 : 1.5}"/>` +
        `<text font-family="system-ui,-apple-system,sans-serif" font-size="${fontSize}" ` +
        `font-weight="${fontWeight}" fill="${textColor}" text-anchor="middle">${tspans}</text>` +
        `</g>`
      );
    });

    const svgStr = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${maxY}" viewBox="0 0 ${maxX} ${maxY}">`,
      `<rect width="${maxX}" height="${maxY}" fill="white"/>`,
      ...edgeParts,
      ...nodeParts,
      `</svg>`,
    ].join("\n");

    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "mindmap.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-card/50">
        <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.min(z + 0.1, 2))} className="h-7 w-7 p-0">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.max(z - 0.1, 0.3))} className="h-7 w-7 p-0">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setZoom(1)} className="h-7 px-2 text-xs">
          <Maximize2 className="w-3.5 h-3.5 mr-1" />
          Reset
        </Button>
        <span className="text-xs text-muted-foreground ml-1">{Math.round(zoom * 100)}%</span>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={handleDownload} className="h-7 px-2 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary">
          <Download className="w-3.5 h-3.5" />
          Export SVG
        </Button>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto bg-muted/10 rounded-b-2xl">
        <svg
          ref={svgRef}
          width={vw}
          height={vh}
          viewBox={`0 0 ${maxX} ${maxY}`}
          style={{ display: "block", minWidth: "100%" }}
        >
          <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
            </filter>
          </defs>
          <Edges tree={tree} />
          {nodes.map((ln) => (
            <NodeRect key={ln.node.id} ln={ln} />
          ))}
        </svg>
      </div>
    </div>
  );
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

const MINDMAP_PROMPT = `You are a mind map generator. Given the user's notes or topic, produce a hierarchical mind map in strict JSON format.

Rules:
- Root node = main topic.
- Each node has "id" (unique string), "label" (short, max 5 words), and optional "children" array.
- Maximum depth: 3 levels (root → branches → leaves).
- Maximum children per node: 6.
- No markdown fences, no extra text — return ONLY the raw JSON object.

Example output:
{"id":"root","label":"Main Topic","children":[{"id":"b1","label":"Branch 1","children":[{"id":"l1","label":"Leaf 1"},{"id":"l2","label":"Leaf 2"}]},{"id":"b2","label":"Branch 2"}]}

Now generate a mind map for the following input:
`;

// ─── Page ─────────────────────────────────────────────────────────────────────

const MindMapPage = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { navigateTo } = useRouter();

  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<Provider>("openai");
  const [mindMapRoot, setMindMapRoot] = useState<MindMapNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    setMindMapRoot(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: MINDMAP_PROMPT + input.trim(),
          provider,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error || "Failed to generate mind map.");
      }

      const data = await response.json();
      const raw: string = data.message || data.content || "";

      // Strip possible markdown code fences
      const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
      const parsed: MindMapNode = JSON.parse(cleaned);
      setMindMapRoot(parsed);
      toast.success("Mind map generated!");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message?.includes("JSON") ? "AI returned invalid format. Try again." : error.message || "Failed to generate mind map.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setInput("");
    setMindMapRoot(null);
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
                  <GitBranch className="w-6 h-6 text-primary" />
                  Mind Map Generator
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Turn your notes or topic into a visual mind map powered by AI
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
                {input.length > 0 ? `${input.length} characters` : "Describe or paste your notes"}
              </span>
            </div>

            <div className="flex-1 p-5 flex flex-col gap-4">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`e.g. "Machine Learning basics"\n\nor paste a paragraph of notes and the AI will extract the structure for you.`}
                className="flex-1 min-h-[280px] resize-none text-sm border-border/40 focus:border-primary/50 bg-background/50 rounded-xl"
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

              {/* Tips */}
              <div className="rounded-xl bg-muted/40 border border-border/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">💡 Tips</p>
                <p>• Short topic: <span className="italic">"Project Management"</span></p>
                <p>• Full notes → AI extracts the structure</p>
                <p>• Export your map as SVG after generation</p>
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
                      Generate Mind Map
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleClear}
                  variant="outline"
                  disabled={!input && !mindMapRoot}
                  className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* ── Output panel ─────────────────────────────────────────────── */}
          <div className="bg-card/30 backdrop-blur-xl rounded-2xl border border-border/50 shadow-xl flex flex-col overflow-hidden min-h-[520px]">
            <div className="px-5 py-4 border-b border-border/50 bg-card/50 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-base">Mind Map</h2>
              {mindMapRoot && (
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  — {mindMapRoot.label}
                </span>
              )}
            </div>

            <div className="flex-1">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm">Building your mind map…</p>
                </div>
              ) : mindMapRoot ? (
                <MindMapCanvas root={mindMapRoot} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center text-muted-foreground select-none p-8">
                  <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center">
                    <GitBranch className="w-8 h-8 opacity-40" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">No mind map yet</p>
                    <p className="text-xs mt-1">
                      Enter a topic or paste notes on the left and click{" "}
                      <strong>Generate Mind Map</strong>
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
            to use the Mind Map feature.
          </p>
        )}
      </div>
    </div>
  );
};

export default MindMapPage;
