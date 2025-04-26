import { IGenerationLog } from "@/engine/interfaces/generation";

// Get the persistent URL for a 3D model, even if it's not uploaded yet
export const get3DModelPersistentUrl = (uuid: string): string => {
    return `https://storage.googleapis.com/nontech-webpage/ai-editor/3d_models/${uuid}.glb`;
}

export const upload3DModelToGCPAndModifyUrl = async (blobUrl: string, log: IGenerationLog): Promise<void> => {
    const result = await upload3DModelToGCP(blobUrl, log.id);

    if (!result.success) {
        // TODO: toast error
        throw new Error('Failed to upload model to GCP');
    }
    
    // Modify the generation log for future reference
    log.fileUrl = result.url;
    return;
}

/**
 * Upload a file to Google Cloud Storage using a signed URL
 * @param blobUrl URL of the blob to upload
 * @param uuid Unique identifier for the file
 */
export const upload3DModelToGCP = async (blobUrl: string, uuid: string): Promise<{ success: boolean, url: string | null }> => {
    try {
        console.log(`Uploading model to GCP with id: ${uuid}`);
        
        // First, fetch the blob data
        const response = await fetch(blobUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch blob data: ${response.status}`);
        }
        
        const blobData = await response.blob();
        
        // Request a signed URL from our server
        const signedUrlResponse = await fetch('/api/storage/getSignedUrl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileName: `${uuid}.glb`,
                contentType: 'model/gltf-binary',
                fileSize: blobData.size
            })
        });
        
        if (!signedUrlResponse.ok) {
            throw new Error(`Failed to get signed URL: ${signedUrlResponse.status}`);
        }
        
        const { signedUrl } = await signedUrlResponse.json();
        
        // Upload the file directly to GCS using the signed URL
        const uploadResponse = await fetch(signedUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'model/gltf-binary'
            },
            body: blobData
        });
        
        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error("Upload error response:", errorText);
            throw new Error(`Failed to upload file: ${uploadResponse.status}`);
        }
        
        console.log(`Successfully uploaded model to GCP: ${uploadResponse.url}`);
        return { success: true, url: uploadResponse.url };
    } catch (error) {
        console.error('Error uploading file to GCP:', error);
        return { success: false, url: null };
    }
}
