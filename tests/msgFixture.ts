// Builds small synthetic Outlook .msg files for tests ([MS-CFB], [MS-OXMSG]).
// Only fields WinProgMan reads are written; no real mail data is used.

interface Node {
  name: string;
  type: 1 | 2 | 5; // storage, stream, root
  data?: Uint8Array;
  children?: Node[];
}

const utf16 = (text: string) => {
  const bytes = new Uint8Array((text.length + 1) * 2);
  for (let i = 0; i < text.length; i += 1) {
    bytes[i * 2] = text.charCodeAt(i) & 0xff;
    bytes[i * 2 + 1] = text.charCodeAt(i) >> 8;
  }
  return bytes;
};
const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};
const fileTime = (date: Date) =>
  (BigInt(date.getTime()) + 11644473600000n) * 10000n;

/** Compound file writer: streams below 4096 bytes go into the mini stream. */
function compoundFile(root: Node): Uint8Array<ArrayBuffer> {
  const entries: Node[] = [];
  const index = new Map<Node, number>();
  const visit = (node: Node) => {
    index.set(node, entries.length);
    entries.push(node);
    node.children?.forEach(visit);
  };
  visit(root);
  // Mini stream: 64-byte sectors.
  const mini: number[] = [];
  const miniData: Uint8Array[] = [];
  const miniStart = new Map<Node, number>();
  for (const node of entries) {
    if (node.type !== 2 || !node.data?.length || node.data.length >= 4096)
      continue;
    const count = Math.ceil(node.data.length / 64);
    miniStart.set(node, mini.length);
    for (let i = 0; i < count; i += 1)
      mini.push(i + 1 === count ? -2 : mini.length + 1);
    const padded = new Uint8Array(count * 64);
    padded.set(node.data);
    miniData.push(padded);
  }
  const ministream = concat(miniData);
  // Big sectors: 0 = FAT, then directory, mini FAT, mini stream, large streams.
  const fat: number[] = [-3];
  const chain = (count: number) => {
    const first = fat.length;
    for (let i = 0; i < count; i += 1)
      fat.push(i + 1 === count ? -2 : fat.length + 1);
    return count ? first : -2;
  };
  const sectors = (length: number) => Math.ceil(length / 512);
  const directoryStart = chain(sectors(entries.length * 128));
  const miniFatStart = chain(sectors(mini.length * 4));
  const ministreamStart = chain(sectors(ministream.length));
  const bigStart = new Map<Node, number>();
  for (const node of entries)
    if (node.type === 2 && node.data && node.data.length >= 4096)
      bigStart.set(node, chain(sectors(node.data.length)));
  if (fat.length > 128) throw new Error("Fixture too large");
  const file = new Uint8Array(512 * (1 + fat.length));
  const view = new DataView(file.buffer);
  const sectorOffset = (sector: number) => 512 * (1 + sector);
  // Header
  file.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  view.setUint16(0x18, 0x3e, true);
  view.setUint16(0x1a, 3, true);
  view.setUint16(0x1c, 0xfffe, true);
  view.setUint16(0x1e, 9, true);
  view.setUint16(0x20, 6, true);
  view.setInt32(0x2c, 1, true);
  view.setInt32(0x30, directoryStart, true);
  view.setInt32(0x38, 4096, true);
  view.setInt32(0x3c, miniFatStart, true);
  view.setInt32(0x40, sectors(mini.length * 4), true);
  view.setInt32(0x44, -2, true);
  view.setInt32(0x4c, 0, true);
  for (let i = 1; i < 109; i += 1) view.setInt32(0x4c + i * 4, -1, true);
  // FAT
  for (let i = 0; i < 128; i += 1)
    view.setInt32(sectorOffset(0) + i * 4, i < fat.length ? fat[i] : -1, true);
  // Mini FAT and mini stream
  for (let i = 0; i < sectors(mini.length * 4) * 128; i += 1)
    view.setInt32(
      sectorOffset(miniFatStart) + i * 4,
      i < mini.length ? mini[i] : -1,
      true,
    );
  if (ministream.length) file.set(ministream, sectorOffset(ministreamStart));
  for (const [node, start] of bigStart)
    file.set(node.data!, sectorOffset(start));
  // Directory: siblings form a chain of right links (valid, if unbalanced).
  const byName = (a: Node, b: Node) =>
    a.name.length - b.name.length ||
    (a.name.toUpperCase() < b.name.toUpperCase() ? -1 : 1);
  const right = new Map<Node, number>();
  const child = new Map<Node, number>();
  for (const node of entries) {
    const kids = [...(node.children ?? [])].sort(byName);
    if (kids.length) child.set(node, index.get(kids[0])!);
    kids.forEach((kid, i) => {
      if (kids[i + 1]) right.set(kid, index.get(kids[i + 1])!);
    });
  }
  entries.forEach((node, i) => {
    const at = sectorOffset(directoryStart) + i * 128;
    const name = utf16(node.name);
    file.set(name, at);
    view.setUint16(at + 0x40, name.length, true);
    file[at + 0x42] = node.type;
    file[at + 0x43] = 1; // black
    view.setInt32(at + 0x44, -1, true);
    view.setInt32(at + 0x48, right.get(node) ?? -1, true);
    view.setInt32(at + 0x4c, child.get(node) ?? -1, true);
    const start =
      node.type === 5
        ? ministream.length
          ? ministreamStart
          : -2
        : (miniStart.get(node) ?? bigStart.get(node) ?? -2);
    view.setInt32(at + 0x74, node.type === 1 ? 0 : start, true);
    view.setUint32(
      at + 0x78,
      node.type === 5 ? ministream.length : (node.data?.length ?? 0),
      true,
    );
  });
  for (let i = entries.length; i < sectors(entries.length * 128) * 4; i += 1) {
    const at = sectorOffset(directoryStart) + i * 128;
    view.setInt32(at + 0x44, -1, true);
    view.setInt32(at + 0x48, -1, true);
    view.setInt32(at + 0x4c, -1, true);
  }
  return file;
}

