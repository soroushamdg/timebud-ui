'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface EditProfileDialogProps {
  isOpen: boolean
  onClose: () => void
  currentFirstName: string
  currentLastName: string
  onSave: (firstName: string, lastName: string) => void
}

export function EditProfileDialog({ 
  isOpen, 
  onClose, 
  currentFirstName, 
  currentLastName, 
  onSave 
}: EditProfileDialogProps) {
  const [firstName, setFirstName] = useState(currentFirstName || '')
  const [lastName, setLastName] = useState(currentLastName || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(firstName, lastName)
      onClose()
    } catch (error) {
      console.error('Failed to save profile:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setFirstName(currentFirstName || '')
    setLastName(currentLastName || '')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-bg-card rounded-none w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-card">
          <h2 className="text-white font-bold text-lg">Edit Profile</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg bg-bg-card-hover flex items-center justify-center text-text-sec hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm text-text-sec mb-2 block">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter first name"
              className="w-full bg-bg-primary border border-border-card rounded-lg px-4 py-3 text-white placeholder:text-text-sec focus:outline-none focus:ring-2 focus:ring-accent-yellow"
            />
          </div>

          <div>
            <label className="text-sm text-text-sec mb-2 block">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Enter last name"
              className="w-full bg-bg-primary border border-border-card rounded-lg px-4 py-3 text-white placeholder:text-text-sec focus:outline-none focus:ring-2 focus:ring-accent-yellow"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t border-border-card">
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="flex-1 bg-bg-primary border border-border-card text-white font-semibold py-3 rounded-lg hover:bg-bg-card-hover transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || (!firstName.trim() && !lastName.trim())}
            className="flex-1 bg-accent-yellow text-black font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
