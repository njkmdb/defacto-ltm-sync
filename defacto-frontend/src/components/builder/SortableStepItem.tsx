'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { PipelineStep } from '@/types/api';

interface SortableStepItemProps {
  step: PipelineStep;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: (e: React.MouseEvent) => void;
}

export default function SortableStepItem({ step, isSelected, onSelect, onRemove }: SortableStepItemProps) {
  const t = useTranslations('Builder');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.step_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      onClick={onSelect}
      className={`p-4 rounded-xl border flex items-center gap-3 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50 border-blue-400 shadow-sm ring-1 ring-blue-400' : 'bg-white border-gray-200 hover:border-blue-300'}`}
    >
      <div {...attributes} {...listeners} className="cursor-grab hover:text-blue-600 text-gray-400">
        <GripVertical className="w-5 h-5" />
      </div>
      
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 text-white text-xs font-bold shrink-0">
        {step.step_order}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-gray-900 truncate">{step.module_name}</h3>
        <p className="text-[10px] text-gray-500 font-mono mt-0.5 truncate">{t('item_output')}: {step.output_key}</p>
      </div>

      <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}