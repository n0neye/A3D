import * as BABYLON from '@babylonjs/core';
import { GizmoManager } from '@babylonjs/core';
import { EventEmitter } from '../utils/EventEmitter';
export type GizmoMode = 'position' | 'rotation' | 'scale' | 'boundingBox';
export class GizmoModeManager {
    private scene: BABYLON.Scene;
    private gizmoManager: GizmoManager;
    public events: EventEmitter = new EventEmitter();
    private currentMode: GizmoMode = 'position';

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
        this.gizmoManager = new GizmoManager(scene);
        
    }   

    public setGizmoMode(mode: GizmoMode): void {
        this.currentMode = mode;
        this.events.emit('gizmoModeChanged', mode);
    }

    public getGizmoMode(): GizmoMode {
        return this.currentMode;
    }

    public getGizmoManager(): GizmoManager {
        return this.gizmoManager;
    }
}
