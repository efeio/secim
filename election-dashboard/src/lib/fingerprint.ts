import FingerprintJS from "@fingerprintjs/fingerprintjs";

const STORAGE_KEY = "election_device_token";

export async function getDeviceToken(): Promise<string> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;

  const fp = await FingerprintJS.load();
  const result = await fp.get();
  const token = result.visitorId;

  localStorage.setItem(STORAGE_KEY, token);
  return token;
}

export function hasLocalVoteRecord(pollId: string): boolean {
  return localStorage.getItem(`voted_${pollId}`) === "true";
}

export function setLocalVoteRecord(pollId: string): void {
  localStorage.setItem(`voted_${pollId}`, "true");
}

export function clearLocalVoteRecord(pollId: string): void {
  localStorage.removeItem(`voted_${pollId}`);
}
