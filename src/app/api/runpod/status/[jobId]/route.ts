import { NextRequest, NextResponse } from 'next/server';
import { getHeaders, getStatusUrl } from '../../utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId;
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Get status from RunPod
    const response = await fetch(getStatusUrl(jobId), {
      method: 'GET',
      headers: getHeaders(),
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
    console.error('Error checking job status:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
} 