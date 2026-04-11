import { AIResponse } from "@/types/ai";

export function parseAIResponse(rawText: string): AIResponse {
  try {
    let trimmed = rawText.trim();

    console.log("[AI Response Parser] Raw response length:", rawText.length);
    console.log(
      "[AI Response Parser] First 200 chars:",
      rawText.substring(0, 200),
    );

    // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;
    const match = trimmed.match(codeBlockRegex);
    if (match) {
      console.log("[AI Response Parser] Stripped markdown code fence");
      trimmed = match[1].trim();
    }

    // Strip any explanatory text before the JSON object
    // Look for the first { and take everything from there
    const firstBraceIndex = trimmed.indexOf("{");
    if (firstBraceIndex > 0) {
      console.log(
        "[AI Response Parser] Found text before JSON, stripping:",
        trimmed.substring(0, firstBraceIndex),
      );
      trimmed = trimmed.substring(firstBraceIndex);
    }

    if (!trimmed.startsWith("{")) {
      console.warn(
        "[AI Response Parser] AI returned non-JSON response, wrapping as respond action",
      );
      return {
        action: "respond",
        message: trimmed,
      };
    }

    const parsed = JSON.parse(trimmed);
    console.log("[AI Response Parser] Parsed action:", parsed.action);

    if (!parsed.action) {
      console.warn(
        "[AI Response Parser] AI response missing action field, defaulting to respond",
      );
      return {
        action: "respond",
        message: typeof parsed === "string" ? parsed : JSON.stringify(parsed),
      };
    }

    // Check if this is a 'respond' action with nested JSON
    if (
      parsed.action === "respond" &&
      parsed.message &&
      typeof parsed.message === "string"
    ) {
      // First, try to find JSON in markdown code blocks
      const nestedJsonMatch = parsed.message.match(
        /```(?:json)?\s*\n?([\s\S]*?)\n?```/,
      );

      if (nestedJsonMatch) {
        try {
          const nestedJson = nestedJsonMatch[1].trim();
          const nestedParsed = JSON.parse(nestedJson);

          // If nested JSON has a valid action field, use it instead
          if (nestedParsed.action && isValidAction(nestedParsed.action)) {
            console.warn(
              "[AI Response Parser] Detected nested JSON in respond message (code block), extracting actual response",
            );
            validateResponse(nestedParsed);
            return nestedParsed as AIResponse;
          }
        } catch (nestedError) {
          console.warn(
            "[AI Response Parser] Found code block in message but failed to parse as JSON:",
            nestedError,
          );
        }
      }

      // Second, try to find raw JSON object in the message (without code blocks)
      const jsonObjectMatch = parsed.message.match(/(\{[\s\S]*\})/);
      if (jsonObjectMatch) {
        try {
          const extractedJson = jsonObjectMatch[1].trim();
          const extractedParsed = JSON.parse(extractedJson);

          // If extracted JSON has a valid action field, use it instead
          if (extractedParsed.action && isValidAction(extractedParsed.action)) {
            console.warn(
              "[AI Response Parser] Detected nested JSON in respond message (raw), extracting actual response",
            );
            validateResponse(extractedParsed);
            return extractedParsed as AIResponse;
          }
        } catch (extractError) {
          console.warn(
            "[AI Response Parser] Found JSON-like content in message but failed to parse:",
            extractError,
          );
        }
      }
    }

    // Validate the response structure
    validateResponse(parsed);

    return parsed as AIResponse;
  } catch (error) {
    console.error("[AI Response Parser] Failed to parse AI response:", error);
    console.error(
      "[AI Response Parser] Raw text was:",
      rawText.substring(0, 500),
    );
    return {
      action: "respond",
      message:
        "I encountered an error processing that request. Please try again.",
    };
  }
}

export function isValidAction(action: string): boolean {
  return [
    "need_context",
    "respond",
    "execute_tools",
    "preview_creation",
    "plan_session",
    "research_required",
  ].includes(action);
}

export function validateResponse(response: AIResponse): void {
  // Validate preview_creation has required fields
  if (response.action === "preview_creation") {
    if (!response.preview) {
      console.warn("preview_creation response missing preview field");
    }
    if (!response.tools || response.tools.length === 0) {
      console.warn("preview_creation response missing tools array");
    }
  }

  // Validate execute_tools has tools array
  if (response.action === "execute_tools") {
    if (!response.tools || response.tools.length === 0) {
      console.warn("execute_tools response missing tools array");
    }
  }

  // Validate plan_session has session_plan
  if (response.action === "plan_session") {
    if (!response.session_plan) {
      console.warn("plan_session response missing session_plan field");
    }
  }

  // Validate research_required has research_query
  if (response.action === "research_required") {
    if (!response.research_query) {
      console.warn("research_required response missing research_query field");
    }
  }
}
