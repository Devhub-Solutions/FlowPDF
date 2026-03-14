declare module 'docxtemplater-image-module-free' {
  interface ImageModuleOptions {
    centered?: boolean;
    fileType?: string;
    getImage: (tagValue: string, tagName: string) => Buffer | null;
    getSize: (img: Buffer, tagValue: string, tagName: string) => [number, number];
  }
  class ImageModule {
    constructor(options: ImageModuleOptions);
  }
  export = ImageModule;
}
