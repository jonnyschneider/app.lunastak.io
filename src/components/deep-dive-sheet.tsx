// src/components/deep-dive-sheet.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare,
  Upload,
  FileText,
  ArrowRight,
  Loader2,
  CheckCircle2,
} from 'lucide-react'

interface DeepDiveConversation {
  id: string
  createdAt: string
  updatedAt: string
  status: string
  messageCount: number
}

interface DeepDiveDocument {
  id: string
  fileName: string
  fileType: string
  status: string
  createdAt: string
}

interface DeepDiveDetail {
  id: string
  projectId: string
  topic: string
  notes: string | null
  status: string
  origin: string
  createdAt: string
}

interface DeepDiveSheetProps {
  deepDiveId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onResolve: () => void
  onStartChat: (deepDiveId: string) => void
  onUploadDoc: (deepDiveId: string) => void
}

export function DeepDiveSheet({
  deepDiveId,
  open,
  onOpenChange,
  onResolve,
  onStartChat,
  onUploadDoc,
}: DeepDiveSheetProps) {
  const [deepDive, setDeepDive] = useState<DeepDiveDetail | null>(null)
  const [conversations, setConversations] = useState<DeepDiveConversation[]>([])
  const [documents, setDocuments] = useState<DeepDiveDocument[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isResolving, setIsResolving] = useState(false)

  useEffect(() => {
    if (deepDiveId && open) {
      fetchDeepDive()
    }
  }, [deepDiveId, open])

  const fetchDeepDive = async () => {
    if (!deepDiveId) return
    setIsLoading(true)
    try {
      const response = await fetch(`/api/deep-dive/${deepDiveId}`)
      if (response.ok) {
        const data = await response.json()
        setDeepDive(data.deepDive)
        setConversations(data.conversations)
        setDocuments(data.documents)
      }
    } catch (err) {
      console.error('Error fetching deep dive:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResolve = async () => {
    if (!deepDiveId) return
    setIsResolving(true)
    try {
      const response = await fetch(`/api/deep-dive/${deepDiveId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      })
      if (response.ok) {
        onOpenChange(false)
        onResolve()
      }
    } catch (err) {
      console.error('Error resolving deep dive:', err)
    } finally {
      setIsResolving(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const originLabel = {
    manual: 'Manually created',
    message: 'From conversation',
    document: 'From document',
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : deepDive ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {deepDive.topic}
                <Badge variant={deepDive.status === 'active' ? 'default' : 'secondary'}>
                  {deepDive.status}
                </Badge>
              </SheetTitle>
              <SheetDescription>
                {originLabel[deepDive.origin as keyof typeof originLabel] || deepDive.origin} on {formatDate(deepDive.createdAt)}
              </SheetDescription>
            </SheetHeader>

            {deepDive.notes && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">{deepDive.notes}</p>
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <Button size="sm" onClick={() => onStartChat(deepDive.id)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                New Chat
              </Button>
              <Button size="sm" variant="outline" onClick={() => onUploadDoc(deepDive.id)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
              {deepDive.status === 'active' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResolve}
                  disabled={isResolving}
                >
                  {isResolving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Resolve
                </Button>
              )}
            </div>

            <div className="mt-6 space-y-4">
              {/* Conversations */}
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Conversations ({conversations.length})
                </h4>
                {conversations.length > 0 ? (
                  <div className="space-y-2">
                    {conversations.map((conv) => (
                      <Link
                        key={conv.id}
                        href={`/conversation/${conv.id}`}
                        className="flex items-center justify-between p-2 rounded border hover:bg-accent transition-colors text-sm"
                      >
                        <div>
                          <div className="text-xs font-medium">{formatDate(conv.createdAt)}</div>
                          <div className="text-xs text-muted-foreground">
                            {conv.messageCount} messages
                          </div>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No conversations yet</p>
                )}
              </div>

              {/* Documents */}
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Documents ({documents.length})
                </h4>
                {documents.length > 0 ? (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2 p-2 rounded border text-sm"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate flex-1 text-xs">{doc.fileName}</span>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {doc.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No documents yet</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Deep dive not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
