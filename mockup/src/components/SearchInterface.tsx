"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Sparkles, ArrowRight, Brain } from "lucide-react";
import { clsx } from "clsx";

export default function SearchInterface() {
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState("");

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[70vh] z-10 relative pointer-events-auto px-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-8 w-full"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl shadow-purple-500/10 mb-2">
            <Brain className="w-10 h-10 text-[#8b5cf6]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white via-white/90 to-white/50">
            What do you want to know?
          </h1>
          <p className="text-white/50 text-lg max-w-lg">
            Search your knowledge graph, find connections, or ask questions about your data.
          </p>
        </div>
        
        <div 
          className={clsx(
            "w-full relative transition-all duration-500",
            focused ? "scale-[1.02]" : "scale-100"
          )}
        >
          {focused && (
            <div className="absolute inset-0 bg-gradient-to-r from-[#8b5cf6] to-[#3b82f6] blur-2xl opacity-20 rounded-3xl transition-opacity duration-500" />
          )}
          <div className="relative flex items-center bg-surface/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 shadow-2xl group hover:border-white/20 transition-colors">
            <Search className="w-6 h-6 text-white/40 ml-4 mr-2 group-hover:text-[#3b82f6] transition-colors" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Ask the Brainbase..."
              className="flex-1 bg-transparent text-white placeholder-white/30 text-lg outline-none py-4 px-2"
            />
            <AnimatePresence>
              {query && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="mr-2 p-3 bg-gradient-to-br from-[#3b82f6] to-[#2563eb] hover:from-[#60a5fa] hover:to-[#3b82f6] rounded-xl text-white shadow-lg shadow-blue-500/25 transition-all"
                >
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mt-4">
          {["who do I know at Apple?", "latest papers on RAG", "brain health status"].map((suggestion, i) => (
            <button 
              key={i}
              onClick={() => setQuery(suggestion)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-surface/50 hover:bg-white/10 text-white/70 hover:text-white text-sm transition-all backdrop-blur-xl"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#8b5cf6]" />
              {suggestion}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
