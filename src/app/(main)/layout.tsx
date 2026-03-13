import { createClient } from '@/lib/supabase/server'
import { MainLayoutClient } from '@/components/layout/MainLayoutClient'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  return <MainLayoutClient>{children}</MainLayoutClient>
}
