'use client';

import { useChatStore } from '@/store/chatStore';
import { Plus, Trash2, Search, Settings, PanelLeftClose, PanelLeft } from 'lucide-react';

import { useState } from 'react';

export default function Sidebar() {
  const {
    sidebarExpanded,
    toggleSidebar,
    chatSessions,
    activeChatId,
    setActiveChatId,
    createNewChat,
    deleteChat,
    searchQuery,
    setSearchQuery,
    clearAllChats,
  } = useChatStore();

  const [showSettings, setShowSettings] = useState(false);

  // Filter sessions by search query
  const filteredSessions = chatSessions.filter((session) =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Mobile Sidebar Backdrop Overlay */}
      {sidebarExpanded && (
        <div
          onClick={() => toggleSidebar()}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300"
        />
      )}

      {/* Sidebar Panel Container */}
      <aside
        className={`fixed md:relative top-0 bottom-0 left-0 z-40 bg-slate-50 dark:bg-slate-950/65 backdrop-blur-xl flex flex-col transition-all duration-300 ease-in-out select-none ${
          sidebarExpanded 
            ? 'w-[240px] translate-x-0 border-r border-slate-200/80 dark:border-slate-800/40' 
            : 'w-0 -translate-x-full md:w-0 md:-translate-x-full overflow-hidden'
        }`}
      >
        {/* Header Block */}
        <div className="p-3 flex items-center justify-between gap-1 border-b border-slate-200/60 dark:border-slate-900/60 h-12 flex-shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
              <img src="/Y-Health.png" alt="Y-Health Logo" className="w-full h-full object-contain invert dark:invert-0" />
            </div>
            <span className="font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap text-xs tracking-wide">
              YHealth AI
            </span>
          </div>

          <button
            onClick={toggleSidebar}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900/80 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            title="Collapse Sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Action Controls */}
        <div className="p-3 flex flex-col gap-2.5 flex-shrink-0">
          {/* New Chat Button */}
          <button
            onClick={() => {
              createNewChat();
              if (window.innerWidth < 768) {
                toggleSidebar();
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#131b2e] text-white font-semibold text-xs hover:bg-[#1b2a47] border border-[#233356]/40 active:scale-98 transition-all shadow-md"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Consultation</span>
          </button>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search history..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 text-slate-850 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
        </div>

        {/* Scrollable Consultation list */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-2 space-y-1 py-1">
          {filteredSessions.length > 0 ? (
            filteredSessions.map((session) => {
              const isActive = session.id === activeChatId;
              return (
                <div
                  key={session.id}
                  className={`group relative flex items-center justify-between rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100/60 dark:border-indigo-900/20 font-semibold'
                      : 'hover:bg-slate-100/70 dark:hover:bg-slate-900/40 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <button
                    onClick={() => {
                      setActiveChatId(session.id);
                      if (window.innerWidth < 768) {
                        toggleSidebar();
                      }
                    }}
                    className="flex-1 text-left px-3 py-2 overflow-hidden text-xs whitespace-nowrap text-ellipsis"
                  >
                    {session.title}
                  </button>

                  <div className="pr-1 flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(session.id);
                      }}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-850 text-slate-400 hover:text-rose-500 transition-colors"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-[10px]">
              No consultations found
            </div>
          )}
        </div>

        {/* Footer Area */}
        <div className="p-3 border-t border-slate-200/60 dark:border-slate-900/60 bg-slate-100/70 dark:bg-slate-950/50 backdrop-blur-md relative flex-shrink-0">
          
          {/* Settings Sub-Drawer */}
          {showSettings && (
            <div className="absolute bottom-16 left-3 right-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 shadow-xl z-50 flex flex-col gap-1.5 animate-slide-up">
              <h5 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-2.5 py-1 uppercase tracking-wider">
                Management
              </h5>
              <button
                onClick={() => {
                  if (confirm("Clear all consultations?")) {
                    clearAllChats();
                    setShowSettings(false);
                  }
                }}
                className="w-full text-left py-1.5 px-2.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-semibold transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All Conversations
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-1.5">
            {/* Minimal User Profile Card */}
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-650 dark:text-slate-350 flex-shrink-0">
                V
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap overflow-hidden text-ellipsis leading-tight">
                  Vishal Kumar
                </span>
                <span className="text-[8px] text-slate-400 dark:text-slate-500 whitespace-nowrap leading-none mt-0.5">
                  Premium Patient
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1.5 rounded-lg border text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all ${
                  showSettings 
                    ? 'bg-slate-100 dark:bg-slate-900 border-indigo-500' 
                    : 'bg-slate-100 dark:bg-slate-900 border-slate-200/50 dark:border-slate-800/60'
                }`}
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
