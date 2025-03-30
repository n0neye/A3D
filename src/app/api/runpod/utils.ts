// RunPod API utilities

// Types
export interface RunPodResponse {
  id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  output?: any;
  error?: string;
}

export interface SubmitPayload {
  input: {
    image?: string;
    image_path?: string;
  };
}

// Constants
const RUNPOD_API_URL = 'https://api.runpod.ai/v2';
const API_KEY = process.env.RUNPOD_API_KEY;
const ENDPOINT_ID = 'gu4fk0x5f7m0iv';

// Headers for RunPod API requests
export const getHeaders = (): HeadersInit => ({
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
});

// URL helpers
export const getSubmitUrl = (): string => 
  `${RUNPOD_API_URL}/${ENDPOINT_ID}/run`;

export const getStatusUrl = (jobId: string): string => 
  `${RUNPOD_API_URL}/${ENDPOINT_ID}/status/${jobId}`; 