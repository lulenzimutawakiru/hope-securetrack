/** SecureTrackAI chat assistant */

export interface SecureChatAiResult {
  reply: string;
  suggestedTasks: string[];
  summary?: string;
  botDomain?: string;
  createTicket?: boolean;
  ticketSubject?: string;
}

export function summarizeConversation(
  messages: Array<{ sender_name?: string | null; body?: string | null }>
): string {
  if (!messages.length) return "No messages to summarize.";
  const sample = messages.slice(-20);
  const speakers = new Set(sample.map((m) => m.sender_name || "User"));
  const topics = sample
    .map((m) => (m.body || "").slice(0, 80))
    .filter(Boolean)
    .slice(0, 5);
  return [
    `Summary of last ${sample.length} message(s) involving ${speakers.size} participant(s).`,
    topics.length ? `Key points: ${topics.join(" · ")}` : "",
    "SecureTrackAI recommendation: capture action items as tasks and escalate blockers to Service Desk.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function draftReply(context: string): string {
  const lower = context.toLowerCase();
  if (lower.includes("thanks") || lower.includes("thank you")) {
    return "You're welcome — happy to help. Let me know if anything else comes up.";
  }
  if (lower.includes("meeting") || lower.includes("call")) {
    return "Happy to join. Please share the agenda and preferred time, or I can schedule a SecureChat meeting room.";
  }
  if (lower.includes("urgent") || lower.includes("asap") || lower.includes("down")) {
    return "Understood — treating this as high priority. I'll follow up immediately and create a Service Desk ticket if needed.";
  }
  return "Thanks for the update. I'll review and get back shortly with next steps.";
}

export function handleBotCommand(
  text: string
): SecureChatAiResult | null {
  const t = text.trim();
  const lower = t.toLowerCase();

  if (lower.startsWith("/hr") || lower.includes("leave balance") || lower.includes("payslip")) {
    return {
      reply:
        "HR Bot: Use HR → Self-service for leave balances and payslips. Policies are in SecureChat Knowledge under HR. Type `/ticket hr` to open an HR request.",
      suggestedTasks: ["Check leave balance", "Download latest payslip"],
      botDomain: "hr",
    };
  }
  if (lower.startsWith("/finance") || lower.includes("invoice status") || lower.includes("payment status")) {
    return {
      reply:
        "Finance Bot: Check Billing → Invoices for status. For payment issues, open a Finance ticket with the invoice number.",
      suggestedTasks: ["Look up invoice", "Escalate payment query"],
      botDomain: "finance",
    };
  }
  if (lower.startsWith("/prod") || lower.includes("machine status") || lower.includes("production order")) {
    return {
      reply:
        "Production Bot: View Production → Orders and Shop Floor for live status. Machine faults: share asset tag and open a maintenance ticket.",
      suggestedTasks: ["Check machine status", "Create maintenance ticket"],
      botDomain: "production",
      createTicket: lower.includes("fault") || lower.includes("down") || lower.includes("breakdown"),
      ticketSubject: "Production issue reported via SecureChat",
    };
  }
  if (lower.startsWith("/it") || lower.includes("password reset") || lower.includes("printer")) {
    return {
      reply:
        "IT Bot: For password reset use Identity self-service or Service Desk. Printer issues — include printer name/location and I'll draft a ticket.",
      suggestedTasks: ["Password reset", "Create IT ticket"],
      botDomain: "it",
      createTicket: true,
      ticketSubject: "IT support request via SecureChat",
    };
  }
  if (lower.includes("@securetrackai") || lower.startsWith("/ai") || lower.startsWith("/help")) {
    return {
      reply:
        "SecureTrackAI online. I can summarize chats, draft replies, create tasks/tickets, explain ERP modules, and search knowledge. Try: `/hr`, `/finance`, `/prod`, `/it`, or ask a question.",
      suggestedTasks: ["Summarize channel", "Draft reply", "Create task"],
      botDomain: "general",
    };
  }
  return null;
}

export function chatAssist(text: string, recentMessages: Array<{ sender_name?: string | null; body?: string | null }> = []): SecureChatAiResult {
  const bot = handleBotCommand(text);
  if (bot) return bot;

  if (text.toLowerCase().includes("summarize") || text.toLowerCase().includes("summary")) {
    return {
      reply: summarizeConversation(recentMessages),
      suggestedTasks: ["Share summary with team", "Create action items"],
      summary: summarizeConversation(recentMessages),
      botDomain: "general",
    };
  }

  if (text.toLowerCase().includes("draft") || text.toLowerCase().includes("reply")) {
    const last = recentMessages[recentMessages.length - 1]?.body || text;
    return {
      reply: `Draft reply:\n\n${draftReply(last)}`,
      suggestedTasks: ["Send draft", "Edit draft"],
      botDomain: "general",
    };
  }

  return {
    reply:
      "SecureTrackAI: I can help with summaries, drafts, tickets, and ERP navigation. Mention @SecureTrackAI or use `/help`.",
    suggestedTasks: [],
    botDomain: "general",
  };
}

export function generateChatInsights(params: {
  dailyMessages?: number;
  activeChannels?: number;
  meetings?: number;
  files?: number;
  announcements?: number;
}): Array<{ title: string; detail: string; severity: string }> {
  const out: Array<{ title: string; detail: string; severity: string }> = [];
  if ((params.dailyMessages || 0) > 0) {
    out.push({
      title: "Messaging activity",
      detail: `~${params.dailyMessages} messages in sample window across ${params.activeChannels || 0} channels.`,
      severity: "info",
    });
  }
  if ((params.meetings || 0) > 0) {
    out.push({
      title: "Meetings scheduled",
      detail: `${params.meetings} meeting(s). Enable AI minutes after each standup.`,
      severity: "info",
    });
  }
  if ((params.files || 0) === 0) {
    out.push({
      title: "File sharing underused",
      detail: "Encourage warehouse and quality teams to share photo evidence in channels.",
      severity: "low",
    });
  }
  out.push({
    title: "Collaboration tip",
    detail: "Pin #announcements and convert urgent production messages to Service Desk tickets.",
    severity: "info",
  });
  return out;
}
