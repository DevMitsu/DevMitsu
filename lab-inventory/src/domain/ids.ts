let counter = 0;

/** Short unique id. Random + time + counter: collision-free for one lab's lifetime. */
export function uid(prefix = ''): string {
  counter = (counter + 1) % 1679616;
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 7);
  return `${prefix}${t}${r}${counter.toString(36)}`;
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
