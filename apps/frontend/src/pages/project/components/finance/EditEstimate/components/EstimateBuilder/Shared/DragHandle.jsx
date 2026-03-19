import React from "react";
import { GripVertical } from "lucide-react";

export const DragHandle = ({ onDragStart, onDragEnd, className = "" }) => (
  <div
    draggable
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    className={`
      cursor-grab active:cursor-grabbing
      text-slate-400 hover:text-indigo-500
      transition-colors select-none
      ${className}
    `}
  >
    <GripVertical size={16} />
  </div>
);