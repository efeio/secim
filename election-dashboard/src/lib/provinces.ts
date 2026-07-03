export type { Region as Province } from "./regions/index";
export { provinces } from "./regions/tr";

import { provinces } from "./regions/tr";
export const provinceMap = new Map(provinces.map((p) => [p.code, p]));
