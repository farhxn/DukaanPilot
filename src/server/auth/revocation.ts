export function sessionStillValid(user: { disabled: boolean; tokensValidAfterTime?: string }, authenticatedAt?: Date) {
  if (user.disabled || !authenticatedAt || !Number.isFinite(authenticatedAt.getTime())) return false;
  if (!user.tokensValidAfterTime) return true;
  const validAfter = Date.parse(user.tokensValidAfterTime);
  return Number.isFinite(validAfter) && authenticatedAt.getTime() >= validAfter;
}
