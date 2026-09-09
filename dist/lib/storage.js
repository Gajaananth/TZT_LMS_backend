"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeStorageBuckets = initializeStorageBuckets;
exports.uploadFile = uploadFile;
exports.deleteFile = deleteFile;
exports.getPublicUrl = getPublicUrl;
const supabase_1 = require("./supabase");
/**
 * Initialize storage buckets and set up RLS policies
 * Call this once during app startup
 */
async function initializeStorageBuckets() {
    try {
        // Ensure avatars bucket exists
        const { data: buckets } = await supabase_1.supabaseAdmin.storage.listBuckets();
        const hasAvatarsBucket = buckets?.some(b => b.name === 'avatars');
        if (!hasAvatarsBucket) {
            const { error: createError } = await supabase_1.supabaseAdmin.storage.createBucket('avatars', {
                public: true,
                fileSizeLimit: 5242880, // 5MB
                allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            });
            if (createError && !createError.message.includes('already exists')) {
                console.warn('Failed to create avatars bucket:', createError.message);
            }
            else {
                console.log('✅ Created avatars bucket');
            }
        }
        // Ensure documents bucket exists (for certificates, reports, etc.)
        const hasDocumentsBucket = buckets?.some(b => b.name === 'documents');
        if (!hasDocumentsBucket) {
            const { error: createError } = await supabase_1.supabaseAdmin.storage.createBucket('documents', {
                public: false,
                fileSizeLimit: 10485760, // 10MB
                allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'text/csv'],
            });
            if (createError && !createError.message.includes('already exists')) {
                console.warn('Failed to create documents bucket:', createError.message);
            }
            else {
                console.log('✅ Created documents bucket');
            }
        }
        console.log('✅ Storage initialization complete');
    }
    catch (error) {
        console.error('Storage initialization error:', error);
    }
}
/**
 * Upload a file to Supabase Storage
 */
async function uploadFile(bucket, path, file, contentType) {
    try {
        const { data, error } = await supabase_1.supabaseAdmin.storage
            .from(bucket)
            .upload(path, file, {
            contentType,
            cacheControl: '3600',
            upsert: false,
        });
        if (error)
            throw error;
        const { data: publicUrlData } = supabase_1.supabaseAdmin.storage
            .from(bucket)
            .getPublicUrl(path);
        return {
            path: data.path,
            publicUrl: publicUrlData.publicUrl,
        };
    }
    catch (error) {
        throw new Error(`Upload failed: ${error.message}`);
    }
}
/**
 * Delete a file from Supabase Storage
 */
async function deleteFile(bucket, path) {
    try {
        const { error } = await supabase_1.supabaseAdmin.storage
            .from(bucket)
            .remove([path]);
        if (error)
            throw error;
        return true;
    }
    catch (error) {
        throw new Error(`Delete failed: ${error.message}`);
    }
}
/**
 * Get public URL for a file
 */
function getPublicUrl(bucket, path) {
    const { data } = supabase_1.supabaseAdmin.storage
        .from(bucket)
        .getPublicUrl(path);
    return data.publicUrl;
}
