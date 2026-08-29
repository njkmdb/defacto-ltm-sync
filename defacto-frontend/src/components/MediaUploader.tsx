'use client';

import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { uploadMediaFile } from '@/lib/api/media'; // 💡 경로 명시적 수정
import { UploadCloud, FileAudio, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function MediaUploader({ baseEntityId = 1024 }: { baseEntityId?: number }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      await uploadMediaFile(file, baseEntityId);
      alert('업로드가 완료되어 백그라운드 텍스트 추출을 시작합니다.');
      // 업로드 직후 파이프라인 관제 리스트 새로고침 트리거
      queryClient.invalidateQueries({ queryKey: ['pipelineStatus'] });
    } catch (error) {
      console.error(error);
      alert('파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUpload(e.target.files[0]);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-lg font-bold text-gray-800 mb-4">멀티모달 데이터 적재 (음성/이미지)</h2>
      
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={onChange} 
          accept="audio/*, image/*" 
          className="hidden" 
        />
        
        {isUploading ? (
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-3" />
        ) : (
          <UploadCloud className="w-12 h-12 text-gray-400 mb-3" />
        )}
        
        <p className="text-sm text-gray-600 font-medium">
          {isUploading ? '로컬 서버로 파일을 전송 중입니다...' : '클릭하거나 파일을 여기로 드래그하세요'}
        </p>
        <div className="flex gap-4 mt-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><FileAudio size={14} /> .m4a, .mp3</span>
          <span className="flex items-center gap-1"><ImageIcon size={14} /> .jpg, .png</span>
        </div>
      </div>
    </div>
  );
}