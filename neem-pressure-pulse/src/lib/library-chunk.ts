// Splits page text into overlapping chunks (~1800 chars) for the knowledge library.
export function chunkPages(pages: { page: number; text: string }[], size = 1800, overlap = 200) {
  const out: { page: number; content: string }[] = [];
  for (const { page, text } of pages) {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) continue;
    let start = 0;
    while (start < clean.length) {
      let end = Math.min(clean.length, start + size);
      if (end < clean.length) {
        const space = clean.lastIndexOf(" ", end);
        if (space > start + size / 2) end = space;
      }
      out.push({ page, content: clean.slice(start, end).trim() });
      if (end >= clean.length) break;
      start = Math.max(end - overlap, start + 1);
    }
  }
  return out;
}
