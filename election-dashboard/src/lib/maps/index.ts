export interface CountryMapData {
  paths: Record<string, string>;
  viewBox: string;
  name: string;
  regionLabel: string;
}

export async function getMapData(country: string): Promise<CountryMapData | null> {
  const meta = supportedCountries.find((c) => c.code === country);
  if (!meta) return null;

  try {
    const mod = await import(`./${country}.ts`);
    const pathsKey = Object.keys(mod).find((k) => k.endsWith("Paths"));
    const paths = pathsKey ? mod[pathsKey] : {};
    return {
      paths,
      viewBox: mod.SVG_VIEWBOX || "0 0 1000 1000",
      name: meta.name,
      regionLabel: meta.regionLabel,
    };
  } catch {
    return null;
  }
}

export const supportedCountries = [
  { code: "tr", name: "Türkiye", flag: "🇹🇷", regionLabel: "İl" },
  { code: "us", name: "United States", flag: "🇺🇸", regionLabel: "State" },
  { code: "gb", name: "United Kingdom", flag: "🇬🇧", regionLabel: "Region" },
  { code: "de", name: "Germany", flag: "🇩🇪", regionLabel: "Bundesland" },
  { code: "fr", name: "France", flag: "🇫🇷", regionLabel: "Département" },
  { code: "it", name: "Italy", flag: "🇮🇹", regionLabel: "Provincia" },
  { code: "es", name: "Spain", flag: "🇪🇸", regionLabel: "Provincia" },
  { code: "nl", name: "Netherlands", flag: "🇳🇱", regionLabel: "Province" },
  { code: "be", name: "Belgium", flag: "🇧🇪", regionLabel: "Province" },
  { code: "at", name: "Austria", flag: "🇦🇹", regionLabel: "Bundesland" },
  { code: "gr", name: "Greece", flag: "🇬🇷", regionLabel: "Region" },
  { code: "bg", name: "Bulgaria", flag: "🇧🇬", regionLabel: "Oblast" },
  { code: "ba", name: "Bosnia & Herzegovina", flag: "🇧🇦", regionLabel: "Entity" },
  { code: "az", name: "Azerbaijan", flag: "🇦🇿", regionLabel: "Rayon" },
  { code: "jp", name: "Japan", flag: "🇯🇵", regionLabel: "Prefecture" },
  { code: "cn", name: "China", flag: "🇨🇳", regionLabel: "Province" },
  { code: "au", name: "Australia", flag: "🇦🇺", regionLabel: "State" },
  { code: "br", name: "Brazil", flag: "🇧🇷", regionLabel: "Estado" },
  { code: "ar", name: "Argentina", flag: "🇦🇷", regionLabel: "Provincia" },
  { code: "world", name: "World", flag: "🌍", regionLabel: "Country" },
] as const;

export type CountryCode = typeof supportedCountries[number]["code"];
