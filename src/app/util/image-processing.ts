/**
 * Adds visual noise to an image
 * @param imageDataUrl The data URL of the image
 * @param noiseStrength Amount of noise to add (0-1)
 * @returns A promise that resolves to the data URL of the noisy image
 */
export async function addNoiseToImage(imageDataUrl: string, noiseStrength: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Create a canvas to process the image
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get 2D context'));
          return;
        }
        
        // Draw the original image
        ctx.drawImage(img, 0, 0);
        
        // Get the image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Add noise to each pixel
        const noiseAmount = noiseStrength * 255; // Scale to pixel values
        
        for (let i = 0; i < data.length; i += 4) {
          // Add random noise to RGB channels
          for (let j = 0; j < 3; j++) {
            const noise = (Math.random() - 0.5) * noiseAmount;
            data[i + j] = Math.min(255, Math.max(0, data[i + j] + noise));
          }
          // Don't modify alpha channel (i+3)
        }
        
        // Put the modified image data back
        ctx.putImageData(imageData, 0, 0);
        
        // Get the data URL
        const noisyImageUrl = canvas.toDataURL('image/jpeg', 0.9);
        resolve(noisyImageUrl);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = (error) => {
      reject(error);
    };
    
    img.src = imageDataUrl;
  });
}

/**
 * Resizes an image to a specific width and height
 * @param imageDataUrl The data URL of the image
 * @param targetWidth The desired width
 * @param targetHeight The desired height
 * @returns A promise that resolves to the data URL of the resized image
 */
export async function resizeImage(
  imageDataUrl: string, 
  targetWidth: number = 512, 
  targetHeight: number = 512
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Create a canvas for resizing
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get 2D context'));
          return;
        }
        
        // Draw the image resized to the canvas
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        // Get the data URL of the resized image
        const resizedImageUrl = canvas.toDataURL('image/jpeg', 0.9);
        resolve(resizedImageUrl);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = (error) => {
      reject(error);
    };
    
    img.src = imageDataUrl;
  });
} 