**CS 298 - Bao H. Nguyen - Gen AI Project**

A unified chat interface for interacting with multiple AI providers: OpenAI GPT, Google Gemini, and Perplexity.

---

## ✨ Features

- **Multi-Provider Support**: Switch seamlessly between OpenAI, Gemini, and Perplexity
- **OpenAI GPT-5.1**: Advanced reasoning, scenario analysis, and business logic
- **Google Gemini**: Document analysis and multimodal understanding
- **Perplexity**: Real-time search with source citations
- **Modern UI**: Built with React, TypeScript, and Tailwind CSS
- **Responsive Design**: Works on desktop and mobile devices

---

## 🛠️ Technologies Used

- **Vite** - Fast build tool and development server
- **TypeScript** - Type-safe JavaScript
- **React** - UI framework
- **shadcn/ui** - Beautiful, accessible component library
- **Tailwind CSS** - Utility-first CSS framework

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Clone the repository:**
   ```sh
   git clone <YOUR_GIT_URL>
   cd ai-chat-hub
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Configure API keys:**
   
   Create a `.env` file in the root directory and add your API keys:
   ```env
  VITE_API_BASE_URL=http://localhost:3000
   ```

4. **Start the development server:**
   ```sh
   npm run dev
   ```

The application will be available at `http://localhost:5173`

---

## 💡 Usage

### OpenAI Provider
**Best for:** Logical reasoning, business analysis, and scenario planning

**Try prompts like:**
- "Analyze whether my business idea is logically viable and list the risks."
- "Predict how customer behavior will change if we increase pricing by 10%."
- "Explain the reasoning steps behind choosing Strategy A vs Strategy B for my startup."

---

### Gemini Provider
**Best for:** Document analysis and content review

**Try prompts like:**
- "Analyze this business requirement document and identify missing details."
- "Compare these two business policy documents and list their differences."
- "Review this product specification and summarize the key technical needs."

---

### Perplexity Provider
**Best for:** Research with verified sources

**Try prompts like:**
- "Find the latest market statistics for the U.S. e-commerce industry and cite sources."
- "Retrieve facts about startup failure rates and show where each statistic comes from."
- "Search for current regulations affecting cross-border shipping businesses."

---

## 📦 Building for Production

```sh
npm run build
```

The production-ready files will be in the `dist` directory.


