import { SerializedProjectSettings, saveProjectToFile, deserializeScene } from "@/app/util/editor/project-util";
import { EditorEngine } from "../EditorEngine";
import EventEmitter from "events";

export class ProjectManager {
    private engine: EditorEngine;
    public events: EventEmitter = new EventEmitter();

    constructor(engine: EditorEngine) {
        this.engine = engine;
    }

    public saveProjectToFile(projectSettings: SerializedProjectSettings, projectName: string): void {
        saveProjectToFile(this.engine.getScene(), projectSettings, projectName);
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
                        deserializeScene(projectData, this.engine, this.onProjectLoaded);
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
        deserializeScene(projectData, this.engine, this.onProjectLoaded);
    }

    onProjectLoaded(project: SerializedProjectSettings): void {
        this.events.emit('projectLoaded', project);
    }

    // TODO: Integrate project-util.ts
}


