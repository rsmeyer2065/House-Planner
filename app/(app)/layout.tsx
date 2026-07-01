import { Nunito } from 'next/font/google'
import { Sidebar } from '@/components/sidebar'
import { MobileNav } from '@/components/mobile-nav'

export const dynamic = 'force-dynamic'

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-nunito',
})

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${nunito.variable} flex h-screen bg-[#e6d6ca] overflow-hidden font-[family-name:var(--font-nunito)]`}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto px-5 py-6 md:px-9 md:py-7 pb-24 md:pb-11">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
