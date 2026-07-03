export interface Region {
  code: string;
  name: string;
  plate: number;
}

export async function getRegions(country: string): Promise<Region[]> {
  try {
    const mod = await import(`./${country}.ts`);
    const key = Object.keys(mod).find((k) => Array.isArray(mod[k]));
    return key ? mod[key] : [];
  } catch {
    return [];
  }
}

export function createRegionMap(regions: Region[]): Map<string, Region> {
  return new Map(regions.map((r) => [r.code, r]));
}

export function createPlateToCodeMap(regions: Region[]): Map<number, string> {
  return new Map(regions.map((r) => [r.plate, r.code]));
}
