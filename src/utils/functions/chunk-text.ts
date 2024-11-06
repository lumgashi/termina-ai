export const chunkText = (text: string, maxTokens: number): string[] => {
  const chunks: string[] = [];
  let currentChunk = '';

  text.split('\n').forEach((line) => {
    if ((currentChunk + line).length / 4 < maxTokens) {
      // Approximate tokens by dividing character count by 4
      currentChunk += line + '\n';
    } else {
      chunks.push(currentChunk);
      currentChunk = line + '\n';
    }
  });

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
};
