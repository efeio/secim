export const candidateColorOverrides: Record<string, string> = {
  "Eray": "#a89530",
  "Hobbit Emo": "#b52626",
};

export function getCandidateColor(name: string, dbColor: string): string {
  return candidateColorOverrides[name] || dbColor;
}

export function getMapFillColor(color: string): string {
  return color;
}
