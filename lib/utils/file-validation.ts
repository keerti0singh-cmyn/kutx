const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const ALLOWED_DOCUMENT_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]
const ALLOWED_ARCHIVE_TYPES = ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed']
const ALLOWED_TEXT_TYPES = ['text/plain']

const ALLOWED_FILE_TYPES = [
    ...ALLOWED_IMAGE_TYPES,
    ...ALLOWED_DOCUMENT_TYPES,
    ...ALLOWED_ARCHIVE_TYPES,
    ...ALLOWED_TEXT_TYPES,
]

export interface FileValidationResult {
    valid: boolean
    error?: string
}

export const validateFile = (file: File): FileValidationResult => {
    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: 'File size must be 5MB or less',
        }
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        return {
            valid: false,
            error: 'File type not allowed. Please upload images, PDFs, documents, or archives.',
        }
    }

    return { valid: true }
}

export const validateProfilePhoto = (file: File): FileValidationResult => {
    const MAX_PROFILE_SIZE = 2 * 1024 * 1024 // 2MB

    if (file.size > MAX_PROFILE_SIZE) {
        return {
            valid: false,
            error: 'Profile photo must be 2MB or less',
        }
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return {
            valid: false,
            error: 'Profile photo must be an image (JPG, PNG, GIF, WebP)',
        }
    }

    return { valid: true }
}

export const isImage = (fileType: string): boolean => {
    return ALLOWED_IMAGE_TYPES.includes(fileType)
}

export const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
