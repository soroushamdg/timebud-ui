"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, RotateCcw, Coins, X, AlertCircle } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { ProviderErrorBanner } from "@/components/chat/ProviderErrorBanner";
import { QuickActionSheet } from "@/components/chat/QuickActionSheet";
import { UndoToast } from "@/components/chat/UndoToast";
import { AppShell } from "@/components/layout/AppShell";
import { ChatAPIRequest, ChatAPIResponse } from "@/types/ai";
import { useCurrentUser } from "@/hooks/useAuth";
import { useTotalCredits } from "@/hooks/useCredits";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function ChatPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const { total, isLow, isLoading: creditsLoading } = useTotalCredits();
  const {
    messages,
    isLoading,
    addUserMessage,
    addAssistantMessage,
    addStatusMessage,
    setLoading,
    pinMessage,
    unpinMessage,
    clearHistory,
    clearConfirmationPayload,
  } = useChatStore();

  const [error, setError] = useState<{ code: string; message: string } | null>(
    null,
  );
  const [loadingMessage, setLoadingMessage] = useState("AI is thinking...");
  const [quickActionMessageId, setQuickActionMessageId] = useState<
    string | null
  >(null);
  const [undoAction, setUndoAction] = useState<{
    visible: boolean;
    message: string;
    tools: any[];
  } | null>(null);
  const [lowCreditBannerDismissed, setLowCreditBannerDismissed] =
    useState(false);
  const [lastCreditsDeducted, setLastCreditsDeducted] = useState<number | null>(
    null,
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (content: string, files?: any[]) => {
    if (!content.trim() && !files?.length) return;

    setError(null);
    addUserMessage(content, files);
    setLoading(true);
    setLoadingMessage("AI is thinking...");

    try {
      const conversationMessages = messages.map((msg) => ({
        role: msg.role === "system" ? "user" : msg.role,
        content: msg.content,
      }));

      conversationMessages.push({
        role: "user",
        content,
      });

      const requestBody: ChatAPIRequest = {
        messages: conversationMessages,
        files: files?.map((f) => ({
          mimeType: f.mimeType,
          base64: f.base64,
          filename: f.filename,
          url: f.url,
        })),
        complexity: "complex",
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data: ChatAPIResponse = await response.json();

      if (!data.success) {
        if (data.error?.code === "insufficient_credits") {
          const creditsNeeded = (data.error as any).required || 20;
          addAssistantMessage(
            `You've used all your credits for this session. This action requires ${creditsNeeded} credits.`,
            undefined,
            undefined,
            undefined,
          );
          setLoading(false);
          return;
        }
        setError(data.error!);
        setLoading(false);
        return;
      }

      if (data.credits) {
        queryClient.invalidateQueries({ queryKey: ["credits"] });
        setLastCreditsDeducted(data.credits.deducted);
      }

      if (data.contextLoaded && data.contextLoaded.length > 0) {
        for (const ctx of data.contextLoaded) {
          addStatusMessage(`Loaded ${ctx.projectName} details`, "success");
        }
      }

      if (data.toolsExecuted && data.toolsExecuted.length > 0) {
        for (const tool of data.toolsExecuted) {
          addStatusMessage(
            tool.success ? `✓ ${tool.summary}` : `✗ ${tool.summary}`,
            tool.success ? "success" : "error",
          );
        }

        const hasDestructive = data.toolsExecuted.some(
          (t) => t.tool.includes("delete") || t.tool.includes("remove"),
        );
        if (!hasDestructive && data.toolsExecuted.length > 0) {
          setUndoAction({
            visible: true,
            message: `${data.toolsExecuted.length} action(s) completed`,
            tools: data.response?.tools || [],
          });
        }
      }

      const aiResponse = data.response!;
      console.log("AI Response:", aiResponse);

      if (aiResponse.action === "respond") {
        const messageContent = aiResponse.message || "";
        const metadata = aiResponse.metadata || {};
        if (lastCreditsDeducted) {
          metadata.creditsUsed = lastCreditsDeducted;
        }
        addAssistantMessage(messageContent, aiResponse.suggestions, metadata);
        setLastCreditsDeducted(null);
      } else if (
        aiResponse.action === "execute_tools" &&
        aiResponse.requiresConfirmation
      ) {
        const confirmationType = aiResponse.tools?.some((t) =>
          t.name.includes("delete"),
        )
          ? "delete"
          : "generic";

        addAssistantMessage(
          aiResponse.message || "",
          undefined,
          aiResponse.metadata,
          {
            type: confirmationType,
            tools: aiResponse.tools || [],
            confirmationSummary:
              aiResponse.confirmationSummary || "Confirm this action?",
          },
        );
      } else if (
        aiResponse.action === "execute_tools" &&
        !aiResponse.requiresConfirmation
      ) {
        // Tools were auto-executed, show the message
        const messageContent = aiResponse.message || "";
        const metadata = aiResponse.metadata || {};
        if (lastCreditsDeducted) {
          metadata.creditsUsed = lastCreditsDeducted;
        }
        addAssistantMessage(messageContent, aiResponse.suggestions, metadata);
        setLastCreditsDeducted(null);
      } else if (aiResponse.action === "preview_creation") {
        addAssistantMessage(
          aiResponse.message || "",
          undefined,
          aiResponse.metadata,
          {
            type: "project_preview",
            tools: aiResponse.tools || [],
            confirmationSummary: aiResponse.message || "Review and confirm",
            preview: aiResponse.preview,
          },
        );
      }

      setLoading(false);
    } catch (err: any) {
      console.error("Chat error:", err);
      setError({
        code: "network_error",
        message:
          "Failed to connect to AI. Please check your connection and try again.",
      });
      setLoading(false);
    }
  };

  const handleConfirm = async (tools: any[]) => {
    // Find the message with confirmation payload to clear it later
    const confirmationMessage = messages.find((m) => m.confirmationPayload);

    setLoading(true);
    setLoadingMessage("Executing...");

    try {
      console.log("Confirming tools:", tools);

      const response = await fetch("/api/chat/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tools, confirmed: true }),
      });

      const data = await response.json();
      console.log("Confirm response:", data);

      if (!data.success) {
        console.error("Confirmation failed:", data.error);
        setError(
          data.error || {
            code: "unknown",
            message: "Failed to execute action",
          },
        );
        setLoading(false);
        return;
      }

      if (data.toolsExecuted) {
        // Clear the confirmation payload from the message
        if (confirmationMessage) {
          clearConfirmationPayload(confirmationMessage.id);
        }

        // Add status messages for each executed tool
        for (const tool of data.toolsExecuted) {
          addStatusMessage(
            tool.success ? `✓ ${tool.summary}` : `✗ ${tool.summary}`,
            tool.success ? "success" : "error",
          );
        }
      } else {
        console.warn("No tools executed in response");
      }

      setLoading(false);
    } catch (err) {
      console.error("Confirm error:", err);
      setError({
        code: "network_error",
        message: "Failed to execute action",
      });
      setLoading(false);
    }
  };

  const handleCancel = () => {
    addStatusMessage("Action cancelled", "success");
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const handleLongPress = (messageId: string) => {
    setQuickActionMessageId(messageId);
  };

  const handleCopyMessage = () => {
    const message = messages.find((m) => m.id === quickActionMessageId);
    if (message) {
      navigator.clipboard.writeText(message.content);
    }
  };

  const handleRetryMessage = () => {
    const message = messages.find((m) => m.id === quickActionMessageId);
    if (message) {
      handleSendMessage(message.content);
    }
  };

  const handleExplainMore = () => {
    const message = messages.find((m) => m.id === quickActionMessageId);
    if (message) {
      handleSendMessage(
        `Can you explain more about: "${message.content.substring(0, 100)}..."`,
      );
    }
  };

  const handlePinToggle = () => {
    const message = messages.find((m) => m.id === quickActionMessageId);
    if (message) {
      if (message.isPinned) {
        unpinMessage(message.id);
      } else {
        pinMessage(message.id);
      }
    }
  };

  const handleUndo = async () => {
    console.log("Undo action");
  };

  const handleClearChat = () => {
    if (messages.length === 0) return;

    if (confirm("Clear all chat history? This cannot be undone.")) {
      clearHistory();
      setError(null);
      setUndoAction(null);
      setQuickActionMessageId(null);
    }
  };

  const getEmptyStateSuggestions = () => {
    const hour = new Date().getHours();
    const timeBasedSuggestion =
      hour < 12
        ? "Plan my day"
        : hour < 17
        ? "Review my progress"
        : "Summarize completed tasks";

    return [
      timeBasedSuggestion,
      "Show my active projects",
      "Create a new project",
      "What tasks are due soon?",
    ];
  };

  const pinnedMessages = messages.filter((m) => m.isPinned);
  const regularMessages = messages.filter((m) => !m.isPinned);

  return (
    <AppShell showTabBar={true}>
      <div className="flex flex-col h-[calc(100vh-6rem)] bg-bg-primary">
        <div className="flex items-center justify-between p-4 border-b border-border-card flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-accent-yellow" />
            <h1 className="text-white font-bold text-xl">AI Assistant</h1>
          </div>
          <div className="flex items-center gap-2">
            {creditsLoading ? (
              <div className="h-6 w-16 bg-border-card rounded animate-pulse"></div>
            ) : (
              <button
                onClick={() => router.push("/credits")}
                className={`flex items-center gap-1 px-2 py-1 rounded ${
                  isLow ? "text-accent-yellow" : "text-text-sec"
                } hover:bg-bg-card transition-colors`}
              >
                {isLow && <AlertCircle className="w-3 h-3" />}
                <span className="text-sm font-medium">{total} cr</span>
              </button>
            )}
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="text-text-sec hover:text-white transition-colors p-2"
                title="Clear chat"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Low credit warning banner */}
        {isLow && !lowCreditBannerDismissed && !creditsLoading && (
          <div className="bg-accent-yellow/10 border-b border-accent-yellow/30 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-accent-yellow flex-shrink-0" />
              <p className="text-accent-yellow text-sm">
                <span className="font-medium">{total} credits remaining</span> ·
                <button
                  onClick={() => router.push("/credits")}
                  className="underline ml-1 hover:opacity-80"
                >
                  Top up
                </button>
              </p>
            </div>
            <button
              onClick={() => setLowCreditBannerDismissed(true)}
              className="text-accent-yellow hover:opacity-80"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <Sparkles className="w-16 h-16 text-accent-yellow mb-4" />
              <h2 className="text-white text-2xl font-bold mb-2">
                Hi {(user as any)?.first_name || "there"}!
              </h2>
              <p className="text-text-sec mb-6">
                I'm your AI assistant. Ask me anything about your projects and
                tasks.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {getEmptyStateSuggestions().map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(suggestion)}
                    className="bg-bg-card border border-border-card text-white px-4 py-2 rounded-full hover:bg-bg-card-hover transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {pinnedMessages.length > 0 && (
                <div className="mb-4 pb-4 border-b border-border-card">
                  {pinnedMessages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      onSuggestionClick={handleSuggestionClick}
                      onConfirm={handleConfirm}
                      onCancel={handleCancel}
                      onLongPress={handleLongPress}
                    />
                  ))}
                </div>
              )}

              {regularMessages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onSuggestionClick={handleSuggestionClick}
                  onConfirm={handleConfirm}
                  onCancel={handleCancel}
                  onLongPress={handleLongPress}
                />
              ))}

              {error && (
                <ProviderErrorBanner
                  errorCode={error.code}
                  errorMessage={error.message}
                  onRetry={() => {
                    setError(null);
                    const lastUserMessage = messages
                      .filter((m) => m.role === "user")
                      .pop();
                    if (lastUserMessage) {
                      handleSendMessage(lastUserMessage.content);
                    }
                  }}
                />
              )}

              {isLoading && <TypingIndicator message={loadingMessage} />}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <ChatInput
          onSend={handleSendMessage}
          disabled={isLoading}
          placeholder="Ask me anything..."
        />

        <QuickActionSheet
          isOpen={quickActionMessageId !== null}
          onClose={() => setQuickActionMessageId(null)}
          onCopy={handleCopyMessage}
          onRetry={handleRetryMessage}
          onExplainMore={handleExplainMore}
          onPin={handlePinToggle}
          isPinned={
            messages.find((m) => m.id === quickActionMessageId)?.isPinned ||
            false
          }
        />

        {undoAction && (
          <UndoToast
            isVisible={undoAction.visible}
            message={undoAction.message}
            onUndo={handleUndo}
            onDismiss={() => setUndoAction(null)}
          />
        )}
      </div>
    </AppShell>
  );
}
