// Type declarations for binary modules to avoid TypeScript errors
declare module 'onnxruntime-node' {
  const content: any;
  export default content;
}

declare module 'sharp' {
  const content: any;
  export default content;
}

declare module 'llamaindex' {
  const content: any;
  export default content;
  export const VectorStoreIndex: any;
  export const SimpleNodeParser: any;
  export const ServiceContext: any;
  export const OpenAIEmbedding: any;
  export const OpenAI: any;
  export const RetrieverQueryEngine: any;
  export const MetadataFilters: any;
  export const MetadataFilter: any;
  export const FilterOperator: any;
  export const Document: any;
}

declare module '@llamaindex/core' {
  const content: any;
  export default content;
}

declare module '@llamaindex/openai' {
  const content: any;
  export default content;
  export const OpenAIEmbedding: any;
  export const OpenAI: any;
} 