'use client'

import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ImportBundleDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: (result: { fragmentsCreated: number; questionsAdded: number }) => void
}

export function ImportBundleDialog({
  projectId,
  open,
  onOpenChange,
  onImported,
}: ImportBundleDialogProps) {
  const [jsonText, setJsonText] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{
    themes: number
    questions: number
    tensions: number
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parseAndPreview = (text: string) => {
    setJsonText(text)
    setError(null)
    setPreview(null)

    if (!text.trim()) return

    try {
      const bundle = JSON.parse(text)
      const hasChunks = bundle.chunks && Array.isArray(bundle.chunks) && bundle.chunks.length > 0
      const hasThemes = bundle.themes && Array.isArray(bundle.themes) && bundle.themes.length > 0
      if (!hasChunks && !hasThemes) {
        setError('Bundle must contain a "chunks" or "themes" array')
        return
      }
      setPreview({
        themes: (bundle.chunks?.length || 0) + (bundle.themes?.length || 0),
        questions: bundle.openQuestions?.length || 0,
        tensions: bundle.tensions?.length || 0,
      })
    } catch {
      setError('Invalid JSON format')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      parseAndPreview(text)
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!jsonText.trim() || error) return

    setImporting(true)
    try {
      const bundle = JSON.parse(jsonText)
      const res = await fetch(`/api/project/${projectId}/import-bundle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bundle),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Import failed')
      }

      const result = await res.json()
      toast.success(`Imported ${result.fragmentsCreated} fragments`)
      onImported(result)
      onOpenChange(false)
      setJsonText('')
      setPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Context Bundle</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Paste a context bundle JSON or upload a .json file.{' '}
            <a href="https://lunastak.io/docs/install" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
              How to create your bundle &rarr;
            </a>
          </p>

          <textarea
            value={jsonText}
            onChange={(e) => parseAndPreview(e.target.value)}
            placeholder='{"version": "1.0", "framework": "decision-stack", "themes": [...]}'
            className="w-full h-48 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none"
          />

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3 w-3 mr-1" />
              Upload .json
            </Button>

            {preview && (
              <span className="text-sm text-muted-foreground">
                {preview.themes} themes, {preview.questions} questions, {preview.tensions} tensions
              </span>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!preview || importing}
              onClick={handleImport}
            >
              {importing ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
