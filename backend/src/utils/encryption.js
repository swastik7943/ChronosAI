import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

// Must be exactly 32 bytes for AES-256
const getEncryptionKey = () => {
    return process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';
};

export const encrypt = (text) => {
    if (!text) return text;

    const key = Buffer.from(getEncryptionKey(), 'utf8');
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${encrypted}:${authTag}`;
};

export const decrypt = (encryptedData) => {
    if (!encryptedData) return encryptedData;

    // Check if it's plaintext (from before encryption was added)
    if (!encryptedData.includes(':')) {
        return encryptedData;
    }

    try {
        const key = Buffer.from(getEncryptionKey(), 'utf8');
        const parts = encryptedData.split(':');
        
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = Buffer.from(parts[1], 'hex');
        const authTag = Buffer.from(parts[2], 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption failed:', error.message);
        return null; // Return null if it fails, which will correctly trigger a sync break rather than proceeding blindly
    }
};
