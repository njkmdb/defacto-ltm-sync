'use client';

import React, { useState, useRef, ChangeEvent, useEffect, DragEvent } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query'; 
import { UploadCloud, FileAudio, Image as ImageIcon, FileText, FileCode, Loader2, CheckCircle, XCircle } from 'lucide-react'; 
import { uploadMediaFile } from '@/lib/api/media';
import { getPipelineStatus } from '@/lib/api/pipeline';

export default function MediaUploadSection() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusPopup, setStatusPopup] = useState<{show: boolean; type: 'uploading' | 'processing' | 'success' | 'error'; message: string;}>({ show: false, type: 'uploading', message: '' });
  const [uploadWaitState, setUploadWaitState] = useState({ isWaiting: false, targetCount: 0 });

  const { data: trackerStatus } = useQuery({
    queryKey: ['pipelineStatusTracker'],
    queryFn: () => getPipelineStatus({ page: 1, limit: 1 }),
    refetchInterval: uploadWaitState.isWaiting ? 2000 : false, 
  });

  useEffect(() => {
    if (!uploadWaitState.isWaiting) return;
    if (trackerStatus && trackerStatus.total_count >= uploadWaitState.targetCount) {
      setUploadWaitState({ isWaiting: false, targetCount: 0 });
      setStatusPopup({ show: true, type: 'success', message: 'AI 데이터 추출 및 목록 갱신 완료!' });
      setTimeout(() => setStatusPopup(prev => ({ ...prev, show: false })), 4000);
      queryClient.invalidateQueries({ queryKey: ['pipelineStatus'] }); 
    }
  }, [trackerStatus?.total_count, uploadWaitState, queryClient]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (uploadWaitState.isWaiting) {
      timeoutId = setTimeout(() => {
        setUploadWaitState({ isWaiting: false, targetCount: 0 });
        setStatusPopup({ show: true, type: 'error', message: 'AI 처리가 지연되고 있습니다. 상태를 직접 확인해주세요.' });
        setTimeout(() => setStatusPopup(prev => ({ ...prev, show: false })), 4000);
      }, 60000); 
    }
    return () => clearTimeout(timeoutId);
  }, [uploadWaitState.isWaiting]);

  const handleUpload = async (files: FileList | File[]) => {
    const validFiles: File[] = [];
    
    // 💡 [핵심 교정] 프론트엔드 단 파일 용량 Validation
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
        setStatusPopup({ show: true, type: 'uploading', message: `서버로 파일을 전송 중입니다... (${i + 1}/${totalFiles})` });
        await uploadMediaFile(validFiles[i], 1024); 
      }
      setStatusPopup({ show: true, type: 'processing', message: `총 ${totalFiles}개의 파일을 AI 엔진이 분석 중입니다... 잠시만 기다려주세요.` });
      setUploadWaitState({ isWaiting: true, targetCount });
    } catch (error: any) {
      setStatusPopup({ show: true, type: 'error', message: '일부 파일 업로드 중 오류가 발생했습니다.' });
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
          <UploadCloud className="w-5 h-5 text-purple-600" /> 다이렉트 파일 업로드 (음성/이미지/문서 일괄 처리 지원)
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
            {isUploading ? '백그라운드에서 데이터를 일괄 처리 중입니다...' : '여러 파일을 한 번에 선택하거나 이곳으로 드래그하세요'}
          </p>
          
          <div className="flex gap-4 mt-5 text-xs text-gray-500 font-semibold bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
            <span className="flex items-center gap-1.5"><FileAudio size={14} className="text-blue-500" /> 음성 (.m4a, .mp3)</span>
            <span className="flex items-center gap-1.5"><ImageIcon size={14} className="text-pink-500" /> 이미지 (.jpg, .png)</span>
            <span className="flex items-center gap-1.5"><FileText size={14} className="text-orange-500" /> PDF (10MB 제한)</span>
            <span className="flex items-center gap-1.5"><FileCode size={14} className="text-green-500" /> 텍스트 (1MB 제한)</span>
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