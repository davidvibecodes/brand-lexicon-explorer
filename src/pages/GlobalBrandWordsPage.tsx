import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Pencil, Trash2, Eye } from "lucide-react";
import AddBrandWordPanel from "@/components/AddBrandWordPanel";
import { extractWordFromUri } from "@/lib/conceptnet";
import type { BrandWord } from "@/lib/conceptnet";

export default function GlobalBrandWordsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const brandWords = useQuery(api.brandWords.listGlobal);
  const deleteBrandWord = useMutation(api.brandWords.remove);

  const isAdmin = user?.role === "admin";

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
    navigate(`/?word=${encodeURIComponent(word.text)}&mode=global`);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Global Brand Words</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isAdmin
                ? "Manage the shared brand words catalog"
                : "Browse the shared catalog of brand words"}
            </p>
          </div>
          {isAdmin && (
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
          )}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter the shared catalog…"
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
                ? "Nothing matches what you searched for."
                : "No shared brand words yet. Admins can add the first ones."}
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
                        {isAdmin && (
                          <>
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
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Panel (admin only) */}
      {isAdmin && (
        <AddBrandWordPanel
          isOpen={panelOpen}
          onClose={() => {
            setPanelOpen(false);
            setEditingWord(null);
          }}
          editWord={editingWord}
          mode="global"
          onSaved={() => {
            setPanelOpen(false);
            setEditingWord(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog (admin only) */}
      {deleteConfirm && isAdmin && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center">
          <div className="bg-background border border-border rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-semibold mb-2">Remove this from the shared catalog?</h3>
            <p className="text-sm text-muted-foreground mb-5">This can't be undone. The brand word and all its concept associations will be removed from the shared catalog.
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
