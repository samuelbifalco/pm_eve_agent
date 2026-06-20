"use strict";
const PROMPT_TEMPLATES = {
    triage: `Use the ingest_feedback tool to normalize this feedback:
Source: customer interviews
Items:
1. Enterprise admins say onboarding is confusing.
2. Two users reported slow dashboard load times.
3. One prospect needs HubSpot integration before buying.`,
    score: `Use the score_opportunities tool to score these opportunities:
1. HubSpot integration — reach 40, impact 4, confidence 0.7, effort 6, strategicFit 3, risk 2
2. Faster dashboard loading — reach 300, impact 3, confidence 0.9, effort 3, strategicFit 4, risk 1
3. Self-serve onboarding checklist — reach 120, impact 4, confidence 0.8, effort 4, strategicFit 5, risk 1
4. Admin audit logs — reach 60, impact 3, confidence 0.6, effort 5, strategicFit 4, risk 2`,
    prd: `Use the generate_prd tool to create a PRD for a self-serve onboarding checklist for new enterprise admins.
Problem: Admins are confused during initial setup and do not know which steps matter.
Audience: Enterprise admins.
Goals:
- Improve activation
- Reduce support tickets
- Help admins invite users and configure integrations
Requirements:
- Checklist
- Progress state
- Recommended next action
- Help links
- Admin completion analytics
Success metrics:
- Activation within 7 days
- Checklist completion
- Support ticket reduction`,
    plan: `Use the create_action_plan tool to create an execution plan.
Goal: Launch a beta for the self-serve onboarding checklist.
Deadline: 3 weeks from now.
Team:
- 1 product manager
- 1 engineer
- 1 designer
Constraints:
- Keep scope small
- Avoid backend-heavy work
- Must support enterprise admins first
Known risks:
- Onboarding requirements are not fully validated
- Engineering capacity is limited`,
    issues: `Use the mock_linear_search tool to search mock issues for onboarding and summarize what is blocking launch.`,
    decision: `Use the save_decision_log tool to save this product decision:
Title: Prioritize onboarding checklist over HubSpot integration
Decision: We are prioritizing the onboarding checklist first.
Context: Activation is the biggest current blocker, while HubSpot is important but only tied to one confirmed prospect so far.
Options considered:
- Build HubSpot integration first
- Improve dashboard performance first
- Build onboarding checklist first
Owner: Product`,
};
const STREAM_TIMEOUT_MS = 120_000;
const STREAM_OPEN_RETRIES = 8;
const conversationEl = document.getElementById("conversation");
const promptEl = document.getElementById("prompt");
const sendBtn = document.getElementById("send");
const clearBtn = document.getElementById("clear");
const loadingEl = document.getElementById("loading");
const statusBarEl = document.getElementById("status-bar");
const debugPanelEl = document.getElementById("debug-panel");
const debugOutputEl = document.getElementById("debug-output");
const toggleDebugBtn = document.getElementById("toggle-debug");
let session = { streamIndex: 0 };
let debugEvents = [];
let debugVisible = false;
let isBusy = false;
let activeAbortController = null;
function setBusy(busy) {
    isBusy = busy;
    sendBtn.disabled = busy;
    promptEl.disabled = busy;
    loadingEl.classList.toggle("hidden", !busy);
}
function abortActiveStream() {
    activeAbortController?.abort();
    activeAbortController = null;
}
function setError(message) {
    statusBarEl.textContent = message;
    statusBarEl.classList.add("error");
}
function clearError() {
    statusBarEl.classList.remove("error");
}
function removeEmptyState() {
    const empty = conversationEl.querySelector(".empty-state");
    empty?.remove();
}
function appendMessage(role, text) {
    removeEmptyState();
    const el = document.createElement("div");
    el.className = `message ${role}`;
    const label = role === "user" ? "You" : role === "assistant" ? "Assistant" : "Tool";
    el.innerHTML = `<span class="role">${label}</span>${escapeHtml(text)}`;
    conversationEl.appendChild(el);
    conversationEl.scrollTop = conversationEl.scrollHeight;
    return el;
}
function escapeHtml(text) {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}
function normalizeEventType(event) {
    const candidates = [
        event.type,
        event.event,
        event.name,
        event.kind,
        event.data?.type,
    ];
    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.length > 0)
            return candidate;
    }
    return "unknown";
}
function collectText(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === "string")
        return value;
    if (typeof value === "number" || typeof value === "boolean")
        return String(value);
    if (Array.isArray(value)) {
        const parts = value
            .map((item) => collectText(item))
            .filter((part) => part !== null && part.length > 0);
        return parts.length > 0 ? parts.join("") : null;
    }
    if (typeof value === "object") {
        const record = value;
        if (typeof record.text === "string")
            return record.text;
        if (typeof record.value === "string")
            return record.value;
        if (record.type === "text") {
            if (typeof record.text === "string")
                return record.text;
            if (typeof record.value === "string")
                return record.value;
        }
        if (record.content !== undefined) {
            const nested = collectText(record.content);
            if (nested)
                return nested;
        }
        if (record.parts !== undefined) {
            const nested = collectText(record.parts);
            if (nested)
                return nested;
        }
    }
    return null;
}
function isAssistantTextEvent(eventType) {
    return (eventType === "message.appended" ||
        eventType === "message.completed" ||
        eventType === "result.completed" ||
        eventType === "input.requested");
}
function extractTextFromEvent(event, eventType) {
    if (!isAssistantTextEvent(eventType))
        return null;
    const data = event.data ?? {};
    const message = data.message ?? event.message;
    if (eventType === "message.appended") {
        if (typeof data.messageSoFar === "string")
            return data.messageSoFar;
        if (typeof data.text === "string")
            return data.text;
        if (typeof data.delta === "string")
            return data.delta;
        if (typeof data.messageDelta === "string")
            return data.messageDelta;
    }
    if (eventType === "message.completed") {
        if (typeof data.message === "string")
            return data.message;
        const fromMessage = collectText(message);
        if (fromMessage)
            return fromMessage;
    }
    const paths = [
        data.text,
        data.content,
        data.value,
        data.output,
        data.result,
        data.delta,
        data.messageDelta,
        data.messageSoFar,
        data.message?.content,
        data.message?.text,
        data.message?.parts,
        data.content?.text,
        Array.isArray(data.content) ? data.content[0] : undefined,
        event.text,
        event.content,
        message,
    ];
    for (const candidate of paths) {
        const text = collectText(candidate);
        if (text)
            return text;
    }
    return null;
}
function extractInputRequestText(event) {
    const data = event.data ?? {};
    const requests = data.requests;
    if (!Array.isArray(requests) || requests.length === 0)
        return null;
    const lines = [];
    for (const request of requests) {
        if (!request || typeof request !== "object")
            continue;
        const record = request;
        const prompt = typeof record.prompt === "string" ? record.prompt : null;
        if (prompt)
            lines.push(prompt);
        const options = record.options;
        if (Array.isArray(options) && options.length > 0) {
            const optionLines = options
                .map((option) => {
                if (!option || typeof option !== "object")
                    return "";
                const opt = option;
                const label = typeof opt.label === "string" ? opt.label : "";
                return label ? `- ${label}` : "";
            })
                .filter(Boolean);
            if (optionLines.length > 0) {
                lines.push("Options:", ...optionLines);
            }
        }
    }
    return lines.length > 0 ? lines.join("\n") : null;
}
function extractToolLines(event, eventType) {
    const data = event.data ?? {};
    const lines = [];
    const toolEventTypes = new Set([
        "actions.requested",
        "action.result",
        "tool.started",
        "tool.completed",
        "tool-call",
        "tool-result",
    ]);
    if (!toolEventTypes.has(eventType))
        return lines;
    const actions = data.actions;
    if (Array.isArray(actions)) {
        for (const action of actions) {
            if (!action || typeof action !== "object")
                continue;
            const record = action;
            const toolName = (typeof record.toolName === "string" && record.toolName) ||
                (typeof record.name === "string" && record.name) ||
                null;
            if (toolName)
                lines.push(`Called ${toolName}`);
        }
    }
    const singleNames = [data.toolName, data.name, data.action?.toolName];
    for (const name of singleNames) {
        if (typeof name === "string" && name.length > 0) {
            lines.push(`Called ${name}`);
        }
    }
    return lines;
}
function isLoadingClearEvent(eventType) {
    return (eventType === "message.completed" ||
        eventType === "result.completed" ||
        eventType === "turn.completed" ||
        eventType === "session.waiting" ||
        eventType === "session.completed" ||
        eventType === "turn.failed" ||
        eventType === "session.failed" ||
        eventType === "step.failed" ||
        eventType === "input.requested");
}
function isStreamEndEvent(eventType) {
    return (eventType === "session.waiting" ||
        eventType === "session.completed" ||
        eventType === "session.failed");
}
function recordDebugEvent(event, eventType) {
    debugEvents.push({ eventType, raw: event });
    if (debugEvents.length > 100)
        debugEvents = debugEvents.slice(-100);
    if (debugVisible) {
        debugOutputEl.textContent = JSON.stringify(debugEvents, null, 2);
    }
}
function updateAssistantBubble(state) {
    if (!state.assistantText)
        return;
    if (!state.assistantEl) {
        state.assistantEl = appendMessage("assistant", state.assistantText);
        return;
    }
    state.assistantEl.innerHTML = `<span class="role">Assistant</span>${escapeHtml(state.assistantText)}`;
    conversationEl.scrollTop = conversationEl.scrollHeight;
}
function handleStreamEvent(event, state) {
    const eventType = normalizeEventType(event);
    recordDebugEvent(event, eventType);
    session.streamIndex += 1;
    for (const line of extractToolLines(event, eventType)) {
        appendMessage("tool", line);
    }
    const text = isAssistantTextEvent(eventType) ? extractTextFromEvent(event, eventType) : null;
    if (text) {
        const data = event.data ?? {};
        if (eventType === "message.completed" || eventType === "result.completed") {
            state.assistantText = text;
        }
        else if (eventType === "message.appended") {
            if (typeof data.messageSoFar === "string") {
                state.assistantText = data.messageSoFar;
            }
            else {
                state.assistantText += text;
            }
        }
        else if (!state.assistantText) {
            state.assistantText = text;
        }
        else {
            state.assistantText += text;
        }
        updateAssistantBubble(state);
    }
    else if (eventType === "input.requested") {
        const prompt = extractInputRequestText(event);
        if (prompt) {
            state.assistantText = prompt;
            updateAssistantBubble(state);
        }
    }
    else if (eventType === "result.completed" && !state.assistantText) {
        const data = event.data ?? {};
        const summary = collectText(data.result) ?? JSON.stringify(data.result ?? data, null, 2);
        state.assistantText = summary;
        updateAssistantBubble(state);
    }
    if (eventType === "session.failed" || eventType === "turn.failed" || eventType === "step.failed") {
        const data = event.data ?? {};
        const reason = (typeof data.message === "string" && data.message) ||
            (typeof data.error === "string" && data.error) ||
            "The agent run failed.";
        throw new Error(reason);
    }
    if (isLoadingClearEvent(eventType)) {
        setBusy(false);
    }
    if (isStreamEndEvent(eventType)) {
        state.streamEnded = true;
    }
}
async function openStreamResponse(sessionId, signal) {
    const startIndex = session.streamIndex;
    const path = startIndex > 0
        ? `/eve/v1/session/${encodeURIComponent(sessionId)}/stream?startIndex=${startIndex}`
        : `/eve/v1/session/${encodeURIComponent(sessionId)}/stream`;
    let lastError = "Failed to open Eve stream.";
    for (let attempt = 0; attempt < STREAM_OPEN_RETRIES; attempt += 1) {
        const response = await fetch(path, { signal });
        if (response.ok)
            return response;
        lastError = `Stream failed (${response.status}): ${await response.text()}`;
        if (![404, 409, 425, 500, 502, 503, 504].includes(response.status)) {
            throw new Error(lastError);
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(lastError);
}
async function consumeStream(sessionId, signal) {
    const response = await openStreamResponse(sessionId, signal);
    if (!response.body)
        throw new Error("Stream body missing");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const state = { assistantText: "", assistantEl: null, streamEnded: false };
    const timeout = setTimeout(() => {
        abortActiveStream();
    }, STREAM_TIMEOUT_MS);
    try {
        while (!state.streamEnded) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed)
                    continue;
                let event;
                try {
                    event = JSON.parse(trimmed);
                }
                catch {
                    throw new Error("Failed to parse Eve stream event.");
                }
                handleStreamEvent(event, state);
                if (state.streamEnded)
                    break;
            }
        }
        return state.assistantText;
    }
    finally {
        clearTimeout(timeout);
        setBusy(false);
        try {
            await reader.cancel();
        }
        catch {
            // Stream may already be closed.
        }
    }
}
async function sendMessage(message) {
    const trimmed = message.trim();
    if (!trimmed || isBusy)
        return;
    abortActiveStream();
    const abortController = new AbortController();
    activeAbortController = abortController;
    clearError();
    appendMessage("user", trimmed);
    promptEl.value = "";
    setBusy(true);
    try {
        let response;
        if (!session.sessionId) {
            response = await fetch("/eve/v1/session", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ message: trimmed }),
                signal: abortController.signal,
            });
        }
        else {
            response = await fetch(`/eve/v1/session/${encodeURIComponent(session.sessionId)}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    message: trimmed,
                    continuationToken: session.continuationToken,
                }),
                signal: abortController.signal,
            });
        }
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Request failed (${response.status}): ${text}`);
        }
        const headerSessionId = response.headers.get("x-eve-session-id")?.trim() || undefined;
        const payload = (await response.json());
        session.sessionId = payload.sessionId ?? headerSessionId ?? session.sessionId;
        session.continuationToken = payload.continuationToken ?? session.continuationToken;
        if (!session.sessionId) {
            throw new Error("No session ID returned by Eve.");
        }
        const assistantText = await consumeStream(session.sessionId, abortController.signal);
        if (!assistantText) {
            appendMessage("assistant", "No text response found. Open debug to inspect stream events.");
        }
        statusBarEl.textContent = `Connected to Eve · session ${session.sessionId}`;
    }
    catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            return;
        }
        const message = error instanceof Error ? error.message : "Unknown error";
        setError(message);
        appendMessage("assistant", `Error: ${message}`);
    }
    finally {
        if (activeAbortController === abortController) {
            activeAbortController = null;
        }
        setBusy(false);
    }
}
function clearSession() {
    abortActiveStream();
    setBusy(false);
    session = { streamIndex: 0 };
    debugEvents = [];
    debugOutputEl.textContent = "[]";
    conversationEl.innerHTML =
        '<div class="empty-state">Send a prompt or pick a quick action to get started.</div>';
    clearError();
    statusBarEl.textContent = "Session cleared. Next send starts a new Eve session.";
}
async function checkHealth() {
    try {
        const response = await fetch("/api/health");
        const data = (await response.json());
        if (data.eve === "ok") {
            statusBarEl.textContent = "Eve agent is reachable. Ready to chat.";
            return;
        }
        setError(data.hint ?? "Eve agent is not reachable. Run npm run dev in another terminal.");
    }
    catch {
        setError("UI server health check failed.");
    }
}
sendBtn.addEventListener("click", () => {
    void sendMessage(promptEl.value);
});
clearBtn.addEventListener("click", clearSession);
toggleDebugBtn.addEventListener("click", () => {
    const hidden = debugPanelEl.classList.toggle("hidden");
    debugVisible = !hidden;
    toggleDebugBtn.textContent = debugVisible ? "Hide debug" : "Show debug";
    if (debugVisible) {
        debugOutputEl.textContent = JSON.stringify(debugEvents, null, 2);
    }
});
promptEl.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void sendMessage(promptEl.value);
    }
});
for (const button of document.querySelectorAll("[data-template]")) {
    button.addEventListener("click", () => {
        const key = button.dataset.template;
        if (!key || !(key in PROMPT_TEMPLATES))
            return;
        promptEl.value = PROMPT_TEMPLATES[key];
        promptEl.focus();
    });
}
void checkHealth();
