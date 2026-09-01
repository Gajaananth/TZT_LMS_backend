import { supabaseAdmin } from './supabase';

/**
 * Initialize storage buckets and set up RLS policies
 * Call this once during app startup
 */
export async function initializeStorageBuckets() {
  try {
    // Ensure avatars bucket exists
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const hasAvatarsBucket = buckets?.some(b => b.name === 'avatars');
    
    if (!hasAvatarsBucket) {
      const { error: createError } = await supabaseAdmin.storage.createBucket('avatars', {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      });
      
      if (createError && !createError.message.includes('already exists')) {
        console.warn('Failed to create avatars bucket:', createError.message);
      } else {
        console.log('✅ Created avatars bucket');
      }
    }

    // Ensure documents bucket exists (for certificates, reports, etc.)
    const hasDocumentsBucket = buckets?.some(b => b.name === 'documents');
    
    if (!hasDocumentsBucket) {
      const { error: createError } = await supabaseAdmin.storage.createBucket('documents', {
        public: false,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'text/csv'],
      });
      
      if (createError && !createError.message.includes('already exists')) {
        console.warn('Failed to create documents bucket:', createError.message);
      } else {
        console.log('✅ Created documents bucket');
      }
    }

    console.log('✅ Storage initialization complete');
  } catch (error) {
    console.error('Storage initialization error:', error);
  }
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(bucket: string, path: string, file: Buffer, contentType: string) {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, file, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;
    
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(path);
    
    return {
      path: data.path,
      publicUrl: publicUrlData.publicUrl,
    };
  } catch (error: any) {
    throw new Error(`Upload failed: ${error.message}`);
  }
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(bucket: string, path: string) {
  try {
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .remove([path]);

    if (error) throw error;
    return true;
  } catch (error: any) {
    throw new Error(`Delete failed: ${error.message}`);
  }
}

/**
 * Get public URL for a file
 */
export function getPublicUrl(bucket: string, path: string) {
  const { data } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(path);
  
  return data.publicUrl;
}
