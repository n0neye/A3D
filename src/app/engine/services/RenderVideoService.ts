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
import { EditorEngine } from '@/app/engine/core/EditorEngine';
import { RenderService } from './RenderService';
import { TimelineManager } from '../managers/timeline/TimelineManager';
import { dataURLtoBlob, resizeImage } from '@/app/engine/utils/generation/image-processing';

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

  constructor(engine: EditorEngine, renderService: RenderService) {
    this.engine = engine;
    this.renderService = renderService;
    this.timelineManager = engine.getTimelineManager();
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
    
    try {
      // Get timeline duration
      const timelineDuration = this.timelineManager.getDuration();
      
      // Calculate number of frames to capture
      const frameCount = Math.ceil(timelineDuration * options.fps);
      
      // Prepare array to store frame data
      const frames: string[] = [];
      const depthFrames: string[] = [];
      
      // Store original playback state
      const wasPlaying = this.timelineManager.isPlaying();
      
      // Pause any current playback
      if (wasPlaying) {
        this.timelineManager.pause();
      }
      
      // Store original timeline position
      const originalPosition = this.timelineManager.getPosition();
      
      // Hide gizmos and helpers during rendering
      this.renderService.setAllGizmoVisibility(false);
      
      // Process each frame
      for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
        // Check if rendering was canceled
        if (this.shouldCancelRender) {
          throw new Error('Rendering was canceled');
        }
        
        // Calculate time for this frame
        const frameTime = (frameIndex / frameCount) * timelineDuration;
        
        // Set timeline to this position
        this.timelineManager.setPosition(frameTime);
        
        // Wait for the scene to update
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Capture regular screenshot
        const screenshot = await this.renderService.takeFramedScreenshot();
        
        if (screenshot) {
          // Resize the screenshot if needed
          const resizedFrame = await resizeImage(screenshot, options.width, options.height);
          frames.push(resizedFrame);
          
          // Provide preview of current frame
          options.onPreviewFrame(resizedFrame);
          
          // Capture depth map if requested
          if (options.includeDepth) {
            const depthMap = await this.renderService.enableDepthRender(0.1);
            if (depthMap) {
              const resizedDepthFrame = await resizeImage(depthMap, options.width, options.height);
              depthFrames.push(resizedDepthFrame);
            }
          }
        }
        
        // Update progress
        options.onProgress((frameIndex + 1) / frameCount);
      }
      
      // Generate the video from frames
      const videoUrl = await this.generateVideoFromFrames(
        options.includeDepth ? depthFrames : frames, 
        options.fps
      );
      
      // Restore original state
      this.timelineManager.setPosition(originalPosition);
      if (wasPlaying) {
        this.timelineManager.play();
      }
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
    // Set the includeDepth option to true
    return this.renderVideo({
      ...options,
      includeDepth: true
    });
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
  private async generateVideoFromFrames(frames: string[], fps: number): Promise<string> {
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
          canvas.width = firstImage.width;
          canvas.height = firstImage.height;
          
          // Create MediaRecorder
          const stream = canvas.captureStream(fps);
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 5000000 // 5 Mbps
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
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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