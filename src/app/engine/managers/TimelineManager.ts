import * as THREE from 'three';
import { EditorEngine } from '../core/EditorEngine';
import { EntityBase } from '../entity/base/EntityBase';
import { Observer } from '../utils/Observer';
import * as THEATRE from '@theatre/core';
import studio from '@theatre/studio';

// Mapping between entity IDs and their Theatre.js objects
interface EntityTimelineMap {
  [entityId: string]: {
    sheet: THEATRE.ISheet;
    obj: THEATRE.ISheetObject<any>;
  };
}

// Types of properties that can be animated
export type AnimatableProperty = 'position' | 'rotation' | 'scale' | 'fov';

/**
 * Manages the animation timeline for all entities in the scene
 * Integrates with Theatre.js for animation playback
 */
export class TimelineManager {
  private engine: EditorEngine;
  private project: THEATRE.IProject;
  private entityMap: EntityTimelineMap = {};
  private isPlaying: boolean = false;
  private initialized: boolean = false;

  // Observer for timeline events
  public observers = new Observer<{
    timelineUpdated: { time: number };
    playbackStateChanged: { isPlaying: boolean };
    keyframeAdded: { entityId: string; property: AnimatableProperty; time: number };
    entityAnimationCreated: { entityId: string };
  }>();

  constructor(engine: EditorEngine) {
    this.engine = engine;
    
    // Create a Theatre.js project
    this.project = THEATRE.getProject('AI-Editor-Animation');
    
    // Initialize Theatre.js studio in development
    if (process.env.NODE_ENV !== 'production') {
      studio.initialize();
    }
  }

  /**
   * Initialize the timeline manager
   */
  initialize() {
    if (this.initialized) return;
    
    this.initialized = true;
    
    // Set up additional initialization if needed
    
    // Notify that initialization is complete
    console.log('TimelineManager initialized');
  }

  /**
   * Get the Theatre.js project
   */
  getProject(): THEATRE.IProject {
    return this.project;
  }

  /**
   * Play the timeline animation
   */
  play() {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.project.ready.then(() => {
      const sheet = this.project.sheet('Main');
      sheet.sequence.play({ iterationCount: Infinity });
    });
    this.observers.notify('playbackStateChanged', { isPlaying: true });
  }

  /**
   * Pause the timeline animation
   */
  pause() {
    if (!this.isPlaying) return;
    
    this.isPlaying = false;
    this.project.ready.then(() => {
      const sheet = this.project.sheet('Main');
      sheet.sequence.pause();
    });
    this.observers.notify('playbackStateChanged', { isPlaying: false });
  }

  /**
   * Toggle play/pause state
   */
  togglePlayback() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Scrub the timeline to a specific time
   */
  scrubTo(time: number) {
    this.project.ready.then(() => {
      const sheet = this.project.sheet('Main');
      sheet.sequence.position = time;
    });
    this.observers.notify('timelineUpdated', { time });
  }

  /**
   * Create a Theatre.js object for a camera
   */
  createCameraAnimation() {
    const camera = this.engine.getCameraManager().getCamera();
    const cameraSheet = this.project.sheet('Camera');
    
    // Create Theatre.js object with props using Theatre.js types
    const cameraProps = {
      position: {
        x: THEATRE.types.number(camera.position.x),
        y: THEATRE.types.number(camera.position.y),
        z: THEATRE.types.number(camera.position.z)
      },
      rotation: {
        x: THEATRE.types.number(camera.rotation.x),
        y: THEATRE.types.number(camera.rotation.y),
        z: THEATRE.types.number(camera.rotation.z)
      },
      fov: THEATRE.types.number(camera.fov)
    };
    
    // Create the object with the props
    const cameraObj = cameraSheet.object('Camera', cameraProps);
    
    // Set up change handlers
    cameraObj.onValuesChange((values) => {
      // Update camera position
      camera.position.set(
        values.position.x,
        values.position.y,
        values.position.z
      );
      
      // Update camera rotation
      camera.rotation.set(
        values.rotation.x,
        values.rotation.y,
        values.rotation.z
      );
      
      // Update camera FOV
      camera.fov = values.fov;
      camera.updateProjectionMatrix();
    });
    
    // Store in entity map (using "camera" as a special entityId)
    this.entityMap["camera"] = {
      sheet: cameraSheet,
      obj: cameraObj
    };
    
    return cameraObj;
  }

