'use client';
import { useState, useEffect, useMemo } from 'react';
import { NotebookPen, Sparkles, Trash2, Edit3, Search, Tag, FolderOpen, PlusCircle, Check } from 'lucide-react';

interface Memory { 
  id: string; 
  content: string; 
  category: string; 
  tags: string; 
  createdAt: string; 
}

const CATEGORIES = ['General', 'Work', 'Personal', 'Preferences', 'Custom'];

export default function NotesPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');
  const [tags, setTags] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/memory');
        if (res.ok) { 
          const data = await res.json(); 
          setMemories(data || []); 
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true); 
    setMessage('');
    
    const url = '/api/memory';
    const method = editingId ? 'PUT' : 'POST';
    const bodyPayload = editingId 
      ? { id: editingId, content, category, tags } 
      : { content, category, tags };

    try {
      const res = await fetch(url, {
        method, 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(bodyPayload),
      });
      if (res.ok) {
        const data = await res.json();
        setContent(''); 
        setCategory('General');
        setTags('');
        
        if (editingId) {
          setMemories(prev => prev.map(m => m.id === editingId ? data : m));
          setEditingId(null);
          setMessage('Memory updated successfully!');
        } else {
          setMemories(prev => [data, ...prev]);
          setMessage('Memory saved!');
        }
      } else {
        setMessage(editingId ? 'Failed to update memory.' : 'Failed to save memory.');
      }
    } catch {
      setMessage('An error occurred.');
    } finally { 
      setSubmitting(false); 
    }
  };

  const startEdit = (mem: Memory) => {
    setEditingId(mem.id);
    setContent(mem.content);
    setCategory(mem.category);
    setTags(mem.tags);
    setMessage('');
    // Scroll to form on mobile devices
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setContent('');
    setCategory('General');
    setTags('');
    setMessage('');
  };

  const deleteMemory = async (id: string) => {
    try {
      const res = await fetch(`/api/memory?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMemories(prev => prev.filter(m => m.id !== id));
        if (editingId === id) cancelEdit();
      }
    } catch {}
  };

  // Compile list of unique tags for search filters
  const allUniqueTags = useMemo(() => {
    const set = new Set<string>();
    memories.forEach(m => {
      if (!m.tags) return;
      m.tags.split(',').map(t => t.trim().toLowerCase()).forEach(t => {
        if (t) set.add(t);
      });
    });
    return Array.from(set);
  }, [memories]);

  // Filter memories based on search query, category dropdown, and selected tag badge
  const filteredMemories = useMemo(() => {
    return memories.filter(m => {
      const matchesSearch = m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            m.tags.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            m.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategoryFilter === 'All' || m.category === selectedCategoryFilter;
      
      const matchesTag = !selectedTagFilter || 
                         m.tags.split(',').map(t => t.trim().toLowerCase()).includes(selectedTagFilter);

      return matchesSearch && matchesCategory && matchesTag;
    });
  }, [memories, searchQuery, selectedCategoryFilter, selectedTagFilter]);

  return (
    <div className="dashboard-subpage overflow-y-auto max-h-full pb-12">
      <div className="subpage-header">
        <h1 className="subpage-title flex items-center gap-2">
          <NotebookPen className="text-accent" size={24} />
          <span>Notes & Memory Bank</span>
        </h1>
        <p className="subpage-description">Inject facts and instructions that ORION references dynamically across chat turns.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 max-w-6xl">
        {/* Left Form: Add / Edit Note */}
        <div className="gemini-card p-6 self-start">
          <h2 className="gemini-card-title flex items-center gap-2 mb-4">
            <PlusCircle size={16} className="text-accent" />
            <span>{editingId ? 'Edit Memory Details' : 'Record a new note'}</span>
          </h2>
          {message && (
            <div className={message.includes('Failed') || message.includes('error') ? 'auth-error mb-3' : 'auth-success mb-3'}>
              {message}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="form-label text-xs">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-accent transition-colors"
                disabled={submitting}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label text-xs">Tags (comma separated)</label>
              <input
                type="text"
                className="form-input"
                placeholder="coding, preferences, work"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label text-xs">Memory content</label>
              <textarea
                className="form-input min-h-[120px] resize-y"
                placeholder="Remember that I work as a frontend dev..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" className="auth-button flex-1" disabled={submitting}>
                {submitting ? 'Saving...' : editingId ? 'Update Memory' : 'Add Note'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-4 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-surface-2 transition-colors text-muted hover:text-foreground"
                  disabled={submitting}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Right Pane: Search, Tags, Memory Grid */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                type="text"
                placeholder="Search notes content, categories, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent"
              />
            </div>

            {/* Category Filter */}
            <div className="w-full sm:w-[160px]">
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent transition-colors"
              >
                <option value="All">All Categories</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags list filter */}
          {allUniqueTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap border-b border-border pb-3">
              <span className="text-xs text-muted flex items-center gap-1 mr-1">
                <Tag size={12} />
                <span>Quick Tags:</span>
              </span>
              <button
                onClick={() => setSelectedTagFilter(null)}
                className={[
                  'text-[10px] font-bold px-2 py-0.5 rounded-full transition-all border uppercase',
                  !selectedTagFilter
                    ? 'bg-accent text-accent-foreground border-accent'
                    : 'bg-transparent text-muted border-border hover:bg-surface-2 hover:text-foreground'
                ].join(' ')}
              >
                All
              </button>
              {allUniqueTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTagFilter(tag)}
                  className={[
                    'text-[10px] font-bold px-2.5 py-0.5 rounded-full transition-all border uppercase flex items-center gap-0.5',
                    selectedTagFilter === tag
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'bg-transparent text-muted border-border hover:bg-surface-2 hover:text-foreground'
                  ].join(' ')}
                >
                  <span>{tag}</span>
                  {selectedTagFilter === tag && <Check size={8} />}
                </button>
              ))}
            </div>
          )}

          {/* Memories Card Grid */}
          <div>
            {loading ? (
              <div className="flex items-center gap-3 text-muted py-16 justify-center">
                <Sparkles size={18} className="animate-spin-slow text-accent" />
                <span className="text-sm">Loading memories...</span>
              </div>
            ) : filteredMemories.length === 0 ? (
              <div className="text-center py-16 text-sm text-muted border border-dashed border-border rounded-xl">
                No matching memories found. Add notes on the left or try another search query.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredMemories.map((mem) => {
                  const tagList = mem.tags.split(',').map(t => t.trim()).filter(Boolean);
                  const isEditing = mem.id === editingId;
                  return (
                    <div 
                      key={mem.id} 
                      className={[
                        'gemini-card p-5 relative group transition-all border-l-4',
                        isEditing ? 'border-accent shadow-md shadow-accent/5 scale-[1.01]' : 'border-l-indigo-400'
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-2 border border-border text-muted uppercase flex items-center gap-1">
                          <FolderOpen size={10} />
                          <span>{mem.category}</span>
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => startEdit(mem)}
                            title="Edit Note"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:bg-surface-2 hover:text-foreground transition-all"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button 
                            onClick={() => deleteMemory(mem.id)}
                            title="Delete Note"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:bg-danger/15 hover:text-danger transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <p className="text-base text-foreground leading-relaxed break-words whitespace-pre-wrap pr-2">{mem.content}</p>
                      
                      <div className="flex items-center justify-between flex-wrap gap-2 mt-4 pt-3 border-t border-border/60">
                        {tagList.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {tagList.map((tag, idx) => (
                              <span key={idx} className="text-[10px] font-medium text-accent bg-accent-soft rounded px-1.5 py-0.5">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        ) : <span />}
                        <span className="text-[10px] font-medium text-muted">{new Date(mem.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
