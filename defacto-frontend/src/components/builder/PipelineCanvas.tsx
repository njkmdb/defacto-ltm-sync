'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Workflow } from 'lucide-react';
import { usePipelineStore } from '@/store/usePipelineStore';
import SortableStepItem from './SortableStepItem';

export default function PipelineCanvas() {
  const t = useTranslations('Builder');
  const { nodes, selectedNodeId, setSelectedNodeId, removeNode, reorderNodes } = usePipelineStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = nodes.findIndex((s) => s.step_id === active.id);
      const newIndex = nodes.findIndex((s) => s.step_id === over.id);
      reorderNodes(oldIndex, newIndex);
    }
  };

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200 shrink-0 flex justify-between items-center">
        <h2 className="text-sm font-extrabold text-gray-700 flex items-center gap-2">
          <Workflow className="w-4 h-4 text-blue-600"/> {t('canvas_title')}
        </h2>
        <span className="text-xs font-bold text-gray-500 bg-gray-200 px-2 py-1 rounded">{t('canvas_total', { count: nodes.length })}</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
        {nodes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-2xl">
            <Workflow className="w-12 h-12 mb-3 text-gray-300" />
            <p className="font-bold">{t('canvas_empty')}</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={nodes.map(s => s.step_id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {nodes.map(step => (
                  <SortableStepItem 
                    key={step.step_id} 
                    step={step} 
                    isSelected={selectedNodeId === step.step_id}
                    onSelect={() => setSelectedNodeId(step.step_id)}
                    onRemove={(e) => { e.stopPropagation(); removeNode(step.step_id); }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}