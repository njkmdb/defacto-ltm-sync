'use client';

import React, { useState, useRef, ChangeEvent, useEffect, DragEvent } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query'; 
import { useTranslations } from 'next-intl';
import { UploadCloud, FileAudio, Image as ImageIcon, FileText, FileCode, Loader2, CheckCircle, XCircle } from 'lucide-react'; 
import { uploadMediaFile } from '@/lib/api/media';
import { getPipelineStatus } from '@/lib/api/pipeline';

export default function MediaUploadSection() {
  const t = useTranslations('Dashboard');
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baseEntityId = 1024; 

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusPopup, setStatusPopup] = useState<{show: boolean; type: 'uploading' | 'processing' | 'success' | 'error'; message: string;}>({ show: false, type: 'uploading', message: '' });
  const [uploadWaitState, setUploadWaitState] = useState({ isWaiting: false, targetCount: 0 });

  const { data: trackerStatus } = useQuery({
    queryKey: ['pipelineStatusTracker', baseEntityId],
    queryFn: () => getPipelineStatus({ baseEntityId, page: 1, limit: 1 }),
    refetchInterval: uploadWaitState.isWaiting ? 2000 : false, 
  });

  useEffect(() => {
    if (!uploadWaitState.isWaiting) return;
    if (trackerStatus && trackerStatus.total_count >= uploadWaitState.targetCount) {
      setUploadWaitState({ isWaiting: false, targetCount: 0 });
      setStatusPopup({ show: true, type: 'success', message: t('media_popup_success') });
      setTimeout(() => setStatusPopup(prev => ({ ...prev, show: false })), 4000);
      queryClient.invalidateQueries({ queryKey: ['pipelineStatus'] }); 
    }
  }, [trackerStatus?.total_count, uploadWaitState, queryClient, t]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (uploadWaitState.isWaiting) {
      timeoutId = setTimeout(() => {
        setUploadWaitState({ isWaiting: false, targetCount: 0 });
        setStatusPopup({ show: true, type: 'error', message: t('media_popup_error_delay') });
        setTimeout(() => setStatusPopup(prev => ({ ...prev, show: false })), 4000);
      }, 60000); 
    }
    return () => clearTimeout(timeoutId);
  }, [uploadWaitState.isWaiting, t]);

  const handleUpload = async (files: FileList | File[]) => {
    const validFiles: File[] = [];
    
    for (const f of Array.from(files)) {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      
      if (ext === '.pdf') {
        if (f.size > 10 * 1024 * 1024) {
          alert(`[${f.name}] PDF 파일은 10MB를 초과할 수 없습니다.`);
          continue;
        }
      } else if (['.txt', '.md', '.csv'].includes(ext)) {
        if (f.size > 1 * 1024 * 1024) {
          alert(`[${f.name}] 텍스트 문서 파일은 품질 보장을 위해 1MB를 초과할 수 없습니다.`);
          continue;
        }
      }
      validFiles.push(f);
    }

    const totalFiles = validFiles.length;
    if (totalFiles === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    const currentCount = trackerStatus?.total_count || 0;
    const targetCount = uploadWaitState.isWaiting ? uploadWaitState.targetCount + totalFiles : currentCount + totalFiles;

    try {
      for (let i = 0; i < totalFiles; i++) {
        setStatusPopup({ show: true, type: 'uploading', message: t('media_popup_uploading', { current: i + 1, total: totalFiles }) });
        await uploadMediaFile(validFiles[i], baseEntityId);
      }
      setStatusPopup({ show: true, type: 'processing', message: t('media_popup_processing', { total: totalFiles }) });
      setUploadWaitState({ isWaiting: true, targetCount });
    } catch (error: any) {
      setStatusPopup({ show: true, type: 'error', message: t('media_popup_error_upload') });
      setTimeout(() => setStatusPopup(prev => ({ ...prev, show: false })), 4000);
      setUploadWaitState({ isWaiting: false, targetCount: 0 }); 
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; 
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: DragEvent<HTMLDivElement>) => { 
    e.preventDefault(); setIsDragging(false); 
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files); 
  };
  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => { 
    if (e.target.files && e.target.files.length > 0) handleUpload(e.target.files); 
  };

  return (
    <>
      <div className="mb-8 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-purple-600" /> {t('media_title')}
        </h2>
        <div
          onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            isDragging ? 'border-purple-500 bg-purple-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
          } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={onFileChange} 
            accept="audio/*, image/*, .pdf, .txt, .md, .csv" 
            multiple 
            className="hidden" 
          />
          {isUploading ? <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-3" /> : <UploadCloud className="w-12 h-12 text-gray-400 mb-3" />}
          <p className="text-sm text-gray-600 font-medium">
            {isUploading ? t('media_processing') : t('media_drag')}
          </p>
          
          <div className="flex gap-4 mt-5 text-xs text-gray-500 font-semibold bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
            <span className="flex items-center gap-1.5"><FileAudio size={14} className="text-blue-500" /> {t('media_audio')}</span>
            <span className="flex items-center gap-1.5"><ImageIcon size={14} className="text-pink-500" /> {t('media_image')}</span>
            <span className="flex items-center gap-1.5"><FileText size={14} className="text-orange-500" /> {t('media_pdf')}</span>
            <span className="flex items-center gap-1.5"><FileCode size={14} className="text-green-500" /> {t('media_text')}</span>
          </div>
        </div>
      </div>

      {statusPopup.show && (
        <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3.5 rounded-full shadow-2xl transition-all duration-500 animate-in slide-in-from-bottom-8 text-sm font-bold bg-gray-900 text-white border border-gray-700">
          {statusPopup.type === 'uploading' && <UploadCloud className="w-5 h-5 text-blue-400 animate-pulse" />}
          {statusPopup.type === 'processing' && <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />}
          {statusPopup.type === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
          {statusPopup.type === 'error' && <XCircle className="w-5 h-5 text-red-400" />}
          <span>{statusPopup.message}</span>
        </div>
      )}
    </>
  );
}