/**
 * BlockRenderer — renders a list of block sections by looking up each
 * section's block_type in the registry and calling its Component.
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §6.
 */

import { getBlockType } from "@/lib/block-registry";

export interface BlockSectionData {
  id: number;
  block_type: string;
  props: Record<string, string>;
  order: number;
}

export function BlockRenderer({ sections }: { sections: BlockSectionData[] }) {
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  return (
    <>
      {sorted.map((section) => {
        const blockType = getBlockType(section.block_type);
        if (!blockType) {
          return (
            <div key={section.id} className="p-6 text-center text-stone-400">
              Unknown block type: {section.block_type}
            </div>
          );
        }
        const Component = blockType.Component;
        return <Component key={section.id} props={section.props || {}} />;
      })}
    </>
  );
}
