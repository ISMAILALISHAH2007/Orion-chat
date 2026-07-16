import { prisma } from '../db';

const generateId = () => {
  return 'mem_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.NVIDIA_API_KEY_1 ||
                 process.env.NVIDIA_API_KEY_2 ||
                 process.env.NVIDIA_API_KEY_3 ||
                 process.env.NVIDIA_API_KEY_4 ||
                 process.env.NVIDIA_API_KEY_5 ||
                 process.env.NVIDIA_API_KEY ||
                 '';
  if (!apiKey) {
    console.warn('No NVIDIA API key found for embedding generation.');
    return new Array(1536).fill(0);
  }

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        input: [text],
        model: 'nvidia/embed-qa-4',
        encoding_format: 'float'
      })
    });

    if (!response.ok) {
      console.error('NVIDIA embedding API error:', response.status, await response.text());
      return new Array(1536).fill(0);
    }

    const resData = await response.json();
    const vector = resData?.data?.[0]?.embedding;
    if (Array.isArray(vector)) {
      // Pad to 1536 dimensions if NVIDIA model returns 1024 (embed-qa-4 dimension size)
      if (vector.length < 1536) {
        const padded = [...vector, ...new Array(1536 - vector.length).fill(0)];
        return padded;
      }
      return vector.slice(0, 1536);
    }
  } catch (err) {
    console.error('Failed to generate embedding:', err);
  }
  return new Array(1536).fill(0);
}

export async function storeMemory(userId: string, content: string) {
  try {
    const embedding = await generateEmbedding(content);
    const vectorString = `[${embedding.join(',')}]`;
    const memId = generateId();
    
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Memory" ("id", "userId", "content", "embedding", "createdAt", "updatedAt") VALUES ($1, $2, $3, cast($4 as vector), NOW(), NOW())`,
      memId,
      userId,
      content,
      vectorString
    );
    console.log('Successfully saved memory for user:', userId);
    return { id: memId, content };
  } catch (dbError) {
    console.error('Error saving memory to DB:', dbError);
    // Fallback insertion without embedding if pgvector causes errors
    try {
      const memId = generateId();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Memory" ("id", "userId", "content", "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW())`,
        memId,
        userId,
        content
      );
      return { id: memId, content };
    } catch (fallbackError) {
      console.error('Fallback memory insertion failed:', fallbackError);
      throw fallbackError;
    }
  }
}

export async function retrieveRelevantMemories(userId: string, query: string, limit = 8): Promise<string[]> {
  try {
    const embedding = await generateEmbedding(query);
    const vectorString = `[${embedding.join(',')}]`;
    
    const results = await prisma.$queryRawUnsafe<Array<{ content: string }>>(
      `SELECT content FROM "Memory" WHERE "userId" = $1 AND embedding IS NOT NULL ORDER BY embedding <=> cast($2 as vector) LIMIT $3`,
      userId,
      vectorString,
      limit
    );
    
    return results.map(r => r.content);
  } catch (err) {
    console.error('Failed to retrieve memories via pgvector:', err);
    // Fallback: simple text match if pgvector fails
    try {
      const fallbackResults = await prisma.memory.findMany({
        where: { userId },
        take: limit,
        orderBy: { createdAt: 'desc' }
      });
      return fallbackResults.map(r => r.content);
    } catch (fallbackErr) {
      console.error('Fallback memory retrieval failed:', fallbackErr);
      return [];
    }
  }
}
