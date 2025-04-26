import { NextRequest, NextResponse } from 'next/server';
import { getHeaders, getStatusUrl } from '../../utils';


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // check jobid is string
    if (typeof jobId !== 'string') {
      return NextResponse.json(
        { error: 'Job ID must be a string' },
        { status: 400 }
      );
    }

    console.log("Checking job status for:", jobId);

    // Get status from RunPod
    const response = await fetch(getStatusUrl(jobId), {
      method: 'GET',
      headers: getHeaders(),
    });

    // Handle response
    if (!response.ok) {
      const errorData = await response.json();
      console.error("RunPod API error:", errorData);
      return NextResponse.json(
        { error: 'RunPod API error', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("Job status response:", data.status);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error checking job status:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}
// --- END OF FILE route.ts ---