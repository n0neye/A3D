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
 * @param maxWidth The maximum width
 * @param maxHeight The maximum height
 * @param keepRatio Whether to maintain the original aspect ratio (defaults to false)
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
        // Create a canvas for resizing
        const canvas = document.createElement('canvas');
        
        let targetWidth = maxWidth;
        let targetHeight = maxHeight;
        
        // Calculate dimensions if keeping aspect ratio
        if (keepRatio) {
          const originalRatio = img.width / img.height;
          const targetRatio = maxWidth / maxHeight;
          
          if (originalRatio > targetRatio) {
            // Image is wider than target: constrain by width
            targetWidth = maxWidth;
            targetHeight = targetWidth / originalRatio;
          } else {
            // Image is taller than target: constrain by height
            targetHeight = maxHeight;
            targetWidth = targetHeight * originalRatio;
          }
        }
        
        // Set canvas dimensions
        canvas.width = maxWidth;
        canvas.height = maxHeight;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get 2D context'));
          return;
        }
        
        // Clear canvas with transparent background
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // If keeping ratio, center the image in the canvas
        const x = keepRatio ? (maxWidth - targetWidth) / 2 : 0;
        const y = keepRatio ? (maxHeight - targetHeight) / 2 : 0;
        
        // Draw the image resized to the canvas
        ctx.drawImage(img, x, y, targetWidth, targetHeight);
        
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
