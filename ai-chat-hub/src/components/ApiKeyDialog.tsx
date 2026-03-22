import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: "openai" | "gemini" | "perplexity";
  onSave: (apiKey: string) => void;
}

export const ApiKeyDialog = ({
  open,
  onOpenChange,
  provider,
  onSave,
}: ApiKeyDialogProps) => {
  const [apiKey, setApiKey] = useState("");

  const providerInfo = {
    openai: {
      name: "OpenAI",
      description: "Get your API key from platform.openai.com",
      placeholder: "sk-...",
    },
    gemini: {
      name: "Google Gemini",
      description: "Get your API key from aistudio.google.com",
      placeholder: "AIza...",
    },
    perplexity: {
      name: "Perplexity",
      description: "Get your API key from perplexity.ai",
      placeholder: "pplx-...",
    },
  };

  const info = providerInfo[provider];

  const handleSave = () => {
    if (apiKey.trim()) {
      onSave(apiKey.trim());
      setApiKey("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{info.name} API Key</DialogTitle>
          <DialogDescription>{info.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder={info.placeholder}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <Button onClick={handleSave} className="w-full">
            Save API Key
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
