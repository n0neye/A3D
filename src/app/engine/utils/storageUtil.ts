
// Get the persistent URL for a 3D model, even if it's not uploaded yet
export const get3DModelPersistentUrl = (uuid: string): string => {
    return `https://storage.googleapis.com/nontech-webpage/ai-editor/3d_models/${uuid}.glb`;
}

/**
 * Upload a file to Google Cloud Storage using a signed URL
 * @param blobUrl URL of the blob to upload
 * @param uuid Unique identifier for the file
 */
export const upload3DModelToGCP = async (blobUrl: string, uuid: string): Promise<boolean> => {
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
        return true;
    } catch (error) {
        console.error('Error uploading file to GCP:', error);
        return false;
    }
}
