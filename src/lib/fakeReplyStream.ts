export const AGENT_REPLY_MIN_REVEAL_DELAY_MS = 2000;
export const AGENT_REPLY_FAKE_TOKENS_PER_SECOND = 32;

export function remainingAgentReplyDelayMs(startedAtMs: number, nowMs = Date.now()): number {
  return Math.max(0, AGENT_REPLY_MIN_REVEAL_DELAY_MS - (nowMs - startedAtMs));
}

export function splitFakeReplyTokens(text: string): string[] {
  return text.match(/\s+|\S+/g) || [];
}

export function fakeReplyTokenDelayMs(tokensPerSecond = AGENT_REPLY_FAKE_TOKENS_PER_SECOND): number {
  return 1000 / tokensPerSecond;
}
