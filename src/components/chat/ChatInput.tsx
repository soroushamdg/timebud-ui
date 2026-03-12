'use client'

import { useState, useRef, useEffect } from 'react'
import { Paperclip, Send, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface FilePreview {
  id: string
  filename: string
  mimeType: string
  base64: string
  url?: string
  uploadProgress: number
}

interface ChatInputProps {
  onSend: (message: string, files?: FilePreview[]) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ onSend, disabled, placeholder = 'Ask me anything...' }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<FilePreview[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const newHeight = Math.min(textarea.scrollHeight, 96) // max 4 rows (~96px)
      textarea.style.height = `${newHeight}px`
    }
  }, [message])

  const handleSend = () => {
    if (!message.trim() && files.length === 0) return
    if (disabled) return

    onSend(message.trim(), files)
    setMessage('')
    setFiles([])

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    for (const file of selectedFiles) {
      const fileId = crypto.randomUUID()
      const filePreview: FilePreview = {
        id: fileId,
        filename: file.name,
        mimeType: file.type,
        base64: '',
        uploadProgress: 0,
      }

      setFiles(prev => [...prev, filePreview])

      // Convert to base64
      const reader = new FileReader()
      reader.onload = async (event) => {
        const base64 = event.target?.result as string

        // Upload to Supabase Storage
        const filePath = `chat-attachments/${user.id}/${fileId}-${file.name}`
        const { data, error } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (!error && data) {
          const { data: urlData } = supabase.storage
            .from('chat-attachments')
            .getPublicUrl(filePath)

          setFiles(prev =>
            prev.map(f =>
              f.id === fileId
                ? { ...f, base64, url: urlData.publicUrl, uploadProgress: 100 }
                : f
            )
          )
        } else {
          // Upload failed, just use base64
          setFiles(prev =>
            prev.map(f =>
              f.id === fileId ? { ...f, base64, uploadProgress: 100 } : f
            )
          )
        }
      }
      reader.readAsDataURL(file)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  return (
    <div className="border-t border-border-card bg-bg-primary p-4">
      {/* File previews */}
      {files.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide">
          {files.map(file => (
            <div
              key={file.id}
              className="bg-bg-card border border-border-card rounded-lg px-3 py-2 flex items-center gap-2 whitespace-nowrap flex-shrink-0"
            >
              <Paperclip className="w-4 h-4 text-text-sec" />
              <span className="text-sm text-white">{file.filename}</span>
              {file.uploadProgress < 100 && (
                <span className="text-xs text-text-sec">{file.uploadProgress}%</span>
              )}
              <button
                onClick={() => removeFile(file.id)}
                className="text-text-sec hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        {/* File attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="w-10 h-10 rounded-full bg-bg-card border border-border-card flex items-center justify-center text-text-sec hover:text-white hover:bg-bg-card-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.png,.jpg,.jpeg"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-bg-card border border-border-card rounded-2xl px-4 py-3 text-white placeholder-text-sec resize-none focus:outline-none focus:ring-2 focus:ring-accent-yellow disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ maxHeight: '96px' }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={disabled || (!message.trim() && files.length === 0)}
          className="w-10 h-10 rounded-full bg-accent-yellow flex items-center justify-center text-black hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
