declare module 'mammoth' {
  interface ConvertOptions {
    arrayBuffer?: ArrayBuffer;
    buffer?: Buffer;
    path?: string;
  }
  interface ConvertResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }
  export function convertToHtml(options: ConvertOptions): Promise<ConvertResult>;
  export function extractRawText(options: ConvertOptions): Promise<ConvertResult>;
}
