export function proposalTtlMs() {
  const hours = Number(process.env.PROPOSAL_TTL_HOURS ?? 24);
  if (!Number.isInteger(hours) || hours < 1 || hours > 24) throw new Error("Invalid proposal lifetime configuration.");
  return hours * 3600000;
}
