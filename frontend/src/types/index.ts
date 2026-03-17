export type RenderMode = 'template' | 'html' | 'url';

export type BuilderBlock = {
  id: string;
  type: 'text' | 'field' | 'image' | 'heading' | 'divider' | 'table';
  content: string;
  label?: string;
};
