'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface InlineTextEditorProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  onCancel: () => void;
  placeholder?: string;
  minRows?: number;
}

export function InlineTextEditor({
  value,
  onSave,
  onCancel,
  placeholder = 'Enter text...',
  minRows = 3,
}: InlineTextEditorProps) {
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    // Move cursor to end
    const length = text.length;
    textareaRef.current?.setSelectionRange(length, length);
  }, []);

  const handleSave = async () => {
    if (text.trim() === value.trim()) {
      onCancel();
      return;
    }
    setSaving(true);
    try {
      await onSave(text.trim());
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
    // Cmd/Ctrl + Enter to save
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="space-y-3">
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={minRows}
        className="w-full resize-none text-base leading-relaxed"
        disabled={saving}
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !text.trim()}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Press Esc to cancel, ⌘+Enter to save
      </p>
    </div>
  );
}
