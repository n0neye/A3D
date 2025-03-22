import { Node } from "@babylonjs/core/node";
import { Scene } from "@babylonjs/core/scene";

export default class BillboardNode extends Node {
    // @ts-ignore ignoring the super call as we don't want to re-init
    constructor(name: string, scene: Scene) {
        // super(name, scene);
    }


    /**
     * Called on the node is being initialized.
     * This function is called immediatly after the constructor has been called.
     */
    public onInitialize(): void {
        console.log("BillboardNode onInitialize");
    }

    /**
     * Called on the node has been fully initialized and is ready.
     */
    public onInitialized(): void {
        console.log("BillboardNode onInitialized");
    }

    /**
     * Called on the scene starts.
     */
    public onStart(): void {
        console.log("BillboardNode onStart");
    }

    /**
     * Called each frame.
     */
    public onUpdate(): void {
        console.log("BillboardNode onUpdate");
    }

    /**
     * Called on the object has been disposed.
     * Object can be disposed manually or when the editor stops running the scene.
     */
    public onStop(): void {
        // ...
    }

    /**
     * Called on a message has been received and sent from a graph.
     * @param name defines the name of the message sent from the graph.
     * @param data defines the data sent in the message.
     * @param sender defines the reference to the graph class that sent the message.
     */
    public onMessage(name: string, data: any, sender: any): void {
        switch (name) {
            case "myMessage":
                // Do something...
                break;
        }
    }
}