const stream = (name: string, data: Uint8Array): Node => ({
  name,
  type: 2,
  data,
});
const PT_UNICODE = 0x001f;
const PT_SYSTIME = 0x0040;
const PT_LONG = 0x0003;

/** Fixed-size property records of __properties_version1.0. */
function properties(
  header: number,
  values: { tag: number; value: bigint | number }[],
) {
  const bytes = new Uint8Array(header + values.length * 16);
  const view = new DataView(bytes.buffer);
  values.forEach(({ tag, value }, i) => {
    const at = header + i * 16;
    view.setUint32(at, tag, true);
    view.setUint32(at + 4, 6, true);
    if (typeof value === "bigint") view.setBigUint64(at + 8, value, true);
    else view.setInt32(at + 8, value, true);
  });
  return stream("__properties_version1.0", bytes);
}
const stringStream = (id: number, text: string) =>
  stream(
    `__substg1.0_${(((id << 16) | PT_UNICODE) >>> 0).toString(16).toUpperCase().padStart(8, "0")}`,
    utf16(text).slice(0, -2),
  );

export interface MsgFixture {
  messageClass: string;
  subject?: string;
  senderName?: string;
  senderSmtp?: string;
  body?: string;
  delivered?: Date;
  start?: Date;
  end?: Date;
  location?: string;
  recipients?: { name: string; email: string; type: "to" | "cc" }[];
}

/** PSETID_Appointment {00062002-0000-0000-C000-000000000046} */
const PSETID_APPOINTMENT = [
  0x02, 0x20, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0xc0, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x46,
];

export function buildMsg(fixture: MsgFixture): Uint8Array<ArrayBuffer> {
  const children: Node[] = [stringStream(0x001a, fixture.messageClass)];
  if (fixture.subject !== undefined)
    children.push(stringStream(0x0037, fixture.subject));
  if (fixture.senderName)
    children.push(stringStream(0x0c1a, fixture.senderName));
  if (fixture.senderSmtp)
    children.push(stringStream(0x5d01, fixture.senderSmtp));
  if (fixture.body) children.push(stringStream(0x1000, fixture.body));
  const values: { tag: number; value: bigint | number }[] = [];
  if (fixture.delivered)
    values.push({
      tag: (0x0e06 << 16) | PT_SYSTIME,
      value: fileTime(fixture.delivered),
    });
  // Named properties: index 0 = start, 1 = end, 2 = location.
  const named = [
    { lid: 0x820d, type: PT_SYSTIME, value: fixture.start },
    { lid: 0x820e, type: PT_SYSTIME, value: fixture.end },
    { lid: 0x8208, type: PT_UNICODE, value: fixture.location },
  ];
  if (fixture.start || fixture.end || fixture.location) {
    const entryStream = new Uint8Array(named.length * 8);
    const view = new DataView(entryStream.buffer);
    named.forEach(({ lid }, i) => {
      view.setUint32(i * 8, lid, true);
      // Property index, GUID index 3 (first GUID stream entry), numeric kind.
      view.setUint32(i * 8 + 4, (i << 16) | (3 << 1), true);
    });
    children.push({
      name: "__nameid_version1.0",
      type: 1,
      children: [
        stream("__substg1.0_00020102", new Uint8Array(PSETID_APPOINTMENT)),
        stream("__substg1.0_00030102", entryStream),
        stream("__substg1.0_00040102", new Uint8Array(0)),
      ],
    });
    named.forEach(({ type, value }, i) => {
      const id = 0x8000 + i;
      if (value instanceof Date)
        values.push({ tag: (id << 16) | type, value: fileTime(value) });
      else if (typeof value === "string")
        children.push(stringStream(id, value));
    });
  }
  (fixture.recipients ?? []).forEach((recipient, i) => {
    children.push({
      name: `__recip_version1.0_#${String(i).padStart(8, "0")}`,
      type: 1,
      children: [
        properties(8, [
          {
            tag: (0x0c15 << 16) | PT_LONG,
            value: recipient.type === "cc" ? 2 : 1,
          },
        ]),
        stringStream(0x3001, recipient.name),
        stringStream(0x39fe, recipient.email),
      ],
    });
  });
  children.push(properties(32, values));
  return compoundFile({ name: "Root Entry", type: 5, children });
}
