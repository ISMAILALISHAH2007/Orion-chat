import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  return NextResponse.json({ success: true, message: "Memory processed" });
}

export async function GET(req: Request) {
  return NextResponse.json({ memories: [] });
}
