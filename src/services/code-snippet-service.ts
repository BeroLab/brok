export interface CodeBlock {
  language: string;
  code: string;
  fullMatch: string;
}

export interface CodeSnippetImage {
  filename: string;
  buffer: Buffer;
  language: string;
}

export class CodeSnippetService {
  private readonly CARBONARA_API_URL = "https://carbonara.solopov.dev/api/cook";

  extractCodeBlocks(text: string): CodeBlock[] {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks: CodeBlock[] = [];
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      blocks.push({
        language: match[1] || "text",
        code: match[2].trim(),
        fullMatch: match[0],
      });
    }

    return blocks;
  }

  async generateSnippetImage(
    code: string,
    language: string
  ): Promise<Buffer> {
    try {
      const response = await fetch(this.CARBONARA_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          language,
          theme: "one-dark",
          backgroundColor: "#1a1b26",
          paddingVertical: "56px",
          paddingHorizontal: "56px",
          dropShadow: true,
          dropShadowBlurRadius: "68px",
          dropShadowOffsetY: "20px",
          windowControls: true,
          lineNumbers: false,
          firstLineNumber: 1,
          exportSize: "2x",
          widthAdjustment: true,
          fontFamily: "Fira Code",
          fontSize: "14px",
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Carbonara API returned ${response.status}: ${response.statusText}`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log(`✅ Generated ${buffer.length} bytes image for ${language} code`);

      return buffer;
    } catch (error) {
      console.error("Failed to generate code snippet image:", error);
      throw error;
    }
  }

  async processCodeBlocks(text: string): Promise<{
    cleanedText: string;
    snippetImages: CodeSnippetImage[];
  }> {
    const codeBlocks = this.extractCodeBlocks(text);

    if (codeBlocks.length === 0) {
      return {
        cleanedText: text,
        snippetImages: [],
      };
    }

    const snippetImages: CodeSnippetImage[] = [];
    let cleanedText = text;

    for (let i = 0; i < codeBlocks.length; i++) {
      const block = codeBlocks[i];

      try {
        const buffer = await this.generateSnippetImage(
          block.code,
          block.language
        );

        snippetImages.push({
          filename: `snippet-${i + 1}.png`,
          buffer,
          language: block.language,
        });

        cleanedText = cleanedText.replace(
          block.fullMatch,
          `[Código ${block.language} - ver imagem anexada]`
        );

        console.log(`✅ Generated snippet image for ${block.language} code`);
      } catch (error) {
        console.error(
          `Failed to generate image for code block ${i + 1}:`,
          error
        );
      }
    }

    return {
      cleanedText,
      snippetImages,
    };
  }
}
