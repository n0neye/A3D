import { EditorEngine } from "../core/EditorEngine";
import { Observer } from "@/engine/utils/Observer";
import { CharacterEntity } from "../entity/types/CharacterEntity";
import { EntityBase, SerializedEntityData } from "../entity/base/EntityBase";
import { defaultSettings } from "@/engine/utils/ProjectUtil";
import { IRenderLog, IRenderSettings } from '@/engine/interfaces/rendering';
import { SerializedTimelineData } from './timeline/TimelineManager';
import { EntityFactory } from '../entity/EntityFactory';
import { FileService } from '../services/FileService/FileService';
import { LocalFileWorker } from '../services/FileService/LocalFileWorker';
import { siteConfig } from '@/siteConfig';

// Interface for serialized render settings

interface IProjectData {
    version: string;
    timestamp: string;
    projectName: string;
    entities: SerializedEntityData[];
    environment: any;
    renderSettings: IRenderSettings;
    renderLogs: IRenderLog[];
    timeline?: SerializedTimelineData;
}

const DEFAULT_PROJECT_NAME = 'Untitled Project';

export class ProjectManager {
    private engine: EditorEngine;
    private settings: IRenderSettings = defaultSettings;
    private renderLogs: IRenderLog[] = [];
    private latestRender: IRenderLog | null = null;
    private fileService: FileService;
    private localFileWorker: LocalFileWorker;
    private isElectron: boolean;
    private currentProjectPath: string | null = null;
    private currentProjectName: string = DEFAULT_PROJECT_NAME;
    private hasUnsavedChanges: boolean = false;
    public observers = new Observer<{
        projectLoaded: { project: IRenderSettings };
        renderLogsChanged: { renderLogs: IRenderLog[], isNewRenderLog: boolean };
        renderSettingsChanged: { renderSettings: IRenderSettings };
        latestRenderChanged: { latestRender: IRenderLog | null };
        projectPathChanged: { path: string | null };
        projectNameChanged: { name: string };
        unsavedChangesStatusChanged: { hasUnsaved: boolean };
    }>();

    constructor(engine: EditorEngine) {
        this.engine = engine;
        this.fileService = FileService.getInstance();
        this.localFileWorker = new LocalFileWorker();
        this.isElectron = typeof window !== 'undefined' && !!window.electron?.isElectron;

        this.engine.getHistoryManager().observer.subscribe('historyChanged', this.onHistoryChanged);
    }

    private onHistoryChanged = (): void => {
        if (!this.hasUnsavedChanges) {
            this.setUnsavedChanges(true);
        }
    }

    private setUnsavedChanges(hasUnsaved: boolean): void {
        if (this.hasUnsavedChanges !== hasUnsaved) {
            this.hasUnsavedChanges = hasUnsaved;
            this.observers.notify('unsavedChangesStatusChanged', { hasUnsaved: this.hasUnsavedChanges });
            console.log("ProjectManager: Unsaved changes status:", this.hasUnsavedChanges);
        }
    }

