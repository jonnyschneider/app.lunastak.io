'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BadgeInfo } from 'lucide-react';

interface InlineTextEditorProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  onCancel: () => void;
  placeholder?: string;
  minRows?: number;
  coachingTip?: string;
  darkMode?: boolean;
}

export function InlineTextEditor({
  value,
  onSave,
  onCancel,
  placeholder = 'Enter text...',
  minRows = 3,
  coachingTip,
  darkMode = false,
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
      {/* Coaching callout */}
      {coachingTip && (
        <div className="bg-luna-light border-l-2 border-l-luna pl-3 pr-4 py-2 rounded-[4px] flex items-start gap-2 w-fit">
          <BadgeInfo className="w-4 h-4 text-luna-dark mt-0.5 shrink-0" />
          <p className="text-sm text-luna-dark italic">
            {coachingTip}
          </p>
        </div>
      )}

      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={minRows}
        className="w-full resize-none text-base leading-relaxed bg-white border-border focus-visible:ring-luna-dark focus-visible:border-luna-dark"
        disabled={saving}
      />

      <div className="flex items-center justify-between">
        <p className={`text-xs ${darkMode ? 'text-white/60' : 'text-muted-foreground'}`}>
          Esc to cancel · ⌘+Enter to save
        </p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={saving}
            className={darkMode ? 'text-white hover:bg-white/10 hover:text-white' : ''}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className={darkMode ? 'bg-ds-neon text-ds-teal hover:bg-ds-neon/90' : ''}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
