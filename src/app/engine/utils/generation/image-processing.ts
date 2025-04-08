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
 * Resizes an image to fit within specified dimensions
 * @param imageDataUrl The data URL of the image
 * @param maxWidth The maximum width
 * @param maxHeight The maximum height
 * @param keepRatio Whether to maintain the original aspect ratio (defaults to true)
 * @returns A promise that resolves to the data URL of the resized image
 */
export async function resizeImage(
  imageDataUrl: string, 
  maxWidth: number = 512, 
  maxHeight: number = 512,
  keepRatio: boolean = true
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Calculate dimensions
        let targetWidth = maxWidth;
        let targetHeight = maxHeight;
        
        if (keepRatio) {
          const originalRatio = img.width / img.height;
          
          // Calculate which dimension constrains the resize
          if (img.width / maxWidth > img.height / maxHeight) {
            // Width is the limiting factor
            targetWidth = maxWidth;
            targetHeight = targetWidth / originalRatio;
          } else {
            // Height is the limiting factor
            targetHeight = maxHeight;
            targetWidth = targetHeight * originalRatio;
          }
        }
        
        // Create a canvas with the exact dimensions of the resized image
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get 2D context'));
          return;
        }
        
        // Draw the image resized to the canvas (no positioning needed)
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        // Get the data URL of the resized image
        const resizedImageUrl = canvas.toDataURL('image/png');
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

/**
 * Crops an image based on the ratio overlay frame
 * @param imageDataUrl The source image data URL
 * @param cropDimensions The dimensions to crop to
 * @returns A promise resolving to the cropped image data URL
 */
export const cropImageToRatioFrame = async (
  imageDataUrl: string,
  cropDimensions: {
      left: number;
      top: number;
      width: number;
      height: number;
  }
): Promise<{imageUrl: string, width: number, height: number}> => {
  return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
          // Create a canvas for cropping
          const canvas = document.createElement('canvas');
          canvas.width = cropDimensions.width;
          canvas.height = cropDimensions.height;
          
          // Get the drawing context
          const ctx = canvas.getContext('2d');
          if (!ctx) {
              reject(new Error('Failed to get canvas context'));
              return;
          }
          
          // Draw the cropped image
          ctx.drawImage(
              img,
              cropDimensions.left, cropDimensions.top, cropDimensions.width, cropDimensions.height,
              0, 0, cropDimensions.width, cropDimensions.height
          );
          
          // Convert to data URL
          resolve({imageUrl: canvas.toDataURL('image/png'), width: cropDimensions.width, height: cropDimensions.height});
      };
      
      img.onerror = () => {
          reject(new Error('Failed to load image for cropping'));
      };
      
      // Start loading the image
      img.src = imageDataUrl;
  });
};


// Convert a data URL to a Blob
export function dataURLtoBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new Blob([u8arr], { type: mime });
}


// Helper to convert a Blob to base64
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}



// Add this function to normalize depth maps based on actual min/max values in the scene
export const normalizeDepthMap = async (depthImageUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
          // Create a canvas to process the image
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
              reject(new Error('Failed to get canvas context'));
              return;
          }

          // Draw the image to the canvas
          ctx.drawImage(img, 0, 0);

          // Get the image data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          // Find min and max depth values in the image
          // Since we're using grayscale, we only need to look at one channel
          let minDepth = 255;
          let maxDepth = 0;

          // Skip fully transparent pixels (if any)
          for (let i = 0; i < data.length; i += 4) {
              if (data[i + 3] > 0) {  // Only consider non-transparent pixels
                  minDepth = Math.min(minDepth, data[i]);
                  maxDepth = Math.max(maxDepth, data[i]);
              }
          }

          // Ensure we don't divide by zero
          const depthRange = maxDepth - minDepth;
          if (depthRange <= 0) {
              resolve(depthImageUrl); // No normalization needed or possible
              return;
          }

          // Normalize the depth values to full 0-255 range
          for (let i = 0; i < data.length; i += 4) {
              if (data[i + 3] > 0) {  // Only process non-transparent pixels
                  // Normalize to 0-255 range
                  const normalizedValue = Math.round(((data[i] - minDepth) / depthRange) * 255);

                  // Set all RGB channels to the same value (grayscale)
                  data[i] = normalizedValue;     // R
                  data[i + 1] = normalizedValue; // G
                  data[i + 2] = normalizedValue; // B
              }
          }

          // Put the normalized data back to the canvas
          ctx.putImageData(imageData, 0, 0);

          // Return as data URL
          resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = () => {
          reject(new Error('Failed to load depth image for normalization'));
      };

      img.src = depthImageUrl;
  });
};
