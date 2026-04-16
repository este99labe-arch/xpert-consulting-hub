export interface XredProfile {
  account_id: string;
  description: string;
  services_offered: string[];
  services_needed: string[];
  cnae_code: string;
  province: string;
  employee_count: number;
  reputation_score: number;
  accounts: { name: string };
}

export function computeScore(myProfile: any, other: XredProfile): number {
  if (!myProfile) return 50;
  let score = 0;

  if (myProfile.cnae_code && other.cnae_code) {
    const prefix = myProfile.cnae_code.substring(0, 2);
    if (other.cnae_code.startsWith(prefix)) score += 20;
    if (other.cnae_code === myProfile.cnae_code) score += 10;
  }

  const myNeeds = new Set<string>(myProfile.services_needed || []);
  const theirOffers = new Set<string>(other.services_offered || []);
  const overlap = [...myNeeds].filter((s: string) => theirOffers.has(s)).length;
  if (myNeeds.size > 0) score += Math.min(25, (overlap / myNeeds.size) * 25);

  if (myProfile.province && other.province && myProfile.province === other.province) score += 15;

  score += Math.min(15, (Number(other.reputation_score) / 5) * 15);
  score += Math.min(10, other.employee_count > 0 ? 10 : 5);
  score += 5;

  return Math.round(Math.min(100, score));
}
