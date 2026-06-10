 'use client'

 import { useState } from 'react'
 import { Sidebar } from './sidebar'

 interface MainLayoutProps {
   children: React.ReactNode
 }

 export function MainLayout({ children }: MainLayoutProps) {
   const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

   return (
     <div className="flex h-screen overflow-hidden bg-background">
       <Sidebar
         collapsed={sidebarCollapsed}
         onCollapse={setSidebarCollapsed}
         className="flex-shrink-0"
       />

       <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
         <div className="min-w-0 flex-1 overflow-y-auto">
           <div className="container mx-auto min-h-full p-6">{children}</div>
         </div>
       </main>
     </div>
   )
 }

