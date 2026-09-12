import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Pencil, Trash2, Eye, LogIn } from "lucide-react";
import AddBrandWordPanel from "@/components/AddBrandWordPanel";
import { extractWordFromUri } from "@/lib/conceptnet";
import type { BrandWord } from "@/lib/conceptnet";

export default function MyBrandWordsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const brandWords = useQuery(api.brandWords.listPersonal);
  const deleteBrandWord = useMutation(api.brandWords.remove);

  const [searchQuery, setSearchQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingWord, setEditingWord] = useState<BrandWord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filteredWords = useMemo(() => {
    if (!brandWords) return [];
    if (!searchQuery) return brandWords;
    const q = searchQuery.toLowerCase();
    return brandWords.filter((w) => w.text.toLowerCase().includes(q));
  }, [brandWords, searchQuery]);

  const handleDelete = async (id: string) => {
    try {
      await deleteBrandWord({ id: id as any });
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleEdit = (word: BrandWord) => {
    setEditingWord(word);
    setPanelOpen(true);
  };

  const handleViewGraph = (word: BrandWord) => {
    // Navigate to lexicon centered on this word
    navigate(`/?word=${encodeURIComponent(word.text)}`);
  };

  // Not signed in state
  if (!isLoading && !isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <LogIn className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Sign in to see your brand words</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Create an account to save and manage the words and concepts you want to associate with your brand.
          </p>
          <Button onClick={() => navigate("/auth?returnTo=/my-brand-words")}>
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">My Brand Words</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              A personal catalog of the words you've connected to your brand
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingWord(null);
              setPanelOpen(true);
            }}
            style={{ backgroundColor: "#107C10" }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter your brand words…"
            className="pl-9"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {brandWords === undefined ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            Loading…
          </div>
        ) : filteredWords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">
              {searchQuery
                ? "No brand words match what you searched for."
                : "You haven't added any brand words yet. Create your first one to start building your catalog."}
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium">Word</th>
                  <th className="text-left px-4 py-2.5 font-medium">Primary Association</th>
                  <th className="text-left px-4 py-2.5 font-medium">Secondaries</th>
                  <th className="text-left px-4 py-2.5 font-medium">Last Edited</th>
                  <th className="text-right px-4 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredWords.map((word) => (
                  <tr key={word._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{word.text}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {extractWordFromUri(word.primary_association_uri)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {word.secondary_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(word.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleViewGraph(word)}
                          title="View as graph"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEdit(word)}
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirm(word._id)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Panel */}
      <AddBrandWordPanel
        isOpen={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setEditingWord(null);
        }}
        editWord={editingWord}
        mode="personal"
        onSaved={() => {
          setPanelOpen(false);
          setEditingWord(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center">
          <div className="bg-background border border-border rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-semibold mb-2">Delete this brand word?</h3>
            <p className="text-sm text-muted-foreground mb-5">This can't be undone. The brand word and all of its concept associations will be permanently removed.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
