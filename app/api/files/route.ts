import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // STUB: Handle file uploads (PDF, DOCX, TXT)
  // Parse form data, extract text, generate embeddings, save to Document model
  return NextResponse.json({ success: true, message: 'File processed successfully' });
}