    private async loadProjectData(projectJsonString: string, filePath: string | null = null): Promise<void> {
        try {
            const projectData: IProjectData = JSON.parse(projectJsonString);
            let nameToSet = projectData.projectName || DEFAULT_PROJECT_NAME;
            if (!projectData.projectName && filePath) {
                const filename = filePath.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, "");
                if (filename) {
                    nameToSet = filename;
                }
            }

            await this.deserializeProject(projectData);

            this.currentProjectPath = filePath;
            this.currentProjectName = nameToSet;

            this.observers.notify('projectPathChanged', { path: this.currentProjectPath });
            this.observers.notify('projectNameChanged', { name: this.currentProjectName });

            this.setUnsavedChanges(false);

        } catch (error) {
            console.error("Error parsing or deserializing project data:", error);
            this.currentProjectPath = null;
            this.currentProjectName = DEFAULT_PROJECT_NAME;
            this.observers.notify('projectPathChanged', { path: this.currentProjectPath });
            this.observers.notify('projectNameChanged', { name: this.currentProjectName });
            this.setUnsavedChanges(false);
            throw new Error(`Failed to parse project data: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async loadProjectFromFile(
        file: File,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    if (event.target && typeof event.target.result === 'string') {
                        await this.loadProjectData(event.target.result, null);
                        resolve();
                    } else {
                         reject(new Error('Failed to read file content.'));
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

    public async loadProjectFromPath(filePath: string, content: string): Promise<void> {
        if (!this.isElectron) {
            console.warn("loadProjectFromPath called in non-Electron environment.");
            return;
        }
        await this.loadProjectData(content, filePath);
    }

    public async loadProjectFromUrl(url: string): Promise<void> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch project from URL: ${response.statusText}`);
        }
        const projectJsonString = await response.text();
        await this.loadProjectData(projectJsonString, null);
    }

    onProjectLoaded(project: IRenderSettings): void {
        console.log("ProjectManager: onProjectLoaded", project, this.observers);
        this.observers.notify('projectLoaded', { project });
    }

    public createNewProject(): void {
        this.clearScene();
        this.observers.notify('projectNameChanged', { name: DEFAULT_PROJECT_NAME });
    }

    public async saveProject(): Promise<{ saved: boolean, error: string | null }> {
        const fileName = `${this.currentProjectName}.${siteConfig.projectFileExtension}`;
        if (this.isElectron && this.currentProjectPath) {
            try {
                const projectData = this.serializeProject();
                const jsonString = JSON.stringify(projectData, null, 2);
                const uint8Array = new TextEncoder().encode(jsonString);
                const arrayBuffer = uint8Array.buffer.slice(0) as ArrayBuffer;
                await this.localFileWorker.saveFileToPath(arrayBuffer, this.currentProjectPath);
                console.log(`Project saved to: ${this.currentProjectPath}`);
                this.setUnsavedChanges(false);
                return { saved: true, error: null };
            } catch (error) {
                console.error(`Error saving project to ${this.currentProjectPath}:`, error);
                return { saved: false, error: error instanceof Error ? error.message : String(error) };
            }
        } else {
            const result = await this.saveProjectAs(fileName);
            return result;
        }
    }

    public async saveProjectAs(
        fileName: string = `${this.currentProjectName}.${siteConfig.projectFileExtension}`
    ): Promise<{ saved: boolean, error: string | null }> {
        const projectData = this.serializeProject();
        const jsonString = JSON.stringify(projectData, null, 2);

        if (this.isElectron && window.electron) {
            try {
                const selectedPath = await window.electron.showSaveDialog(fileName);

                if (selectedPath) {
                    const uint8Array = new TextEncoder().encode(jsonString);
                    const arrayBuffer = uint8Array.buffer.slice(0) as ArrayBuffer;
                    await this.localFileWorker.saveFileToPath(arrayBuffer, selectedPath);

                    this.currentProjectPath = selectedPath;
                    this.currentProjectName = selectedPath.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, "") || DEFAULT_PROJECT_NAME;
                    this.observers.notify('projectPathChanged', { path: this.currentProjectPath });
                    this.observers.notify('projectNameChanged', { name: this.currentProjectName });
                    console.log(`Project saved as: ${this.currentProjectPath}`);
                    this.setUnsavedChanges(false);
                    return { saved: true, error: null };
                } else {
                    console.log("Save As cancelled by user.");
                    return { saved: false, error: null };
                }
            } catch (err) {
                return { saved: false, error: err instanceof Error ? err.message : String(err) };
            }
        } else {
            const blob = new Blob([jsonString], { type: `application/${siteConfig.projectFileExtension}` });

            if ('showSaveFilePicker' in window) {
                try {
                    const fileHandle = await window.showSaveFilePicker!({
                        suggestedName: fileName,
                        types: [{
                            description: 'Project Files',
                            accept: { [`application/${siteConfig.projectFileExtension}`]: [`.${siteConfig.projectFileExtension}`] },
                        }],
                    });
                    const writable = await fileHandle.createWritable();
                    const uint8Array = new TextEncoder().encode(jsonString);
                    const arrayBuffer = uint8Array.buffer.slice(0);
                    await writable.write(blob);
                    await writable.close();
                    this.currentProjectPath = null;
                    this.currentProjectName = fileName.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, "") || DEFAULT_PROJECT_NAME;
                    this.observers.notify('projectPathChanged', { path: this.currentProjectPath });
                    this.observers.notify('projectNameChanged', { name: this.currentProjectName });
                    this.setUnsavedChanges(false);
                    return { saved: true, error: null };
                } catch (err) {
                    console.log("File System Access API failed or cancelled, falling back to download method");
                    return { saved: false, error: err instanceof Error ? err.message : String(err) };
                }
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            this.currentProjectPath = null;
            this.currentProjectName = fileName.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, "") || DEFAULT_PROJECT_NAME;
            this.observers.notify('projectPathChanged', { path: this.currentProjectPath });
            this.observers.notify('projectNameChanged', { name: this.currentProjectName });
            this.setUnsavedChanges(false);
            return { saved: true, error: null };
        }
    }

    serializeProject(): IProjectData {
        const entities: EntityBase[] = this.engine.getObjectManager().getAllVisibleEntities();

        const environment = this.engine.getEnvironmentManager().serializeEnvironment();

        const timeline = this.engine.getTimelineManager().serialize();

        const project: IProjectData = {
            version: "1.0.1",
            timestamp: new Date().toISOString(),
            projectName: this.currentProjectName,
            entities: entities.map(entity => entity.serialize()),
            environment: environment,
            renderSettings: this.settings,
            renderLogs: this.renderLogs,
            timeline: timeline
        };

        return project;
    }

    clearScene(): void {
        this.engine.getSelectionManager().deselectAll();

        const existingEntities = this.engine.getObjectManager().getAllEntities();
        const scene = this.engine.getScene();

        existingEntities.forEach(entity => {
            entity.dispose();
            scene.remove(entity);
            this.engine.getObjectManager().unregisterEntity(entity);
        });

        this.currentProjectPath = null;
        this.currentProjectName = DEFAULT_PROJECT_NAME;
        this.observers.notify('projectPathChanged', { path: this.currentProjectPath });
        this.observers.notify('projectNameChanged', { name: this.currentProjectName });

        this.engine.getHistoryManager().clearHistory();
        this.setUnsavedChanges(false);
    }

    async deserializeProject(
        data: IProjectData,
    ): Promise<void> {
        this.clearScene();

        const scene = this.engine.getScene();

        if (data.environment) {
            this.engine.getEnvironmentManager().deserializeEnvironment(data.environment);
        }

        if (data.timeline && this.engine.getTimelineManager()) {
            this.engine.getTimelineManager().deserialize(data.timeline, this.engine);
        }

        if (data.renderSettings) {
            this.settings = data.renderSettings;
        } else {
            this.settings = defaultSettings;
        }
        this.observers.notify('renderSettingsChanged', { renderSettings: this.settings });

        // Set ratio
        // TODO: Move to better place?
        if (this.settings.ratio) {
            this.engine.getCameraManager().setRatioOverlayRatio(this.settings.ratio);
        }

        if (data.renderLogs) {
            this.renderLogs = data.renderLogs;
            this.latestRender = data.renderLogs.length > 0 ? data.renderLogs[data.renderLogs.length - 1] : null;
        } else {
            this.renderLogs = [];
            this.latestRender = null;
        }
        this.observers.notify('renderLogsChanged', { renderLogs: this.renderLogs, isNewRenderLog: false });
        this.observers.notify('latestRenderChanged', { latestRender: this.latestRender });

        console.log("ProjectManager: deserializeProject: entities", data.entities?.length || 0);

        if (data.entities && Array.isArray(data.entities)) {
            const entityPromises = data.entities.map((entityData: SerializedEntityData) => {
                return new Promise<void>(async (resolve) => {
                    try {
                        await EntityFactory.deserializeEntity(scene, entityData);
                        resolve();
                    } catch (error) {
                        console.error(`Error creating entity from saved data:`, error, entityData);
                        resolve();
                    }
                });
            });
            await Promise.all(entityPromises);
        }

        const entitiesMap = new Map<string, EntityBase>(this.engine.getObjectManager().getAllEntities().map(e => [e.uuid, e]));
        if (data.entities && Array.isArray(data.entities)) {
            data.entities.forEach(entityData => {
                const child = entitiesMap.get(entityData.uuid);
                if (!child) return;

                if (entityData.parentUUID) {
                    const parent = entitiesMap.get(entityData.parentUUID);
                    if (parent) {
                        parent.add(child);
                    } else {
                        console.warn(`DeserializeProject: Parent UUID ${entityData.parentUUID} not found for child ${child.name} (${child.uuid})`);
                    }
                } else if (entityData.parentBone) {
                    const character = entitiesMap.get(entityData.parentBone.characterUUID) as CharacterEntity;
                    if (character && character.getBoneControls) {
                         const boneControl = character.getBoneControls().find(b => b.bone.name === entityData.parentBone!.boneName);
                         if (boneControl) {
                             boneControl.add(child);
                         } else {
                             console.warn(`DeserializeProject: Parent bone ${entityData.parentBone.boneName} not found on character ${character.name} for child ${child.name}`);
                         }
                    } else {
                         console.warn(`DeserializeProject: Parent character UUID ${entityData.parentBone.characterUUID} not found or not a CharacterEntity for child ${child.name}`);
                    }
                }
            });
        }

        this.engine.getObjectManager().scanScene();

        this.currentProjectName = data.projectName || DEFAULT_PROJECT_NAME;
        this.observers.notify('projectLoaded', { project: this.settings });
        this.observers.notify('projectNameChanged', { name: this.currentProjectName });
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
        return this.latestRender;
    }

    getRenderLogs(): IRenderLog[] {
        return this.renderLogs;
    }

    getCurrentProjectPath(): string | null {
        return this.currentProjectPath;
    }

    updateProjectName(newName: string): void {
        const trimmedName = newName.trim();
        if (trimmedName && trimmedName !== this.currentProjectName) {
            this.currentProjectName = trimmedName;
            console.log("ProjectManager: updateProjectName", this.currentProjectName);
            this.observers.notify('projectNameChanged', { name: this.currentProjectName });
        }
    }

    getCurrentProjectName(): string {
        return this.currentProjectName;
    }

    hasUnsavedChangesStatus(): boolean {
        return this.hasUnsavedChanges;
    }

    dispose(): void {
        // TODO: Unsubscribe from historyChanged
    }
}



