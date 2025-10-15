import { tool } from "ai";
import { z } from "zod";
import { tavily } from "@tavily/core";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

if (!TAVILY_API_KEY) {
  console.warn("⚠️  TAVILY_API_KEY not set - web search tool will not be available");
}

const PROGRAMMING_KEYWORDS = [
  "code",
  "coding",
  "programming",
  "developer",
  "software",
  "javascript",
  "typescript",
  "python",
  "java",
  "go",
  "rust",
  "php",
  "ruby",
  "c++",
  "c#",
  "react",
  "vue",
  "angular",
  "svelte",
  "next.js",
  "nextjs",
  "node.js",
  "nodejs",
  "deno",
  "bun",
  "api",
  "backend",
  "frontend",
  "fullstack",
  "database",
  "sql",
  "nosql",
  "mongodb",
  "postgresql",
  "mysql",
  "redis",
  "docker",
  "kubernetes",
  "git",
  "github",
  "gitlab",
  "deploy",
  "deployment",
  "ci/cd",
  "testing",
  "framework",
  "library",
  "package",
  "npm",
  "yarn",
  "pnpm",
  "webpack",
  "vite",
  "eslint",
  "prettier",
  "algorithm",
  "data structure",
  "web development",
  "mobile development",
  "app development",
  "saas",
  "mvp",
  "startup",
  "tech",
  "technology",
  "ai",
  "machine learning",
  "ml",
  "deep learning",
  "neural network",
  "llm",
  "chatbot",
  "bot",
  "automation",
  "scraping",
  "crawling",
];

function isProgrammingRelated(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return PROGRAMMING_KEYWORDS.some((keyword) => lowerQuery.includes(keyword));
}

export function createWebSearchTool() {
  if (!TAVILY_API_KEY) {
    return null;
  }

  const tavilyClient = tavily({ apiKey: TAVILY_API_KEY });

  return tool({
    description:
      "OBRIGATÓRIO: Use esta tool quando o usuário perguntar sobre 'novidades', 'o que há de novo', 'últimas atualizações', 'lançamentos recentes', 'notícias' sobre tecnologia e programação. Exemplos: 'o que há de novo no Next.js?', 'novidades do React 19', 'últimas features do TypeScript', 'o que aconteceu com o Bun recentemente?'",
    parameters: z.object({
      query: z
        .string()
        .min(1)
        .max(100)
        .describe(
          "A query de busca sobre programação ou tecnologia. Exemplo: 'novidades next.js 15', 'atualizações react 19'"
        ),
    }),
    execute: async ({ query }) => {
      console.log(`🔍 Web search tool called with query: "${query}"`);

      if (!isProgrammingRelated(query)) {
        console.log(`❌ Query rejected - not programming related: "${query}"`);
        return {
          success: false,
          message:
            "This search query doesn't appear to be related to programming or technology. Please ask about programming, software development, or tech-related topics.",
          results: [],
        };
      }

      try {
        const response = await tavilyClient.search(query, {
          maxResults: 5,
          searchDepth: "basic",
          includeAnswer: true,
        });

        console.log(`✅ Found ${response.results.length} results for: "${query}"`);

        return {
          success: true,
          query,
          answer: response.answer || null,
          results: response.results.map((result) => ({
            title: result.title,
            url: result.url,
            content: result.content.slice(0, 500),
            score: result.score,
          })),
        };
      } catch (error) {
        console.error("❌ Web search error:", error);
        return {
          success: false,
          message: "Failed to perform web search. Please try again later.",
          results: [],
        };
      }
    },
  });
}
