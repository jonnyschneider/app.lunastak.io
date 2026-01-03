'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { DocumentTextIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';

interface DocumentUploadProps {
  onUploadComplete: (data: {
    conversationId: string;
    summary: string;
    filename: string;
    guestUserId?: string;
  }) => void;
  onError: (error: string) => void;
}

export function DocumentUpload({ onUploadComplete, onError }: DocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploadedFile(file);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-document', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();
      onUploadComplete({
        conversationId: data.conversationId,
        summary: data.summary,
        filename: file.name,
        guestUserId: data.guestUserId,
      });
    } catch (error) {
      console.error('Upload error:', error);
      onError(error instanceof Error ? error.message : 'Upload failed');
      setUploadedFile(null);
    } finally {
      setIsUploading(false);
    }
  }, [onUploadComplete, onError]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
    disabled: isUploading,
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragActive ? 'border-zinc-500 bg-zinc-50 dark:bg-zinc-800' : 'border-zinc-300 dark:border-zinc-600'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500'}
        `}
      >
        <input {...getInputProps()} />

        {isUploading ? (
          <>
            <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-zinc-400 animate-pulse" />
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Extracting content from {uploadedFile?.name}...
            </p>
          </>
        ) : (
          <>
            <DocumentTextIcon className="mx-auto h-12 w-12 text-zinc-400" />
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {isDragActive
                ? 'Drop your file here'
                : 'Drag and drop your file here, or click to browse'}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
              Supports PDF, DOCX, TXT, and Markdown files (max 10MB)
            </p>
          </>
        )}
      </div>

      {fileRejections.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">
            {fileRejections[0].errors[0].code === 'file-too-large'
              ? 'File is too large. Please upload a file under 10MB.'
              : 'Invalid file type. Please upload a PDF, DOCX, TXT, or MD file.'}
          </p>
        </div>
      )}
    </div>
  );
}
