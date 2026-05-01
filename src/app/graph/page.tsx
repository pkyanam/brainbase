import { Metadata } from "next";
import GraphClient from "./GraphClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Graph — Brainbase",
  description: "Explore your knowledge graph. Interactive 3D visualization of every person, company, and project in your brain.",
};

export default function GraphPage() {
  return <GraphClient />;
}
