/**
 * RenderVideoService.ts
 * 
 * Responsible for rendering videos from timeline animations in the 3D editor.
 * This service encapsulates functionality for:
 * - Capturing frames during timeline playback
 * - Creating depth videos
 * - Converting frame sequences to video
 * - Managing video rendering progress
 * 
 * Works in conjunction with RenderService and TimelineManager.
 */
import * as THREE from 'three';
import { EditorEngine } from '@/engine/core/EditorEngine';
import { RenderService } from './RenderService';
import { TimelineManager } from '../managers/timeline/TimelineManager';
import { dataURLtoBlob, resizeImage } from '@/engine/utils/generation/image-processing';

// Define interfaces for video rendering
export interface VideoRenderOptions {
  fps: number;
  width: number;
  height: number;
  includeDepth: boolean;
  onProgress: (progress: number) => void;
  onPreviewFrame: (imageUrl: string) => void;
}

export interface VideoRenderResult {
  videoUrl: string;
  duration: number;
  frameCount: number;
  executionTimeMs: number;
}

export class RenderVideoService {
  private engine: EditorEngine;
  private renderService: RenderService;
  private timelineManager: TimelineManager;
  private isRendering: boolean = false;
  private shouldCancelRender: boolean = false;
  private renderer: THREE.WebGLRenderer;

  constructor(engine: EditorEngine, renderService: RenderService, renderer: THREE.WebGLRenderer) {
    this.engine = engine;
    this.renderService = renderService;
    this.timelineManager = engine.getTimelineManager();
    this.renderer = renderer;
  }

