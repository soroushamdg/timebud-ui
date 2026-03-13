import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { StaticAvatar } from '@/lib/avatars/config'

function generateLabelFromFilename(filename: string): string {
  const nameWithoutExt = filename.replace(/\.(png|jpg|jpeg|webp)$/i, '')
  const words = nameWithoutExt.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  )
  return words.join(' ')
}

function getStaticAvatars(): StaticAvatar[] {
  try {
    const avatarsDir = path.join(process.cwd(), 'public/project-avatars')
    const files = fs.readdirSync(avatarsDir)
    
    return files
      .filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file))
      .sort()
      .map((filename, index) => ({
        id: `static-${index + 1}`,
        filename,
        label: generateLabelFromFilename(filename),
        path: `/project-avatars/${filename}`,
      }))
  } catch (error) {
    console.error('Failed to read static avatars directory:', error)
    return []
  }
}

export async function GET() {
  try {
    const avatars = getStaticAvatars()
    
    return NextResponse.json(avatars, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Failed to fetch static avatars:', error)
    return NextResponse.json(
      { error: 'Failed to fetch static avatars' },
      { status: 500 }
    )
  }
}
