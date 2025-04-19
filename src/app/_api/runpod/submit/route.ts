import { NextRequest, NextResponse } from 'next/server';
import { getHeaders, getSubmitUrl, SubmitPayload } from '../utils';

// Configure request size limit
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Adjust based on your needs
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, imageUrl } = body;
    
    // Validate input
    if (!imageBase64 && !imageUrl) {
      return NextResponse.json(
        { error: 'Either imageBase64 or imageUrl must be provided' },
        { status: 400 }
      );
    }

    console.log("received data", imageBase64 ? "base64" : "url", imageBase64 ? imageBase64.length : imageUrl);

    // Prepare payload based on input type
    const payload: SubmitPayload = {
      input: imageUrl 
        ? { image_path: imageUrl }
        : { image: imageBase64 }
    };

    // Send request to RunPod
    const response = await fetch(getSubmitUrl(), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    // Handle response
    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: 'RunPod API error', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error submitting job:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
} 