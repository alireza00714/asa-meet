export type EphemeralFile = {
  id: string;
  fileName: string;
  contentType: string;
  downloadUrl: string;
  expiresAtUtc: string;
};

export function clearExpiredFiles(files: EphemeralFile[]): EphemeralFile[] {
  const now = Date.now();
  return files.filter((file) => new Date(file.expiresAtUtc).getTime() > now);
}
