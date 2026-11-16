export type PresignedUpload = { url: string; method: "PUT"; headers: Record<string, string> };

export interface StorageDriver {
  presignPut(input: {
    key: string;
    contentType: string;
    contentLength: number;
  }): Promise<PresignedUpload>;
  head(key: string): Promise<{ contentLength: number; contentType: string | null } | null>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}
