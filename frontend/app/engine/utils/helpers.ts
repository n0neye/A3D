// Utility function to download an image from a URL
export async function downloadImage(imageUrl: string, filename?: string): Promise<void> {
  if (!imageUrl) return;
  
  // Create default filename if not provided
  const defaultFilename = imageUrl.split('/').pop() || `render-${new Date().toISOString()}.png`;
  const downloadFilename = filename || defaultFilename;
  
  try {
    // Convert the dataURL to a blob
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    
    // Fallback method for browsers that don't support File System Access API
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFilename;
    a.target = '_blank';
    
    // Append to body and click (to ensure it works in all browsers)
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
  } catch (error) {
    console.error("Error downloading image:", error);
  }
}

// Add this function if it doesn't exist already
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  // Clean up
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}
