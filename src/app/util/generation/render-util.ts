import * as BABYLON from '@babylonjs/core';
import { getRatioOverlayDimensions } from '../editor/editor-util';
import { cropImageToRatioFrame, resizeImage } from './image-processing';

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

export const EnableDepthRender = async (scene: BABYLON.Scene, engine: BABYLON.Engine, seconds: number = 2) => {
    try {
        if (!scene.activeCamera) throw new Error("Active camera not found");

        // Enable depth renderer with better settings
        const depthRenderer = scene.enableDepthRenderer(
            scene.activeCamera,
            false,  // Don't colorize
            true,   // Use logarithmic depth buffer for better precision
            BABYLON.Engine.TEXTURE_NEAREST_LINEAR_MIPLINEAR,
        );

        // Adjust camera clip planes for better depth resolution
        // scene.activeCamera.minZ = 0.1;
        // scene.activeCamera.maxZ = 20.0;

        // Force a render to update the depth values
        scene.render();

        // Create an improved shader with better normalization
        BABYLON.Effect.ShadersStore['improvedDepthPixelShader'] = `
        varying vec2 vUV;
        uniform sampler2D textureSampler;
        uniform float near;
        uniform float far;
        
        void main(void) {
          // Get raw depth value
          float depth = texture2D(textureSampler, vUV).r;
          
          // Ensure depth is in valid range
          depth = clamp(depth, 0.0, 1.0);
          
          // Use a power function with more aggressive scaling for better visibility
          // depth = pow(depth, 0.45);
          
          // Invert for better visualization (closer is brighter)
          float displayDepth = 1.0 - depth;
          
          // Ensure final output is strictly in 0-1 range
          displayDepth = clamp(displayDepth, 0.0, 1.0);
          
          gl_FragColor = vec4(displayDepth, displayDepth, displayDepth, 1.0);
        }
      `;

        // Create the post process with our improved shader
        const postProcess = new BABYLON.PostProcess(
            "depthVisualizer",
            "improvedDepth",
            ["near", "far"],  // Added uniforms for near/far planes
            null,
            1.0,
            scene.activeCamera
        );

        // Set up the shader parameters and texture
        postProcess.onApply = (effect) => {
            effect.setTexture("textureSampler", depthRenderer.getDepthMap());
            effect.setFloat("near", scene.activeCamera!.minZ);
            effect.setFloat("far", scene.activeCamera!.maxZ);
        };

        //   wait for 1 frame
        await new Promise(resolve => setTimeout(resolve, 1));

        const depthSnapshot = await TakeFramedScreenshot(scene, engine);

        // Normalize the depth map
        const normalizedDepthSnapshot = await normalizeDepthMap(depthSnapshot || '');

        setTimeout(() => {
            // Detach depth renderer
            if (scene.activeCamera && postProcess) {
                scene.activeCamera.detachPostProcess(postProcess);
                postProcess.dispose();
            }
        }, seconds * 1000);

        // Return the normalized depth map
        return normalizedDepthSnapshot;
    } catch (error) {
        console.error("Error generating depth map:", error);
        return null;
    }
};


// Modify the existing functions to use the cropping if overlay is active

// Modify CreateScreenshotAsync to use the ratio frame if visible
export async function TakeFramedScreenshot(scene: BABYLON.Scene, engine: BABYLON.Engine, maxSize: number = 1280): Promise<string | null> {
    try {
        if (!scene || !engine) return null;

        // Get standard screenshot
        const screenshot = await BABYLON.Tools.CreateScreenshotAsync(
            engine,
            scene.activeCamera as BABYLON.Camera,
            { precision: 1 }
        );

        // Check if we have an active ratio overlay
        const ratioDimensions = getRatioOverlayDimensions(scene);

        if (ratioDimensions) {
            // Crop to the ratio overlay
            const { imageUrl, width, height } = await cropImageToRatioFrame(screenshot, ratioDimensions);
            // Resize the screenshot if it's too large
            if (width > maxSize || height > maxSize) {
                const resized = await resizeImage(imageUrl, maxSize, maxSize);
                return resized;
            }
            return imageUrl;
        }

        // Return the uncropped screenshot if no overlay
        return screenshot;
    } catch (error) {
        console.error("Error taking screenshot:", error);
        return null;
    }
}

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
        const ratioDimensions = getRatioOverlayDimensions(scene);

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
