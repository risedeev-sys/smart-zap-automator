import { useState, useCallback, DragEvent } from "react";

export function useDragReorder<T>(items: T[], onReorder: (items: T[]) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => (e: DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Make drag image semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    }
  }, []);

  const handleDragOver = useCallback((index: number) => (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      const updated = [...items];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(overIndex, 0, moved);
      onReorder(updated);
    }
    setDragIndex(null);
    setOverIndex(null);
  }, [dragIndex, overIndex, items, onReorder]);

  const getDragProps = useCallback((index: number) => ({
    draggable: true,
    onDragStart: handleDragStart(index),
    onDragOver: handleDragOver(index),
    onDragEnd: handleDragEnd,
    className: dragIndex === index
      ? "opacity-50"
      : overIndex === index && dragIndex !== null
        ? "border-t-2 border-primary"
        : "",
  }), [handleDragStart, handleDragOver, handleDragEnd, dragIndex, overIndex]);

  return { getDragProps, dragIndex };
}
