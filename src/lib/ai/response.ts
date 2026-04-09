import { AIResponse } from "@/types/ai";

export function parseAIResponse(rawText: string): AIResponse {
  try {
    let trimmed = rawText.trim();

    // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    const codeBlockRegex = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;
    const match = trimmed.match(codeBlockRegex);
    if (match) {
      trimmed = match[1].trim();
    }

    if (!trimmed.startsWith("{")) {
      console.warn("AI returned non-JSON response, wrapping as respond action");
      return {
        action: "respond",
        message: trimmed,
      };
    }

    const parsed = JSON.parse(trimmed);

    if (!parsed.action) {
      console.warn("AI response missing action field, defaulting to respond");
      return {
        action: "respond",
        message: typeof parsed === "string" ? parsed : JSON.stringify(parsed),
      };
    }

    // Check if this is a 'respond' action with nested JSON code block
    if (
      parsed.action === "respond" &&
      parsed.message &&
      typeof parsed.message === "string"
    ) {
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
              "Detected nested JSON in respond message, extracting actual response",
            );
            validateResponse(nestedParsed);
            return nestedParsed as AIResponse;
          }
        } catch (nestedError) {
          // If nested parsing fails, continue with original response
          console.warn(
            "Found code block in message but failed to parse as JSON:",
            nestedError,
          );
        }
      }
    }

    // Validate the response structure
    validateResponse(parsed);

    return parsed as AIResponse;
  } catch (error) {
    console.error("Failed to parse AI response:", error);
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
