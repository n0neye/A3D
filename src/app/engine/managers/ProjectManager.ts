import * as THREE from 'three';
import { EditorEngine } from "../core/EditorEngine";
import { Observer } from "@/app/engine/utils/Observer";
import { SerializedShapeEntityData } from "../entity/types/ShapeEntity";
import { SerializedGenerativeEntityData } from "../entity/types/GenerativeEntity";
import { CharacterEntity } from "../entity/types/CharacterEntity";
import { SerializedCharacterEntityData } from "../entity/types/CharacterEntity";
import { GenerativeEntity } from "../entity/types/GenerativeEntity";
import { ShapeEntity } from "../entity/types/ShapeEntity";
import { LightEntity } from "../entity/types/LightEntity";
import { SerializedLightEntityData } from "../entity/types/LightEntity";
import { EntityBase, SerializedEntityData, isEntity } from "../entity/base/EntityBase";
import { defaultSettings } from "@/app/engine/utils/ProjectUtil";
import { IRenderLog, IRenderSettings } from '@/app/engine/interfaces/rendering';
import { SerializedTimelineData } from '../managers/timeline/TimelineManager';
// Interface for serialized render settings

interface IProjectData {
    version: string;
    timestamp: string;
    entities: SerializedEntityData[];
    environment: any;
    renderSettings: IRenderSettings;
    renderLogs: IRenderLog[];
    timeline?: SerializedTimelineData;
}

export class ProjectManager {
    private engine: EditorEngine;
    private settings: IRenderSettings = defaultSettings;
    private renderLogs: IRenderLog[] = [];
    private latestRender: IRenderLog | null = null;
    public observers = new Observer<{
        projectLoaded: { project: IRenderSettings };
        renderLogsChanged: { renderLogs: IRenderLog[], isNewRenderLog: boolean };
        renderSettingsChanged: { renderSettings: IRenderSettings };
        latestRenderChanged: { latestRender: IRenderLog | null };
    }>();

    constructor(engine: EditorEngine) {
        this.engine = engine;
    }

    // Load project from a file
    public async loadProjectFromFile(
        file: File,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    if (event.target && typeof event.target.result === 'string') {
                        const projectData = JSON.parse(event.target.result);
                        this.deserializeProject(projectData);
                        resolve();
                    }
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read project file'));
            };

