'use client'

import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, Check, ExternalLink } from 'lucide-react'
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
  const [importPhase, setImportPhase] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [imported, setImported] = useState<{ fragmentsCreated: number; questionsAdded: number } | null>(null)
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
    setImportPhase(`Tagging ${preview?.themes || 0} chunks with Luna's dimensions...`)
    try {
      const bundle = JSON.parse(jsonText)

      // Advance phase after a short delay — LLM tagging is the slow part,
      // fragment creation is now bulk and fast.
      const phaseTimer = setTimeout(() => {
        setImportPhase('Creating ground truths...')
      }, 8000)

      const res = await fetch(`/api/project/${projectId}/import-bundle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bundle),
      })

      clearTimeout(phaseTimer)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Import failed')
      }

      const result = await res.json()
      toast.success(`Imported ${result.fragmentsCreated} ground truths`, {
        description: result.questionsAdded > 0
          ? `Plus ${result.questionsAdded} open questions for Explore Next`
          : undefined,
      })
      setImported(result)
      setJsonText('')
      setPreview(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed'
      setError(message.includes('fetch') || message.includes('network')
        ? 'Connection lost during import. Your data is safe — try again.'
        : message)
    } finally {
      setImporting(false)
      setImportPhase(null)
    }
  }

  const handleClose = (open: boolean) => {
    if (!open) {
      // Defer parent refresh until dialog is being dismissed, so the success
      // state isn't torn down by a parent re-render mid-flow.
      if (imported) onImported(imported)
      setImported(null)
    }
    onOpenChange(open)
  }

  if (imported) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Context import successful</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{imported.fragmentsCreated} ground truths</span> added to your knowledge base
              {imported.questionsAdded > 0 && <> — plus <span className="font-semibold text-foreground">{imported.questionsAdded} open questions</span> for Explore Next</>}.
            </p>
            <p className="text-sm">
              Check what was extracted from your bundle, then build your strategy.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => handleClose(false)}>
                Show me
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Context Bundle</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/*
            ⚠ THIS DIALOG USED TO ASSUME YOU ALREADY HAD A BUNDLE.
            A first-timer was handed a textarea and a JSON placeholder, with the one thing they
            actually needed — how to make one — as a trailing link on a line of grey text. The
            steps are the content until there is something to import; after that they are in the
            way, so they collapse and the summary takes their place.
          */}
          {!preview && (
            <div className="rounded-lg border bg-muted/40 p-4">
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2.5">
                  <span className="font-mono text-xs text-foreground/50">1</span>
                  <span>Open Claude, ChatGPT or Gemini and run the Lunastak skill.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono text-xs text-foreground/50">2</span>
                  <span>Talk through your business. It hands you a context bundle.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono text-xs text-foreground/50">3</span>
                  <span>Paste it below, or upload the .json file.</span>
                </li>
              </ol>
              <a
                href="https://lunastak.io/docs/install"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80"
              >
                Set up the skill
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          <textarea
            value={jsonText}
            onChange={(e) => parseAndPreview(e.target.value)}
            placeholder='Paste your context bundle here'
            className="w-full h-40 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none"
          />

          {/*
            The validation summary is the best reassurance in this flow — it is the moment a user
            learns their bundle is good BEFORE committing to it. It used to be 11px grey beside the
            upload button. Now it is the thing that replaces the instructions.
          */}
          {preview && (
            <div className="flex items-start gap-2.5 rounded-lg border border-luna/40 bg-luna/5 p-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-luna" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Bundle looks good</p>
                <p className="text-muted-foreground">
                  {preview.themes} themes, {preview.questions} questions, {preview.tensions} tensions
                  {' '}— ready to import.
                </p>
              </div>
            </div>
          )}

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
                  {importPhase || 'Importing...'}
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
