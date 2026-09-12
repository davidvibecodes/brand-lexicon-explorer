import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Network, Tags, Globe, Sparkles } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
               style={{ backgroundColor: "#0F6CBD" }}>
            BL
          </div>
          <span className="text-lg font-semibold tracking-tight">
            BrandLexicon
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate("/auth")}>
            Sign in
          </Button>
          <Button onClick={() => navigate("/")} style={{ backgroundColor: "#0F6CBD" }}>
            Explore Lexicon
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-3xl text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-xs text-muted-foreground mb-6">
            <Sparkles className="h-3 w-3" />
            Powered by ConceptNet 5
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight mb-6">
            Node Words For Your Brand
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
            Explore words as nodes in a living knowledge graph. Build associations between concepts and your brand to create a custom language map that's uniquely yours.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate("/")}
              className="px-8 h-12 text-base"
              style={{ backgroundColor: "#0F6CBD" }}
            >
              Start Exploring
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/auth?returnTo=/my-brand-words")}
              className="px-8 h-12 text-base"
            >
              Create Account
            </Button>
          </div>
        </motion.div>

        {/* Feature Cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="max-w-4xl w-full mt-20 grid grid-cols-1 sm:grid-cols-3 gap-5"
        >
          <FeatureCard
            icon={<Network className="h-5 w-5" />}
            title="Visual Word Network"
            description="Navigate a force-directed graph of related concepts. Pan, zoom, and double-click to explore deeper connections."
            color="#0F6CBD"
          />
          <FeatureCard
            icon={<Tags className="h-5 w-5" />}
            title="Your Brand Words"
            description="Connect your brand to concepts in the graph. Every association you save becomes part of your personal workspace."
            color="#107C10"
          />
          <FeatureCard
            icon={<Globe className="h-5 w-5" />}
            title="Shared Catalog"
            description="Browse globally shared brand words created by others. Admins can add and manage shared entries for everyone to explore."
            color="#6B5CE7"
          />
        </motion.div>
      </section>

      {/* Attribution Footer */}
      <footer className="px-6 py-4 border-t border-border/50 text-center text-xs text-muted-foreground">
        Word data from ConceptNet 5, used under CC BY-SA 4.0.
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="p-5 rounded-xl border border-border bg-card hover:shadow-md transition-shadow"
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {icon}
      </div>
      <h3 className="font-semibold text-sm mb-1.5">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}
