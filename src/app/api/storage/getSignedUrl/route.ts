import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

// Initialize storage client
let storage: Storage;

try {
  // For production, use service account credentials from environment variable
  const credentials = process.env.GCP_SERVICE_ACCOUNT_KEY;
  
  if (!credentials) {
    throw new Error('GCP credentials not found');
  }
  
  storage = new Storage({
    credentials: JSON.parse(Buffer.from(credentials, 'base64').toString()),
    projectId: process.env.GCP_PROJECT_ID
  });
} catch (error) {
  console.error('Error initializing Storage client:', error);
}

export async function POST(request: NextRequest) {
  try {
    // Get file information from request
    const { fileName, contentType } = await request.json();
    
    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: 'fileName and contentType are required' },
        { status: 400 }
      );
    }
    
    // The destination bucket and path
    const bucketName = 'nontech-webpage';
    const filePath = `ai-editor/3d_models/${fileName}`;
    
    // Get a signed URL for uploading (valid for 15 minutes)
    const [signedUrl] = await storage.bucket(bucketName).file(filePath).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: contentType,
    });
    
    return NextResponse.json({ signedUrl });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate signed URL', message: (error as Error).message },
      { status: 500 }
    );
  }
} 