import { tool } from "ai";
import { z } from "zod";

const CONTEXT7_API_KEY = process.env.CONTEXT7_API_KEY;
const CONTEXT7_BASE_URL = "https://context7.com/api/v1";

interface ResolveLibraryResponse {
  libraries: Array<{
    id: string;
    name: string;
    description: string;
    trustScore: number;
    snippetCount: number;
  }>;
}

interface GetDocsResponse {
  documentation: string;
  snippets: Array<{
    code: string;
    language: string;
    description?: string;
  }>;
}

async function resolveLibraryId(
  libraryName: string
): Promise<string | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (CONTEXT7_API_KEY) {
      headers["Authorization"] = `Bearer ${CONTEXT7_API_KEY}`;
    }

    const response = await fetch(
      `${CONTEXT7_BASE_URL}/resolve?name=${encodeURIComponent(libraryName)}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      console.error(
        `Failed to resolve library: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = (await response.json()) as ResolveLibraryResponse;

    if (data.libraries && data.libraries.length > 0) {
      return data.libraries[0]?.id ?? null;
    }

    return null;
  } catch (error) {
    console.error("Error resolving library ID:", error);
    return null;
  }
}

async function getLibraryDocs(
  libraryId: string,
  topic?: string
): Promise<GetDocsResponse | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (CONTEXT7_API_KEY) {
      headers["Authorization"] = `Bearer ${CONTEXT7_API_KEY}`;
    }

    const url = new URL(`${CONTEXT7_BASE_URL}/docs/${libraryId}`);
    if (topic) {
      url.searchParams.set("topic", topic);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      console.error(
        `Failed to get library docs: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = (await response.json()) as GetDocsResponse;
    return data;
  } catch (error) {
    console.error("Error getting library docs:", error);
    return null;
  }
}

export function createContext7SearchTool() {
  return tool({
    description:
      "Search for up-to-date documentation and code examples for programming libraries and frameworks. Use this when the user asks about how to use a specific library, framework, API, or programming tool. Examples: 'How to use React hooks?', 'NextJS routing examples', 'Prisma query syntax'.",
    parameters: z.object({
      libraryName: z
        .string()
        .min(1)
        .max(100)
        .describe(
          "The name of the library or framework to search documentation for (e.g., 'react', 'next.js', 'prisma', 'typescript')"
        ),
      topic: z
        .string()
        .optional()
        .describe(
          "Specific topic or feature to focus on (e.g., 'hooks', 'routing', 'authentication')"
        ),
    }),
    execute: async ({ libraryName, topic }) => {
      console.log(
        `📚 Context7 search tool called for: "${libraryName}"${topic ? ` (topic: ${topic})` : ""}`
      );

      const libraryId = await resolveLibraryId(libraryName);

      if (!libraryId) {
        console.log(`❌ Library not found: "${libraryName}"`);
        return {
          success: false,
          message: `Could not find documentation for "${libraryName}". Please check the library name and try again.`,
          documentation: null,
          snippets: [],
        };
      }

      console.log(`✅ Resolved library ID: ${libraryId}`);

      const docs = await getLibraryDocs(libraryId, topic);

      if (!docs) {
        console.log(`❌ Failed to fetch docs for library ID: ${libraryId}`);
        return {
          success: false,
          message: `Failed to fetch documentation for "${libraryName}". Please try again later.`,
          documentation: null,
          snippets: [],
        };
      }

      console.log(
        `✅ Retrieved documentation for "${libraryName}" with ${docs.snippets?.length || 0} code snippets`
      );

      return {
        success: true,
        libraryName,
        libraryId,
        topic: topic || null,
        documentation: docs.documentation.slice(0, 2000),
        snippets: docs.snippets.slice(0, 3).map((snippet) => ({
          code: snippet.code,
          language: snippet.language,
          description: snippet.description || null,
        })),
      };
    },
  });
}
