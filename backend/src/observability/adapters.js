// backend/src/observability/adapters.js
//
// Each provider SDK returns a differently shaped response object. An adapter
// pulls the three things a span needs out of it: the text output, token usage,
// and the finish reason. Keyed by a short name the call site passes as
// `meta.adapter`. Unknown key -> "generic" (records the call, no usage).
export const RESPONSE_ADAPTERS = {
  generic: () => ({ output: null, usage: {}, finishReason: null }),

  // openai.responses.create(...)
  "openai.responses": (res) => ({
    output: res?.output_text?.trim?.() ?? res?.content?.[0]?.text ?? null,
    usage: {
      inputTokens: res?.usage?.input_tokens ?? null,
      outputTokens: res?.usage?.output_tokens ?? null,
      totalTokens: res?.usage?.total_tokens ?? null,
    },
    finishReason: res?.status ?? null,
  }),

  // openai.chat.completions.create(...)
  "openai.chat": (res) => ({
    output: res?.choices?.[0]?.message?.content ?? null,
    usage: {
      inputTokens: res?.usage?.prompt_tokens ?? null,
      outputTokens: res?.usage?.completion_tokens ?? null,
      totalTokens: res?.usage?.total_tokens ?? null,
    },
    finishReason: res?.choices?.[0]?.finish_reason ?? null,
  }),

  // @google/generative-ai : model.generateContent(...) -> { response }
  "gemini.generative-ai": (res) => {
    const r = res?.response ?? res;
    const um = r?.usageMetadata ?? {};
    let text = null;
    try {
      text = typeof r?.text === "function" ? r.text() : null;
    } catch {
      /* text() throws when the candidate was blocked */
    }
    return {
      output: text,
      usage: {
        inputTokens: um.promptTokenCount ?? null,
        outputTokens: um.candidatesTokenCount ?? null,
        totalTokens: um.totalTokenCount ?? null,
      },
      finishReason: r?.candidates?.[0]?.finishReason ?? null,
    };
  },

  // @google/genai : ai.models.generateContent(...) -> flat object
  "gemini.genai": (res) => {
    const um = res?.usageMetadata ?? {};
    let text = null;
    try {
      text =
        typeof res?.text === "function"
          ? res.text()
          : typeof res?.text === "string"
            ? res.text
            : null;
    } catch {
      /* ignore */
    }
    return {
      output: text,
      usage: {
        inputTokens: um.promptTokenCount ?? null,
        outputTokens: um.candidatesTokenCount ?? null,
        totalTokens: um.totalTokenCount ?? null,
      },
      finishReason: res?.candidates?.[0]?.finishReason ?? null,
    };
  },
};
