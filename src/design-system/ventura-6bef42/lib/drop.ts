import { useCallback, useState } from "react";

type Options = {
  onFile: (file: File) => void | Promise<void>;
  accept?: (file: File) => boolean;
  disabled?: boolean;
};

/**
 * Simple hook that turns any element into a drag-and-drop target for a single file.
 * Returns props to spread on the element plus a `dragging` flag for optional styling.
 */
export function useFileDrop({ onFile, accept, disabled }: Options) {
  const [dragging, setDragging] = useState(false);

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      if (!Array.from(e.dataTransfer.types || []).includes("Files")) return;
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);
    },
    [disabled],
  );

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (!f) return;
      if (accept && !accept(f)) return;
      void onFile(f);
    },
    [onFile, accept, disabled],
  );

  return { dropProps: { onDragOver, onDragLeave, onDrop }, dragging };
}
