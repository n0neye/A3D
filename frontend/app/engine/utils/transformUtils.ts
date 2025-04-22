import * as THREE from 'three';

/**
 * Sets the local scale of a THREE.Object3D such that its resulting world scale
 * matches the desiredWorldScale, counteracting the parent's world scale.
 *
 * @param object The object whose world scale needs to be set.
 * @param desiredWorldScale The target world scale (as a THREE.Vector3).
 */
export function setWorldScale(object: THREE.Object3D, desiredWorldScale: THREE.Vector3): void {
    const parent = object.parent;
    const parentWorldScale = new THREE.Vector3();
    const _tempMatrix = new THREE.Matrix4(); // Reuse a matrix object

    // Ensure parent's world matrix and scale are up-to-date
    if (parent) {
        // It's crucial that the parent's world transform is current.
        // You might need to call parent.updateMatrixWorld(true) *before* calling this function
        // if the parent's transform might have changed since the last render frame.
        parent.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), parentWorldScale);
    } else {
        // If no parent (e.g., object added directly to the scene), parent scale is identity.
        parentWorldScale.set(1, 1, 1);
    }

    // Avoid division by zero if the parent has a zero scale component.
    if (parentWorldScale.x === 0 || parentWorldScale.y === 0 || parentWorldScale.z === 0) {
        console.warn("setWorldScale: Parent has zero world scale component. Cannot accurately achieve desired world scale.");
        // Fallback: Set local scale directly. The resulting world scale will still be affected by the zero parent scale.
        object.scale.copy(desiredWorldScale);
        object.updateMatrix(); // Mark local matrix as needing update
        return;
    }

    // Calculate the required local scale by dividing the desired world scale
    // by the parent's world scale component-wise.
    const localScale = new THREE.Vector3(
        desiredWorldScale.x / parentWorldScale.x,
        desiredWorldScale.y / parentWorldScale.y,
        desiredWorldScale.z / parentWorldScale.z
    );

    // Apply the calculated local scale
    object.scale.copy(localScale);

    // Mark the object's local matrix as needing an update.
    // Its world matrix will be updated automatically in the next render loop
    // or when updateMatrixWorld() is called on an ancestor.
    object.updateMatrix();
}
