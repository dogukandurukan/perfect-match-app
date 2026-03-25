/** Parse Setup-1 height field into integer cm for `profiles.height_cm`. */
export function heightInputToCm(raw: string, unit: 'cm' | 'ft'): number | null {
  const s = raw.trim().replace(',', '.');
  if (!s) return null;

  if (unit === 'cm') {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }

  // ft: "5.10" or "5'10" → 5 ft 10 in; plain number → decimal feet
  const ftInch = /^(\d+)[''](\d{1,2})$/.exec(s);
  if (ftInch) {
    const ft = parseInt(ftInch[1]!, 10);
    const inch = parseInt(ftInch[2]!, 10);
    if (inch > 11) return null;
    return Math.round(ft * 30.48 + inch * 2.54);
  }

  const dotParts = s.split('.');
  if (dotParts.length === 2 && dotParts[0] !== '' && dotParts[1]!.length <= 2) {
    const ft = parseInt(dotParts[0]!, 10);
    const inch = parseInt(dotParts[1]!.padEnd(2, '0').slice(0, 2), 10);
    if (inch <= 11) return Math.round(ft * 30.48 + inch * 2.54);
  }

  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 30.48);
}
