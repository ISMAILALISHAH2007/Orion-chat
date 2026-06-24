export function parseMarkdown(text: string): string {
  // STUB: simple replacement to simulate markdown parsing
  // In a real app, use a library like marked or react-markdown
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br />');
}
