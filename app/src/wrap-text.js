export function wrapChartImageText(context, text, maxWidth) {
  const lines = [];
  let line = "";
  const words = text.trim().split(/\s+/u).flatMap((word) => {
    if (context.measureText(word).width <= maxWidth) return [word];
    const pieces = [];
    let piece = "";
    for (const character of word) {
      if (piece && context.measureText(piece + character).width > maxWidth) {
        pieces.push(piece); piece = "";
      }
      piece += character;
    }
    if (piece) pieces.push(piece);
    return pieces;
  });
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
