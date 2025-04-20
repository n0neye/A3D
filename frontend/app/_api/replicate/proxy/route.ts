import { NextRequest, NextResponse } from 'next/server';
import Replicate from "replicate";

// Initialize the Replicate client with API token
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

export async function POST(request: NextRequest) {
  if (!REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN is not set" },
      { status: 500 }
    );
  }

  try {
    // Initialize the Replicate client
    const replicate = new Replicate({
      auth: REPLICATE_API_TOKEN,
    });

    // Read the request body
    const requestData = await request.json();
    const { version, input } = requestData;

    // If no version is provided in the request, use the LCM model by default
    const modelVersion = version || "683d19dc312f7a9f0428b04429a9ccefd28dbf7785fef083ad5cf991b65f406f";
    const modelString = version ? version : "fofr/latent-consistency-model:" + modelVersion;

    // Run the model
    const prediction = await replicate.predictions.create({
      version: modelVersion,
      input: input,
    });

    // Return the prediction ID for polling
    return NextResponse.json(prediction);
  } catch (error) {
    console.error("Replicate API error:", error);
    return NextResponse.json(
      { error: "An error occurred while calling Replicate API" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // For polling the status of a prediction
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  
  if (!id) {
    return NextResponse.json(
      { error: "Prediction ID is required" },
      { status: 400 }
    );
  }

  if (!REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN is not set" },
      { status: 500 }
    );
  }

  try {
    // Initialize the Replicate client
    const replicate = new Replicate({
      auth: REPLICATE_API_TOKEN,
    });

    // Get the prediction status
    const prediction = await replicate.predictions.get(id);
    
    return NextResponse.json(prediction);
  } catch (error) {
    console.error("Replicate API error:", error);
    return NextResponse.json(
      { error: "An error occurred while polling Replicate API" },
      { status: 500 }
    );
  }
} 