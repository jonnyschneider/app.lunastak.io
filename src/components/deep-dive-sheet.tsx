// src/components/deep-dive-sheet.tsx
'use client'

import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Item,
  ItemGroup,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemSeparator,
} from '@/components/ui/item'
import {
  MessageSquare,
  Upload,
  FileText,
  ArrowRight,
  Loader2,
  NotebookPen,
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
  onStartChat: (deepDiveId: string) => void
  onUploadDoc: (deepDiveId: string) => void
  onViewConversation: (conversationId: string) => void
}

export function DeepDiveSheet({
  deepDiveId,
  open,
  onOpenChange,
  onStartChat,
  onUploadDoc,
  onViewConversation,
}: DeepDiveSheetProps) {
  const [deepDive, setDeepDive] = useState<DeepDiveDetail | null>(null)
  const [conversations, setConversations] = useState<DeepDiveConversation[]>([])
  const [documents, setDocuments] = useState<DeepDiveDocument[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAllDocs, setShowAllDocs] = useState(false)
  const [showAllChats, setShowAllChats] = useState(false)

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const originLabel = {
    manual: 'Manually created',
    message: 'From conversation',
    document: 'From document',
  }

  const ITEM_LIMIT = 3

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
              <SheetTitle>{deepDive.topic}</SheetTitle>
              <SheetDescription>
                {originLabel[deepDive.origin as keyof typeof originLabel] || deepDive.origin} on {formatDate(deepDive.createdAt)}
              </SheetDescription>
            </SheetHeader>

            {deepDive.notes && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">{deepDive.notes}</p>
              </div>
            )}

            {/* Tabbed content */}
            <Tabs defaultValue="chats" className="mt-6">
              <div className="border-b">
                <TabsList className="h-10 bg-transparent p-0 gap-4">
                  <TabsTrigger
                    value="chats"
                    className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-green-600 data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Chats
                    {conversations.length > 0 && (
                      <span className="ml-1.5 h-5 min-w-5 rounded-full px-1 font-mono tabular-nums text-xs bg-muted flex items-center justify-center">
                        {conversations.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="docs"
                    className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-green-600 data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Docs & Memos
                    {documents.length > 0 && (
                      <span className="ml-1.5 h-5 min-w-5 rounded-full px-1 font-mono tabular-nums text-xs bg-muted flex items-center justify-center">
                        {documents.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Documents & Memos Tab */}
              <TabsContent value="docs" className="mt-4">
                {documents.length > 0 ? (
                  <>
                    <ItemGroup>
                      {(showAllDocs ? documents : documents.slice(0, ITEM_LIMIT)).map((doc, index) => (
                        <div key={doc.id}>
                          {index > 0 && <ItemSeparator />}
                          <Item size="sm">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <ItemContent>
                              <ItemTitle className="text-xs truncate">{doc.fileName}</ItemTitle>
                              <ItemDescription className="text-xs">
                                {doc.status === 'complete' ? 'Processed' : doc.status}
                              </ItemDescription>
                            </ItemContent>
                          </Item>
                        </div>
                      ))}
                      {documents.length > ITEM_LIMIT && (
                        <>
                          <ItemSeparator />
                          <div className="px-4 py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-muted-foreground"
                              onClick={() => setShowAllDocs(!showAllDocs)}
                            >
                              {showAllDocs ? 'Show less' : `Show ${documents.length - ITEM_LIMIT} more`}
                            </Button>
                          </div>
                        </>
                      )}
                    </ItemGroup>
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => onUploadDoc(deepDive.id)}>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Doc
                      </Button>
                      <Button size="sm" variant="outline" disabled>
                        <NotebookPen className="h-4 w-4 mr-2" />
                        Add Memo
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground mb-4">No documents or memos yet</p>
                    <div className="flex gap-2 justify-center">
                      <Button size="sm" onClick={() => onUploadDoc(deepDive.id)}>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Doc
                      </Button>
                      <Button size="sm" variant="outline" disabled>
                        <NotebookPen className="h-4 w-4 mr-2" />
                        Add Memo
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Chats Tab */}
              <TabsContent value="chats" className="mt-4">
                {conversations.length > 0 ? (
                  <>
                    <ItemGroup>
                      {(showAllChats ? conversations : conversations.slice(0, ITEM_LIMIT)).map((conv, index) => (
                        <div key={conv.id}>
                          {index > 0 && <ItemSeparator />}
                          <Item
                            size="sm"
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => onViewConversation(conv.id)}
                          >
                            <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                            <ItemContent>
                              <ItemTitle className="text-xs">{formatDate(conv.createdAt)}</ItemTitle>
                              <ItemDescription className="text-xs">
                                {conv.messageCount} messages
                              </ItemDescription>
                            </ItemContent>
                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          </Item>
                        </div>
                      ))}
                      {conversations.length > ITEM_LIMIT && (
                        <>
                          <ItemSeparator />
                          <div className="px-4 py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-muted-foreground"
                              onClick={() => setShowAllChats(!showAllChats)}
                            >
                              {showAllChats ? 'Show less' : `Show ${conversations.length - ITEM_LIMIT} more`}
                            </Button>
                          </div>
                        </>
                      )}
                    </ItemGroup>
                    <div className="mt-4">
                      <Button size="sm" onClick={() => onStartChat(deepDive.id)}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        New Chat
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground mb-4">No chats yet</p>
                    <Button size="sm" onClick={() => onStartChat(deepDive.id)}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Start Chat
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
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
