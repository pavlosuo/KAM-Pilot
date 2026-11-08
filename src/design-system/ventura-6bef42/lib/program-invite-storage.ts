export const PENDING_PROGRAM_INVITE_KEY = "pending_program_invite";

export function getPendingProgramInvite(): string | null {
  try {
    return localStorage.getItem(PENDING_PROGRAM_INVITE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingProgramInvite() {
  try {
    localStorage.removeItem(PENDING_PROGRAM_INVITE_KEY);
  } catch {
    /* ignore */
  }
}
