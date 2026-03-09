'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'

export default function ChatPage() {
  const [messages] = useState([
    { id: 1, text: "Welcome to TimeBud Chat! How can I help you today?", sender: "bot" },
    { id: 2, text: "I need help planning my focus session", sender: "user" },
    { id: 3, text: "I can help you with that! Let's check your current tasks and projects.", sender: "bot" },
  ])

  return (
    <AppShell>
      <div className="flex-1 flex flex-col bg-black">
        {/* Header */}
        <div className="bg-[#1A1A1A] border-b border-[#333333] px-4 py-3">
          <h1 className="text-white text-lg font-semibold">Chat</h1>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] px-4 py-2 rounded-none ${
                  message.sender === 'user'
                    ? 'bg-[#FFD233] text-black'
                    : 'bg-[#2A2A2A] text-white'
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="bg-[#1A1A1A] border-t border-[#333333] p-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Type a message..."
              className="flex-1 bg-[#2A2A2A] text-white px-4 py-2 rounded-none border border-[#333333] focus:outline-none focus:border-[#FFD233]"
            />
            <button className="bg-[#FFD233] text-black px-4 py-2 rounded-none font-medium">
              Send
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
