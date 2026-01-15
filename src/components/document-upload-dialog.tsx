'use client'

import { useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { FileText, Upload, X, Loader2 } from 'lucide-react'
import { SignInGateDialog, SIGN_IN_GATE_PRESETS } from '@/components/SignInGateDialog'

interface DocumentUploadDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadComplete: () => void
  deepDiveId?: string
}

type UploadState = 'idle' | 'selected' | 'uploading' | 'processing' | 'complete' | 'error'

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.txt,.md'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function DocumentUploadDialog({
  projectId,
  open,
  onOpenChange,
  onUploadComplete,
  deepDiveId,
}: DocumentUploadDialogProps) {
  const { data: session } = useSession()
  const [state, setState] = useState<UploadState>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadContext, setUploadContext] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Guest users need to sign in to upload documents
  if (!session?.user) {
    return (
      <SignInGateDialog
        open={open}
        onOpenChange={onOpenChange}
        title={SIGN_IN_GATE_PRESETS.uploadDocument.title}
        description={SIGN_IN_GATE_PRESETS.uploadDocument.description}
      />
    )
  }

  const resetState = () => {
    setState('idle')
    setSelectedFile(null)
    setUploadContext('')
    setProgress(0)
    setError(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError('File size must be less than 10MB')
      return
    }

    setSelectedFile(file)
    setState('selected')
    setError(null)
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setState('uploading')
    setProgress(10)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('projectId', projectId)
      formData.append('uploadContext', uploadContext)
      if (deepDiveId) {
        formData.append('deepDiveId', deepDiveId)
      }

      setProgress(30)

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      setProgress(60)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      setState('processing')
      setProgress(80)

      // The backend will process asynchronously, so we just acknowledge the upload
      const data = await response.json()

      setProgress(100)
      setState('complete')

      // Close dialog and refresh after a brief delay
      setTimeout(() => {
        onUploadComplete()
        onOpenChange(false)
        resetState()
      }, 1000)
    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
      setState('error')
    }
  }

  const handleClose = () => {
    if (state === 'uploading' || state === 'processing') {
      // Don't allow closing during upload
      return
    }
    onOpenChange(false)
    resetState()
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload a document to give Luna more context about your strategy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Selection */}
          {state === 'idle' && (
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Click to select a file</p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, DOC, DOCX, TXT, MD (max 10MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Selected File */}
          {selectedFile && state === 'selected' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50 overflow-hidden">
                <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSelectedFile(null)
                    setState('idle')
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Context Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Tell Luna about this document
                </label>
                <Textarea
                  placeholder="e.g., This is our competitor analysis from Q3, focusing on market positioning..."
                  value={uploadContext}
                  onChange={(e) => setUploadContext(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  This context helps Luna extract more relevant insights.
                </p>
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {(state === 'uploading' || state === 'processing') && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50 overflow-hidden">
                <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-sm font-medium truncate">{selectedFile?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {state === 'uploading' ? 'Uploading...' : 'Processing...'}
                  </p>
                </div>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Complete */}
          {state === 'complete' && (
            <div className="text-center py-4">
              <div className="h-12 w-12 rounded-full bg-green-100 text-green-600 mx-auto flex items-center justify-center mb-2">
                <FileText className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium">Upload complete!</p>
              <p className="text-xs text-muted-foreground">
                Luna is now processing your document.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          {state === 'idle' && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {state === 'selected' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleUpload}>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </>
          )}
          {state === 'error' && (
            <>
              <Button variant="outline" onClick={resetState}>
                Try Again
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
