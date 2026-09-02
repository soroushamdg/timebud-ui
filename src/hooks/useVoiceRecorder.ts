'use client'

import { useCallback, useRef, useState } from 'react'

interface UseVoiceRecorderOptions {
  /** Number of pulsing amplitude rings to drive (see `ringRefs`). */
  ringCount?: number
  /** Called with the transcribed text once `/api/voice/transcribe` succeeds. */
  onTranscribed?: (text: string) => void
}

/**
 * Shared recording + live-amplitude-visualization + Whisper-transcription pipeline.
 * Extracted from QuickCaptureSheet so the chat screen's mic button can reuse the
 * exact same (already working) behavior instead of a second implementation.
 */
export function useVoiceRecorder({ ringCount = 3, onTranscribed }: UseVoiceRecorderOptions = {}) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const ringRefs = useRef<(HTMLDivElement | null)[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopAmplitudeLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    audioContextRef.current?.close().catch(() => {})
    audioContextRef.current = null
    analyserRef.current = null
    ringRefs.current.forEach((el) => {
      if (el) {
        el.style.transform = 'scale(1)'
        el.style.opacity = '0'
      }
    })
  }, [])

  const startAmplitudeLoop = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioContextRef.current = audioContext
      analyserRef.current = analyser

      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteTimeDomainData(data)
        let sumSquares = 0
        for (let i = 0; i < data.length; i++) {
          const centered = (data[i] - 128) / 128
          sumSquares += centered * centered
        }
        const rms = Math.sqrt(sumSquares / data.length)
        const level = Math.min(1, rms * 4)

        ringRefs.current.forEach((el, i) => {
          if (!el) return
          const scale = 1 + level * (1 + i * 0.7)
          const opacity = Math.max(0, 0.45 - i * 0.12) * Math.min(1, level * 3)
          el.style.transform = `scale(${scale})`
          el.style.opacity = String(opacity)
        })

        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      // Fail soft — the recording itself (via MediaRecorder) keeps working
      // even if the browser refuses to construct an AudioContext here.
    }
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
    clearTimer()
  }, [clearTimer])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        stopAmplitudeLoop()
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setIsTranscribing(true)
        setError(null)
        try {
          const formData = new FormData()
          formData.append('audio', blob, 'recording.webm')
          const res = await fetch('/api/voice/transcribe', { method: 'POST', body: formData })
          const json = await res.json()
          if (!json.success) throw new Error(json.error?.message || 'Failed to transcribe')
          onTranscribed?.(json.text)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to transcribe audio')
        } finally {
          setIsTranscribing(false)
        }
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
      setElapsedSeconds(0)
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000)
      startAmplitudeLoop(stream)
    } catch {
      setError('Microphone access is required for voice capture')
    }
  }, [onTranscribed, startAmplitudeLoop, stopAmplitudeLoop])

  const toggle = useCallback(() => {
    if (isRecording) {
      stop()
    } else {
      start()
    }
  }, [isRecording, start, stop])

  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'

  return {
    isRecording,
    isTranscribing,
    elapsedSeconds,
    error,
    ringRefs,
    ringCount,
    isSupported,
    start,
    stop,
    toggle,
  }
}