  /**
   * Render a video from the current timeline animation
   */
  public async renderVideo(options: VideoRenderOptions): Promise<VideoRenderResult | null> {
    if (this.isRendering) {
      console.warn('A video render is already in progress');
      return null;
    }

    const startTime = Date.now();
    this.isRendering = true;
    this.shouldCancelRender = false;

    let stopDepthRenderFunction: (() => void) | null = null;
    if (options.includeDepth) {
      const { stopDepthRender } = this.renderService.startDepthRender();
      stopDepthRenderFunction = stopDepthRender;
    }

    try {
      // Get timeline duration
      // const timelineDuration = this.timelineManager.getDuration();
      const timelineDuration = 1; //for testing

      // Calculate number of frames to capture
      const frameCount = Math.ceil(timelineDuration * options.fps);

      // Prepare array to store frame data
      const frames: string[] = [];

      // Pause any current playback
      this.timelineManager.pause();

      // Store original timeline position
      const originalPosition = this.timelineManager.getCurrentTime();

      // Hide gizmos and helpers during rendering
      this.renderService.setAllGizmoVisibility(false);

      // Get camera
      const cameraManager = this.engine.getCameraManager();
      const camera = cameraManager.getCamera();
      

      // Get the frame dimensions
      const ratioDimensions = cameraManager.getRatioOverlayDimensions();
      if (!ratioDimensions) {
          throw new Error("No ratio dimensions found");
      }
      // Multiply the frame dimensions with pixel ratio to account for high-DPI displays
      const pixelRatio = this.renderer.pixelRatio || window.devicePixelRatio;
      const frame = {
          left: ratioDimensions.frame.left * pixelRatio,
          top: ratioDimensions.frame.top * pixelRatio,
          width: ratioDimensions.frame.width * pixelRatio,
          height: ratioDimensions.frame.height * pixelRatio
      };


      // Process each frame
      for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
        // Check if rendering was canceled
        if (this.shouldCancelRender) {
          throw new Error('Rendering was canceled');
        }

        // Calculate time for this frame
        const frameTime = (frameIndex / frameCount) * timelineDuration;

        // Set timeline to this position
        this.timelineManager.setCurrentTime(frameTime);

        // Wait for the scene to update
        await new Promise(resolve => setTimeout(resolve, 1));

        // Render the scene
        this.renderer.render(this.engine.getScene(), camera);

        // Get the canvas data as base64 image
        const screenshot = this.renderer.domElement.toDataURL('image/jpeg', 0.9);
        frames.push(screenshot);

        // Update progress
        options.onProgress((frameIndex + 1) / frameCount);
      }

      if (options.includeDepth && stopDepthRenderFunction) {
        stopDepthRenderFunction();
      }

      // Generate the video from frames
      const videoUrl = await this.generateVideoFromFrames(
        frames,
        options.fps,
        frame
      );

      // Restore original state
      this.timelineManager.setCurrentTime(originalPosition);
      this.renderService.setAllGizmoVisibility(true);

      // Return result
      return {
        videoUrl,
        duration: timelineDuration,
        frameCount,
        executionTimeMs: Date.now() - startTime
      };

    } catch (error) {
      console.error('Error rendering video:', error);

      // Restore original visibility state
      this.renderService.setAllGizmoVisibility(true);

      return null;
    } finally {
      this.isRendering = false;
    }
  }

  /**
   * Generate a depth video by rendering the scene with depth visualization
   */
  public async renderDepthVideo(options: VideoRenderOptions): Promise<VideoRenderResult | null> {

    const startTime = Date.now();
    this.isRendering = true;
    this.shouldCancelRender = false;

    // Store original timeline position
    const originalPosition = this.timelineManager.getCurrentTime();

    try {
      // Get timeline duration
      // const timelineDuration = this.timelineManager.getDuration();
      const timelineDuration = 2; //for testing

      // Calculate number of frames to capture
      const frameCount = Math.ceil(timelineDuration * options.fps);

      // Prepare array to store frame data
      const frames: string[] = [];

      // Pause any current playback
      this.timelineManager.pause();


      // Hide gizmos and helpers during rendering
      this.renderService.setAllGizmoVisibility(false);

      // Get camera
      const cameraManager = this.engine.getCameraManager();
      const camera = cameraManager.getCamera();

      const { stopDepthRender, renderer, postScene, postCamera } = this.renderService.startDepthRender();


      // Get the frame dimensions
      const ratioDimensions = cameraManager.getRatioOverlayDimensions();
      if (!ratioDimensions) {
          throw new Error("No ratio dimensions found");
      }
      // Multiply the frame dimensions with pixel ratio to account for high-DPI displays
      const pixelRatio = this.renderer.pixelRatio || window.devicePixelRatio;
      const frame = {
          left: ratioDimensions.frame.left * pixelRatio,
          top: ratioDimensions.frame.top * pixelRatio,
          width: ratioDimensions.frame.width * pixelRatio,
          height: ratioDimensions.frame.height * pixelRatio
      };


      // Process each frame
      for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
        // Check if rendering was canceled
        if (this.shouldCancelRender) {
          throw new Error('Rendering was canceled');
        }

        // Set timeline time
        const frameTime = (frameIndex / frameCount) * timelineDuration;
        this.timelineManager.setCurrentTime(frameTime);

        // Wait for the scene to update
        await new Promise(resolve => setTimeout(resolve, 1));

        // Render the scene
        renderer.render(postScene, postCamera);

        // Get the canvas data as base64 image
        const screenshot = this.renderer.domElement.toDataURL('image/jpeg', 0.9);
        frames.push(screenshot);

        // Update progress
        options.onProgress((frameIndex + 1) / frameCount);
      }

      stopDepthRender();

      // Generate the video from frames
      const videoUrl = await this.generateVideoFromFrames(
        frames,
        options.fps,
        frame
      );

      // Restore original state
      this.timelineManager.setCurrentTime(originalPosition);
      this.renderService.setAllGizmoVisibility(true);

      // Return result
      return {
        videoUrl,
        duration: timelineDuration,
        frameCount,
        executionTimeMs: Date.now() - startTime
      };

    } catch (error) {
      console.error('Error rendering video:', error);

      // Restore original visibility state
      this.renderService.setAllGizmoVisibility(true);

      return null;
    } finally {
      this.isRendering = false;
    }
  }

  /**
   * Cancel an ongoing video render
   */
  public cancelRender(): void {
    if (this.isRendering) {
      this.shouldCancelRender = true;
    }
  }

  /**
   * Check if a render is currently in progress
   */
  public isRenderInProgress(): boolean {
    return this.isRendering;
  }

  /**
   * Generate a video from a sequence of frames
   * Uses MediaRecorder API to create a video from frame sequence
   */
  private async generateVideoFromFrames(frames: string[], fps: number,
    cropDimensions: {
      left: number;
      top: number;
      width: number;
      height: number;
    }): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        // Create a canvas to draw frames on
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Could not get canvas context');
        }

        // Set canvas size based on first frame
        const firstImage = new Image();
        firstImage.onload = () => {
          canvas.width = cropDimensions.width;
          canvas.height = cropDimensions.height;

          // Create MediaRecorder
          const stream = canvas.captureStream(fps);
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 20000000 // 20 Mbps
          });

          const chunks: Blob[] = [];

          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunks.push(e.data);
            }
          };

          mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const videoUrl = URL.createObjectURL(blob);
            resolve(videoUrl);
          };

          // Start recording
          mediaRecorder.start();

          // Function to draw each frame
          let frameIndex = 0;
          const drawNextFrame = () => {
            if (frameIndex < frames.length) {
              const img = new Image();
              img.onload = () => {
                ctx.drawImage(
                  img,
                  cropDimensions.left, cropDimensions.top, cropDimensions.width, cropDimensions.height,
                  0, 0, cropDimensions.width, cropDimensions.height
                );
                frameIndex++;

                // Schedule next frame
                setTimeout(drawNextFrame, 1000 / fps);
              };
              img.src = frames[frameIndex];
            } else {
              // All frames processed, stop recording
              mediaRecorder.stop();
            }
          };

          // Start drawing frames
          drawNextFrame();
        };

        // Load first image to initialize canvas size
        firstImage.src = frames[0];

      } catch (error) {
        reject(error);
      }
    });
  }
} 