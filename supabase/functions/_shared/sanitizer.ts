export function sanitizeString(input: unknown, maxLength = 1000): string {
    if (typeof input !== "string") return "";
    return input
        .replace(/\0/g, "")
        .replace(/<[^>]*>/g, "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#x27;")
        .trim().slice(0, maxLength);
}

export function sanitizeUUID(input: unknown): string | null {
    if (typeof input !== "string") return null;
    const cleaned = input.trim().toLowerCase();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    return uuidRegex.test(cleaned) ? cleaned : null;
}
