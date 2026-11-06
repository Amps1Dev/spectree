export type TargetStatus = 'Pending' | 'Scanning' | 'Complete' | 'Failed';

export interface ParsedTarget {
  id: string;
  target: string;
  label?: string;
  notes?: string;
  valid: boolean;
  error?: string;
  status: TargetStatus;
  findingsCount?: number;
}

function parseCsvLine(line: string) {
  const fields: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      fields.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }

  fields.push(value.trim());
  return fields;
}

function isIpv4(value: string) {
  const parts = value.split('.');
  return (
    parts.length === 4 &&
    parts.every(
      (part) =>
        /^\d{1,3}$/.test(part) &&
        Number(part) >= 0 &&
        Number(part) <= 255 &&
        (part === '0' || !part.startsWith('0')),
    )
  );
}

function isIpv6(value: string) {
  if (!value.includes(':') || !/^[0-9a-f:]+$/i.test(value)) return false;
  const compression = value.split('::');
  if (compression.length > 2) return false;

  const left = compression[0] ? compression[0].split(':') : [];
  const right = compression[1] ? compression[1].split(':') : [];
  const groups = [...left, ...right];
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/i.test(group))) return false;

  return compression.length === 2 ? groups.length < 8 : groups.length === 8;
}

function isHostname(value: string) {
  if (value.length > 253 || value.endsWith('.')) return false;
  const labels = value.split('.');
  return labels.every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
  );
}

export function isValidTarget(value: string) {
  const [address, prefix, extra] = value.split('/');
  if (extra !== undefined || !address) return false;
  const ipv4 = isIpv4(address);
  const ipv6 = isIpv6(address);

  if (prefix !== undefined) {
    if (!/^\d+$/.test(prefix)) return false;
    const number = Number(prefix);
    return (ipv4 && number <= 32) || (ipv6 && number <= 128);
  }

  if (/^[\d.]+$/.test(address) && !ipv4) return false;
  return ipv4 || ipv6 || isHostname(address);
}

export function parseTargets(text: string): ParsedTarget[] {
  const results: ParsedTarget[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const [rawTarget = '', rawLabel = '', ...rawNotes] = parseCsvLine(line);
    const target = rawTarget.trim();
    const label = rawLabel.trim() || undefined;
    const notes = rawNotes.join(',').trim() || undefined;
    if (!target) continue;

    const header = target.toLowerCase();
    if (
      results.length === 0 &&
      ['ip', 'target', 'hostname', 'host'].includes(header)
    ) {
      continue;
    }

    const dedupeKey = target.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const valid = isValidTarget(target);
    results.push({
      id: `${results.length}-${dedupeKey}`,
      target,
      label,
      notes,
      valid,
      error: valid ? undefined : 'Invalid IP, CIDR, IPv6 address, or hostname',
      status: 'Pending',
    });
  }

  return results;
}

export async function parseTargetFile(file: File): Promise<ParsedTarget[]> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !['txt', 'csv', 'docx'].includes(extension)) {
    throw new Error('Choose a .txt, .csv, or .docx target file.');
  }

  if (extension === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer(),
    });
    return parseTargets(result.value);
  }

  return parseTargets(await file.text());
}