            reader.readAsText(file);
        });
    }

    public async loadProjectFromUrl(url: string): Promise<void> {
        const response = await fetch(url);
        const projectData = await response.json();
        this.deserializeProject(projectData);
    }

    onProjectLoaded(project: IRenderSettings): void {
        console.log("ProjectManager: onProjectLoaded", project, this.observers);
        this.observers.notify('projectLoaded', { project });
    }

    // TODO: Integrate project-util.ts

    public async saveProjectToFile(
        fileName: string = 'scene-project.mud'
    ): Promise<void> {
        const projectData = this.serializeProject();
        const jsonString = JSON.stringify(projectData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/mud' });

        // Try to use the File System Access API if available (modern browsers)
        if ('showSaveFilePicker' in window) {
            try {
                // @ts-ignore - TypeScript might not recognize this API yet
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: 'MUD Files',
                        accept: { 'application/mud': ['.mud'] },
                    }],
                });

                // Create a writable stream
                // @ts-ignore - TypeScript might not recognize this API yet
                const writable = await fileHandle.createWritable();

                // Write the blob to the file
                // @ts-ignore - TypeScript might not recognize this API yet
                await writable.write(blob);

                // Close the file
                // @ts-ignore - TypeScript might not recognize this API yet
                await writable.close();

                return;
            } catch (err) {
                // User probably cancelled the save dialog or browser doesn't support it
                console.log("File System Access API failed, falling back to download method");
            }
        } else {

            // Fallback method for browsers that don't support File System Access API
            // This doesn't always show a Save As dialog, but we can try to encourage it
            const url = URL.createObjectURL(blob);

            // Create and trigger download
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;

            // Append to body and click (to ensure it works in all browsers)
            document.body.appendChild(a);
            a.click();

            // Clean up
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

        }
    }

    serializeProject(): IProjectData {
        const entities: EntityBase[] = this.engine.getObjectManager().getAllEntities();
        
        // Serialize environment settings
        const environment = this.engine.getEnvironmentManager().serializeEnvironment();

        // Serialize timeline data
        const timelineManager = this.engine.getTimelineManager();
        const timeline = timelineManager ? timelineManager.serialize() : undefined;

        // Create project data structure
        const project: IProjectData = {
            version: "1.0.1",
            timestamp: new Date().toISOString(),
            entities: entities.map(entity => entity.serialize()),
            environment: environment,
            renderSettings: this.settings,
            renderLogs: this.renderLogs,
            timeline: timeline
        };

        return project;
    }

    clearScene(): void {
        // Deselect
        this.engine.getSelectionManager().deselectAll();
        
        // Get all entities from object manager
        const existingEntities = this.engine.getObjectManager().getAllEntities();
        const scene = this.engine.getScene();

        // Dispose entities
        existingEntities.forEach(entity => {
            entity.dispose();
            scene.remove(entity);
            this.engine.getObjectManager().unregisterEntity(entity);
        });
    }
    
    deserializeProject(
        data: IProjectData,
    ): void {
        this.clearScene();
        
        const scene = this.engine.getScene();

        // Apply environment settings if present
        if (data.environment) {
            this.engine.getEnvironmentManager().deserializeEnvironment(data.environment);
        }


        // Create entities from the saved data
        if (data.entities && Array.isArray(data.entities)) {
            // Create entities from serialized data using entity class deserializers
            data.entities.forEach((entityData: SerializedEntityData) => {
                try {
                    // Create the entity based on its type
                    const entityType = entityData.entityType;

                    switch (entityType) {
                        case 'light':
                            LightEntity.deserialize(scene, entityData as SerializedLightEntityData);
                            break;

                        case 'shape':
                            ShapeEntity.deserialize(scene, entityData as SerializedShapeEntityData);
                            break;

                        case 'generative':
                            GenerativeEntity.deserialize(scene, entityData as SerializedGenerativeEntityData);
                            break;
                        case 'character':
                            CharacterEntity.deserialize(scene, entityData as SerializedCharacterEntityData);
                            break;
                        default:
                            console.warn(`Unknown entity type: ${entityType}`);
                            break;
                    }

                } catch (error) {
                    console.error(`Error creating entity from saved data:`, error, entityData);
                }
            });
        }

        // Deserialize timeline data if present
        if (data.timeline && this.engine.getTimelineManager()) {
            this.engine.getTimelineManager().deserialize(data.timeline, this.engine);
        }

        // Notify observers that the project has been loaded
        if (data.renderSettings) {
            this.settings = data.renderSettings;
            this.observers.notify('projectLoaded', { project: data.renderSettings });
        }
        if (data.renderLogs) {
            this.renderLogs = data.renderLogs;
            this.observers.notify('renderLogsChanged', { renderLogs: data.renderLogs, isNewRenderLog: false });
            
            this.latestRender = data.renderLogs[data.renderLogs.length - 1];
            this.observers.notify('latestRenderChanged', { latestRender: this.latestRender });
        }

        // After creating all entities, scan the scene to ensure all are registered
        this.engine.getObjectManager().scanScene();
    }

    updateRenderSettings(newSettings: Partial<IRenderSettings>): void {
        this.settings = { ...this.settings, ...newSettings };
        console.log("ProjectManager: updateRenderSettings", this.settings);
        this.observers.notify('renderSettingsChanged', { renderSettings: this.settings });
    }

    addRenderLog(log: IRenderLog, isNew: boolean = false): void {
        this.renderLogs.push(log);
        console.log("ProjectManager: addRenderLog", this.renderLogs);
        this.observers.notify('renderLogsChanged', { renderLogs: this.renderLogs, isNewRenderLog: isNew });
        this.latestRender = log;
        this.observers.notify('latestRenderChanged', { latestRender: log });
    }

    getRenderSettings(): IRenderSettings {
        return this.settings;
    }

    getLatestRender(): IRenderLog | null {
        return this.renderLogs.length > 0 ? this.renderLogs[this.renderLogs.length - 1] : null;
    }

    getRenderLogs(): IRenderLog[] {
        return this.renderLogs;
    }
}



