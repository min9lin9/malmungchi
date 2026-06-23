export function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

export function has(name: string): boolean {
  return process.argv.includes(name);
}

export function repeated(name: string): readonly string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    const value = process.argv[index + 1];
    if (process.argv[index] === name && value) values.push(value);
  }
  return values;
}
