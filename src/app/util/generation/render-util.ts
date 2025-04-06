import * as BABYLON from '@babylonjs/core';
import { cropImageToRatioFrame, resizeImage } from './image-processing';
import { EditorEngine } from '@/app/engine/EditorEngine';

// Add this utility function to convert depth texture to image
export const convertDepthTextureToImage = async (texture: BABYLON.Texture, width: number, height: number): Promise<string> => {
    // Get the raw pixel data
    const pixels = await texture.readPixels();
    if (!pixels) throw new Error("Failed to read texture pixels");

    // Convert to Float32Array to access the depth values
    const depthValues = new Float32Array(pixels.buffer);

    // Create a new canvas element
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    // Get the canvas context
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Failed to create canvas context");

    // Create an ImageData object
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // Fill the ImageData with depth values
    for (let i = 0; i < depthValues.length; i++) {
        // Apply the same transformation as in the shader
        const depth = depthValues[i];
        const scaledDepth = Math.pow(depth, 0.45);
        const displayDepth = 1.0 - scaledDepth;

        // Convert to 0-255 range
        const value = Math.floor(displayDepth * 255);

        // Set RGBA values
        const index = i * 4;
        data[index] = value;     // R
        data[index + 1] = value; // G
        data[index + 2] = value; // B
        data[index + 3] = 255;   // A
    }

    // Put the image data onto the canvas
    ctx.putImageData(imageData, 0, 0);

    // Return as data URL
    return canvas.toDataURL('image/png');
};

// Also update GetDepthMap to use the ratio frame
export const GetDepthMap = async (scene: BABYLON.Scene, engine: BABYLON.Engine) => {
    try {
        if (!scene || !engine) throw new Error("Scene or engine not found");
        if (!scene.activeCamera) throw new Error("Active camera not found");

        // Enable depth renderer with better settings
        const depthRenderer = scene.enableDepthRenderer(
            scene.activeCamera,
            false,  // Don't colorize
            true    // Use logarithmic depth buffer for better precision
        );

        // Adjust camera clip planes for better depth resolution if needed
        // scene.activeCamera.minZ = 0.1;  // Set to a reasonable near clip distance
        // scene.activeCamera.maxZ = 20;  // Set to a reasonable far clip distance

        // Force a render to update the depth values
        scene.render();

        //   Wait for 1 frame
        await new Promise(resolve => setTimeout(resolve, 1));

        // Get the depth map texture
        const depthMap = depthRenderer.getDepthMap();
        // Get width and height
        const width = depthMap.getRenderWidth();
        const height = depthMap.getRenderHeight();

        // Convert the texture to an image
        let depthSnapshot = await convertDepthTextureToImage(depthMap, width, height);

        // Normalize the depth map
        depthSnapshot = await normalizeDepthMap(depthSnapshot);

        // Check if we have an active ratio overlay
        const cameraManager = EditorEngine.getInstance().getCameraManager();
        const ratioDimensions = cameraManager.getRatioOverlayDimensions();

        if (!ratioDimensions) { throw new Error("No ratio overlay dimensions found"); }

        // Crop to the ratio overlay
        return await cropImageToRatioFrame(depthSnapshot, ratioDimensions);

    } catch (error) {
        console.error("Error generating depth map:", error);
        return null;
    }
};

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
