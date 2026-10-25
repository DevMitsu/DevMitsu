/**
 * Placeholder profile for the Stage 1 prototype.
 * Replace with the authenticated staff member once sign-in exists.
 * The display name can be overridden locally with VITE_PROFILE_NAME in a .env.local file.
 */
export interface Profile {
  displayName: string;
  role: string;
}

export const mockProfile: Profile = {
  displayName: import.meta.env.VITE_PROFILE_NAME || 'Librarian',
  role: 'Librarian',
};

export function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase());
  return letters.join('') || '?';
}