  /**
   * Create a Theatre.js object for an entity
   */
  createEntityAnimation(entity: EntityBase) {
    // Skip if already exists
    if (this.entityMap[entity.entityId]) {
      return this.entityMap[entity.entityId].obj;
    }
    
    // Create a sheet for this entity (using entity name for readability)
    const entitySheet = this.project.sheet(entity.name);
    
    // Create Theatre.js object with props using Theatre.js types
    const entityProps = {
      position: {
        x: THEATRE.types.number(entity.position.x),
        y: THEATRE.types.number(entity.position.y),
        z: THEATRE.types.number(entity.position.z)
      },
      rotation: {
        x: THEATRE.types.number(entity.rotation.x),
        y: THEATRE.types.number(entity.rotation.y),
        z: THEATRE.types.number(entity.rotation.z)
      },
      scale: {
        x: THEATRE.types.number(entity.scale.x),
        y: THEATRE.types.number(entity.scale.y),
        z: THEATRE.types.number(entity.scale.z)
      }
    };
    
    // Create the object with the props
    const entityObj = entitySheet.object(entity.name, entityProps);
    
    // Set up change handlers
    entityObj.onValuesChange((values) => {
      // Update entity position
      entity.position.set(
        values.position.x,
        values.position.y,
        values.position.z
      );
      
      // Update entity rotation
      entity.rotation.set(
        values.rotation.x,
        values.rotation.y,
        values.rotation.z
      );
      
      // Update entity scale
      entity.scale.set(
        values.scale.x,
        values.scale.y,
        values.scale.z
      );
    });
    
    // Store in entity map
    this.entityMap[entity.entityId] = {
      sheet: entitySheet,
      obj: entityObj
    };
    
    // Notify that entity animation was created
    this.observers.notify('entityAnimationCreated', { entityId: entity.entityId });
    
    return entityObj;
  }

  /**
   * Add a keyframe to the camera at the current time
   */
  addCameraKeyframe(property: 'position' | 'rotation' | 'fov', time?: number) {
    // Make sure camera animation exists
    if (!this.entityMap["camera"]) {
      this.createCameraAnimation();
    }
    
    const camera = this.engine.getCameraManager().getCamera();
    const cameraObj = this.entityMap["camera"].obj;
    const currentTime = time ?? this.getCurrentTime();
    
    // According to Theatre.js docs, we need to use Studio API to add keyframes
    // For the MVP, we'll just update the object's value, which will be visible in the Studio UI
    if (property === 'position') {
      this.project.ready.then(() => {
        // Update the object value which should be visible in the Studio timeline
        cameraObj.initialValue = {
          position: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z
          }
        };
      });
    } else if (property === 'rotation') {
      this.project.ready.then(() => {
        cameraObj.initialValue = {
          rotation: {
            x: camera.rotation.x,
            y: camera.rotation.y,
            z: camera.rotation.z
          }
        };
      });
    } else if (property === 'fov') {
      this.project.ready.then(() => {
        cameraObj.initialValue = {
          fov: camera.fov
        };
      });
    }
    
    // Notify that keyframe was added
    this.observers.notify('keyframeAdded', { 
      entityId: "camera", 
      property, 
      time: currentTime 
    });
  }

  /**
   * Add a keyframe to an entity at the current time
   */
  addEntityKeyframe(entity: EntityBase, property: 'position' | 'rotation' | 'scale', time?: number) {
    // Make sure entity animation exists
    if (!this.entityMap[entity.entityId]) {
      this.createEntityAnimation(entity);
    }
    
    const entityObj = this.entityMap[entity.entityId].obj;
    const currentTime = time ?? this.getCurrentTime();
    
    // Add keyframe based on property type
    if (property === 'position') {
      this.project.ready.then(() => {
        entityObj.initialValue = {
          position: {
            x: entity.position.x,
            y: entity.position.y,
            z: entity.position.z
          }
        };
      });
    } else if (property === 'rotation') {
      this.project.ready.then(() => {
        entityObj.initialValue = {
          rotation: {
            x: entity.rotation.x,
            y: entity.rotation.y,
            z: entity.rotation.z
          }
        };
      });
    } else if (property === 'scale') {
      this.project.ready.then(() => {
        entityObj.initialValue = {
          scale: {
            x: entity.scale.x,
            y: entity.scale.y,
            z: entity.scale.z
          }
        };
      });
    }
    
    // Notify that keyframe was added
    this.observers.notify('keyframeAdded', { 
      entityId: entity.entityId, 
      property, 
      time: currentTime 
    });
  }

  /**
   * Get the status of the timeline playback
   */
  isTimelinePlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get the current time of the timeline
   */
  getCurrentTime(): number {
    let time = 0;
    // We need to use a sheet to get the position
    const mainSheet = this.project.sheet('Main');
    
    // This is asynchronous, so we can't return the actual time directly
    // For now, we'll return 0 or the last known time
    this.project.ready.then(() => {
      time = mainSheet.sequence.position;
    });
    
    return time;
  }
  
  /**
   * Dispose and clean up resources
   */
  dispose() {
    // Clean up Theatre.js
    if (process.env.NODE_ENV !== 'production') {
      studio.ui.hide();
    }
    
    // Reset variables
    this.entityMap = {};
    this.isPlaying = false;
  }
} 