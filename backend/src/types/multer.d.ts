declare module 'multer' {
  export type DiskStorageCallback = (
    error: Error | null,
    value: string,
  ) => void;

  export type DiskStorageFile = {
    originalname: string;
    mimetype: string;
  };

  export function diskStorage(options: {
    destination: (
      request: unknown,
      file: DiskStorageFile,
      callback: DiskStorageCallback,
    ) => void;
    filename: (
      request: unknown,
      file: DiskStorageFile,
      callback: DiskStorageCallback,
    ) => void;
  }): unknown;

  export function memoryStorage(): unknown;
}
