import * as BABYLON from '@babylonjs/core';
import { getRatioOverlayDimensions } from './editor/editor-util';

// Add this utility function to convert depth texture to image
export const convertTextureToImage = async (texture: BABYLON.Texture, width: number, height: number): Promise<string> => {
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
            true,    // Use logarithmic depth buffer for better precision
            BABYLON.Engine.TEXTURE_NEAREST_LINEAR_MIPLINEAR,
        );

        // Adjust camera clip planes for better depth resolution if needed
        scene.activeCamera.minZ = 0.1;  // Set to a reasonable near clip distance
        scene.activeCamera.maxZ = 20;  // Set to a reasonable far clip distance

        // Force a render to update the depth values
        scene.render();

        // Create an improved shader that better handles depth values
        BABYLON.Effect.ShadersStore['improvedDepthPixelShader'] = `
        varying vec2 vUV;
        uniform sampler2D textureSampler;
        uniform float near;
        uniform float far;
        
        void main(void) {
          // Get raw depth value
          float depth = texture2D(textureSampler, vUV).r;
          
          // Use a power function to emphasize smaller differences
          // This makes middle-range depths more visible
          float scaledDepth = pow(depth, 0.45);
          
          // Invert for better visualization (closer is brighter)
          float displayDepth = 1.0 - scaledDepth;
          
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

        // Save snapshot of depth map
        const width = engine.getRenderWidth();
        const height = engine.getRenderHeight();

        //   wait for 1 frame
        await new Promise(resolve => setTimeout(resolve, 1));

        const depthSnapshot = await BABYLON.Tools.CreateScreenshotAsync(
            engine,
            scene.activeCamera!,
            { width: width, height: height }
        );

        setTimeout(() => {
            // Detach depth renderer
            if (scene.activeCamera && postProcess) {
                scene.activeCamera.detachPostProcess(postProcess);
                postProcess.dispose();
            }
        }, seconds * 1000);

        // Update preview
        return depthSnapshot;
    } catch (error) {
        console.error("Error generating depth map:", error);
        return null;
    }
};

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
): Promise<string> => {
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
            resolve(canvas.toDataURL('image/png'));
        };
        
        img.onerror = () => {
            reject(new Error('Failed to load image for cropping'));
        };
        
        // Start loading the image
        img.src = imageDataUrl;
    });
};

// Modify the existing functions to use the cropping if overlay is active

// Modify CreateScreenshotAsync to use the ratio frame if visible
export async function TakeScreenshot(scene: BABYLON.Scene, engine: BABYLON.Engine): Promise<string | null> {
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
            return await cropImageToRatioFrame(screenshot, ratioDimensions);
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
        scene.activeCamera.minZ = 0.1;  // Set to a reasonable near clip distance
        scene.activeCamera.maxZ = 20;  // Set to a reasonable far clip distance

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
        const depthSnapshot = await convertTextureToImage(depthMap, width, height);

        // Check if we have an active ratio overlay
        const ratioDimensions = getRatioOverlayDimensions(scene);
        
        if (ratioDimensions) {
            // Crop to the ratio overlay
            return await cropImageToRatioFrame(depthSnapshot, ratioDimensions);
        }
        
        // Return the uncropped depth map if no overlay
        return depthSnapshot;

    } catch (error) {
        console.error("Error generating depth map:", error);
        return null;
    }
};
