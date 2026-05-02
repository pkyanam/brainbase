import BrainGraph from "@/components/BrainGraph";
import Sidebar from "@/components/Sidebar";
import SearchInterface from "@/components/SearchInterface";

export default function Home() {
  return (
    <main className="min-h-screen relative flex overflow-hidden bg-background">
      <BrainGraph />
      <Sidebar />
      
      <div className="flex-1 pl-[80px] md:pl-[280px] transition-all duration-300 relative z-10 flex flex-col justify-center">
        <SearchInterface />
        
        <div className="absolute bottom-6 w-full text-center text-white/30 text-sm flex items-center justify-center gap-2 pr-[80px] md:pr-[280px]">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Brainbase Knowledge Graph API • All systems nominal
        </div>
      </div>
    </main>
  );
}
